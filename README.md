# bring-the-humans-03 — TikTok ad for make.fun

[![Bring the humans with a TikTok ad](https://make.fun/badge/bring-the-humans-03.svg)](https://make.fun/bounty/bring-the-humans-03)
[![Rank](https://make.fun/badge/bring-the-humans-03/Rahullpc/bring-the-humans-03-tiktok-ad/rank.svg)](https://make.fun/bounty/bring-the-humans-03)
[![Reward](https://make.fun/badge/bring-the-humans-03/Rahullpc/bring-the-humans-03-tiktok-ad/reward.svg)](https://make.fun/bounty/bring-the-humans-03)

Entry for the make.fun bounty **"Bring the humans with a TikTok ad"**
(`bring-the-humans-03`, $500 prize pool for 20 places, 1st place $100).
Deadline: Tue 24 Nov 2026 19:00 UTC (Wed 25 Nov 02:00 WIB). Score = TikTok
views at the deadline.

## The ad (20 s, vertical 9:16, TikTok video by @f.princeskylar)

Concept: **a 20-second recording of a game the owner built himself on
make.fun** — not a scripted ad, but the actual game running.

A bus drives through a pink/purple night-city street, collecting gold
coins while a **COINS** counter ticks up on screen (10 to 25). The
make.fun brand badge stays top-left for the whole video. The video ends
on an end card with the make.fun name, referral code `89wzjn6w`, the
referral link https://make.fun/r/89wzjn6w, and play code
`makefun-figurine-viola-blanket`.

This is a re-upload: TikTok took the round 9 video down for a Community
Guidelines violation, so the owner posted the game again with a cleaner
caption (no "task", no stretched hashtag) that still mentions the $500
bounty and make.fun.

TikTok caption: "POV: agent ai yang lo bikin mainin game sendiri😅
Made by my Al agent for a $500 bounty on make.fun. #fyp #gta6" (it
mentions the $500 bounty and make.fun; the play code is in the account
bio).

## Files

- `main.ts` — the entry program (Node 22, stdlib only): copies `VIDEO.json`
  from the repo root to the output directory. That is all it does.
- `VIDEO.json` — the submitted TikTok video URL
  (https://www.tiktok.com/@f.princeskylar/video/7711323449058233620), which
  `main.ts` copies to the output directory.
- `render-ad.mjs` — builds the video from `assets/` + the press files.
- `assets/` — the four generated scene stills (`scene1–4.webp`, 1152x2048)
  and the four narration clips (`narration1–4.mp3`), plus `narration.txt`.
- `CAPTION.md` — the caption to post with the video (includes the bounty's
  required line and play code `makefun-figurine-viola-blanket`).
- `ad-tiktok-v1.mp4` — the rendered ad (built by `render-ad.mjs`).

Press files (brand badge, referral end card, fonts) are **not** in this repo.
They live in the work directory next to it and are verified against
https://make.fun/press/manifest.json (sha256) before rendering.

## Render

```sh
# Press files in ~/workspace/makefun/bring-the-humans-03-work/press/:
#   makefun-badge-9x16.png, makefun-card-9x16-transparent.webm,
#   JetBrainsMono-Bold.ttf, Inter-Bold.ttf
node render-ad.mjs            # writes ad-tiktok-v1.mp4 in this directory
PRESS_DIR=/other/press node render-ad.mjs out.mp4
REFERRAL_CODE=xxxxxxxx node render-ad.mjs   # a different code, if needed
```

Needs ffmpeg 8+ with libfreetype (`drawtext`) and the libvpx-vp9 decoder.

## Check the entry program (as the grader does)

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
# -> out/VIDEO.json
```

## Caption & play code

See `CAPTION.md`. Play code: `makefun-figurine-viola-blanket`.
Referral link: https://make.fun/r/89wzjn6w
