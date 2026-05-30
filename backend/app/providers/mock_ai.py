import time
from pathlib import Path


class MockSpeechToTextProvider:
    def __init__(self, latency_seconds: float = 1.0) -> None:
        self.latency_seconds = latency_seconds

    def transcribe(self, media_path: str, source_language: str) -> str:
        time.sleep(self.latency_seconds)
        filename = Path(media_path).name
        language_label = "detected language" if source_language == "auto" else source_language
        return f"Mock transcript for {filename} in {language_label}."


class MockTranslationProvider:
    def __init__(self, latency_seconds: float = 1.0) -> None:
        self.latency_seconds = latency_seconds

    def translate(self, text: str, target_language: str) -> str:
        time.sleep(self.latency_seconds)
        return f"[{target_language}] {text}"
