import json
import shutil
import subprocess
import time
from pathlib import Path
from uuid import UUID


class MockRenderProvider:
    def __init__(self, render_dir: Path, latency_seconds: float = 1.0) -> None:
        self.render_dir = render_dir
        self.latency_seconds = latency_seconds

    def render(self, job_id: UUID, source_path: str, translated_text: str) -> str:
        time.sleep(self.latency_seconds)
        self.render_dir.mkdir(parents=True, exist_ok=True)
        output_path = self.render_dir / f"{job_id}.json"
        ffmpeg_version = self._ffmpeg_version()
        output_path.write_text(
            json.dumps(
                {
                    "job_id": str(job_id),
                    "source_path": source_path,
                    "translated_text": translated_text,
                    "ffmpeg": ffmpeg_version,
                    "note": "Mock render metadata. Replace with real FFmpeg muxing in production.",
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        return str(output_path)

    @staticmethod
    def _ffmpeg_version() -> str:
        if not shutil.which("ffmpeg"):
            return "ffmpeg unavailable"

        result = subprocess.run(
            ["ffmpeg", "-version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.splitlines()[0] if result.stdout else "ffmpeg detected"
