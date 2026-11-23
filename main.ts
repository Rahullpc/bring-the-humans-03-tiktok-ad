// main.ts — entry program for the bring-the-humans-03 make.fun entry.
//
// It copies VIDEO.json (the submitted TikTok video URL) from the bot
// directory into the output directory, so the grader can read it there:
//
//   MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
//   -> out/VIDEO.json
//
// Node 22+, standard library only. No dependencies, no network access.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

const botDir = process.env.MAKEFUN_BOT_DIR ?? ".";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";

const inputPath = resolve(join(botDir, "VIDEO.json"));
const outputPath = resolve(join(outputDir, "VIDEO.json"));

if (!existsSync(inputPath)) {
  fail(`VIDEO.json not found under ${botDir} (looked at ${inputPath})`);
}

let data: unknown;
try {
  data = JSON.parse(readFileSync(inputPath, "utf8"));
} catch {
  fail(`${inputPath} is not valid JSON`);
}

const url =
  typeof data === "object" && data !== null
    ? (data as Record<string, unknown>).url
    : undefined;

if (
  typeof url !== "string" ||
  url.trim().length === 0 ||
  url.trim() !== url ||
  !url.includes("tiktok.com")
) {
  fail(
    `${inputPath} has no usable TikTok video URL in its "url" field ` +
      `(empty, whitespace-padded, or not a tiktok.com link)`,
  );
}

mkdirSync(outputDir, { recursive: true });
copyFileSync(inputPath, outputPath);

const copied = readFileSync(outputPath, "utf8");
const original = readFileSync(inputPath, "utf8");
if (copied !== original) {
  fail(`copied file ${outputPath} does not match ${inputPath} byte for byte`);
}

console.log(`main.ts: copied ${inputPath} -> ${outputPath} (${url})`);
