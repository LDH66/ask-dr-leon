let mediaRecorder;
let audioChunks = [];
let isRecording = false;

document.addEventListener('DOMContentLoaded', () => {
    setupMobileMicrophone();
    setupUIHandlers();
});

// Setup mobile speech input using MediaRecorder API for iOS/Android
function setupMobileMicrophone() {
    const micBtn = document.getElementById('micBtn');
    const listeningIndicator = document.getElementById('listeningIndicator');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (micBtn) micBtn.style.display = 'none';
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
            
            if (listeningIndicator) {
                listeningIndicator.textContent = "Processing with Whisper...";
                listeningIndicator.style.display = 'block';
            }

            const transcribedText = await sendAudioToBackend(audioBlob);
            
            if (transcribedText) {
                const userInput = document.getElementById('userInput');
                if (userInput) userInput.value = transcribedText;
                processUserQuery(transcribedText);
            }
            
            if (listeningIndicator) {
                listeningIndicator.style.display = 'none';
            }
        };

        if (micBtn) {
            micBtn.addEventListener('click', () => {
                if (!isRecording) {
                    audioChunks = [];
                    mediaRecorder.start();
                    isRecording = true;
                    micBtn.classList.add('listening');
                    if (listeningIndicator) {
                        listeningIndicator.textContent = "Listening... Tap mic to stop.";
                        listeningIndicator.style.display = 'block';
                    }
                } else {
                    mediaRecorder.stop();
                    isRecording = false;
                    micBtn.classList.remove('listening');
                }
            });
        }
    }).catch(err => {
        console.warn("Microphone access denied or unavailable:", err);
        if (micBtn) micBtn.style.display = 'none';
    });
}

// Send recorded audio to Netlify Serverless Function for Whisper transcription
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

// Setup keyboard and click bindings for text input and topic buttons
function setupUIHandlers() {
    const submitBtn = document.getElementById('submitBtn');
    const userInput = document.getElementById('userInput');
    const topicPills = document.querySelectorAll('.pill-btn');

    if (submitBtn && userInput) {
        submitBtn.addEventListener('click', () => {
            const query = userInput.value.trim();
            if (query) processUserQuery(query);
        });

        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = userInput.value.trim();
                if (query) processUserQuery(query);
            }
        });
    }

    topicPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const topic = pill.getAttribute('data-topic');
            if (userInput) userInput.value = topic;
            processUserQuery(topic);
        });
    });
}

// Send query to backend AI engine and trigger browser speech synthesis
async function processUserQuery(query) {
    try {
        console.log("Sending query to AI engine:", query);
        
        // Call your backend AI function (or handle response)
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: query })
        });

        if (response.ok) {
            const data = await response.json();
            speakAnswer(data.reply);
        } else {
            // Fallback: If chat function isn't built yet, use browser speech directly
            speakAnswer(`Dr Leon is answering your question about: ${query}`);
        }
    } catch (error) {
        console.error("Engine processing error:", error);
        speakAnswer("I received your question, but encountered an error connecting to the engine.");
    }
}

// Speak the answer aloud using browser speech synthesis
function speakAnswer(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop any ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}