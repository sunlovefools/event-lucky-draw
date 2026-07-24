import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const SCRATCH = new URL("./", import.meta.url);
const WORKSPACE = new URL("../", import.meta.url);
const ENV_PATH = new URL(".env.local", WORKSPACE);
const DEFAULT_TARGET = "https://event-lucky-draw-git-master-sunlovefools-projects.vercel.app";
const DELEGATE_COUNT = 300;
const STATION_COUNT = 10;
const SCANNER_CONCURRENCY = 10;
const PREFIX = `LOADTEST-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-`;
const REPORT_PATH = new URL(`event-load-test-result-${PREFIX.slice(9, -1)}.json`, SCRATCH);

function parseEnv(text) {
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[line.slice(0, index).trim()] = value;
  }
  return result;
}

const env = parseEnv(await readFile(ENV_PATH, "utf8"));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
const TARGET = (env.LOAD_TEST_TARGET || DEFAULT_TARGET).replace(/\/$/, "");
const SHARED_DATABASE_MODE =
  process.argv.includes("--allow-shared-database") ||
  env.LOAD_TEST_ALLOW_SHARED_DATABASE?.toLowerCase() === "true";
const DRY_RUN = process.argv.includes("--dry-run");
if (!supabaseUrl || !anonKey || !bypassSecret) throw new Error("Required load-test environment values are missing.");

const supabaseHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
};
const targetHeaders = { "x-vercel-protection-bypass": bypassSecret };
const metrics = [];
const phases = [];
let createdStations = [];
let stationsUnderTest = [];
let delegates = [];
let sessions = [];
let cleanupComplete = false;
let stationSource = "unknown";

function emit(event, data = {}) {
  process.stdout.write(`${JSON.stringify({ event, at: new Date().toISOString(), ...data })}\n`);
}

async function rest(path, { method = "GET", body, prefer } = {}) {
  const headers = { ...supabaseHeaders };
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${method} ${path} failed (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function inBatches(items, batchSize, callback) {
  for (let offset = 0; offset < items.length; offset += batchSize) {
    await callback(items.slice(offset, offset + batchSize));
  }
}

async function runPool(items, concurrency, callback) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await callback(items[index], index);
    }
  });
  await Promise.all(workers);
}

function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

async function timedRequest(label, url, options = {}, validate) {
  const started = performance.now();
  let response;
  let bodyText = "";
  let error = null;
  try {
    response = await fetch(url, {
      ...options,
      headers: { ...targetHeaders, ...(options.headers ?? {}) },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    bodyText = await response.text();
    if (validate) validate(response, bodyText);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const entry = {
    label,
    ms: performance.now() - started,
    status: response?.status ?? 0,
    ok: !error && Boolean(response?.ok),
    error,
  };
  metrics.push(entry);
  return { response, bodyText, entry };
}

function requireHttpOk(response, bodyText) {
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
}

function requireScan(expectedDuplicate = false) {
  return (response, bodyText) => {
    requireHttpOk(response, bodyText);
    const body = JSON.parse(bodyText);
    if (!body.ok || Boolean(body.duplicate) !== expectedDuplicate) {
      throw new Error(`Unexpected scan response: ${bodyText.slice(0, 400)}`);
    }
  };
}

function requireLockedScan(response, bodyText) {
  requireHttpOk(response, bodyText);
  const body = JSON.parse(bodyText);
  if (body.ok || body.reason !== "locked") {
    throw new Error(`Unexpected locked-scan response: ${bodyText.slice(0, 400)}`);
  }
}

async function scan(station, delegate, expectedDuplicate = false) {
  await timedRequest(
    expectedDuplicate ? "scan_duplicate" : station.name === "Final Survey" ? "scan_final" : "scan_regular",
    `${TARGET}/station/api/scan`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgePayload: delegate.registration_number, stationName: station.name }),
    },
    requireScan(expectedDuplicate),
  );
}

async function lockedScan(station, delegate) {
  await timedRequest(
    "scan_final_locked",
    `${TARGET}/station/api/scan`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgePayload: delegate.registration_number, stationName: station.name }),
    },
    requireLockedScan,
  );
}

