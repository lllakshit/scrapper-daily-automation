import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const source = path.join(
  process.cwd(),
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.mjs",
);
const target = path.join(process.cwd(), ".next", "server", "chunks", "pdf.worker.mjs");

await mkdir(path.dirname(target), { recursive: true });
await copyFile(source, target);
console.log("Copied pdf.worker.mjs for server PDF parsing");
