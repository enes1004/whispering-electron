# Whispering Electron

Electron app to integrate voice recording and OpenAI Whisper speech to text conversion.

## Features

- Real-time speech-to-text conversion using OpenAI Whisper
- Support for Japanese and English languages with auto-detection
- Multiple audio input options:
  - Microphone only
  - System audio only  
  - Microphone + System audio (default)
- Pseudo real-time conversion with overlapping segments
- Configurable segment duration and overlap
- Text save functionality
- Simple and intuitive UI

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   pip3 install openai-whisper
   ```

## Usage

```bash
npm start
```

## Audio Processing

The app processes audio in segments with configurable duration (default 5 seconds) and overlap (default 2 seconds). This creates a pseudo real-time experience:

- Segment 1: 0-5 seconds
- Segment 2: 3-8 seconds  
- Segment 3: 6-11 seconds
- etc.

The overlapping portions help ensure no words are missed between segments.

## Note on Mock Implementation

In environments without internet access, the app uses a mock Whisper implementation for demonstration purposes. To use real Whisper:

1. Ensure internet connectivity for model download
2. Uncomment the real Whisper code in `main.js`
3. Comment out the mock implementation

## Requirements

- Node.js
- Python 3.7+
- OpenAI Whisper (pip install openai-whisper)
- FFmpeg (for audio processing)

## Development

```bash
npm run dev  # Run with developer tools
```
