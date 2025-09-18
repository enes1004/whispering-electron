#!/bin/bash

# Installation script for Whispering Electron
# This script sets up the development environment

echo "🎤 Setting up Whispering Electron..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Check if pip3 is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip3 first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ Python version: $(python3 --version)"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Node.js dependencies"
    exit 1
fi

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip3 install openai-whisper

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Python dependencies"
    echo "   You may need to run: sudo pip3 install openai-whisper"
    exit 1
fi

# Check if FFmpeg is available (required by Whisper)
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  FFmpeg is not installed. Whisper requires FFmpeg for audio processing."
    echo "   Install FFmpeg:"
    echo "   - Ubuntu/Debian: sudo apt install ffmpeg"
    echo "   - macOS: brew install ffmpeg"
    echo "   - Windows: Download from https://ffmpeg.org/"
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "To start the application:"
echo "  npm start"
echo ""
echo "To run in development mode:"
echo "  npm run dev"
echo ""
echo "📋 Features:"
echo "  - Real-time speech-to-text with OpenAI Whisper"
echo "  - Japanese and English language support"
echo "  - Multiple audio input options"
echo "  - Segmented processing with overlap"
echo "  - Text save functionality"