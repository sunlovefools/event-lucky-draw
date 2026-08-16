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
    title: "Welcome to the 5th FFNM & 1st MyBONe ASM Lucky Draw Challenge",
    message: "Visit each booth and collect every required stamp to enter the lucky draw.",
  },
  {
    title: "Visit Each Booth",
    message: "Complete the activity at each booth. Once completed, the exhibitor will scan the QR code on your conference badge to award your stamp.",
    target: "[data-tutorial='delegate-station']",
  },
  {
    title: "Check Your New Stamp",
    message: "After the exhibitor scans your badge QR code, tap Refresh Progress to view your newly collected stamp.",
    target: "[data-tutorial-demo='stamp']",
    effect: "delegate-refresh-demo",
  },
  {
    title: "Complete All Exhibition Booths to Unlock the Final Survey",
    message: "Collect all your station stamps to unlock the Final Survey Station and complete the challenge.",
    target: "[data-tutorial='delegate-final-station']",
  },
  {
    title: "You’re Officially in the Lucky Draw! 🎉",
    message: "Complete the Final Survey and collect your final stamp to confirm your lucky draw entry.",
    target: "[data-tutorial='delegate-status']",
    effect: "delegate-entry-demo",
  },
  {
    title: "Good Luck!🎉",
    message: "Your lucky draw entry is complete! Keep this page handy for verification by the event team, if required.",
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
        <h1 id="home-title">5th FFNM & 1st MyBONe ASM 2026 Lucky Draw Challenge</h1>
        <p className="hero-tagline">
          <span className="hero-tagline__complete">Complete.</span>{" "}
          <span className="hero-tagline__collect">Collect.</span>{" "}
          <span className="hero-tagline__win">Win!</span>
        </p>
        <p className="lead">Visit every booth, collect all your stamps, and unlock your chance to win exciting prizes!</p>
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
            <h2 id="welcome-title" className="delegate-welcome-title">
              <span className="delegate-welcome-label">Welcome</span>
              <span className="delegate-identity">
                {delegate.title?.trim() ? <><span className="delegate-title">{delegate.title.trim()}</span>{" "}</> : null}
                <span className="delegate-full-name">{delegate.fullName}!</span>
              </span>
            </h2>
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
          <h2 id="need-stamps-title">Complete Your Stamps to Enter the Lucky Draw!</h2>
          <p className="lead" style={{ margin: "0.5rem auto 0" }}>
            Collect all required stamps to unlock the Final Survey Station and complete your lucky draw entry.
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