async function stationRefresh(station) {
  await timedRequest(
    station.name === "Final Survey" ? "station_refresh_final" : "station_refresh_regular",
    `${TARGET}/station/${encodeURIComponent(station.name)}`,
    {},
    requireHttpOk,
  );
}

async function delegateRefresh(delegateIndex) {
  await timedRequest(
    "delegate_refresh_spike",
    `${TARGET}/`,
    { headers: { Cookie: `delegate_session=${sessions[delegateIndex].id}` } },
    requireHttpOk,
  );
}

async function phase(name, work) {
  const started = performance.now();
  emit("phase_start", { name });
  await work();
  const durationMs = performance.now() - started;
  phases.push({ name, durationMs });
  emit("phase_complete", { name, durationMs: Math.round(durationMs), metricCount: metrics.length });
  await writeCheckpoint(name);
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function summarize(entries) {
  const durations = entries.map((entry) => entry.ms).sort((a, b) => a - b);
  const statuses = {};
  for (const entry of entries) statuses[entry.status] = (statuses[entry.status] ?? 0) + 1;
  return {
    requests: entries.length,
    successes: entries.filter((entry) => entry.ok).length,
    failures: entries.filter((entry) => !entry.ok).length,
    statusCounts: statuses,
    meanMs: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
    p50Ms: percentile(durations, 50),
    p90Ms: percentile(durations, 90),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    maxMs: durations.at(-1) ?? null,
  };
}

function summariesByLabel() {
  return Object.fromEntries([...new Set(metrics.map((entry) => entry.label))].map((label) => [label, summarize(metrics.filter((entry) => entry.label === label))]));
}

async function writeCheckpoint(state, extra = {}) {
  await writeFile(REPORT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    target: TARGET,
    configuration: {
      delegates: DELEGATE_COUNT,
      stations: STATION_COUNT,
      scannerConcurrency: SCANNER_CONCURRENCY,
      sharedDatabaseMode: SHARED_DATABASE_MODE,
      stationSource,
    },
    state,
    phases,
    overall: summarize(metrics),
    byLabel: summariesByLabel(),
    prefix: PREFIX,
    cleanupComplete,
    ...extra,
  }, null, 2));
}

async function cleanup() {
  emit("cleanup_start", { prefix: PREFIX });
  await rest(`scan_audit_logs?qr_token=like.${encodeURIComponent(`${PREFIX}*`)}`, { method: "DELETE" }).catch((error) => emit("cleanup_warning", { table: "scan_audit_logs", message: error.message }));
  if (delegates.length) {
    await inBatches(delegates, 75, async (batch) => {
      const ids = batch.map((row) => row.id).join(",");
      await rest(`delegates?id=in.(${ids})`, { method: "DELETE" });
    });
  }
  if (createdStations.length) {
    const ids = createdStations.map((row) => row.id).join(",");
    await rest(`stations?id=in.(${ids})`, { method: "DELETE" });
  }
  cleanupComplete = true;
  emit("cleanup_complete");
}

