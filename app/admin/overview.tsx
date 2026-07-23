import Link from "next/link";

import { setParticipationAction, drawLuckyWinnerAction, resetDrawRoundAction } from "@/app/admin/actions";
import type { AdminDashboardResult } from "@/lib/admin/dashboard";
import type { HealthStatus } from "@/lib/health";
import { AdminCard, formatTime } from "@/app/admin/ui";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";
import {
  IconPower,
  IconActivity,
  IconUsers,
  IconCheckCircle,
  IconTrophy,
  IconStore,
  IconScan,
  IconCrown,
  IconDatabase,
  IconWifi,
  IconClock,
  IconArrowRight,
  IconRefresh,
} from "@/app/admin/icons";


export function AdminOverview({
  dashboard,
  error,
  health,
}: {
  dashboard: Extract<AdminDashboardResult, { authorized: true }>;
  error?: string;
  health?: HealthStatus;
}) {
  const { participation, stations, participants, stationSummaries, scanAuditLogs, drawRounds } = dashboard;

  const eligibleCount = participants.filter((p) => ["eligible", "manual_include"].includes(p.drawStatus)).length;
  const activeStations = stations.filter((s) => s.active).length;
  const nextOpenValue = participation.open ? "false" : "true";
  const buttonLabel = participation.open ? "Close participation" : "Open participation";

  const allWinners = drawRounds
    .flatMap((r) => r.winners.map((w) => ({ ...w, roundNumber: r.roundNumber })))
    .sort((a, b) => (a.wonAt < b.wonAt ? 1 : -1));
  const recentWinners = allWinners.slice(0, 8);

  const statTiles = [
    { icon: IconUsers, label: "Participants", value: participants.length, accent: false },
    { icon: IconCheckCircle, label: "Eligible", value: eligibleCount, accent: true },
    { icon: IconTrophy, label: "Winners drawn", value: allWinners.length, accent: false },
    { icon: IconStore, label: "Active stations", value: `${activeStations}/${stations.length}`, accent: false },
    { icon: IconScan, label: "Scan attempts", value: scanAuditLogs.length, accent: false },
  ];

  return (
    <div className="module-grid">
      {error ? (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      ) : null}

      {/* Participation control */}
      <AdminCard
        icon={IconPower}
        eyebrow="Live control"
        title="Participation"
        action={
          <span className={`badge ${participation.open ? "badge-success" : "badge-danger"}`}>
            <span className="dot" />
            {participation.open ? "Open" : "Closed"}
          </span>
        }
      >
        <div className="participation-banner">
          <p className="participation-banner__meta">
            Last changed by {participation.updatedByUsername ?? "unknown admin"} at {formatTime(participation.updatedAt)}
          </p>
          <form action={setParticipationAction}>
            <input type="hidden" name="open" value={nextOpenValue} />
            <input type="hidden" name="redirectTo" value="/admin" />
            <PendingSubmitButton className={participation.open ? "btn btn-danger" : "btn btn-accent"} pendingLabel="Updating…">
              <IconPower size={18} />
              {buttonLabel}
            </PendingSubmitButton>
          </form>
        </div>
      </AdminCard>

      {/* System status */}
      <AdminCard icon={IconActivity} eyebrow="Health" title="System status">
        <div className="health-grid">
          <div className="health-item">
            <span className="health-item__icon" style={{ background: "var(--color-info-soft)", color: "var(--color-primary)" }}>
              <IconWifi size={20} />
            </span>
            <span>
              <span className="health-item__label">App</span>
              <br />
              <span className="health-item__value">{health?.app}</span>
            </span>
          </div>
          <div className="health-item">
            <span className="health-item__icon" style={{ background: "var(--color-success-soft)", color: "var(--color-accent-strong)" }}>
              <IconDatabase size={20} />
            </span>
            <span>
              <span className="health-item__label">Database</span>
              <br />
              <span className="health-item__value">{health?.database}</span>
            </span>
          </div>
          <div className="health-item">
            <span className="health-item__icon" style={{ background: "var(--color-warning-soft)", color: "#92400e" }}>
              <IconClock size={20} />
            </span>
            <span>
              <span className="health-item__label">Last checked</span>
              <br />
              <span className="health-item__value">{health?.checkedAt}</span>
            </span>
          </div>
        </div>
        {health?.error ? <p className="alert alert-danger" style={{ marginTop: "1rem" }}>{health.error}</p> : null}
      </AdminCard>

      {/* At a glance */}
      <div className="stat-tiles">
        {statTiles.map((tile) => (
          <div className="stat-tile" key={tile.label}>
            <span className={`stat-tile__icon${tile.accent ? " stat-tile__icon--accent" : ""}`} aria-hidden="true">
              <tile.icon size={22} />
            </span>
            <span>
              <span className="stat-tile__value">{tile.value}</span>
              <br />
              <span className="stat-tile__label">{tile.label}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Lucky draw */}
      <AdminCard
        icon={IconTrophy}
        eyebrow="On stage"
        title="Lucky draw"
        iconAccent
        action={
          <Link href="/display" className="icon-btn" target="_blank" rel="noreferrer">
            <IconArrowRight size={18} />
            Public display
          </Link>
        }
      >
        <div className="participation-banner">
          <p className="participation-banner__meta">
            {allWinners.length} winner{allWinners.length === 1 ? "" : "s"} drawn · winners stay excluded until reset
          </p>
          <span className="badge badge-success">
            <span className="dot" />
            Ready
          </span>
        </div>
        <div className="row" style={{ gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <form action={drawLuckyWinnerAction}>
            <input type="hidden" name="redirectTo" value="/admin" />
            <PendingSubmitButton className="btn btn-accent" pendingLabel="Drawing…">
              <IconTrophy size={18} />
              Draw winner
            </PendingSubmitButton>
          </form>
          <form action={resetDrawRoundAction}>
            <input type="hidden" name="redirectTo" value="/admin" />
            <PendingSubmitButton className="btn btn-ghost" pendingLabel="Resetting…">
              <IconRefresh size={18} />
              Reset winners
            </PendingSubmitButton>
          </form>
        </div>
      </AdminCard>

      {/* Recent winners */}
      <AdminCard
        icon={IconCrown}
        eyebrow="Latest"
        title="Recent winners"
        action={
          <Link href="/admin/winners" className="icon-btn">
            View all
            <IconArrowRight size={18} />
          </Link>
        }
      >
        {recentWinners.length === 0 ? (
          <p className="empty">No winners drawn yet.</p>
        ) : (
          <ul className="list">
            {recentWinners.map((winner) => (
              <li key={winner.id} className="list-item">
                <span className="list-item-title">{winner.fullName}</span>
                <br />
                <span className="muted nowrap">#{winner.registrationNumber} · {formatTime(winner.wonAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      {/* Station summary */}
      <AdminCard
        icon={IconStore}
        eyebrow="Progress"
        title="Station summary"
        action={
          <Link href="/admin/reports" className="icon-btn">
            Reports
            <IconArrowRight size={18} />
          </Link>
        }
      >
        {stationSummaries.length === 0 ? (
          <p className="empty">No station completions yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Status</th>
                  <th>Completions</th>
                </tr>
              </thead>
              <tbody>
                {stationSummaries.map((summary) => (
                  <tr key={summary.stationId}>
                    <td>{summary.stationName}</td>
                    <td>
                      <span className={`badge ${summary.active ? "badge-success" : "badge-neutral"}`}>
                        {summary.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td>{summary.completions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
