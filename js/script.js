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

// Process query and immediately speak response aloud
function processUserQuery(query) {
    console.log("Processing query:", query);
    
    let answerText = `You asked about ${query}. Vibe coding lets you build apps seamlessly using AI prompts instead of writing every line manually.`;
    
    if (query.toLowerCase().includes('vibe coding')) {
        answerText = "Vibe coding is the revolutionary way to build software where you act as the director, guiding AI to write code while you focus on vision and architecture.";
    } else if (query.toLowerCase().includes('prompt formula')) {
        answerText = "The 4 part prompt formula consists of role definition, context, clear constraints, and expected output format.";
    } else if (query.toLowerCase().includes('apis')) {
        answerText = "Connecting APIs allows your frontend interface to securely talk to backend services like OpenAI.";
    }

    speakAnswer(answerText);
}

// Speak text aloud using browser speech synthesis
function speakAnswer(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop any overlapping speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
        console.log("Speaking aloud:", text);
    } else {
        console.warn("Speech synthesis not supported in this browser.");
    }
}