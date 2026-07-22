import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { VendorPortal } from "@/app/vendor/vendor-portal";
import { authenticateVendor } from "@/lib/auth/vendor-auth";
import { createStore } from "./test-stores";
import { hashPassword } from "@/lib/password";

describe("vendor username/password login", () => {
  it("creates a vendor session when credentials match an active vendor account", async () => {
    const salt = "vendor-salt";
    const passwordHash = hashPassword("station-secret", salt);

    const result = await authenticateVendor({
      store: createStore({
        async findActiveVendorByUsername(username) {
          expect(username).toBe("ai-vendor");
          return {
            id: "vendor-1",
            username: "ai-vendor",
            passwordHash,
            passwordSalt: salt,
            station: { id: "station-1", name: "AI Booth", active: true },
          };
        },
      }),
      username: " AI-Vendor ",
      password: "station-secret",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      session: { id: "vendor-session-1", vendorId: "vendor-1", expiresAt: "2025-01-02T00:00:00.000Z" },
    });
  });

  it("rejects invalid vendor credentials without creating a session", async () => {
    const salt = "vendor-salt";
    const passwordHash = hashPassword("station-secret", salt);
    let created = false;

    const result = await authenticateVendor({
      store: createStore({
        async findActiveVendorByUsername() {
          return {
            id: "vendor-1",
            username: "ai-vendor",
            passwordHash,
            passwordSalt: salt,
            station: { id: "station-1", name: "AI Booth", active: true },
          };
        },
        async createVendorSession() {
          created = true;
          throw new Error("should not create session");
        },
      }),
      username: "ai-vendor",
      password: "wrong-password",
    });

    expect(result).toEqual({ ok: false, error: "Invalid username or password." });
    expect(created).toBe(false);
  });
});

describe("station portal fallback", () => {
  it("explains when a station link is unknown", () => {
    render(<VendorPortal dashboard={{ found: false }} />);

    expect(screen.getByRole("heading", { name: "Station not found" })).toBeInTheDocument();
    expect(screen.getByText(/Check the station link/i)).toBeInTheDocument();
  });
});

