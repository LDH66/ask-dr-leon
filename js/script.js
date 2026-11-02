let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Call this inside your DOMContentLoaded event listener
function setupMobileMicrophone() {
    const micBtn = document.getElementById('micBtn');
    const listeningIndicator = document.getElementById('listeningIndicator');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        micBtn.style.display = 'none';
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = [];
            
            listeningIndicator.textContent = "Processing with Whisper...";
            listeningIndicator.style.display = 'block';

            const transcribedText = await sendAudioToBackend(audioBlob);
            
            if (transcribedText) {
                document.getElementById('userInput').value = transcribedText;
                processUserQuery(transcribedText);
            }
            listeningIndicator.style.display = 'none';
        };

        micBtn.addEventListener('click', () => {
            if (!isRecording) {
                audioChunks = [];
                mediaRecorder.start();
                isRecording = true;
                micBtn.classList.add('listening');
                listeningIndicator.textContent = "Listening... Tap mic to stop.";
                listeningIndicator.style.display = 'block';
            } else {
                mediaRecorder.stop();
                isRecording = false;
                micBtn.classList.remove('listening');
            }
        });
    }).catch(err => {
        console.warn("Microphone access denied or unavailable:", err);
        micBtn.style.display = 'none';
    });
}

async function sendAudioToBackend(audioBlob) {
    try {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        
        return new Promise((resolve) => {
            reader.onloadend = async () => {
                const base64Audio = reader.result.split(',')[1];
                const response = await fetch('/.netlify/functions/transcribe', {
                    method: 'POST',
                    body: base64Audio
                });
                const data = await response.json();
                resolve(data.text);
            };
        });
    } catch (error) {
        console.error("Transcription error:", error);
        return null;
    }
}