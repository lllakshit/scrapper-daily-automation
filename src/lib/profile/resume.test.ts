import { describe, expect, it } from "vitest";

import {
  MAX_RESUME_BYTES,
  ResumeValidationError,
  extractResume,
  validateResumeUpload,
} from "./resume";

const textResume = (overrides: Partial<{ name: string; type: string; bytes: Uint8Array }> = {}) => ({
  name: overrides.name ?? "resume.txt",
  type: overrides.type ?? "text/plain",
  bytes:
    overrides.bytes ??
    new TextEncoder().encode(
      "Asha Example\ncandidate@example.com\nSkills\nTypeScript, Python, Next.js",
    ),
});

describe("resume upload validation", () => {
  it("accepts PDF, DOCX and plain text signatures", () => {
    expect(
      validateResumeUpload({
        name: "resume.pdf",
        type: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.7 sample"),
      }).kind,
    ).toBe("pdf");

    const docxBytes = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...new TextEncoder().encode("[Content_Types].xml word/document.xml"),
    ]);
    expect(
      validateResumeUpload({
        name: "resume.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        bytes: docxBytes,
      }).kind,
    ).toBe("docx");

    expect(validateResumeUpload(textResume()).kind).toBe("txt");
    expect(validateResumeUpload(textResume({ type: "application/octet-stream" })).kind).toBe("txt");
  });

  it("rejects extension, MIME and signature spoofing", () => {
    expect(() => validateResumeUpload(textResume({ name: "resume.exe" }))).toThrow(
      ResumeValidationError,
    );
    expect(() => validateResumeUpload(textResume({ type: "application/pdf" }))).toThrow(
      ResumeValidationError,
    );
    expect(() =>
      validateResumeUpload({
        name: "resume.pdf",
        type: "application/pdf",
        bytes: new TextEncoder().encode("not a pdf"),
      }),
    ).toThrow(ResumeValidationError);
    expect(() =>
      validateResumeUpload(
        textResume({ bytes: new Uint8Array([0x66, 0x6f, 0x00, 0x6f]) }),
      ),
    ).toThrow(ResumeValidationError);
  });

  it("rejects empty and oversized documents", () => {
    expect(() => validateResumeUpload(textResume({ bytes: new Uint8Array() }))).toThrow(
      ResumeValidationError,
    );
    expect(() =>
      validateResumeUpload(textResume({ bytes: new Uint8Array(MAX_RESUME_BYTES + 1) })),
    ).toThrow(ResumeValidationError);
  });
});

describe("resume extraction", () => {
  it("builds a reviewable draft from only evidence present in the document", async () => {
    const result = await extractResume(textResume(), {
      now: () => "2026-10-03T10:00:00.000Z",
    });

    expect(result.profile.status).toBe("draft");
    expect(result.profile.personal.name).toBe("Asha Example");
    expect(result.profile.personal.email).toBe("candidate@example.com");
    expect(result.profile.skills.languages).toEqual(expect.arrayContaining(["TypeScript", "Python"]));
    expect(result.profile.skills.frontend).toContain("Next.js");
    expect(result.profile.experience).toEqual([]);
    expect(result.text).toContain("Asha Example");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
