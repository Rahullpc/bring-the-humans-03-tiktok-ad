// main.ts — entry program for the bring-the-humans-03 make.fun entry (round 10).
//
// Round 10's video is a re-upload: the owner's own game recording, posted
// again after TikTok took the round 9 video down for a Community Guidelines
// violation. The new video carries the same play code in the account bio
// and a cleaner caption that still mentions the $500 bounty and make.fun.
//
// The submitted entry is a TikTok video; its URL lives in VIDEO.json at the
// repo root. This program copies that file into the output directory so the
// grader can read it there:
//
//   MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
//   -> out/VIDEO.json
//
// Node 22+, standard library only. No dependencies, no network access.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// A submitted video URL must be a full TikTok video address, never a short
// link: https://www.tiktok.com/@<handle>/video/<digits>
const VIDEO_URL = /^https:\/\/www\.tiktok\.com\/@[^/]+\/video\/\d+$/;

function die(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

const botDir = process.env.MAKEFUN_BOT_DIR ?? ".";
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";

const source = resolve(join(botDir, "VIDEO.json"));
const target = resolve(join(outDir, "VIDEO.json"));

if (!existsSync(source)) {
  die(`no VIDEO.json under ${botDir} (looked at ${source})`);
}

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(source, "utf8"));
} catch {
  die(`${source} is not valid JSON`);
}

const url =
  typeof parsed === "object" && parsed !== null
    ? (parsed as Record<string, unknown>).url
    : undefined;

if (typeof url !== "string" || !VIDEO_URL.test(url.trim())) {
  die(
    `${source} has no usable TikTok video URL in its "url" field ` +
      `(expected https://www.tiktok.com/@handle/video/<digits>)`,
  );
}

mkdirSync(outDir, { recursive: true });
copyFileSync(source, target);

if (readFileSync(target, "utf8") !== readFileSync(source, "utf8")) {
  die(`copied ${target} does not match ${source} byte for byte`);
}

console.log(`main.ts: copied ${source} -> ${target} (${url.trim()})`);
