import { describe, expect, test } from "vitest";

import { diagnoseProject } from "../src/lib/doctor.js";

describe("diagnoseProject", () => {
  test("formats verification issues into grouped remediation guidance", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "missing-step6-file",
          message: "Missing 00_execution_plan.md",
          path: "06_execution_plan"
        },
        {
          code: "absolute-path-link",
          message: "Found absolute path link",
          path: "04_image_prompts/shot-01.md"
        }
      ]
    });

    expect(output).toContain("Structure");
    expect(output).toContain("Links");
    expect(output).toContain("00_execution_plan.md");
    expect(output).toContain("relative path");
  });
});
