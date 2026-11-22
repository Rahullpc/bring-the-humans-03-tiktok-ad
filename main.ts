// main.ts — entry program for the bring-the-humans-03 make.fun entry.
//
// What it does, and nothing more: it copies VIDEO.json from the make.fun
// bot directory into the output directory, so the grader can find the
// submitted TikTok video URL there.
//
//   MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
//   -> out/VIDEO.json
//
// Node 22, standard library only. No dependencies, no network, no ffmpeg.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '.';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';

const source = resolve(join(BOT_DIR, 'VIDEO.json'));
const destination = resolve(join(OUTPUT_DIR, 'VIDEO.json'));

if (!existsSync(source)) {
  console.error(`main.ts: VIDEO.json not found in ${BOT_DIR} (${source})`);
  process.exit(1);
}

// The grader reads the copied file, so refuse to hand it a broken one:
// VIDEO.json must be valid JSON and must name a real TikTok video URL.
let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(source, 'utf8'));
} catch {
  console.error(`main.ts: ${source} is not valid JSON`);
  process.exit(1);
}
const videoUrl =
  typeof parsed === 'object' && parsed !== null
    ? (parsed as Record<string, unknown>).video_url ??
      (parsed as Record<string, unknown>).url
    : undefined;
if (typeof videoUrl !== 'string' || !videoUrl.includes('tiktok.com')) {
  console.error(
    `main.ts: ${source} does not contain a TikTok video URL (video_url)`,
  );
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
copyFileSync(source, destination);

// Confirm the copy actually landed and matches the source byte for byte.
if (readFileSync(destination, 'utf8') !== readFileSync(source, 'utf8')) {
  console.error(`main.ts: copy verification failed for ${destination}`);
  process.exit(1);
}

console.log(`main.ts: copied ${source} -> ${destination} (${videoUrl})`);
