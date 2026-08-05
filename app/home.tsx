import React from "react";

import { logoutDelegateAction } from "@/app/delegate/actions";
import { friendlyError } from "@/lib/messages";
import type { DelegateHomeResult } from "@/lib/delegate";
import { DelegateRegister } from "@/app/components/delegate-register";
import { DelegateStamps } from "@/app/components/delegate-stamps";
import { Confetti } from "@/app/components/confetti";
import { GuidedTutorial, type TutorialStep } from "@/app/components/guided-tutorial";
import { formatParticipantName } from "@/lib/shared/participant";

const DELEGATE_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to the FFNM & MyBone Lucky Draw Challenge",
    message: "Visit each station and collect every required stamp to enter the lucky draw.",
  },
  {
    title: "Visit the Stations",
    message: "Visit the station and complete its activity. The station will then award you the stamp by scanning your conference badge QR.",
    target: "[data-tutorial='delegate-station']",
  },
  {
    title: "Check your New Stamp",
    message: "After the vendor scans your QR code, tap Refresh Progress to update your stamps.",
    target: "[data-tutorial-demo='stamp']",
    effect: "delegate-refresh-demo",
  },
  {
    title: "The Final Survey Station is Locked",
    message: "Collect all other station stamps first, then you will unlock the Final Survey Station.",
    target: "[data-tutorial='delegate-final-station']",
  },
  {
    title: "You're in the Lucky Draw!",
    message: "Once you receive the Final Survey Station stamp, your lucky draw entry is confirmed.",
    target: "[data-tutorial='delegate-status']",
    effect: "delegate-entry-demo",
  },
  {
    title: "Good Luck!",
    message: "Keep this page available in case the event team needs to verify your lucky draw entry.",
  },
];

export async function Home({
  delegateHomePromise = Promise.resolve({ identified: false }),
  error,
}: {
  delegateHomePromise?: Promise<DelegateHomeResult>;
  error?: string;
}) {
  const delegateHome = await delegateHomePromise;
  const errorMessage = friendlyError(error);

  return (
    <main className="shell" id="main">
      <section className="hero" aria-labelledby="home-title">
        <h1 id="home-title">FFNM & MyBone Lucky Draw Challenge</h1>
        <p className="lead">Visit every station, collect your stamps, and enter the lucky draw.</p>
      </section>

      {delegateHome.identified ? (
        <DelegateView delegateHome={delegateHome} />
      ) : (
        <DelegateRegister errorMessage={errorMessage} />
      )}
    </main>
  );
}

function DelegateView({ delegateHome }: { delegateHome: Extract<DelegateHomeResult, { identified: true }> }) {
  const { delegate, progress, finalSurvey } = delegateHome;
  const delegateDisplayName = formatParticipantName(delegate);
  const pct = progress.totalRequired === 0 ? 0 : Math.round((progress.completedCount / progress.totalRequired) * 100);
  const allStampsCollected = progress.totalRequired > 0 && progress.remainingCount === 0;
  // A delegate is only "entered" once every station stamp is collected AND the
  // final survey station has marked them eligible. The legacy submitted flag is
  // kept for already-migrated survey responses.
  const isEntered = allStampsCollected && (finalSurvey.submitted || finalSurvey.eligible);

  return (
    <>
      <section className="card delegate-welcome-card" aria-labelledby="welcome-title" data-tutorial="delegate-progress">
        <div className="section-head delegate-welcome-head">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2 id="welcome-title">Welcome {delegateDisplayName}!</h2>
          </div>
          <div className="head-actions delegate-welcome-actions">
            <GuidedTutorial id="delegate-page" steps={DELEGATE_TUTORIAL_STEPS} launcherClassName="tutorial-launcher--delegate" version={5} />
            <span className="badge badge-neutral">#{delegate.registrationNumber}</span>
          </div>
        </div>

        <div className="stat-row" style={{ marginBottom: "1rem" }} data-tutorial="delegate-progress-summary">
          <div className="stat">
            <span className="stat-value">{progress.completedCount}/{progress.totalRequired}</span>
            <span className="stat-label">stations complete</span>
          </div>
          <div className="stat">
            <span className="stat-value">{progress.remainingCount}</span>
            <span className="stat-label">{progress.remainingCount === 1 ? "stamp remaining" : "stamps remaining"}</span>
          </div>
        </div>
        <p className="progress-summary-copy">{progress.completedCount} of {progress.totalRequired} stations completed</p>
        <div className="progress-meter" role="progressbar" aria-valuenow={progress.completedCount} aria-valuemin={0} aria-valuemax={progress.totalRequired} aria-label="Station progress">
          <span style={{ width: `${pct}%` }} />
        </div>

        <DelegateStamps delegateId={delegate.id} stations={progress.stations} />

        {finalSurvey.available ? (
          <p className="alert alert-success" style={{ marginTop: "1.25rem" }}>
            Final Survey Station unlocked — scan it now to enter the lucky draw.
          </p>
        ) : null}
      </section>

      {isEntered ? (
        <section className="card center delegate-entry-confirmed delegate-status-card" aria-labelledby="entered-title" data-tutorial="delegate-status">
          <Confetti count={44} />
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ margin: "0 auto 0.5rem" }}>
            <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
            <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
          </svg>
          <p className="eyebrow">Lucky Draw Entry Confirmed</p>
          <h2 id="entered-title">You're entered into the lucky draw</h2>
          <p className="lead" style={{ margin: "0.5rem auto 0" }}>
            Thanks for completing the quest, {delegateDisplayName}. Keep an eye on the big screen for the draw!
          </p>
          <p className="muted" style={{ marginTop: "0.75rem" }}>Registration #{delegate.registrationNumber}</p>
        </section>
      ) : allStampsCollected ? (
        <section className="card center delegate-status-card" aria-labelledby="not-eligible-title" data-tutorial="delegate-status">
          <p className="eyebrow">Almost there</p>
          <h2 id="not-eligible-title">You're not in the draw yet</h2>
          <p className="lead" style={{ margin: "0.5rem auto 0" }}>
            Your Final Survey Station stamp was recorded, but you're not eligible to enter the draw. If this looks like a mistake, please see the event crew.
          </p>
        </section>
      ) : (
        <section className="card center delegate-status-card" aria-labelledby="need-stamps-title" data-tutorial="delegate-status">
          <p className="eyebrow">Not yet entered</p>
          <h2 id="need-stamps-title">Get all the stamps to enter the lucky draw!</h2>
          <p className="lead" style={{ margin: "0.5rem auto 0" }}>
            Collect every stamp above to unlock the Final Survey Station and complete your entry.
          </p>
        </section>
      )}

      <form action={logoutDelegateAction} style={{ marginTop: "1.5rem" }}>
        <button type="submit" className="btn btn-danger btn-block">
          Log out
        </button>
      </form>
    </>
  );
}
