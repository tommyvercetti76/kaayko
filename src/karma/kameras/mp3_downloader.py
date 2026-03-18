#!/usr/bin/env python3
"""
YouTube to MP3 Downloader
Requires: pip install -U yt-dlp
- Clean output (no yt-dlp noise)
- Auto-installs ffmpeg via imageio-ffmpeg if missing
- Supports single videos, playlists, and multiple URLs
- No ffprobe required
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import yt_dlp
except ImportError:
    print("ERROR: yt_dlp is not installed.  Run: pip install -U yt-dlp")
    sys.exit(1)


# ── ffmpeg resolver ────────────────────────────────────────────────────────────

FFMPEG_SEARCH_PATHS = [
    "/usr/local/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
    "/opt/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
    os.path.expanduser("~/bin/ffmpeg"),
]


def _pip_install(package: str) -> None:
    print(f"  pip install {package} …")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "--quiet", package],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def ensure_ffmpeg() -> str:
    """Return full path to the ffmpeg executable, installing if needed."""

    env = os.environ.get("FFMPEG_BIN")
    if env:
        p = Path(env).expanduser()
        if p.is_file() and os.access(p, os.X_OK):
            return str(p)
        raise RuntimeError(f"FFMPEG_BIN set but not usable: {env}")

    found = shutil.which("ffmpeg")
    if not found:
        for c in FFMPEG_SEARCH_PATHS:
            if os.path.isfile(c) and os.access(c, os.X_OK):
                found = c
                break

    if found:
        return found

    # Auto-install via imageio-ffmpeg
    print("ffmpeg not found — installing via imageio-ffmpeg …")
    try:
        import imageio_ffmpeg  # type: ignore
    except ImportError:
        _pip_install("imageio-ffmpeg")
        import imageio_ffmpeg  # type: ignore

    exe = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"ffmpeg ready: {exe}\n")
    return exe


def find_nodejs() -> str | None:
    for name in ("node", "nodejs"):
        found = shutil.which(name)
        if found:
            return found
    for p in ("/usr/local/bin/node", "/opt/homebrew/bin/node", "/opt/local/bin/node"):
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return None


# ── Conversion ─────────────────────────────────────────────────────────────────

def convert_to_mp3(ffmpeg_exe: str, src: str, bitrate: str) -> str:
    """Convert src to .mp3 using ffmpeg directly (no ffprobe needed)."""
    dst = str(Path(src).with_suffix(".mp3"))
    if Path(src).suffix.lower() == ".mp3":
        return src

    result = subprocess.run(
        [
            ffmpeg_exe, "-y",
            "-i", src,
            "-vn",
            "-codec:a", "libmp3lame",
            "-b:a", f"{bitrate}k",
            "-ar", "44100",
            dst,
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr[-600:])

    try:
        os.remove(src)
    except OSError:
        pass

    return dst


# ── Progress display ───────────────────────────────────────────────────────────

class TrackProgress:
    """Tracks per-file download progress and collects finished filenames."""

    def __init__(self) -> None:
        self.finished: list[str] = []
        self._last_pct = ""

    def hook(self, d: dict) -> None:
        status = d.get("status")
        fname  = Path(d.get("filename", "")).stem[:50]

        if status == "downloading":
            pct   = d.get("_percent_str", "").strip()
            speed = d.get("_speed_str",   "").strip()
            if pct != self._last_pct:
                print(f"\r  ↓ {fname:<50}  {pct:>6}  {speed}", end="", flush=True)
                self._last_pct = pct

        elif status == "finished":
            filename = d.get("filename", "")
            print(f"\r  ✓ {fname:<50}  downloaded          ")
            if filename:
                self.finished.append(filename)
            self._last_pct = ""


# ── Core download function ─────────────────────────────────────────────────────

def download_urls(
    urls: list[str],
    output_dir: str,
    bitrate: str,
    ffmpeg_exe: str,
    node_path: str | None,
) -> None:
    os.makedirs(output_dir, exist_ok=True)
    progress = TrackProgress()

    ydl_opts: dict = {
        "format":            "bestaudio/best",
        "outtmpl":           os.path.join(output_dir, "%(title)s.%(ext)s"),
        # Suppress all yt-dlp internal output
        "quiet":             True,
        "no_warnings":       True,
        "noprogress":        True,
        "retries":           3,
        "fragment_retries":  3,
        "progress_hooks":    [progress.hook],
        # Skip files already downloaded
        "no_overwrites":     True,
    }

    if node_path:
        ydl_opts["extractor_args"] = {
            "youtube": {"js_runtimes": [f"nodejs:{node_path}"]}
        }

    print(f"Output folder : {os.path.abspath(output_dir)}")
    print(f"Bitrate       : {bitrate} kbps")
    print(f"URLs          : {len(urls)}\n")
    print("-" * 60)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for url in urls:
            try:
                # Get metadata for a friendly header
                info = ydl.extract_info(url, download=False)
                if info.get("_type") == "playlist":
                    entries = info.get("entries") or []
                    print(f"\nPlaylist : {info.get('title', url)}")
                    print(f"Tracks   : {len(entries)}")
                else:
                    print(f"\nTrack    : {info.get('title', url)}")
                print()
                ydl.download([url])
            except yt_dlp.utils.DownloadError as e:
                print(f"\n  ✗ Failed: {e}\n")

    # ── Also pick up any leftover .webm / .opus / .m4a files ──────────────────
    # (handles files from previous failed runs that are already on disk)
    AUDIO_EXTS = {".webm", ".opus", ".m4a", ".ogg", ".wav", ".flac", ".aac"}
    for f in Path(output_dir).iterdir():
        if f.suffix.lower() in AUDIO_EXTS and str(f) not in progress.finished:
            progress.finished.append(str(f))

    # ── Convert everything to MP3 ─────────────────────────────────────────────
    to_convert = [f for f in progress.finished if Path(f).suffix.lower() != ".mp3"]

    if not to_convert:
        print("\nAll files already MP3 — nothing to convert.")
    else:
        print(f"\n{'-' * 60}")
        print(f"Converting {len(to_convert)} file(s) to MP3 …\n")
        ok, fail = 0, 0
        for src in to_convert:
            name = Path(src).stem[:50]
            try:
                convert_to_mp3(ffmpeg_exe, src, bitrate)
                print(f"  ✓ {name}")
                ok += 1
            except RuntimeError as e:
                print(f"  ✗ {name}\n    {e}")
                fail += 1

        print(f"\n{ok} converted" + (f", {fail} failed" if fail else "") + ".")

    print(f"\n✓ Done!  Files saved to: {os.path.abspath(output_dir)}\n")


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("            YouTube → MP3 Downloader")
    print("=" * 60)

    # ── Resolve tools once up front ───────────────────────────────────────────
    ffmpeg_exe = ensure_ffmpeg()
    node_path  = find_nodejs()

    print(f"ffmpeg : {ffmpeg_exe}")
    print(f"node   : {node_path or 'not found (JS warnings may appear)'}")
    print()

    # ── Collect one or more URLs ──────────────────────────────────────────────
    if len(sys.argv) > 1:
        # Command-line mode: python3 script.py <url1> [url2 ...] [--bitrate 320] [--out ~/Music]
        args = sys.argv[1:]
        bitrate = "192"
        out_dir = "downloads"
        urls: list[str] = []
        i = 0
        while i < len(args):
            if args[i] in ("--bitrate", "-b") and i + 1 < len(args):
                bitrate = args[i + 1]; i += 2
            elif args[i] in ("--out", "-o") and i + 1 < len(args):
                out_dir = os.path.expanduser(args[i + 1]); i += 2
            else:
                urls.append(args[i]); i += 1
    else:
        # Interactive mode
        print("Paste one or more YouTube URLs (video or playlist).")
        print("Press Enter on a blank line when done.\n")
        urls = []
        while True:
            raw = input(f"URL {len(urls) + 1}: ").strip()
            if not raw:
                if urls:
                    break
                print("  Enter at least one URL.")
                continue
            urls.append(raw)

        print("\nChoose bitrate:")
        print("  1) 128 kbps")
        print("  2) 192 kbps  (default)")
        print("  3) 256 kbps")
        print("  4) 320 kbps  (best quality)")
        choice = input("Selection [1-4, default 2]: ").strip()
        bitrate = {"1": "128", "2": "192", "3": "256", "4": "320"}.get(choice, "192")

        out_dir = input("Save to folder [default: downloads]: ").strip() or "downloads"
        out_dir = os.path.expanduser(out_dir)

    if not urls:
        print("No URLs provided. Exiting.")
        sys.exit(1)

    download_urls(urls, out_dir, bitrate, ffmpeg_exe, node_path)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nCancelled.")
        sys.exit(0)