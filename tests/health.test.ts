import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Home } from "@/app/home";
import { getHealthStatus } from "@/lib/health";
import { readEnvironment } from "@/lib/env";

describe("environment configuration", () => {
  it("accepts the public Supabase URL and anon key required by the hosted app", () => {
    const env = readEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(env).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
    });
  });
});

describe("Supabase-backed health path", () => {
  it("reports healthy when the health_check table is reachable", async () => {
    const status = await getHealthStatus({
      supabase: {
        from: (table: string) => {
          expect(table).toBe("health_checks");
          return {
            select: (columns: string) => {
              expect(columns).toBe("id, checked_at");
              return {
                limit: async (count: number) => {
                  expect(count).toBe(1);
                  return { data: [{ id: 1, checked_at: "2025-01-01T00:00:00Z" }], error: null };
                },
              };
            },
          };
        },
      },
      now: () => new Date("2025-01-01T00:01:00Z"),
    });

    expect(status).toEqual({
      ok: true,
      app: "event-lucky-draw",
      database: "reachable",
      checkedAt: "2025-01-01T00:01:00.000Z",
    });
  });

  it("reports unhealthy when Supabase cannot be reached", async () => {
    const status = await getHealthStatus({
      supabase: {
        from: () => ({
          select: () => ({
            limit: async () => ({ data: null, error: { message: "connection refused" } }),
          }),
        }),
      },
      now: () => new Date("2025-01-01T00:02:00Z"),
    });

    expect(status).toMatchObject({
      ok: false,
      app: "event-lucky-draw",
      database: "unreachable",
      checkedAt: "2025-01-01T00:02:00.000Z",
      error: "connection refused",
    });
  });
});

describe("home page", () => {
  it("renders the app shell and the delegate registration scanner", async () => {
    render(await Home({ }));

    expect(screen.getByRole("heading", { name: "Event Station Quest Lucky Draw" })).toBeInTheDocument();
    expect(screen.getByText(/collect your stamps/));
    expect(screen.getByText("Scan Your Conference Badge QR")).toBeInTheDocument();
  });
});
