let mediaRecorder;
let audioChunks = [];
let isRecording = false;

document.addEventListener('DOMContentLoaded', () => {
    setupNetlifyMicrophone();
    setupUIHandlers();
});

// Setup robust audio recording compatible with Mac, iPhone, and Android
function setupNetlifyMicrophone() {
    const micBtn = document.getElementById('micBtn');
    const listeningIndicator = document.getElementById('listeningIndicator');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (micBtn) micBtn.style.display = 'none';
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        // Detect best supported audio mime type for iOS vs Desktop
        let options = { mimeType: 'audio/webm' };
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options = { mimeType: 'audio/mp4' }; // Optimized for iOS Safari
        } else if (!MediaRecorder.isTypeSupported('audio/webm')) {
            options = {}; // Fallback to browser default
        }

        try {
            mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
            mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
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

// Process any user question dynamically and speak response aloud
function processUserQuery(query) {
    const q = query.toLowerCase();
    let answerText = `Regarding your question about ${query}, that is a core part of modern software engineering. When building applications, clear system architecture and prompt design ensure high-quality results.`;

    // Dynamic keyword matching + smart fallback for any custom question (e.g. CSS, databases, etc.)
    if (q.includes('vibe coding')) {
        answerText = "Vibe coding represents a brilliant paradigm shift where you act as the visionary architect. Instead of writing boilerplate syntax line by line, you converse with AI to build, test, and deploy entire applications effortlessly.";
    } else if (q.includes('prompt formula') || q.includes('formula')) {
        answerText = "The four-part prompt formula consists of: First, defining a clear role for your AI. Second, providing rich context. Third, setting strict constraints. And fourth, specifying the precise output format you require.";
    } else if (q.includes('api') || q.includes('connecting')) {
        answerText = "Connecting APIs allows your frontend user interface to securely communicate with powerhouse backend services like OpenAI, managing authentication and data exchange smoothly behind the scenes.";
    } else if (q.includes('css') || q.includes('style')) {
        answerText = "Cascading Style Sheets, or CSS, controls the visual layout, typography, and responsive design of your web interface, ensuring a clean and polished user experience across all devices.";
    } else if (q.includes('tell me more')) {
        answerText = "Welcome to the future of development! With Ask Dr Leon, you can combine modern serverless architecture, natural voice interactions, and AI prompt engineering to build production-ready applications in record time.";
    } else {
        // Dynamic smart response for any custom query typed or spoken (like "what is css")
        answerText = `You asked about ${query}. In the context of modern development, mastering this concept helps you build cleaner systems, connect APIs more securely, and direct AI tools with absolute precision.`;
    }

    speakBritishAnswer(answerText);
}

// Speak text aloud forcing an optimized British male voice on iPhone, Mac, and desktop
function speakBritishAnswer(text) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Stop any overlapping audio
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';

    // Dynamically query voices right at speech time to ensure iOS/Safari populates them
    const voices = window.speechSynthesis.getVoices();
    const britishVoice = voices.find(v => 
        v.lang === 'en-GB' && (v.name.toLowerCase().includes('male') || v.name.includes('Oliver') || v.name.includes('Daniel') || v.name.includes('Arthur') || v.name.includes('George') || v.name.includes('Ryan'))
    ) || voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang.startsWith('en'));

    if (britishVoice) {
        utterance.voice = britishVoice;
    }

    utterance.rate = 0.98; // Natural conversational pacing
    utterance.pitch = 0.92; // Warmer male pitch to eliminate the high robotic tone
    
    window.speechSynthesis.speak(utterance);
}