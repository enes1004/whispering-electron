const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle audio processing with Whisper
ipcMain.handle('process-audio', async (event, audioFilePath, language = 'ja') => {
  return new Promise((resolve, reject) => {
    const useMockResponse = process.argv.includes('--mock-response');
    
    if (useMockResponse) {
      // Mock response for demonstration
      const result = {
        "text": "これはテスト音声の変換結果です。実際の環境では、Whisperモデルが音声を認識してテキストに変換します。",
        "language": language
      };
      resolve(result);
      return;
    }

    const pythonScript = `
import json
import sys

try:
    import whisper
    model = whisper.load_model("base")
    result = model.transcribe("${audioFilePath}", language="${language}")
    print(json.dumps({"text": result["text"], "language": result["language"]}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

    const tempPythonFile = path.join(__dirname, 'temp_whisper.py');
    fs.writeFileSync(tempPythonFile, pythonScript);

    exec(`python3 ${tempPythonFile}`, (error, stdout, stderr) => {
      // Clean up temp file
      fs.unlinkSync(tempPythonFile);

      if (error) {
        reject(new Error(`Whisper processing failed: ${error.message}`));
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch (parseError) {
        reject(new Error(`Failed to parse Whisper output: ${parseError.message}`));
      }
    });
  });
});

// Handle audio blob processing with Whisper
ipcMain.handle('process-audio-blob', async (event, base64Data, language = 'ja', segmentIndex = 0) => {
  return new Promise((resolve, reject) => {
    const useMockResponse = process.argv.includes('--mock-response');
    
    if (useMockResponse) {
      // Mock response for demonstration with varied content
      const mockTexts = [
        "こんにちは、これは音声認識のテストです。",
        "リアルタイム音声変換が正常に動作しています。",
        "このセグメントでは別の内容が話されています。",
        "オーバーラップ機能も適切に動作していることを確認できます。"
      ];
      const result = {
        "text": mockTexts[segmentIndex % mockTexts.length],
        "language": language
      };
      resolve(result);
      return;
    }

    const tempAudioFile = path.join(__dirname, `temp_audio_${segmentIndex}_${Date.now()}.webm`);
    
    try {
      // Convert base64 to buffer and write to file
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(tempAudioFile, buffer);

      const pythonScript = `
import json
import sys
import os

try:
    import whisper
    model = whisper.load_model("base")
    result = model.transcribe("${tempAudioFile}", language="${language}")
    print(json.dumps({"text": result["text"], "language": result["language"]}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

      const tempPythonFile = path.join(__dirname, `temp_whisper_${segmentIndex}.py`);
      fs.writeFileSync(tempPythonFile, pythonScript);

      exec(`python3 ${tempPythonFile}`, (error, stdout, stderr) => {
        // Clean up temp files
        try {
          fs.unlinkSync(tempPythonFile);
          fs.unlinkSync(tempAudioFile);
        } catch (cleanupError) {
          console.warn('Error cleaning up temp files:', cleanupError);
        }

        if (error) {
          reject(new Error(`Whisper processing failed: ${error.message}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse Whisper output: ${parseError.message}`));
        }
      });
    } catch (fileError) {
      reject(new Error(`Failed to write audio file: ${fileError.message}`));
    }
  });
});

// Handle file save
ipcMain.handle('save-file', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled) {
    fs.writeFileSync(result.filePath, content);
    return { success: true, filePath: result.filePath };
  }
  
  return { success: false };
});