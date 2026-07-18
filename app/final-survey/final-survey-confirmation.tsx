import React from "react";

import type { FinalSurveyResult } from "@/lib/final-survey";

export function FinalSurveyConfirmation({ result }: { result: FinalSurveyResult }) {
  if (!result.ok) {
    return (
      <main className="shell">
        <section className="hero" aria-labelledby="survey-error-title">
          <p className="eyebrow">Final survey</p>
          <h1 id="survey-error-title">Survey not submitted</h1>
          <p role="alert" className="health-error">{result.error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="survey-confirmation-title">
        <p className="eyebrow">Lucky draw</p>
        <h1 id="survey-confirmation-title">You are entered</h1>
        <p className="lead">{result.message}</p>
        <p>Registration number: {result.delegate.registrationNumber}</p>
        <p>Eligible at {result.eligibleAt}</p>
      </section>
    </main>
  );
}
