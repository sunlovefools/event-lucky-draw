import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AdminDashboard } from "@/app/admin/admin-dashboard";
import {
  authenticateAdmin,
  getAdminDashboard,
  hashAdminPassword,
  setParticipationState,
  type AdminStore,
} from "@/lib/admin";

function createStore(overrides: Partial<AdminStore> = {}): AdminStore {
  const store: AdminStore = {
    async findActiveAdminByUsername() {
      return null;
    },
    async createAdminSession() {
      return {
        id: "session-1",
        adminId: "admin-1",
        expiresAt: "2025-01-02T00:00:00.000Z",
      };
    },
    async findValidSession() {
      return null;
    },
    async readParticipationState() {
      return {
        open: false,
        updatedAt: "2025-01-01T00:00:00.000Z",
        updatedByUsername: "organizer",
      };
    },
    async updateParticipationState(open, adminId, updatedAt) {
      return {
        open,
        updatedAt,
        updatedByUsername: adminId === "admin-1" ? "organizer" : null,
      };
    },
    ...overrides,
  };

  return store;
}

describe("admin username/password login", () => {
  it("creates an admin session when the username and password match an active admin account", async () => {
    const salt = "login-salt";
    const passwordHash = hashAdminPassword("correct horse battery staple", salt);

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
    const passwordHash = hashAdminPassword("expected-password", salt);
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

describe("protected admin dashboard", () => {
  it("blocks dashboard data when there is no valid admin session", async () => {
    const result = await getAdminDashboard({ store: createStore(), sessionId: "missing" });

    expect(result).toEqual({ authorized: false });
  });

  it("returns the visible participation state for a valid admin session", async () => {
    const result = await getAdminDashboard({
      store: createStore({
        async findValidSession(sessionId) {
          expect(sessionId).toBe("session-1");
          return { id: "session-1", adminId: "admin-1", username: "organizer" };
        },
        async readParticipationState() {
          return {
            open: true,
            updatedAt: "2025-01-01T00:00:00.000Z",
            updatedByUsername: "organizer",
          };
        },
      }),
      sessionId: "session-1",
    });

    expect(result).toEqual({
      authorized: true,
      admin: { id: "admin-1", username: "organizer" },
      participation: {
        open: true,
        updatedAt: "2025-01-01T00:00:00.000Z",
        updatedByUsername: "organizer",
      },
    });
  });
});

describe("participation control", () => {
  it("lets an authenticated admin close and reopen participation", async () => {
    const store = createStore({
      async findValidSession() {
        return { id: "session-1", adminId: "admin-1", username: "organizer" };
      },
    });

    const closed = await setParticipationState({
      store,
      sessionId: "session-1",
      open: false,
      now: () => new Date("2025-01-01T00:10:00.000Z"),
    });
    const reopened = await setParticipationState({
      store,
      sessionId: "session-1",
      open: true,
      now: () => new Date("2025-01-01T00:11:00.000Z"),
    });

    expect(closed).toEqual({
      ok: true,
      participation: {
        open: false,
        updatedAt: "2025-01-01T00:10:00.000Z",
        updatedByUsername: "organizer",
      },
    });
    expect(reopened).toEqual({
      ok: true,
      participation: {
        open: true,
        updatedAt: "2025-01-01T00:11:00.000Z",
        updatedByUsername: "organizer",
      },
    });
  });

  it("does not let an unauthenticated request change participation", async () => {
    let updated = false;

    const result = await setParticipationState({
      store: createStore({
        async updateParticipationState() {
          updated = true;
          throw new Error("should not update");
        },
      }),
      sessionId: "missing",
      open: false,
    });

    expect(result).toEqual({ ok: false, error: "Admin login required." });
    expect(updated).toBe(false);
  });
});

describe("admin dashboard UI", () => {
  it("shows a protected login prompt to visitors", () => {
    render(<AdminDashboard dashboard={{ authorized: false }} />);

    expect(screen.getByRole("heading", { name: "Admin login" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows participation controls and persisted closed state to admins", () => {
    render(
      <AdminDashboard
        dashboard={{
          authorized: true,
          admin: { id: "admin-1", username: "organizer" },
          participation: {
            open: false,
            updatedAt: "2025-01-01T00:10:00.000Z",
            updatedByUsername: "organizer",
          },
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Admin dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Signed in as organizer")).toBeInTheDocument();
    expect(screen.getByText("Participation is closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open participation" })).toBeInTheDocument();
    expect(screen.getByText("Last changed by organizer at 2025-01-01T00:10:00.000Z")).toBeInTheDocument();
  });
});
