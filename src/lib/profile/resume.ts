import { createHash, randomUUID } from "node:crypto";
import { basename, extname } from "node:path";

import type { CareerProfile } from "./schemas";
import { createEmptyCareerProfile, CareerProfileSchema } from "./schemas";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 150_000;

export type ResumeKind = "pdf" | "docx" | "txt";
export type UploadedResume = Readonly<{ name: string; type: string; bytes: Uint8Array }>;

const MEDIA_TYPES: Record<ResumeKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export class ResumeValidationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "EMPTY_FILE"
      | "FILE_TOO_LARGE"
      | "UNSUPPORTED_TYPE"
      | "TYPE_MISMATCH"
      | "INVALID_SIGNATURE"
      | "EMPTY_TEXT"
      | "REQUEST_SIZE_REQUIRED"
      | "PARSER_FAILED",
    readonly diagnostic?: string,
  ) {
    super(message);
    this.name = "ResumeValidationError";
  }
}

export function validateResumeUpload(upload: UploadedResume): { kind: ResumeKind; mediaType: string } {
  if (upload.bytes.byteLength === 0) {
    throw new ResumeValidationError("The resume file is empty", "EMPTY_FILE");
  }
  if (upload.bytes.byteLength > MAX_RESUME_BYTES) {
    throw new ResumeValidationError("Resume files must be 5 MB or smaller", "FILE_TOO_LARGE");
  }

  const extension = extname(upload.name).toLocaleLowerCase();
  const kind = ({ ".pdf": "pdf", ".docx": "docx", ".txt": "txt" } as const)[extension];
  if (!kind) {
    throw new ResumeValidationError("Upload a PDF, DOCX, or TXT resume", "UNSUPPORTED_TYPE");
  }
  const suppliedMediaType = upload.type.toLocaleLowerCase();
  const mediaTypeIsGeneric = suppliedMediaType === "" || suppliedMediaType === "application/octet-stream";
  if (!mediaTypeIsGeneric && suppliedMediaType !== MEDIA_TYPES[kind]) {
    throw new ResumeValidationError("The filename and media type do not match", "TYPE_MISMATCH");
  }

  if (kind === "pdf" && !startsWith(upload.bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    throw new ResumeValidationError("The uploaded file is not a valid PDF", "INVALID_SIGNATURE");
  }
  if (kind === "docx") {
    const headerIsZip = startsWith(upload.bytes, [0x50, 0x4b, 0x03, 0x04]);
    const archiveIndex = Buffer.from(upload.bytes).toString("latin1");
    if (
      !headerIsZip ||
      !archiveIndex.includes("[Content_Types].xml") ||
      !archiveIndex.includes("word/document.xml")
    ) {
      throw new ResumeValidationError("The uploaded file is not a valid DOCX document", "INVALID_SIGNATURE");
    }
  }
  if (kind === "txt" && upload.bytes.includes(0)) {
    throw new ResumeValidationError("The text resume contains binary data", "INVALID_SIGNATURE");
  }

  return { kind, mediaType: MEDIA_TYPES[kind] };
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function installPdfJsNodeGlobals(): void {
  const target = globalThis as unknown as {
    DOMMatrix?: new (init?: readonly number[] | string) => {
      a: number;
      b: number;
      c: number;
      d: number;
      e: number;
      f: number;
    };
  };
  if (target.DOMMatrix) return;
  class MinimalDOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;

    constructor(init?: readonly number[] | string) {
      if (Array.isArray(init) && init.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }
  }
  Object.defineProperty(globalThis, "DOMMatrix", {
    configurable: true,
    writable: true,
    value: MinimalDOMMatrix,
  });
}

async function parseText(upload: UploadedResume, kind: ResumeKind): Promise<string> {
  try {
    if (kind === "txt") {
      return new TextDecoder("utf-8", { fatal: true }).decode(upload.bytes);
    }
    if (kind === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(upload.bytes) });
      return result.value;
    }

    installPdfJsNodeGlobals();
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({
      data: upload.bytes,
      useSystemFonts: true,
    }).promise;
    try {
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent({
          includeMarkedContent: false,
          disableNormalization: false,
        });
        pages.push(
          content.items
            .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
            .filter(Boolean)
            .join(" "),
        );
      }
      return pages.join("\n");
    } finally {
      await document.destroy();
    }
  } catch (error) {
    if (error instanceof ResumeValidationError) throw error;
    console.error("Resume parser failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    throw new ResumeValidationError(
      "The resume could not be read safely",
      "PARSER_FAILED",
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
  }
}

