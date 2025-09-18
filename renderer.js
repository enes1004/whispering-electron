class WhisperRecorder {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.currentSegmentChunks = [];
        this.allChunks = [];
        this.globalSegmentCounter = 0;  // Persistent counter across recording sessions
        this.currentSessionStartSegment = 0;  // Track where current session started
        this.startTime = null;
        this.timerInterval = null;
        this.segmentTimer = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateStatus('準備完了', 'ready');
    }

    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.audioSourceSelect = document.getElementById('audioSource');
        this.languageSelect = document.getElementById('language');
        this.whisperModelSelect = document.getElementById('whisperModel');
        this.segmentDurationInput = document.getElementById('segmentDuration');
        this.overlapDurationInput = document.getElementById('overlapDuration');
        this.statusDiv = document.getElementById('status');
        this.timerDiv = document.getElementById('timer');
        this.textOutput = document.getElementById('textOutput');
        this.saveBtn = document.getElementById('saveBtn');
        this.segmentInfo = document.getElementById('segmentInfo');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.saveBtn.addEventListener('click', () => this.saveText());
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + R to start/stop recording
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                if (this.isRecording) {
                    this.stopRecording();
                } else {
                    this.startRecording();
                }
            }
            
            // Ctrl/Cmd + S to save
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                this.saveText();
            }
        });
    }

    updateStatus(message, type) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${type}`;
    }

    updateTimer() {
        if (this.startTime) {
            const elapsed = Date.now() - this.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            this.timerDiv.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    async getAudioConstraints() {
        const audioSource = this.audioSourceSelect.value;
        
        if (audioSource === 'system') {
            return await this.getSystemAudioStream();
        } else if (audioSource === 'mic+system') {
            return await this.getMixedAudioStream();
        }
        
        // Default to microphone only
        return { audio: true, video: false };
    }

    async getSystemAudioStream() {
        try {
            // Check if getDisplayMedia is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error('システムオーディオキャプチャはこのブラウザでサポートされていません。');
            }

            // Request permission for screen capture with audio
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                audio: true, 
                video: false 
            });
            
            // Check if audio track is available
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                stream.getTracks().forEach(track => track.stop());
                throw new Error('システムオーディオが利用できません。システムオーディオ共有を有効にしてください。');
            }

            return stream;
        } catch (error) {
            console.warn('System audio capture failed:', error.message);
            
            // Show permission dialog
            const userResponse = await this.showAudioPermissionDialog(
                'システムオーディオの取得に失敗しました。',
                error.message + '\n\nマイクを代替として使用しますか？'
            );
            
            if (userResponse) {
                // Fall back to microphone
                return { audio: true, video: false };
            } else {
                throw new Error('システムオーディオの取得がキャンセルされました。');
            }
        }
    }

    async getMixedAudioStream() {
        try {
            // First get microphone
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            
            try {
                // Try to get system audio
                const systemStream = await navigator.mediaDevices.getDisplayMedia({ 
                    audio: true, 
                    video: false 
                });

                // Check if system audio is available
                const systemAudioTracks = systemStream.getAudioTracks();
                if (systemAudioTracks.length === 0) {
                    systemStream.getTracks().forEach(track => track.stop());
                    throw new Error('システムオーディオが利用できません');
                }

                // Create audio context to mix streams
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const destination = audioContext.createMediaStreamDestination();
                
                // Connect microphone
                const micSource = audioContext.createMediaStreamSource(micStream);
                const micGain = audioContext.createGain();
                micGain.gain.value = 0.7; // Reduce mic volume slightly
                micSource.connect(micGain);
                micGain.connect(destination);
                
                // Connect system audio
                const systemSource = audioContext.createMediaStreamSource(systemStream);
                const systemGain = audioContext.createGain();
                systemGain.gain.value = 0.8; // System audio at slightly higher volume
                systemSource.connect(systemGain);
                systemGain.connect(destination);
                
                // Clean up original streams
                micStream.getTracks().forEach(track => track.stop());
                systemStream.getTracks().forEach(track => track.stop());
                
                return destination.stream;
                
            } catch (systemError) {
                console.warn('System audio mixing failed, using microphone only:', systemError.message);
                
                const userResponse = await this.showAudioPermissionDialog(
                    'システムオーディオとの混合に失敗しました。',
                    systemError.message + '\n\nマイクのみを使用しますか？'
                );
                
                if (userResponse) {
                    return micStream;
                } else {
                    micStream.getTracks().forEach(track => track.stop());
                    throw new Error('音声取得がキャンセルされました。');
                }
            }
            
        } catch (micError) {
            console.error('Microphone access failed:', micError.message);
            throw new Error('マイクへのアクセスに失敗しました: ' + micError.message);
        }
    }

    async showAudioPermissionDialog(title, message) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            `;
            
            dialog.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; text-align: center;">
                    <h3 style="color: #333; margin-bottom: 15px;">${title}</h3>
                    <p style="color: #666; margin-bottom: 25px; line-height: 1.5;">${message}</p>
                    <div>
                        <button id="audioDialogYes" style="background: #007acc; color: white; border: none; padding: 10px 20px; margin: 0 10px; border-radius: 5px; cursor: pointer;">はい</button>
                        <button id="audioDialogNo" style="background: #ccc; color: #333; border: none; padding: 10px 20px; margin: 0 10px; border-radius: 5px; cursor: pointer;">いいえ</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            document.getElementById('audioDialogYes').onclick = () => {
                document.body.removeChild(dialog);
                resolve(true);
            };
            
            document.getElementById('audioDialogNo').onclick = () => {
                document.body.removeChild(dialog);
                resolve(false);
            };
        });
    }

    async startRecording() {
        try {
            // Check for browser support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('このブラウザは音声録音をサポートしていません。');
            }
            
            this.updateStatus('録音開始中...', 'processing');
            
            const streamOrConstraints = await this.getAudioConstraints();
            let stream;
            
            if (streamOrConstraints instanceof MediaStream) {
                // We got a stream directly (system audio or mixed)
                stream = streamOrConstraints;
            } else {
                // We got constraints, use getUserMedia
                stream = await navigator.mediaDevices.getUserMedia(streamOrConstraints);
            }
            
            // Check if MediaRecorder is supported
            if (!window.MediaRecorder) {
                throw new Error('このブラウザはMediaRecorderをサポートしていません。');
            }
            
            this.currentSegmentChunks = [];
            this.allChunks = [];
            this.currentSessionStartSegment = this.globalSegmentCounter;  // Remember where this session started
            this.startTime = Date.now();
            this.isRecording = true;
            
            // Update UI
            this.startBtn.disabled = true;
            this.startBtn.classList.add('recording');
            this.stopBtn.disabled = false;
            this.updateStatus('録音中...', 'recording');
            
            // Start timer
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
            
            // Start segmented recording
            this.startSegmentedRecording(stream);
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.updateStatus('録音開始エラー: ' + error.message, 'ready');
            
            // Reset UI on error
            this.startBtn.disabled = false;
            this.startBtn.classList.remove('recording');
            this.stopBtn.disabled = true;
        }
    }

    startSegmentedRecording(stream) {
        const segmentDuration = parseInt(this.segmentDurationInput.value) * 1000; // Convert to ms
        
        this.processNextSegment(stream, this.globalSegmentCounter);
    }

    async processNextSegment(stream, segmentIndex) {
        if (!this.isRecording) return;
        
        const segmentDuration = parseInt(this.segmentDurationInput.value) * 1000;
        const overlapDuration = parseInt(this.overlapDurationInput.value) * 1000;
        
        // Create a new MediaRecorder for this segment
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        const segmentChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                segmentChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            if (segmentChunks.length > 0) {
                const audioBlob = new Blob(segmentChunks, { type: 'audio/webm;codecs=opus' });
                await this.processAudioBlob(audioBlob, segmentIndex);
            }
        };
        
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
        };
        
        // Start recording this segment
        mediaRecorder.start();
        
        // Stop this segment after the segment duration
        setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        }, segmentDuration);
        
        // Schedule the next segment with overlap
        const nextSegmentDelay = segmentDuration - overlapDuration;
        this.segmentTimer = setTimeout(() => {
            if (this.isRecording) {
                this.globalSegmentCounter++;  // Increment the global counter
                this.processNextSegment(stream, this.globalSegmentCounter);
            }
        }, nextSegmentDelay);
    }

    async processAudioBlob(audioBlob, segmentIndex) {
        try {
            this.updateStatus(`セグメント ${segmentIndex + 1} を処理中...`, 'processing');
            
            // Convert blob to base64 for transfer to main process
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
            const base64Data = btoa(binaryString);
            
            // Process with Whisper via main process
            const language = this.languageSelect.value;
            const model = this.whisperModelSelect.value;
            const result = await window.electronAPI.processAudioBlob(base64Data, language, segmentIndex, model);
            
            // Add to text output
            this.addTranscribedText(result.text, segmentIndex);
            
            this.updateSegmentInfo(segmentIndex + 1, result.text.substring(0, 50) + '...');
            
        } catch (error) {
            console.error('Error processing audio:', error);
            this.updateStatus('音声処理エラー: ' + error.message, 'ready');
        }
    }

    addTranscribedText(text, segmentIndex) {
        const currentText = this.textOutput.value;
        const timestamp = new Date().toLocaleTimeString('ja-JP');
        const newText = currentText + (currentText ? '\n' : '') + `[${timestamp}] ${text}`;
        this.textOutput.value = newText;
        
        // Auto-scroll to bottom
        this.textOutput.scrollTop = this.textOutput.scrollHeight;
        
        if (this.isRecording) {
            this.updateStatus('録音中... (セグメント処理完了)', 'recording');
        }
    }

    updateSegmentInfo(segmentNum, preview) {
        this.segmentInfo.textContent = `最新セグメント ${segmentNum}: ${preview}`;
    }

    stopRecording() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        
        if (this.segmentTimer) {
            clearTimeout(this.segmentTimer);
            this.segmentTimer = null;
        }
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Update UI
        this.startBtn.disabled = false;
        this.startBtn.classList.remove('recording');
        this.stopBtn.disabled = true;
        this.updateStatus('録音停止 - 処理完了', 'ready');
    }

    async saveText() {
        const content = this.textOutput.value;
        if (!content.trim()) {
            alert('保存するテキストがありません。');
            return;
        }
        
        try {
            const result = await window.electronAPI.saveFile(content);
            if (result.success) {
                alert(`ファイルが保存されました: ${result.filePath}`);
            } else {
                alert('ファイルの保存がキャンセルされました。');
            }
        } catch (error) {
            console.error('Error saving file:', error);
            alert('ファイルの保存中にエラーが発生しました: ' + error.message);
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new WhisperRecorder();
});