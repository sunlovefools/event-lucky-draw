import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { getAdminDashboard, SupabaseDashboardStore } from "@/lib/admin/dashboard";
import { resetDrawRoundAction } from "@/app/admin/actions";
import { AdminCard, EmptyState, formatTime } from "@/app/admin/ui";
import { IconTrophy, IconCrown, IconRefresh } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";
import { DrawSettingsModal } from "@/app/admin/draw-settings-modal";
import { getLuckyDrawPool } from "@/lib/admin/draw";
import { getDrawSettings, SupabaseDrawSettingsStore } from "@/lib/admin/draw-settings";

export default async function WinnersPage() {
  const cookieStore = await cookies();
  const dashboard = await getAdminDashboard({
    store: new SupabaseDashboardStore(),
    sessionId: cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  });
  if (!dashboard.authorized) redirect("/admin?error=login-required");

  const drawSettings = await getDrawSettings({ store: new SupabaseDrawSettingsStore() });

  const winners = dashboard.drawRounds
    .flatMap((draw) => draw.winners)
    .sort((a, b) => (a.wonAt < b.wonAt ? 1 : -1));
  const winnerIds = winners.map((winner) => winner.delegateId);
  const eligibleCandidateNames = getLuckyDrawPool(dashboard.participants, winnerIds)
    .map((participant) => participant.fullName);

  return (
    <div className="module-grid">
      <AdminCard
        icon={IconTrophy}
        eyebrow="Stage"
        title="Winner history"
        action={
          <span className="row" style={{ gap: ".5rem" }}>
            <DrawSettingsModal settings={drawSettings} candidateNames={eligibleCandidateNames} redirectTo="/admin/winners" />
            <Link href="/display" className="icon-btn" target="_blank" rel="noreferrer">
              Public display
            </Link>
            <span className="badge badge-neutral">{winners.length}</span>
          </span>
        }
      >
        <div className="participation-banner" style={{ marginBottom: "1rem" }}>
          <p className="participation-banner__meta">Winners remain excluded from future draws until reset.</p>
          <form action={resetDrawRoundAction}>
            <input type="hidden" name="redirectTo" value="/admin/winners" />
            <PendingSubmitButton className="icon-btn icon-btn--danger" pendingLabel="Resetting…">
              <IconRefresh size={16} />
              Reset winners
            </PendingSubmitButton>
          </form>
        </div>

        {winners.length === 0 ? (
          <EmptyState icon={IconCrown} title="No winners drawn yet" hint="Open the draw display, then draw." />
        ) : (
          <ul className="list">
            {winners.map((winner) => (
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
      </AdminCard>
    </div>
  );
}
