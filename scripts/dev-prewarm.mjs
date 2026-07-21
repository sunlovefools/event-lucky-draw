import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";

const fallbackPort = Number(process.env.PORT || 3000);
let baseUrl = `http://127.0.0.1:${fallbackPort}`;

const routesToWarm = [
  "/",
  "/admin",
  "/admin/draw",
  "/admin/participants",
  "/admin/stations",
  "/admin/vendors",
  "/admin/scan-audit",
  "/admin/winners",
  "/admin/reports",
  "/vendor",
  "/"
];

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev"], {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});

let stdoutBuffer = "";
let resolveReadyUrl;
const readyUrlPromise = new Promise((resolve) => {
  resolveReadyUrl = resolve;
});
child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  stdoutBuffer += text;

  const localUrlMatch = stdoutBuffer.match(/Local:\s+http:\/\/localhost:(\d+)/);
  if (localUrlMatch) {
    baseUrl = `http://127.0.0.1:${localUrlMatch[1]}`;
    resolveReadyUrl?.(baseUrl);
    resolveReadyUrl = undefined;
  }

  process.stdout.write(chunk);
});
child.stderr.on("data", (chunk) => process.stderr.write(chunk));

const exitPromise = new Promise((resolve) => {
  child.on("exit", (code, signal) => resolve({ code, signal }));
});

async function warmRoutes() {
  for (const route of routesToWarm) {
    try {
      const response = await fetch(new URL(route, baseUrl), {
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      console.log(`[warmup] ${route} -> ${response.status}`);
    } catch (error) {
      console.warn(`[warmup] ${route} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function main() {
  console.log(`[warmup] starting Next dev on ${baseUrl}`);
  await readyUrlPromise;
  console.log("[warmup] server is ready; precompiling routes");
  await warmRoutes();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));

void exitPromise.then(({ code, signal }) => {
  process.exit(code ?? (signal ? 1 : 0));
});