// render-ad.mjs — assembles the bring-the-humans-03 TikTok ad (1080x1920, ~21.5 s).
//
// Pipeline (two ffmpeg passes, Node standard library only):
//   Pass 1: each scene still gets a slow zoom (zoompan), its on-screen text
//           on a dark band inside TikTok's safe zone, and its narration MP3
//           delayed 0.4 s into the scene. The four scenes are concatenated.
//   Pass 2: the make.fun press-pack recipe from https://make.fun/press/llms.txt —
//           brand badge overlaid from frame 0 until the end card comes in,
//           transparent referral card over the last 2.5 s with the clip
//           blurring (sigma 28) and desaturating underneath, and our own
//           referral code typed into the card's field in JetBrains Mono Bold.
//
// Inputs:
//   - assets/scene{1..4}.webp + assets/narration{1..4}.mp3 (this repo)
//   - Press files, passed as PRESS_DIR (default: the sibling work directory):
//       makefun-badge-9x16.png, makefun-card-9x16-transparent.webm,
//       JetBrainsMono-Bold.ttf (referral code), Inter-Bold.ttf (screen text)
//     Press files are NEVER committed to this repo; they live in the work dir.
//
// Usage:
//   PRESS_DIR=/path/to/press REFERRAL_CODE=89wzjn6w node render-ad.mjs [out.mp4]
//
// Requires ffmpeg 8+ with libfreetype (drawtext) and the libvpx-vp9 decoder.

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const REPO = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(REPO, 'assets');
const PRESS_DIR =
  process.env.PRESS_DIR ??
  resolve(REPO, '..', 'bring-the-humans-03-work', 'press');
const CODE = process.env.REFERRAL_CODE ?? '89wzjn6w';
const OUT = resolve(process.argv[2] ?? join(REPO, 'ad-tiktok-v1.mp4'));
const CLIP = join(
  resolve(REPO, '..', 'bring-the-humans-03-work'),
  'clip.mp4',
);

// The ad's spine: four scenes, each with its still, its narration, how long
// the scene holds, and the lines burned onto the screen. Text lives on a
// dark band at y 1000–1200, inside TikTok's safe zone (x 120, y 269, 840x979)
// and well clear of the brand badge (y 272–400).
const SCENES = [
  {
    img: 'scene1.webp',
    audio: 'narration1.mp3',
    dur: 4.5,
    lines: ['Your AI agent works', 'while you sleep.'],
  },
  {
    img: 'scene2.webp',
    audio: 'narration2.mp3',
    dur: 5.5,
    lines: ['AI agents compete', 'in bounties for real money.'],
  },
  {
    img: 'scene3.webp',
    audio: 'narration3.mp3',
    dur: 5.0,
    lines: ['Bring your agent.', 'Sign up together.'],
  },
  {
    img: 'scene4.webp',
    audio: 'narration4.mp3',
    dur: 6.5,
    lines: ['$500 in prizes. 20 winners.', 'Join now — make.fun'],
  },
];

const W = 1080;
const H = 1920;
const FPS = 30;
const TOTAL = SCENES.reduce((sum, scene) => sum + scene.dur, 0); // 21.5 s
const CARD_LEN = 2.5; // the referral card's length, from the press pack
const CARD_START = TOTAL - CARD_LEN; // 19.0 s — card comes in here
const CARD_REST = 1.433; // seconds until the card's field comes to rest
const TEXT_FONT = join(PRESS_DIR, 'Inter-Bold.ttf');
const CODE_FONT = join(PRESS_DIR, 'JetBrainsMono-Bold.ttf');
const BADGE = join(PRESS_DIR, 'makefun-badge-9x16.png');
const CARD = join(PRESS_DIR, 'makefun-card-9x16-transparent.webm');

// Text layout inside the safe zone: the dark band and the two lines on it.
const BAND = { x: 120, y: 1000, w: 840, h: 200 };
const TEXT_SIZE = 54;
const TEXT_TOP = 1016;
const LINE_STEP = 76;
const NARRATION_DELAY_MS = 400; // narration starts 0.4 s into each scene

// ---- Validation -----------------------------------------------------------

function fail(message) {
  throw new Error(`render-ad.mjs: ${message}`);
}

function validateScenes() {
  if (SCENES.length === 0) fail('no scenes defined');
  for (const [index, scene] of SCENES.entries()) {
    if (typeof scene.dur !== 'number' || !(scene.dur > 0)) {
      fail(`scene ${index + 1}: duration must be a positive number`);
    }
    if (!Array.isArray(scene.lines) || scene.lines.length === 0) {
      fail(`scene ${index + 1}: needs at least one on-screen line`);
    }
    if (scene.lines.length > 2) {
      fail(`scene ${index + 1}: at most two on-screen lines fit the band`);
    }
    for (const file of [scene.img, scene.audio]) {
      if (!existsSync(join(ASSETS, file))) fail(`missing asset: ${file}`);
    }
  }
}

function validatePressFiles() {
  for (const file of [TEXT_FONT, CODE_FONT, BADGE, CARD]) {
    if (!existsSync(file)) fail(`missing press file: ${file}`);
  }
}

function validateReferralCode() {
  if (!/^[a-z0-9]{4,16}$/.test(CODE)) {
    fail(`REFERRAL_CODE looks wrong: ${JSON.stringify(CODE)}`);
  }
}

validateScenes();
validatePressFiles();
validateReferralCode();

console.log(
  `render-ad.mjs: ${SCENES.length} scenes, ${TOTAL}s total, ` +
    `referral code ${CODE}, output ${OUT}`,
);

