import { describe, expect, it } from "vitest";

import { exportAdminCsv, type AdminExportKind, type AdminExportStore } from "@/lib/admin/exports";

function createStore(overrides: Partial<AdminExportStore> = {}): AdminExportStore {
  return {
    async findValidSession() {
      return { id: "session-1", adminId: "admin-1", username: "organizer" };
    },
    async listParticipantProgressExportRows() {
      return [
        {
          fullName: "Ada Lovelace",
          registrationNumber: "REG-001",
          stampsCollected: 2,
          totalActiveStations: 3,
          surveySubmitted: true,
          drawStatus: "eligible",
        },
      ];
    },
    async listStationCompletionExportRows() {
      return [{ stationName: "AI Booth", active: true, completions: 12 }];
    },
    async listSurveyResponseExportRows() {
      return [
        {
          fullName: "Ada Lovelace",
          registrationNumber: "REG-001",
          satisfaction: "Very satisfied",
          favoriteStation: "AI Booth",
          feedback: "Great, fast flow",
          submittedAt: "2025-01-01T00:05:00.000Z",
        },
      ];
    },
    async listWinnerHistoryExportRows() {
      return [
        {
          roundNumber: 1,
          fullName: "Ada Lovelace",
          registrationNumber: "REG-001",
          wonAt: "2025-01-01T00:10:00.000Z",
        },
      ];
    },
    async listScanAuditExportRows() {
      return [
        {
          delegateFullName: "Ada Lovelace",
          stationName: "AI Booth",
          scannedAt: "2025-01-01T00:00:00.000Z",
          qrToken: "secure-token",
          result: "success",
          consumed: true,
        },
      ];
    },
    ...overrides,
  };
}

describe("admin CSV exports", () => {
  it.each<[AdminExportKind, string, string]>([
    ["participants", "participants-progress.csv", "full_name,registration_number,stamps_collected,total_active_stations,survey_submitted,draw_status\nAda Lovelace,REG-001,2,3,true,eligible\n"],
    ["station-completions", "station-completions.csv", "station_name,active,completions\nAI Booth,true,12\n"],
    ["survey-responses", "survey-responses.csv", "full_name,registration_number,satisfaction,favorite_station,feedback,submitted_at\nAda Lovelace,REG-001,Very satisfied,AI Booth,\"Great, fast flow\",2025-01-01T00:05:00.000Z\n"],
    ["winner-history", "winner-history.csv", "round_number,full_name,registration_number,won_at\n1,Ada Lovelace,REG-001,2025-01-01T00:10:00.000Z\n"],
    ["scan-audit", "scan-audit.csv", "delegate_full_name,station_name,scanned_at,qr_token,result,consumed\nAda Lovelace,AI Booth,2025-01-01T00:00:00.000Z,secure-token,success,true\n"],
  ])("exports %s as a downloadable CSV", async (kind, filename, csv) => {
    const result = await exportAdminCsv({
      store: createStore(),
      sessionId: "session-1",
      kind,
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({ ok: true, filename, contentType: "text/csv; charset=utf-8", body: csv });
  });

  it("blocks exports without a valid admin session", async () => {
    let listed = false;

    const result = await exportAdminCsv({
      store: createStore({
        async findValidSession() {
          return null;
        },
        async listParticipantProgressExportRows() {
          listed = true;
          return [];
        },
      }),
      sessionId: "missing",
      kind: "participants",
    });

    expect(result).toEqual({ ok: false, error: "Admin login required." });
    expect(listed).toBe(false);
  });
});
