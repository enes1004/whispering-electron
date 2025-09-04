class WhisperRecorder {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.segments = [];
        this.segmentCounter = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.recordingTimer = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateStatus('準備完了', 'ready');
    }

    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.audioSourceSelect = document.getElementById('audioSource');
        this.languageSelect = document.getElementById('language');
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
        
        let constraints = { audio: true, video: false };
        
        try {
            if (audioSource === 'system') {
                // For system audio, we'll use getDisplayMedia with audio
                return 'displayMedia';
            } else if (audioSource === 'mic+system') {
                // For now, just use microphone as mixing requires complex implementation
                // In a real production app, you would need to capture both streams and mix them
                constraints = { audio: true, video: false };
            }
        } catch (error) {
            console.warn('System audio capture not available, falling back to microphone');
            constraints = { audio: true, video: false };
        }
        
        return constraints;
    }

    async startRecording() {
        try {
            // Check for browser support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('このブラウザは音声録音をサポートしていません。');
            }
            
            this.updateStatus('録音開始中...', 'processing');
            
            const constraints = await this.getAudioConstraints();
            let stream;
            
            if (constraints === 'displayMedia') {
                // For system audio capture
                if (!navigator.mediaDevices.getDisplayMedia) {
                    throw new Error('このブラウザはシステムオーディオキャプチャをサポートしていません。');
                }
                stream = await navigator.mediaDevices.getDisplayMedia({ 
                    audio: true, 
                    video: false 
                });
            } else {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            }
            
            // Check if MediaRecorder is supported
            if (!window.MediaRecorder) {
                throw new Error('このブラウザはMediaRecorderをサポートしていません。');
            }
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            this.segments = [];
            this.segmentCounter = 0;
            this.startTime = Date.now();
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    // If this is from requestData(), process the segment
                    if (this.isRecording) {
                        this.processSegment();
                    }
                }
            };
            
            this.mediaRecorder.onstop = () => {
                // Process any remaining chunks when recording stops
                if (this.audioChunks.length > 0) {
                    this.processCurrentSegment();
                }
            };
            
            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.updateStatus('録音エラー: ' + event.error.message, 'ready');
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            
            // Update UI
            this.startBtn.disabled = true;
            this.startBtn.classList.add('recording');
            this.stopBtn.disabled = false;
            this.updateStatus('録音中...', 'recording');
            
            // Start timer
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
            
            // Start segmented recording
            this.startSegmentedRecording();
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.updateStatus('録音開始エラー: ' + error.message, 'ready');
            
            // Reset UI on error
            this.startBtn.disabled = false;
            this.startBtn.classList.remove('recording');
            this.stopBtn.disabled = true;
        }
    }

    startSegmentedRecording() {
        const segmentDuration = parseInt(this.segmentDurationInput.value) * 1000; // Convert to ms
        
        // Start processing segments at regular intervals
        this.recordingTimer = setInterval(() => {
            if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.requestSegmentData();
            }
        }, segmentDuration);
    }

    requestSegmentData() {
        // Request data from MediaRecorder without stopping it
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.requestData();
        }
    }

    async processSegment() {
        // This method is called by ondataavailable when requestData() is called
        if (this.audioChunks.length > 0) {
            const segmentChunks = [...this.audioChunks];
            // Don't clear audioChunks here to maintain overlap
            
            const audioBlob = new Blob(segmentChunks, { type: 'audio/webm;codecs=opus' });
            await this.processAudioBlob(audioBlob, this.segmentCounter);
            this.segmentCounter++;
            
            // Clear old chunks to prevent memory buildup, but keep some for overlap
            const overlapDuration = parseInt(this.overlapDurationInput.value);
            const segmentDuration = parseInt(this.segmentDurationInput.value);
            const keepRatio = overlapDuration / segmentDuration;
            const chunksToKeep = Math.floor(this.audioChunks.length * keepRatio);
            this.audioChunks = this.audioChunks.slice(-chunksToKeep);
        }
    }

    async processCurrentSegment() {
        if (this.audioChunks.length > 0) {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
            await this.processAudioBlob(audioBlob, this.segmentCounter);
        }
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
            const result = await window.electronAPI.processAudioBlob(base64Data, language, segmentIndex);
            
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
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Stop all tracks
        if (this.mediaRecorder && this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        // Update UI
        this.startBtn.disabled = false;
        this.startBtn.classList.remove('recording');
        this.stopBtn.disabled = true;
        this.updateStatus('録音停止 - 最終処理中...', 'processing');
        
        // Process final segment after a short delay
        setTimeout(() => {
            this.updateStatus('準備完了', 'ready');
        }, 2000);
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