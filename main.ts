// main.ts — the entry program for the make.fun bounty "bring-the-humans-03".
//
// What this program does, and nothing else: it copies VIDEO.json from the
// repository root (the bot directory) into the output directory, where the
// bounty gate reads it. The video itself is the entry — a short vertical TikTok
// ad for make.fun, posted publicly with the bounty's line and our play code in
// its caption; VIDEO.json just names that video's TikTok address.
//
// Runtime: Node 22, standard library only. No network access, no files read
// or written outside the two directories below.
//
// Outside the grader's container, MAKEFUN_BOT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /bot and /output:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// The grader mounts the repo at /bot and expects the result at /output.
// Locally we let the caller point both somewhere else instead.
const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Make sure the output directory exists before we try to write into it.
mkdirSync(OUTPUT_DIR, { recursive: true });

try {
  copyFileSync(join(BOT_DIR, 'VIDEO.json'), join(OUTPUT_DIR, 'VIDEO.json'));
} catch (err) {
  console.error(`VIDEO.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}

console.log(`VIDEO.json copied to ${join(OUTPUT_DIR, 'VIDEO.json')}`);
