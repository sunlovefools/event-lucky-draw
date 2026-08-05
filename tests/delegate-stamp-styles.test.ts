import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("delegate stamp mobile layout", () => {
  it("uses equal fixed-height stamp cards on narrow screens", () => {
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

    expect(css).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.stamp-grid\s*{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*grid-auto-rows:\s*180px;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.stamp\s*{[^}]*height:\s*100%;/,
    );
  });
});
