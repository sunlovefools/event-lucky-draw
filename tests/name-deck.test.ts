import { describe, expect, it } from "vitest";

import { createShuffledNameDeck } from "@/lib/shared/name-deck";

describe("shuffled name deck", () => {
  it("does not start with the previously displayed name when alternatives exist", () => {
    const nextName = createShuffledNameDeck(
      ["Ada Lovelace", "Grace Hopper", "Katherine Johnson"],
      "Ada Lovelace",
      () => 0,
    );

    expect(nextName()).not.toBe("Ada Lovelace");
  });

  it("shows every unique eligible name before repeating one", () => {
    const nextName = createShuffledNameDeck(
      ["Ada Lovelace", "Grace Hopper", "Katherine Johnson", "Ada Lovelace"],
      "Ada Lovelace",
      () => 0,
    );

    const firstCycle = [nextName(), nextName(), nextName()];
    expect(new Set(firstCycle)).toEqual(new Set(["Ada Lovelace", "Grace Hopper", "Katherine Johnson"]));

    const firstOfNextCycle = nextName();
    expect(firstOfNextCycle).not.toBe(firstCycle.at(-1));
  });
});