function normalizeText(text: string): string {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) throw new ResumeValidationError("No readable text was found", "EMPTY_TEXT");
  return normalized.slice(0, MAX_EXTRACTED_CHARACTERS);
}

const SKILL_DICTIONARY: Readonly<Record<keyof CareerProfile["skills"], readonly string[]>> = {
  languages: ["JavaScript", "TypeScript", "Python", "Java", "Go", "Rust", "C++", "C#"],
  frontend: ["React", "Next.js", "Vue", "Angular", "Tailwind CSS", "HTML", "CSS"],
  backend: ["Node.js", "NestJS", "FastAPI", "Django", "Express", "Spring Boot"],
  databases: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Supabase"],
  cloud: ["AWS", "Azure", "Google Cloud", "Vercel"],
  devops: ["Docker", "Kubernetes", "Terraform", "GitHub Actions", "CI/CD"],
  aiMl: ["Machine Learning", "PyTorch", "TensorFlow", "scikit-learn", "NLP"],
  llmGenAi: ["LLM", "GenAI", "Generative AI", "LangChain", "LangGraph", "RAG", "OpenAI"],
  tools: ["Git", "GitHub", "Jira", "Postman", "Figma"],
};

function exactSkillMatches(text: string, skill: string): boolean {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#])${escaped}($|[^a-z0-9+#])`, "i").test(text);
}

function buildDraft(text: string, upload: UploadedResume, mediaType: string, now: string, sha256: string) {
  const profile = createEmptyCareerProfile(now);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const name =
    lines.find(
      (line) =>
        line.length <= 120 &&
        /^[\p{L}][\p{L} .'-]+$/u.test(line) &&
        !/^(resume|curriculum vitae|cv|summary|profile|skills|experience|education)$/i.test(line),
    ) ?? "";
  const evidence: CareerProfile["evidence"] = [];
  if (name) {
    evidence.push({ id: randomUUID(), source: "resume", fieldPath: "personal.name", excerpt: name });
  }
  if (email) {
    evidence.push({ id: randomUUID(), source: "resume", fieldPath: "personal.email", excerpt: email });
  }

  const skills = Object.fromEntries(
    Object.entries(SKILL_DICTIONARY).map(([category, values]) => [
      category,
      values.filter((skill) => exactSkillMatches(text, skill)),
    ]),
  ) as CareerProfile["skills"];
  for (const [category, values] of Object.entries(skills)) {
    for (const skill of values) {
      evidence.push({
        id: randomUUID(),
        source: "resume",
        fieldPath: `skills.${category}`,
        excerpt: skill,
      });
    }
  }

  return CareerProfileSchema.parse({
    ...profile,
    personal: { ...profile.personal, name, email },
    skills,
    resumeSource: {
      originalName: basename(upload.name.replaceAll("\\", "/")),
      mediaType,
      size: upload.bytes.byteLength,
      sha256,
      extractedAt: now,
    },
    evidence,
    extractionWarnings: [
      "Review every extracted field before approval.",
      "Experience, projects, education, and certifications require manual review before they are added.",
    ],
  });
}

export async function extractResume(
  upload: UploadedResume,
  options: { now?: () => string } = {},
): Promise<{ profile: CareerProfile; text: string; sha256: string }> {
  const { kind, mediaType } = validateResumeUpload(upload);
  const text = normalizeText(await parseText(upload, kind));
  const sha256 = createHash("sha256").update(upload.bytes).digest("hex");
  const now = options.now?.() ?? new Date().toISOString();
  return { profile: buildDraft(text, upload, mediaType, now, sha256), text, sha256 };
}
