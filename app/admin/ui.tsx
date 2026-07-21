import React from "react";
import Link from "next/link";

import { IconChevronLeft, IconChevronRight } from "@/app/admin/icons";

export function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type IconType = (p: { size?: number; className?: string }) => React.ReactElement;

export function AdminCard({
  icon: Icon,
  title,
  eyebrow,
  iconAccent,
  action,
  children,
}: {
  icon: IconType;
  title: string;
  eyebrow?: string;
  iconAccent?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-card" aria-labelledby={`card-${slug(title)}`}>
      <div className="admin-card__head">
        <div className="admin-card__title">
          <span className={`admin-card__icon${iconAccent ? " admin-card__icon--accent" : ""}`} aria-hidden="true">
            <Icon size={22} />
          </span>
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={`card-${slug(title)}`}>{title}</h2>
          </div>
        </div>
        {action ? <div className="row" style={{ gap: ".5rem" }}>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: IconType;
  title: string;
  hint?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        <Icon size={26} />
      </span>
      <strong>{title}</strong>
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Windowed page-number list centred on the current page.
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) {
    return (
      <div className="pagination">
        <span className="pagination__info">
          {total} {total === 1 ? "item" : "items"}
        </span>
      </div>
    );
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination__info">
        Showing {from}–{to} of {total}
      </span>
      <div className="pagination__pages">
        <Link
          href={href(page - 1)}
          className="pagination__edge"
          aria-label="Previous page"
          aria-disabled={page <= 1}
          style={page <= 1 ? { opacity: 0.5, pointerEvents: "none" } : undefined}
        >
          <IconChevronLeft size={18} />
        </Link>
        {pageWindow(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="pagination__current" style={{ background: "transparent", borderColor: "transparent", color: "var(--color-muted)" }}>
              …
            </span>
          ) : p === page ? (
            <span key={p} className="pagination__current" aria-current="page">
              {p}
            </span>
          ) : (
            <Link key={p} href={href(p)}>
              {p}
            </Link>
          ),
        )}
        <Link
          href={href(page + 1)}
          className="pagination__edge"
          aria-label="Next page"
          aria-disabled={page >= totalPages}
          style={page >= totalPages ? { opacity: 0.5, pointerEvents: "none" } : undefined}
        >
          <IconChevronRight size={18} />
        </Link>
      </div>
    </nav>
  );
}
