import json
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID


@dataclass(frozen=True)
class RenderResult:
    output_path: str
    srt_path: str
    vtt_path: str
    metadata: dict[str, object]


class MockRenderProvider:
    def __init__(self, render_dir: Path, latency_seconds: float = 1.0) -> None:
        self.render_dir = render_dir
        self.latency_seconds = latency_seconds

    def render(
        self,
        job_id: UUID,
        source_path: str,
        translated_text: str,
        subtitles: list[dict[str, object]] | None = None,
    ) -> RenderResult:
        time.sleep(self.latency_seconds)
        self.render_dir.mkdir(parents=True, exist_ok=True)

        subtitle_rows = subtitles or [
            {
                "start_ms": 0,
                "end_ms": 45000,
                "text": translated_text or "Generated localized subtitle text.",
            }
        ]
        srt_path = self.render_dir / f"{job_id}.srt"
        vtt_path = self.render_dir / f"{job_id}.vtt"
        self._write_srt(srt_path, subtitle_rows)
        self._write_vtt(vtt_path, subtitle_rows)

        ffmpeg_version = self._ffmpeg_version()
        source = Path(source_path)
        metadata: dict[str, object] = {
            "job_id": str(job_id),
            "source_path": source_path,
            "srt_path": str(srt_path),
            "vtt_path": str(vtt_path),
            "ffmpeg": ffmpeg_version,
            "provider": "ffmpeg_mock_render",
        }

        if source.exists() and self._has_video_stream(source):
            mp4_path = self.render_dir / f"{job_id}.mp4"
            command = [
                "ffmpeg",
                "-y",
                "-i",
                str(source),
                "-i",
                str(srt_path),
                "-map",
                "0:v:0",
                "-map",
                "0:a?",
                "-map",
                "1:0",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-c:a",
                "aac",
                "-c:s",
                "mov_text",
                "-movflags",
                "+faststart",
                str(mp4_path),
            ]
            result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=120)
            if result.returncode == 0 and mp4_path.exists():
                metadata.update({"artifact_type": "mp4", "note": "FFmpeg MP4 export with soft subtitle track."})
                return RenderResult(str(mp4_path), str(srt_path), str(vtt_path), metadata)
            metadata.update(
                {
                    "artifact_type": "json_fallback",
                    "ffmpeg_error": result.stderr[-2000:] if result.stderr else "ffmpeg failed without stderr",
                }
            )
        else:
            metadata.update(
                {
                    "artifact_type": "json_fallback",
                    "note": "Source media missing or not a video stream; generated subtitle sidecars only.",
                }
            )

        fallback_path = self.render_dir / f"{job_id}.json"
        fallback_path.write_text(json.dumps(metadata | {"translated_text": translated_text}, indent=2), encoding="utf-8")
        return RenderResult(str(fallback_path), str(srt_path), str(vtt_path), metadata)

    @staticmethod
    def _format_srt_time(milliseconds: int) -> str:
        seconds, ms = divmod(max(0, milliseconds), 1000)
        minutes, seconds = divmod(seconds, 60)
        hours, minutes = divmod(minutes, 60)
        return f"{hours:02}:{minutes:02}:{seconds:02},{ms:03}"

    @staticmethod
    def _format_vtt_time(milliseconds: int) -> str:
        seconds, ms = divmod(max(0, milliseconds), 1000)
        minutes, seconds = divmod(seconds, 60)
        hours, minutes = divmod(minutes, 60)
        return f"{hours:02}:{minutes:02}:{seconds:02}.{ms:03}"

    def _write_srt(self, path: Path, subtitles: list[dict[str, object]]) -> None:
        blocks = []
        for index, subtitle in enumerate(subtitles, start=1):
            start_ms = int(subtitle.get("start_ms") or 0)
            end_ms = int(subtitle.get("end_ms") or start_ms + 3000)
            text = str(subtitle.get("text") or "")
            blocks.append(
                f"{index}\n{self._format_srt_time(start_ms)} --> {self._format_srt_time(end_ms)}\n{text}\n"
            )
        path.write_text("\n".join(blocks), encoding="utf-8")

    def _write_vtt(self, path: Path, subtitles: list[dict[str, object]]) -> None:
        blocks = ["WEBVTT\n"]
        for subtitle in subtitles:
            start_ms = int(subtitle.get("start_ms") or 0)
            end_ms = int(subtitle.get("end_ms") or start_ms + 3000)
            text = str(subtitle.get("text") or "")
            blocks.append(f"{self._format_vtt_time(start_ms)} --> {self._format_vtt_time(end_ms)}\n{text}\n")
        path.write_text("\n".join(blocks), encoding="utf-8")

    @staticmethod
    def _has_video_stream(source: Path) -> bool:
        if not shutil.which("ffprobe") or not shutil.which("ffmpeg"):
            return False
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=codec_type",
                "-of",
                "csv=p=0",
                str(source),
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.returncode == 0 and "video" in result.stdout

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
