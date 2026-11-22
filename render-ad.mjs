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
// the scene holds, and the two lines burned onto the screen. Text lives on a
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
const TOTAL = SCENES.reduce((s, sc) => s + sc.dur, 0); // 21.5 s
const CARD_LEN = 2.5; // the referral card's length, from the press pack
const CARD_START = TOTAL - CARD_LEN; // 19.0 s — card comes in here
const CARD_REST = 1.433; // seconds until the card's field comes to rest
const TEXT_FONT = join(PRESS_DIR, 'Inter-Bold.ttf');
const CODE_FONT = join(PRESS_DIR, 'JetBrainsMono-Bold.ttf');
const BADGE = join(PRESS_DIR, 'makefun-badge-9x16.png');
const CARD = join(PRESS_DIR, 'makefun-card-9x16-transparent.webm');

// Fail loudly before any ffmpeg work if an input is missing.
for (const sc of SCENES) {
  for (const f of [sc.img, sc.audio]) {
    if (!existsSync(join(ASSETS, f))) throw new Error(`missing asset: ${f}`);
  }
}
for (const f of [TEXT_FONT, CODE_FONT, BADGE, CARD]) {
  if (!existsSync(f)) throw new Error(`missing press file: ${f}`);
}

const escapeText = (s) => s.replace(/:/g, '\\:').replace(/'/g, "\\'");

// ---- Pass 1: scenes + narration -> CLIP (21.5 s, no badge/card yet) ----
async function buildClip() {
  const args = [];
  const filters = [];
  SCENES.forEach((sc, i) => {
    args.push('-i', join(ASSETS, sc.img));
  });
  SCENES.forEach((sc, i) => {
    args.push('-i', join(ASSETS, sc.audio));
  });
  SCENES.forEach((sc, i) => {
    const frames = Math.round(sc.dur * FPS);
    // Slow push-in on the still: zoom 1.00 -> 1.08, centred.
    let v = `[${i}:v]zoompan=z='1+0.08*on/${frames - 1}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1`;
    // Dark band + two centred lines, then a short fade-in for the whole scene.
    v += `,drawbox=x=120:y=1000:w=840:h=200:color=black@0.55:t=fill`;
    sc.lines.forEach((line, li) => {
      v += `,drawtext=fontfile=${TEXT_FONT}:text='${escapeText(line)}':fontsize=54:fontcolor=white:x=(w-text_w)/2:y=${1016 + li * 76}`;
    });
    v += `,fade=t=in:st=0:d=0.3[v${i}]`;
    filters.push(v);
    // Narration starts 0.4 s into the scene, padded out to the scene length.
    filters.push(
      `[${SCENES.length + i}:a]adelay=400|400,apad,atrim=0:${sc.dur}[a${i}]`,
    );
  });
  const concatInputs = SCENES.map((_, i) => `[v${i}][a${i}]`).join('');
  filters.push(`${concatInputs}concat=n=${SCENES.length}:v=1:a=1[v][a]`);
  mkdirSync(dirname(CLIP), { recursive: true });
  await run('ffmpeg', [
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
async function finishAd() {
  const T = CARD_START;
  const REST = CARD_REST;
  // Referral field geometry for the 9:16 card (manifest referral_card.fields):
  // caret x 210 y 1232 (5x78), code centred on y 1271, 62 px JetBrains Mono Bold.
  const filter = [
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},format=yuva420p,split[clip][soft]`,
    `[soft]gblur=sigma=28,eq=saturation=0.35,fade=t=in:st=${T}:d=0.8:alpha=1[soft]`,
    `[clip][soft]overlay[bg0]`,
    // Badge from frame 0 until the card comes in, then off.
    `[bg0][2:v]overlay=enable='lt(t,${T})'[bg]`,
    `[1:v]format=yuva420p,setpts=PTS-STARTPTS+${T}/TB[card]`,
    `[bg][card]overlay=eof_action=pass`,
    // Cover the blinking caret with white, then type our own code.
    `drawbox=x=208:y=1230:w=9:h=82:color=white:t=fill:enable='gte(t,${T + REST})'`,
    `drawtext=fontfile=${CODE_FONT}:text=${CODE}:fontsize=62:fontcolor=0x191419:x=210:y=1271-(ascent-descent)/2:enable='gte(t,${T + REST})'[v]`,
  ].join(',\n');
  await run('ffmpeg', [
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
    filter,
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
