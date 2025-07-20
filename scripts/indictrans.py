#!/usr/bin/env python3
"""
IndicTrans2 translation script for VaaniVerse

This script loads the IndicTrans2 model and translates text between
English, Hindi, and Kannada.
"""

import argparse
import json
import os
import sys
from indicnlp.transliterate.unicode_transliterate import UnicodeIndicTransliterator
from fairseq.models.transformer import TransformerModel

# Set up paths for IndicTrans2
MODEL_DIR = os.environ.get("INDICTRANS2_MODEL_DIR", "./models/indictrans2")
DICT_DIR = os.path.join(MODEL_DIR, "dictionary")
MODEL_PATH = os.path.join(MODEL_DIR, "model.pt")

# Language code mappings
LANGUAGE_CODES = {
    "en": "eng_Latn",  # English
    "hi": "hin_Deva",  # Hindi
    "kn": "kan_Knda",  # Kannada
}

def load_model():
    """Load the IndicTrans2 model."""
    try:
        model = TransformerModel.from_pretrained(
            MODEL_DIR,
            checkpoint_file="model.pt",
            source_dictionary=os.path.join(DICT_DIR, "dict.src.txt"),
            target_dictionary=os.path.join(DICT_DIR, "dict.tgt.txt"),
        )
        model.eval()  # Set to evaluation mode
        return model
    except Exception as e:
        print(json.dumps({
            "error": f"Failed to load IndicTrans2 model: {str(e)}"
        }))
        sys.exit(1)

def translate(text, source_lang, target_lang, model):
    """Translate text using IndicTrans2."""
    try:
        # Preprocess the text with the appropriate script
        src_code = LANGUAGE_CODES[source_lang]
        tgt_code = LANGUAGE_CODES[target_lang]
        
        # Prepare input for model
        input_text = f"{src_code}>{tgt_code} {text}"
        
        # Translate
        translation = model.translate(input_text)
        
        # Return the translation
        return {
            "translation": translation,
            "confidence": 0.92  # Fixed confidence score for now
        }
    except Exception as e:
        return {
            "translation": text,
            "error": str(e),
            "confidence": 0.5
        }

def main():
    parser = argparse.ArgumentParser(description="IndicTrans2 Translation")
    parser.add_argument("--text", required=True, help="Text to translate")
    parser.add_argument("--source", required=True, choices=["en", "hi", "kn"], help="Source language")
    parser.add_argument("--target", required=True, choices=["en", "hi", "kn"], help="Target language")
    
    args = parser.parse_args()
    
    # If source and target are the same, no need to translate
    if args.source == args.target:
        result = {
            "translation": args.text,
            "confidence": 1.0
        }
    else:
        # Load the model and translate
        model = load_model()
        result = translate(args.text, args.source, args.target, model)
    
    # Output the result as JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main()
