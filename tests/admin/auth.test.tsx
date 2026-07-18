import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AdminDashboard } from "@/app/admin/admin-dashboard";
import { authenticateAdmin } from "@/lib/auth/admin-auth";
import { createStore } from "./test-stores";
import { hashPassword } from "@/lib/password";

describe("admin username/password login", () => {
  it("creates an admin session when the username and password match an active admin account", async () => {
    const salt = "login-salt";
    const passwordHash = hashPassword("correct horse battery staple", salt);

    const result = await authenticateAdmin({
      store: createStore({
        async findActiveAdminByUsername(username) {
          expect(username).toBe("organizer");
          return { id: "admin-1", username: "organizer", passwordHash, passwordSalt: salt };
        },
      }),
      username: " organizer ",
      password: "correct horse battery staple",
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      session: {
        id: "session-1",
        adminId: "admin-1",
        expiresAt: "2025-01-02T00:00:00.000Z",
      },
    });
  });

  it("rejects invalid credentials without creating a session", async () => {
    const salt = "login-salt";
    const passwordHash = hashPassword("expected-password", salt);
    let createdSession = false;

    const result = await authenticateAdmin({
      store: createStore({
        async findActiveAdminByUsername() {
          return { id: "admin-1", username: "organizer", passwordHash, passwordSalt: salt };
        },
        async createAdminSession() {
          createdSession = true;
          throw new Error("should not create a session");
        },
      }),
      username: "organizer",
      password: "wrong-password",
    });

    expect(result).toEqual({ ok: false, error: "Invalid username or password." });
    expect(createdSession).toBe(false);
  });
});

describe("admin login screen", () => {
  it("shows a protected login prompt to visitors", () => {
    render(<AdminDashboard dashboard={{ authorized: false }} />);

    expect(screen.getByRole("heading", { name: "Admin login" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });
});