async function main() {
  const [existingStations, existingDelegates] = await Promise.all([
    rest("stations?select=id,name,active&order=name.asc"),
    rest("delegates?select=id,registration_number"),
  ]);

  const existingLoadTestStations = existingStations.filter((station) => station.name.startsWith("LOADTEST-"));
  const existingLoadTestDelegates = existingDelegates.filter((delegate) => delegate.registration_number.startsWith("LOADTEST-"));
  if (existingLoadTestStations.length || existingLoadTestDelegates.length) {
    throw new Error(
      `Safety stop: found stale synthetic data (${existingLoadTestStations.length} LOADTEST station(s), ${existingLoadTestDelegates.length} LOADTEST delegate(s)). Remove only those stale records before retrying.`,
    );
  }

  if (!SHARED_DATABASE_MODE && (existingStations.length !== 0 || existingDelegates.length !== 0)) {
    throw new Error(
      `Safety stop: this load test requires an empty dedicated staging database, but found ${existingStations.length} station(s) and ${existingDelegates.length} delegate(s). Set LOAD_TEST_ALLOW_SHARED_DATABASE=true only if you intentionally want shared-database mode.`,
    );
  }

  if (existingStations.length === 0) {
    createdStations = Array.from({ length: STATION_COUNT }, (_, index) => ({
      id: randomUUID(),
      name: index === STATION_COUNT - 1 ? "Final Survey" : `${PREFIX}Station-${String(index + 1).padStart(2, "0")}`,
      active: true,
    }));
    stationsUnderTest = createdStations;
    stationSource = "temporary";
  } else {
    const activeStations = existingStations.filter((station) => station.active);
    const finalSurveyStations = activeStations.filter((station) => station.name === "Final Survey");
    if (activeStations.length !== STATION_COUNT || finalSurveyStations.length !== 1) {
      throw new Error(
        `Safety stop: shared-database mode requires exactly ${STATION_COUNT} active stations including exactly one named Final Survey; found ${activeStations.length} active station(s) and ${finalSurveyStations.length} Final Survey station(s).`,
      );
    }
    stationsUnderTest = activeStations;
    stationSource = "existing";
  }

  if (DRY_RUN) {
    emit("dry_run_ready", {
      sharedDatabaseMode: SHARED_DATABASE_MODE,
      existingDelegates: existingDelegates.length,
      existingStations: existingStations.length,
      stationsUnderTest: stationsUnderTest.length,
      stationSource,
      message: "Preflight passed. No records were created or changed.",
    });
    return;
  }

  delegates = Array.from({ length: DELEGATE_COUNT }, (_, index) => ({
    id: randomUUID(),
    registration_number: `${PREFIX}${String(index + 1).padStart(3, "0")}`,
    title: "",
    full_name: `Load Test Delegate ${String(index + 1).padStart(3, "0")}`,
    // Prevent synthetic delegates from entering a live lucky-draw candidate
    // pool while shared-database mode is running. Final Survey still writes
    // eligible_at, so the workflow and correctness checks remain exercised.
    draw_status: SHARED_DATABASE_MODE ? "excluded" : "auto",
  }));
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  sessions = delegates.map((delegate) => ({ id: randomUUID(), delegate_id: delegate.id, expires_at: expiresAt }));

  if (createdStations.length) {
    await rest("stations", { method: "POST", body: createdStations, prefer: "return=representation" });
  }
  await inBatches(delegates, 100, (batch) => rest("delegates", { method: "POST", body: batch, prefer: "return=minimal" }));
  await inBatches(sessions, 100, (batch) => rest("delegate_sessions", { method: "POST", body: batch, prefer: "return=minimal" }));
  emit("seed_complete", {
    delegates: delegates.length,
    stations: stationsUnderTest.length,
    stationSource,
    preservedExistingDelegates: existingDelegates.length,
    prefix: PREFIX,
  });

  await phase("warmup", async () => {
    await runPool(Array.from({ length: 10 }), 2, () => timedRequest("health_warmup", `${TARGET}/api/health`, {}, requireHttpOk));
  });

  const regularStations = stationsUnderTest.filter((station) => station.name !== "Final Survey");
  const finalStation = stationsUnderTest.find((station) => station.name === "Final Survey");
  const preflight = await timedRequest(
    "scan_preflight",
    `${TARGET}/station/api/scan`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgePayload: delegates[0].registration_number, stationName: regularStations[0].name }),
    },
    requireScan(false),
  );
  if (!preflight.entry.ok) throw new Error(`Deployment/Supabase validation failed: ${preflight.entry.error ?? preflight.entry.status}`);
  await stationRefresh(regularStations[0]);

  const measuredSuccessPairs = new Set([`${delegates[0].id}:${regularStations[0].id}`]);
  const stationWaveJobs = delegates.slice(1).map((delegate, index) => {
    const station = stationsUnderTest[(index + 1) % stationsUnderTest.length];
    return { delegate, station };
  });

  await phase("ten_station_delegate_wave", async () => {
    await runPool(stationWaveJobs, SCANNER_CONCURRENCY, async ({ station, delegate }) => {
      if (station.name === "Final Survey") {
        await lockedScan(station, delegate);
      } else {
        await scan(station, delegate);
        measuredSuccessPairs.add(`${delegate.id}:${station.id}`);
      }
      await stationRefresh(station);
    });
  });

  await phase("prepare_prerequisite_stamps", async () => {
    const prerequisiteRows = [];
    for (const delegate of delegates) {
      for (const station of regularStations) {
        if (!measuredSuccessPairs.has(`${delegate.id}:${station.id}`)) {
          prerequisiteRows.push({ delegate_id: delegate.id, station_id: station.id });
        }
      }
    }
    await inBatches(prerequisiteRows, 200, (batch) => rest("delegate_station_stamps", { method: "POST", body: batch, prefer: "return=minimal" }));
    emit("prerequisites_seeded", { rows: prerequisiteRows.length });
  });

  await phase("delegate_refresh_spike", async () => {
    await Promise.all(delegates.map((_, index) => delegateRefresh(index)));
  });

  await phase("final_survey_scans", async () => {
    await runPool(delegates, SCANNER_CONCURRENCY, async (delegate) => {
      await scan(finalStation, delegate);
      await stationRefresh(finalStation);
    });
  });

  await phase("duplicate_race", async () => {
    await Promise.all(Array.from({ length: 20 }, () => scan(regularStations[0], delegates[0], true)));
  });

  // PostgREST returns at most 1,000 rows by default. Query each station
  // separately so the 3,000-row correctness check is not silently truncated.
  const allStationStampRows = (await Promise.all(stationsUnderTest.map((station) =>
    rest(`delegate_station_stamps?select=id,delegate_id,station_id&station_id=eq.${station.id}`)
  ))).flat();
  const testDelegateIds = new Set(delegates.map((delegate) => delegate.id));
  const stampRows = allStationStampRows.filter((stamp) => testDelegateIds.has(stamp.delegate_id));
  const auditRows = await rest(`scan_audit_logs?select=result,consumed&qr_token=like.${encodeURIComponent(`${PREFIX}*`)}`);
  const eligibleRows = await rest(`delegates?select=id,eligible_at&registration_number=like.${encodeURIComponent(`${PREFIX}*`)}`);
  const correctness = {
    expectedStamps: DELEGATE_COUNT * STATION_COUNT,
    actualStamps: stampRows.length,
    uniqueStampPairs: new Set(stampRows.map((row) => `${row.delegate_id}:${row.station_id}`)).size,
    expectedEligibleDelegates: DELEGATE_COUNT,
    actualEligibleDelegates: eligibleRows.filter((row) => row.eligible_at).length,
    auditSuccesses: auditRows.filter((row) => row.result === "success").length,
    auditDuplicates: auditRows.filter((row) => row.result === "duplicate").length,
    auditOther: auditRows.filter((row) => !["success", "duplicate"].includes(row.result)).length,
  };

  const byLabel = summariesByLabel();
  const report = {
    generatedAt: new Date().toISOString(),
    target: TARGET,
    configuration: {
      delegates: DELEGATE_COUNT,
      stations: STATION_COUNT,
      scannerConcurrency: SCANNER_CONCURRENCY,
      sharedDatabaseMode: SHARED_DATABASE_MODE,
      stationSource,
    },
    phases,
    overall: summarize(metrics),
    byLabel,
    correctness,
    prefix: PREFIX,
    cleanupComplete: false,
  };
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  emit("report_written", { path: REPORT_PATH.pathname, overall: report.overall, correctness });
  await cleanup();
  report.cleanupComplete = cleanupComplete;
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  emit("test_complete", { path: REPORT_PATH.pathname });
}

try {
  await main();
} catch (error) {
  emit("test_failed", { message: error instanceof Error ? error.message : String(error) });
  await writeCheckpoint("failed", { failure: error instanceof Error ? error.message : String(error) }).catch(() => {});
  await cleanup().catch((cleanupError) => emit("cleanup_failed", { message: cleanupError.message }));
  await writeCheckpoint("failed_after_cleanup", { failure: error instanceof Error ? error.message : String(error) }).catch(() => {});
  process.exitCode = 1;
}
