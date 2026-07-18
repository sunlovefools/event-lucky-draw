import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FinalSurveyConfirmation } from "@/app/final-survey/final-survey-confirmation";
import { submitFinalSurvey, type FinalSurveyStore } from "@/lib/final-survey";

const validSession = {
  id: "delegate-session-1",
  delegate: { id: "delegate-1", registrationNumber: "REG-001", fullName: "Ada Lovelace" },
};

function createStore(overrides: Partial<FinalSurveyStore> = {}): FinalSurveyStore {
  const store: FinalSurveyStore = {    async readParticipationOpen() {
      return true;
    },
    async listActiveStationIds() {
      return ["station-1", "station-2"];
    },
    async listDelegateStampStationIds() {
      return ["station-1", "station-2"];
    },
    async findFinalSurveyResponse() {
      return null;
    },
    async createFinalSurveyResponse(delegateId, answers, submittedAt) {
      return { id: "survey-1", delegateId, answers, submittedAt };
    },
    async markDelegateEligible(delegateId, eligibleAt) {
      return { id: delegateId, eligibleAt, drawStatus: "eligible" };
    },
    ...overrides,
  };

  return store;
}

describe("final survey submission", () => {
  it("marks a delegate eligible after one fixed final survey submission when all active stations are complete", async () => {
    const createdResponses: Array<{ delegateId: string; answers: { satisfaction: string; favoriteStation: string; feedback: string }; submittedAt: string }> = [];
    const markedEligible: Array<{ delegateId: string; eligibleAt: string }> = [];

    const result = await submitFinalSurvey({
      store: createStore({
        async createFinalSurveyResponse(delegateId, answers, submittedAt) {
          createdResponses.push({ delegateId, answers, submittedAt });
          return { id: "survey-1", delegateId, answers, submittedAt };
        },
        async markDelegateEligible(delegateId, eligibleAt) {
          markedEligible.push({ delegateId, eligibleAt });
          return { id: delegateId, eligibleAt, drawStatus: "eligible" };
        },
      }),
      session: validSession,
      answers: { satisfaction: "great", favoriteStation: "AI Booth", feedback: "Loved it" },
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      delegate: { id: "delegate-1", fullName: "Ada Lovelace", registrationNumber: "REG-001" },
      eligibleAt: "2025-01-01T00:00:00.000Z",
      message: "Ada Lovelace is entered into the lucky draw.",
    });
    expect(createdResponses).toEqual([
      {
        delegateId: "delegate-1",
        answers: { satisfaction: "great", favoriteStation: "AI Booth", feedback: "Loved it" },
        submittedAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
    expect(markedEligible).toEqual([{ delegateId: "delegate-1", eligibleAt: "2025-01-01T00:00:00.000Z" }]);
  });

  it("does not show eligibility when station requirements are incomplete", async () => {
    let submitted = false;

    const result = await submitFinalSurvey({
      store: createStore({
        async listDelegateStampStationIds() {
          return ["station-1"];
        },
        async createFinalSurveyResponse() {
          submitted = true;
          throw new Error("should not submit survey before completion");
        },
      }),
      session: validSession,
      answers: { satisfaction: "great", favoriteStation: "AI Booth", feedback: "" },
    });

    expect(result).toEqual({ ok: false, error: "Complete all active stations before submitting the final survey." });
    expect(submitted).toBe(false);
  });

  it("submits the final survey once only", async () => {
    let submitted = false;

    const result = await submitFinalSurvey({
      store: createStore({
        async findFinalSurveyResponse() {
          return { id: "survey-1", delegateId: "delegate-1", answers: { satisfaction: "great", favoriteStation: "AI Booth", feedback: "" }, submittedAt: "2025-01-01T00:00:00.000Z" };
        },
        async createFinalSurveyResponse() {
          submitted = true;
          throw new Error("should not submit twice");
        },
      }),
      session: validSession,
      answers: { satisfaction: "great", favoriteStation: "AI Booth", feedback: "" },
    });

    expect(result).toEqual({ ok: false, error: "Final survey has already been submitted." });
    expect(submitted).toBe(false);
  });

  it("blocks survey submission when participation is closed", async () => {
    let submitted = false;

    const result = await submitFinalSurvey({
      store: createStore({
        async readParticipationOpen() {
          return false;
        },
        async createFinalSurveyResponse() {
          submitted = true;
          throw new Error("should not submit while closed");
        },
      }),
      session: validSession,
      answers: { satisfaction: "great", favoriteStation: "AI Booth", feedback: "" },
    });

    expect(result).toEqual({ ok: false, error: "Participation is closed." });
    expect(submitted).toBe(false);
  });
});

describe("final survey confirmation UI", () => {
  it("shows a simple eligible confirmation", () => {
    render(
      <FinalSurveyConfirmation
        result={{
          ok: true,
          delegate: { id: "delegate-1", fullName: "Ada Lovelace", registrationNumber: "REG-001" },
          eligibleAt: "2025-01-01T00:00:00.000Z",
          message: "Ada Lovelace is entered into the lucky draw.",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "You are entered" })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace is entered into the lucky draw.")).toBeInTheDocument();
    expect(screen.getByText("Registration number: REG-001")).toBeInTheDocument();
  });
});
