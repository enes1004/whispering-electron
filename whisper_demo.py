#!/usr/bin/env python3
"""
Demo script showing how to integrate real OpenAI Whisper with the Electron app.

This script demonstrates the actual Whisper integration that would be used
in a production environment with internet connectivity.

Usage:
    python3 whisper_demo.py <audio_file> [language]
"""

import sys
import json
import os

def process_with_whisper(audio_file, language="ja"):
    """
    Process audio file with OpenAI Whisper.
    
    Args:
        audio_file (str): Path to the audio file
        language (str): Language code (ja, en, auto)
    
    Returns:
        dict: Result containing text and language
    """
    try:
        # Import Whisper (requires internet for first-time model download)
        import whisper
        
        # Load the model (downloads on first use)
        model = whisper.load_model("base")
        
        # Transcribe the audio
        if language == "auto":
            result = model.transcribe(audio_file)
        else:
            result = model.transcribe(audio_file, language=language)
        
        return {
            "text": result["text"],
            "language": result["language"],
            "success": True
        }
        
    except ImportError:
        return {
            "error": "OpenAI Whisper not installed. Run: pip install openai-whisper",
            "success": False
        }
    except Exception as e:
        return {
            "error": f"Whisper processing failed: {str(e)}",
            "success": False
        }

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 whisper_demo.py <audio_file> [language]")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "ja"
    
    if not os.path.exists(audio_file):
        result = {
            "error": f"Audio file not found: {audio_file}",
            "success": False
        }
    else:
        result = process_with_whisper(audio_file, language)
    
    # Output JSON result
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()