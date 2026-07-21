"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAdminAction } from "@/app/admin/actions";
import {
  IconDashboard,
  IconUsers,
  IconStore,
  IconIdCard,
  IconScan,
  IconTrophy,
  IconReport,
  IconMenu,
  IconLogout,
  IconPower,
} from "@/app/admin/icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactElement;
  countKey?: "participants" | "stations" | "vendors" | "scan" | "winners";
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", Icon: IconDashboard, exact: true },
  { href: "/admin/participants", label: "Participants", Icon: IconUsers, countKey: "participants" },
  { href: "/admin/stations", label: "Stations", Icon: IconStore, countKey: "stations" },
  { href: "/admin/vendors", label: "Vendors", Icon: IconIdCard, countKey: "vendors" },
  { href: "/admin/scan-audit", label: "Scan audit", Icon: IconScan, countKey: "scan" },
  { href: "/admin/winners", label: "Winners", Icon: IconTrophy, countKey: "winners" },
  { href: "/admin/reports", label: "Reports", Icon: IconReport },
];

const TITLES: Record<string, string> = {
  "/admin": "Overview",
  "/admin/participants": "Participants",
  "/admin/stations": "Stations",
  "/admin/vendors": "Vendors",
  "/admin/scan-audit": "Scan audit",
  "/admin/winners": "Winners",
  "/admin/reports": "Reports",
};

export function AdminChrome({
  admin,
  participation,
  counts,
  children,
}: {
  admin: { username: string };
  participation: { open: boolean };
  counts?: Record<string, number>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const title = TITLES[pathname] ?? "Admin";

  return (
    <div className="admin-app">
      {navOpen ? (
        <button
          type="button"
          className="admin-scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside className={`admin-sidebar${navOpen ? " is-open" : ""}`}>
        <div className="admin-brand">
          <span className="admin-brand__mark" aria-hidden="true">
            <IconTrophy size={22} />
          </span>
          <span>
            <span className="admin-brand__name">Station Quest</span>
            <br />
            <span className="admin-brand__sub">Admin</span>
          </span>
        </div>

        <nav className="admin-nav" aria-label="Admin sections">
          <span className="admin-nav__label">Manage</span>
          {NAV.map((item) => {
            const count = item.countKey ? counts?.[item.countKey] : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(item) ? "is-active" : undefined}
                aria-current={isActive(item) ? "page" : undefined}
                onClick={() => setNavOpen(false)}
              >
                <item.Icon size={20} />
                <span>{item.label}</span>
                {typeof count === "number" ? (
                  <span className="admin-nav__count">{count}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar__foot">
          <form action={logoutAdminAction}>
            <button type="submit" className="btn btn-ghost btn-block">
              <IconLogout size={18} />
              Log out
            </button>
          </form>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            <button
              type="button"
              className="admin-hamburger"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
            >
              <IconMenu size={22} />
            </button>
            <span className="admin-topbar__title">{title}</span>
          </div>
          <div className="admin-topbar__right">
            <span
              className={`badge ${participation.open ? "badge-success" : "badge-danger"}`}
              title={participation.open ? "Participation is open" : "Participation is closed"}
            >
              <IconPower size={14} />
              {participation.open ? "Open" : "Closed"}
            </span>
            <span className="admin-user">
              <span className="admin-avatar" aria-hidden="true">
                {admin.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="admin-user__name">{admin.username}</span>
            </span>
          </div>
        </header>

        <main className="admin-content" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}
