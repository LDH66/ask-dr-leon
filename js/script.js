let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let britishVoice = null;

document.addEventListener('DOMContentLoaded', () => {
    setupNetlifyMicrophone();
    setupUIHandlers();
    loadBritishVoice();
});

// Load and cache British male voice safely (handles async browser loading)
function loadBritishVoice() {
    if (!('speechSynthesis' in window)) return;

    function setVoice() {
        const voices = window.speechSynthesis.getVoices();
        // Look for British male voices first, then fall back to any British English voice
        britishVoice = voices.find(v => 
            v.lang === 'en-GB' && (v.name.toLowerCase().includes('male') || v.name.includes('Oliver') || v.name.includes('Daniel') || v.name.includes('Arthur') || v.name.includes('George'))
        ) || voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang.startsWith('en'));
    }

    setVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = setVoice;
    }
}

// Setup robust audio recording using Netlify Whisper backend (works perfectly on Mac & iOS)
function setupNetlifyMicrophone() {
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
            // Click once to start recording, click again to stop & process via Whisper
            micBtn.addEventListener('click', () => {
                if (!isRecording) {
                    audioChunks = [];
                    mediaRecorder.start();
                    isRecording = true;
                    micBtn.classList.add('listening');
                    if (listeningIndicator) {
                        listeningIndicator.textContent = "Listening... Tap mic again to send.";
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

// Send recorded audio to Netlify Serverless Function for OpenAI Whisper transcription
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

        // Pressing Enter submits immediately
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = userInput.value.trim();
                if (query) {
                    userInput.blur();
                    processUserQuery(query);
                }
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

// Process query and deliver expert answers in a British male voice
function processUserQuery(query) {
    const q = query.toLowerCase();
    let answerText = `Hello! Regarding your inquiry about ${query}, vibe coding enables you to direct software development seamlessly using intelligent prompts.`;

    if (q.includes('vibe coding')) {
        answerText = "Vibe coding represents a brilliant paradigm shift where you act as the visionary architect. Instead of writing boilerplate syntax line by line, you converse with AI to build, test, and deploy entire applications effortlessly.";
    } else if (q.includes('prompt formula') || q.includes('formula')) {
        answerText = "The four-part prompt formula consists of: First, defining a clear role for your AI. Second, providing rich context. Third, setting strict constraints. And fourth, specifying the precise output format you require.";
    } else if (q.includes('api') || q.includes('connecting')) {
        answerText = "Connecting APIs allows your frontend user interface to securely communicate with powerhouse backend services like OpenAI, managing authentication and data exchange smoothly behind the scenes.";
    } else if (q.includes('tell me more')) {
        answerText = "Welcome to the future of development! With Ask Dr Leon, you can combine modern serverless architecture, natural voice interactions, and AI prompt engineering to build production-ready applications in record time.";
    }

    speakBritishAnswer(answerText);
}

// Speak text aloud using the loaded British male voice
function speakBritishAnswer(text) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Stop any overlapping audio
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';

    if (britishVoice) {
        utterance.voice = britishVoice;
    }

    utterance.rate = 1.0; 
    utterance.pitch = 0.95; // Natural male conversational pitch
    
    window.speechSynthesis.speak(utterance);
}