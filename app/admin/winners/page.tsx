import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { deleteDrawRoundAction } from "@/app/admin/actions";
import { AdminCard, EmptyState, formatTime } from "@/app/admin/ui";
import { IconTrophy, IconCrown, IconList, IconRefresh } from "@/app/admin/icons";

export default async function WinnersPage() {
  const cookieStore = await cookies();
  const dashboard = await getAdminDashboard({
    store: new SupabaseDashboardStore(),
    sessionId: cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  });
  if (!dashboard.authorized) redirect("/admin?error=login-required");

  const { drawRounds } = dashboard;
  const rounds = [...drawRounds].sort((a, b) => b.roundNumber - a.roundNumber);
  const totalWinners = rounds.reduce((n, r) => n + r.winners.length, 0);

  return (
    <div className="module-grid">
      <AdminCard
        icon={IconTrophy}
        eyebrow="Stage"
        title="Winner history"
        action={
          <span className="row" style={{ gap: ".5rem" }}>
            <Link href="/admin/draw" className="icon-btn">
              Public display
            </Link>
            <span className="badge badge-neutral">{totalWinners}</span>
          </span>
        }
      >
        {rounds.length === 0 ? (
          <EmptyState icon={IconCrown} title="No winners drawn yet" hint="Start a round from the Overview page, then draw." />
        ) : (
          <div className="stack" style={{ gap: "1.25rem" }}>
            {rounds.map((round) => (
              <section key={round.id} className="admin-card" style={{ boxShadow: "none", padding: "1.1rem" }}>
                <div className="admin-card__head">
                  <div className="row-between" style={{ width: "100%" }}>
                    <div className="row" style={{ gap: ".6rem" }}>
                      <span className="admin-card__icon admin-card__icon--accent" aria-hidden="true">
                        <IconCrown size={20} />
                      </span>
                      <div>
                        <p className="eyebrow">Round</p>
                        <h3>Round {round.roundNumber}</h3>
                      </div>
                    </div>
                    <div className="row" style={{ gap: ".5rem" }}>
                      <span className={`badge ${round.isCurrent ? "badge-success" : "badge-neutral"}`}>
                        {round.isCurrent ? "Open" : "Closed"}
                      </span>
                      {!round.isCurrent ? (
                        <form action={deleteDrawRoundAction}>
                          <input type="hidden" name="roundId" value={round.id} />
                          <input type="hidden" name="redirectTo" value="/admin/winners" />
                          <button type="submit" className="icon-btn icon-btn--danger" title="Delete this round's winners">
                            <IconRefresh size={16} />
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>

                {round.winners.length === 0 ? (
                  <p className="muted">No winners in this round yet.</p>
                ) : (
                  <ul className="list">
                    {round.winners.map((winner) => (
                      <li key={winner.id} className="list-item">
                        <div className="row-between">
                          <span className="participant-name">
                            <span className="participant-avatar" aria-hidden="true">
                              <IconCrown size={16} />
                            </span>
                            <span>
                              <span className="cell-strong">{winner.fullName}</span>
                              <br />
                              <span className="cell-sub">#{winner.registrationNumber}</span>
                            </span>
                          </span>
                          <span className="muted nowrap">{formatTime(winner.wonAt)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
