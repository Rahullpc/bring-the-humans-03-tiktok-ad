#!/usr/bin/env python3
"""Rakit narasi TTS ke video-asli.mp4 (bring-the-humans-03).

Blok narasi (start detik) + segmen TTS (sudah dipangkas silence ujung):
  A @ 0.0 : seg01f + seg02f                       (target <= 3.30 dtk)
  B @ 3.4 : seg03  + seg04  (speed 100)           (target <= 4.70 dtk)
  C @ 8.2 : seg05f + seg06f + seg07f + seg08f + seg09f (target <= 6.25 dtk)
  D @14.6 : seg10f                                (target <= 4.45 dtk)
  E @19.2 : seg11f + seg13f                       (target <= 5.10 dtk)
  Catatan: seg12 ("Pakai kode referral v, j, e, v:") TIDAK diucapkan —
  total ucapan 3 blok akhir melebihi durasi video; teksnya tetap tampil
  di layar pada 0:20.4 dan kode tetap dieja penuh di seg13. Jika bos mau
  baris itu tetap diucapkan, video harus diperpanjang (tahan end card).
Audio asli video adalah digital silence (-91 dB) sehingga hanya narasi
yang dipakai sebagai track audio. Video stream di-copy tanpa re-encode.
"""
import subprocess, os, sys

D = "/home/hatch/workspace/videos"  # placeholder, diganti di bawah
D = "/home/hatch/workspace/makefun/bring-the-humans-03"
N = os.path.join(D, "narasi")
OUT = os.path.join(D, "tiktok-ad-dengan-suara.mp4")
VIDEO = os.path.join(D, "video-asli.mp4")
VIDEO_DUR = 24.4
GAP = 0.05          # jeda antar segmen dalam satu blok
MAX_ATEMPO = 1.25   # batas percepatan yang masih wajar

BLOCKS = [
    ("A", 0.0, 3.30, ["seg01f", "seg02f"]),
    ("B", 3.4, 4.70, ["seg03", "seg04"]),
    ("C", 8.2, 6.25, ["seg05f", "seg06f", "seg07f", "seg08f", "seg09f"]),
    ("D", 14.6, 4.45, ["seg10f"]),
    ("E", 19.2, 5.10, ["seg11f", "seg13f"]),
]

def run(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)

def dur(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
        "format=duration", "-of", "csv=p=0", path], text=True)
    return float(out.strip())

def trim(src_mp3, dst_wav):
    """Pangkas silence awal+akhir, hasil wav 44.1k stereo."""
    run(["ffmpeg", "-y", "-v", "error", "-i", src_mp3, "-af",
         "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,"
         "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,"
         "aresample=44100,aformat=channel_layouts=stereo",
         dst_wav])

def main():
    os.makedirs(os.path.join(D, "work"), exist_ok=True)
    # 0. silence 0.05 dtk untuk jeda antar segmen
    sil = os.path.join(D, "work", "gap005.wav")
    if not os.path.exists(sil):
        run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi",
             "-i", "anullsrc=r=44100:cl=stereo", "-t", str(GAP), sil])
    trimmed = {}
    for _, _, _, segs in BLOCKS:
        for s in segs:
            src = os.path.join(N, s + ".mp3")
            dst = os.path.join(D, "work", s + "t.wav")
            if not os.path.exists(dst):
                trim(src, dst)
            trimmed[s] = dst
            print(f"trim {s}: {dur(dst):.2f} dtk (dari {dur(src):.2f})")

    block_files = []
    for name, start, target, segs in BLOCKS:
        parts, total = [], 0.0
        for i, s in enumerate(segs):
            if i > 0:
                parts.append(sil); total += GAP
            parts.append(trimmed[s]); total += dur(trimmed[s])
        tempo = total / target
        print(f"Blok {name} @{start}: mentah {total:.2f} dtk, target {target:.2f}, "
              f"atempo {tempo:.3f}")
        if tempo > MAX_ATEMPO:
            print(f"  !! Blok {name} butuh atempo {tempo:.2f} > batas {MAX_ATEMPO} — BERHENTI")
            sys.exit(2)
        if tempo < 1.0:
            tempo = 1.0
        lst = os.path.join(D, "work", f"block{name}.txt")
        with open(lst, "w") as f:
            for p in parts:
                f.write(f"file '{p}'\n")
        raw = os.path.join(D, "work", f"block{name}-raw.wav")
        run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
             "-i", lst, "-c", "copy", raw])
        final = os.path.join(D, "work", f"block{name}.wav")
        if tempo > 1.001:
            run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af",
                 f"atempo={tempo:.4f}", final])
        else:
            run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-c", "copy", final])
        print(f"  -> blok {name}: {dur(final):.2f} dtk (target {target:.2f})")
        block_files.append((start, final))

    # Gabung: tiap blok di-delay ke start-nya, mix, pad sampai durasi video.
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", VIDEO]
    for _, bf in block_files:
        cmd += ["-i", bf]
    fc = []
    for i, (start, _) in enumerate(block_files):
        ms = int(round(start * 1000))
        fc.append(f"[{i+1}:a]adelay={ms}|{ms},apad[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(len(block_files)))
    fc.append(f"{mix}amix=inputs={len(block_files)}:normalize=0,apad=whole_dur={VIDEO_DUR},"
              f"loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
    cmd += ["-filter_complex", ";".join(fc),
            "-map", "0:v", "-map", "[aout]",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
            "-t", str(VIDEO_DUR), OUT]
    run(cmd)
    print("SELESAI:", OUT)
    print("durasi output:", round(dur(OUT), 2), "dtk (asli:", VIDEO_DUR, ")")

if __name__ == "__main__":
    main()
