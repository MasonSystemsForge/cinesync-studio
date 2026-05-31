import json
import shutil
import subprocess
from pathlib import Path


def _parse_fraction(value: str | None) -> str | None:
    if not value or value == "0/0":
        return None
    return value


def probe_media(path: Path) -> dict[str, int | str | None]:
    if not shutil.which("ffprobe"):
        return {"duration_ms": None, "width": None, "height": None, "frame_rate": None}

    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0 or not result.stdout:
        return {"duration_ms": None, "width": None, "height": None, "frame_rate": None}

    payload = json.loads(result.stdout)
    video_stream = next((stream for stream in payload.get("streams", []) if stream.get("codec_type") == "video"), {})
    duration = payload.get("format", {}).get("duration") or video_stream.get("duration")
    duration_ms = int(float(duration) * 1000) if duration else None
    return {
        "duration_ms": duration_ms,
        "width": video_stream.get("width"),
        "height": video_stream.get("height"),
        "frame_rate": _parse_fraction(video_stream.get("avg_frame_rate")),
    }
