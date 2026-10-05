import { describe, expect, it } from "vitest";

import { createInterviewWorkspace, updateQuestionPractice } from "./domain";

describe("interview workspace", () => {
  it("creates all preparation sections and immutably tracks question practice", async () => {
    const workspace = await createInterviewWorkspace(
      {
        applicationId: "app-1",
        company: "Acme",
        role: "AI Engineer",
        evidence: [{ id: "ev-1", excerpt: "Built FastAPI services" }],
      },
      undefined,
      "2026-10-03T10:00:00.000Z",
      "interview-1",
    );
    const question = workspace.sections.technicalQuestions[0];
    expect(question).toBeDefined();
    const updated = updateQuestionPractice(
      workspace,
      question!.id,
      "confident",
      "2026-10-03T11:00:00.000Z",
    );

    expect(workspace.sections.technicalQuestions[0]?.practiceStatus).toBe("not_practiced");
    expect(updated.sections.technicalQuestions[0]?.practiceStatus).toBe("confident");
    expect(updated.sections.questionsForInterviewer.length).toBeGreaterThan(0);
  });
});
