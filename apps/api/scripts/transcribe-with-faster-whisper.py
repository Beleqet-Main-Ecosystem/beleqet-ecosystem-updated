#!/usr/bin/env python3
import argparse
import json
import os
import sys

try:
    from faster_whisper import WhisperModel
except Exception as exc:  # pragma: no cover - runtime diagnostic
    print(json.dumps({"error": str(exc)}), file=sys.stderr)
    sys.exit(2)


def parse_args():
    parser = argparse.ArgumentParser(description="Transcribe an audio file with faster-whisper")
    parser.add_argument("--file", required=True)
    parser.add_argument("--model", default="base")
    parser.add_argument("--language", default=None)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    audio_path = args.file
    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"audio file not found: {audio_path}"}), file=sys.stderr)
        return 2

    try:
        model_size = args.model or "base"
        compute_type = "int8"
        model = WhisperModel(model_size, device="cpu", compute_type=compute_type)
        segments, info = model.transcribe(audio_path, beam_size=5, language=args.language)
        text_parts = [segment.text for segment in segments]
        text = "".join(text_parts).strip()
        print(json.dumps({"text": text, "language": info.language, "language_probability": info.language_probability}))
        return 0
    except Exception as exc:  # pragma: no cover - runtime diagnostic
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