// ---- Small filter builders ------------------------------------------------

// drawtext chokes on raw ':' and "'"; escape both before interpolating.
const escapeText = (text) => text.replace(/:/g, '\\:').replace(/'/g, "\\'");

// Slow push-in on a still: zoom 1.00 -> 1.08, centred on the frame.
function zoomFilter(inputLabel, frames) {
  return (
    `[${inputLabel}]zoompan=z='1+0.08*on/${frames - 1}':` +
    `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
    `d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1`
  );
}

// Dark band plus the scene's centred lines, then a short fade-in.
function textFilter(scene) {
  const parts = [
    `drawbox=x=${BAND.x}:y=${BAND.y}:w=${BAND.w}:h=${BAND.h}:color=black@0.55:t=fill`,
  ];
  scene.lines.forEach((line, lineIndex) => {
    parts.push(
      `drawtext=fontfile=${TEXT_FONT}:text='${escapeText(line)}':` +
        `fontsize=${TEXT_SIZE}:fontcolor=white:` +
        `x=(w-text_w)/2:y=${TEXT_TOP + lineIndex * LINE_STEP}`,
    );
  });
  parts.push('fade=t=in:st=0:d=0.3');
  return parts.join(',');
}

// One scene's video chain: zoom, then text, labelled [vN].
function sceneVideoFilter(scene, index) {
  const frames = Math.round(scene.dur * FPS);
  return `${zoomFilter(`${index}:v`, frames)},${textFilter(scene)}[v${index}]`;
}

// One scene's audio chain: narration delayed into the scene, padded and
// trimmed to exactly the scene length, labelled [aN].
function sceneAudioFilter(scene, index) {
  const audioInput = SCENES.length + index;
  return (
    `[${audioInput}:a]adelay=${NARRATION_DELAY_MS}|${NARRATION_DELAY_MS},` +
    `apad,atrim=0:${scene.dur}[a${index}]`
  );
}

function concatFilter() {
  const inputs = SCENES.map((_, index) => `[v${index}][a${index}]`).join('');
  return `${inputs}concat=n=${SCENES.length}:v=1:a=1[v][a]`;
}

async function runFfmpeg(label, args) {
  try {
    await run('ffmpeg', args);
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim().split('\n').at(-1) : error.message;
    fail(`${label} failed: ${detail}`);
  }
}

// ---- Pass 1: scenes + narration -> CLIP (21.5 s, no badge/card yet) ----
async function buildClip() {
  const args = [];
  for (const scene of SCENES) args.push('-i', join(ASSETS, scene.img));
  for (const scene of SCENES) args.push('-i', join(ASSETS, scene.audio));

  const filters = SCENES.flatMap((scene, index) => [
    sceneVideoFilter(scene, index),
    sceneAudioFilter(scene, index),
  ]);
  filters.push(concatFilter());

  mkdirSync(dirname(CLIP), { recursive: true });
  await runFfmpeg('pass 1 (scenes)', [
    '-y',
    ...args,
    '-filter_complex',
    filters.join(';\n'),
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(FPS),
    '-crf',
    '18',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    CLIP,
  ]);
  console.log(`pass 1: clip written to ${CLIP} (${TOTAL}s)`);
}

// ---- Pass 2: badge + referral card, following the press-pack recipe ----
function finishFilter() {
  const start = CARD_START;
  const rest = CARD_REST;
  // Referral field geometry for the 9:16 card (manifest referral_card.fields):
  // caret x 210 y 1232 (5x78), code centred on y 1271, 62 px JetBrains Mono Bold.
  return [
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},format=yuva420p,split[clip][soft]`,
    `[soft]gblur=sigma=28,eq=saturation=0.35,fade=t=in:st=${start}:d=0.8:alpha=1[soft]`,
    `[clip][soft]overlay[bg0]`,
    // Badge from frame 0 until the card comes in, then off.
    `[bg0][2:v]overlay=enable='lt(t,${start})'[bg]`,
    `[1:v]format=yuva420p,setpts=PTS-STARTPTS+${start}/TB[card]`,
    `[bg][card]overlay=eof_action=pass`,
    // Cover the blinking caret with white, then type our own code.
    `drawbox=x=208:y=1230:w=9:h=82:color=white:t=fill:enable='gte(t,${start + rest})'`,
    `drawtext=fontfile=${CODE_FONT}:text=${CODE}:fontsize=62:fontcolor=0x191419:x=210:y=1271-(ascent-descent)/2:enable='gte(t,${start + rest})'[v]`,
  ].join(',\n');
}

async function finishAd() {
  await runFfmpeg('pass 2 (badge + card)', [
    '-y',
    '-i',
    CLIP,
    '-c:v',
    'libvpx-vp9',
    '-i',
    CARD,
    '-i',
    BADGE,
    '-filter_complex',
    finishFilter(),
    '-map',
    '[v]',
    '-map',
    '0:a',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '18',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    OUT,
  ]);
  if (!existsSync(OUT)) fail(`pass 2 finished but ${OUT} is missing`);
  console.log(`pass 2: final ad written to ${OUT}`);
}

await buildClip();
await finishAd();

// Quick self-check: duration, size, streams.
const { stdout } = await run('ffprobe', [
  '-v',
  'error',
  '-show_entries',
  'format=duration,size',
  '-show_entries',
  'stream=codec_type,width,height',
  '-of',
  'default=nw=1',
  OUT,
]);
console.log(stdout);
