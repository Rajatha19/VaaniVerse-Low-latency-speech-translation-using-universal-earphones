#!/usr/bin/env python3
"""
Advanced audio pre-processing script for VaaniVerse

This script applies comprehensive audio processing to reduce hallucinations:
- Noise reduction using noisereduce
- Audio normalization to -20dBFS
- Silence trimming
- Resampling to 16kHz (Whisper's optimal sample rate)
"""

import argparse
import json
import os
import sys
import numpy as np
import soundfile as sf
import librosa
from scipy.io import wavfile
import noisereduce as nr

def process_audio(input_file, output_file):
    """Process audio with comprehensive pre-processing."""
    try:
        print(f"Loading audio file: {input_file}")
        
        # Load the audio file - let librosa handle format conversion
        y, sr = librosa.load(input_file, sr=None)
        print(f"Original: sample_rate={sr}, duration={len(y)/sr:.2f}s, samples={len(y)}")
        
        # Check if audio has meaningful content
        if len(y) < sr * 0.5:  # Less than 0.5 seconds
            print("Audio too short, skipping processing")
            # Still save a minimal file to avoid errors
            sf.write(output_file, y, sr)
            return True
        
        # Step 1: Resample to 16kHz (Whisper's optimal sample rate)
        if sr != 16000:
            print(f"Resampling from {sr}Hz to 16000Hz")
            y = librosa.resample(y, orig_sr=sr, target_sr=16000)
            sr = 16000
        
        # Step 2: Trim silence from beginning and end
        print("Trimming silence...")
        y_trimmed, _ = librosa.effects.trim(y, top_db=20)
        
        # Check if we still have audio after trimming
        if len(y_trimmed) < sr * 0.1:  # Less than 0.1 seconds after trimming
            print("Audio too short after trimming, using original")
            y_trimmed = y
        
        print(f"After trimming: duration={len(y_trimmed)/sr:.2f}s, samples={len(y_trimmed)}")
        
        # Step 3: Normalize audio to -20dBFS for consistent volume
        print("Normalizing audio...")
        # Calculate RMS and target level
        rms = np.sqrt(np.mean(y_trimmed**2))
        if rms > 0:
            # Target RMS for -20dBFS
            target_rms = 10**(-20/20)
            normalization_factor = target_rms / rms
            # Prevent over-amplification
            normalization_factor = min(normalization_factor, 10)
            y_normalized = y_trimmed * normalization_factor
        else:
            y_normalized = y_trimmed
        
        # Step 4: Apply noise reduction
        print("Applying noise reduction...")
        try:
            reduced_noise = nr.reduce_noise(
                y=y_normalized, 
                sr=sr,
                stationary=False,  # Use non-stationary noise reduction for better speech preservation
                prop_decrease=0.8  # Reduce noise by 80% but preserve speech
            )
        except Exception as e:
            print(f"Noise reduction failed: {e}, using normalized audio")
            reduced_noise = y_normalized
        
        # Step 5: Final clipping to prevent distortion
        reduced_noise = np.clip(reduced_noise, -1.0, 1.0)
        
        print(f"Final: duration={len(reduced_noise)/sr:.2f}s, samples={len(reduced_noise)}")
        
        # Save the processed audio
        sf.write(output_file, reduced_noise, sr)
        print(f"Processed audio saved to: {output_file}")
        
        return True
    except Exception as e:
        error_msg = f"Failed to process audio: {str(e)}"
        print(json.dumps({"error": error_msg}))
        print(error_msg, file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description="Noise Cancellation")
    parser.add_argument("--input", required=True, help="Input audio file path")
    parser.add_argument("--output", required=True, help="Output audio file path")
    
    args = parser.parse_args()
    
    success = process_audio(args.input, args.output)
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
  
