import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("delete-all delegates migration", () => {
  it.each([
    "20260803000000_delete_all_delegates.sql",
    "20260804002000_allow_delete_all_delegates.sql",
  ])("uses explicit predicates for every DELETE in %s", (filename) => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations", filename), "utf8");
    const deleteStatements = migration.match(/delete\s+from\s+[^;]+;/gi) ?? [];

    expect(deleteStatements).toHaveLength(2);
    expect(deleteStatements.every((statement) => /\swhere\s/i.test(statement))).toBe(true);
  });
});
