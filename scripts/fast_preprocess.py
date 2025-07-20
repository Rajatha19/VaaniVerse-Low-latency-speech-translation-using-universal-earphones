#!/usr/bin/env python3
"""
Fast audio pre-processing script for VaaniVerse - Optimized for minimal latency

This script applies only essential audio processing:
- Quick format conversion to WAV
- Basic volume normalization (simple peak normalization)
- Minimal silence trimming
"""

import argparse
import json
import os
import sys
import numpy as np
import soundfile as sf

def fast_process_audio(input_file, output_file):
    """Fast audio processing with minimal operations."""
    try:
        # Load the audio file quickly
        y, sr = sf.read(input_file)
        
        # Convert to mono if stereo (simple average)
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)
        
        # Quick check for meaningful content
        if len(y) < sr * 0.2:  # Less than 0.2 seconds
            # Still save the file to avoid errors
            sf.write(output_file, y, sr)
            return True
        
        # Quick peak normalization (much faster than RMS)
        peak = np.max(np.abs(y))
        if peak > 0:
            # Normalize to 0.8 to prevent clipping but maintain volume
            y = y * (0.8 / peak)
        
        # Very basic silence trimming (just start/end)
        # Find first and last non-silent samples
        threshold = 0.01
        non_silent = np.where(np.abs(y) > threshold)[0]
        
        if len(non_silent) > 0:
            start_idx = max(0, non_silent[0] - int(sr * 0.1))  # Keep 0.1s before
            end_idx = min(len(y), non_silent[-1] + int(sr * 0.1))  # Keep 0.1s after
            y = y[start_idx:end_idx]
        
        # Save the processed audio at 16kHz (Whisper's preferred rate)
        sf.write(output_file, y, 16000)
        
        return True
    except Exception as e:
        error_msg = f"Failed to process audio: {str(e)}"
        print(json.dumps({"error": error_msg}))
        print(error_msg, file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description="Fast Audio Processing")
    parser.add_argument("--input", required=True, help="Input audio file path")
    parser.add_argument("--output", required=True, help="Output audio file path")
    
    args = parser.parse_args()
    
    success = fast_process_audio(args.input, args.output)
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
