#!/usr/bin/env python3
"""
Coqui TTS script for VaaniVerse

This script uses Coqui TTS to generate speech from text for
English, Hindi, and Kannada.
"""

import argparse
import json
import os
import sys
from TTS.api import TTS

# Language to voice mapping
LANGUAGE_VOICES = {
    "en": "tts_models/en/ljspeech/tacotron2-DDC",
    "hi": "tts_models/hi/fairseq/vits",
    "kn": "tts_models/multilingual/multi-dataset/xtts_v2"  # Fallback to XTTS for Kannada
}

def generate_speech(text, language, output_file):
    """Generate speech from text using Coqui TTS."""
    try:
        # Get the appropriate TTS model
        model_name = LANGUAGE_VOICES.get(language, LANGUAGE_VOICES["en"])
        
        # Initialize TTS
        tts = TTS(model_name=model_name)
        
        # For multilingual models, set the target language
        if "multilingual" in model_name or "multi-dataset" in model_name:
            if language == "kn":
                # XTTS needs a speaker reference, using the built-in one
                tts.tts_to_file(text=text, file_path=output_file, speaker_wav="speakers/female.wav", language=language)
            else:
                tts.tts_to_file(text=text, file_path=output_file, language=language)
        else:
            # For language-specific models
            tts.tts_to_file(text=text, file_path=output_file)
            
        return True
    except Exception as e:
        print(json.dumps({
            "error": f"Failed to generate speech: {str(e)}"
        }))
        return False

def main():
    parser = argparse.ArgumentParser(description="Coqui TTS")
    parser.add_argument("--text", required=True, help="Text to convert to speech")
    parser.add_argument("--language", required=True, choices=["en", "hi", "kn"], help="Language")
    parser.add_argument("--output", required=True, help="Output audio file path")
    
    args = parser.parse_args()
    
    success = generate_speech(args.text, args.language, args.output)
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
