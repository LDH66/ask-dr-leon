let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let lastAskedQuery = "";

document.addEventListener('DOMContentLoaded', () => {
    setupNetlifyMicrophone();
    setupUIHandlers();
});

// Robust iPhone & Mac microphone recording setup
function setupNetlifyMicrophone() {
    const micBtn = document.getElementById('micBtn');
    const listeningIndicator = document.getElementById('listeningIndicator');

    if (micBtn) {
        micBtn.style.display = 'flex';
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("getUserMedia not supported on this browser.");
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        // Detect iOS Safari vs Desktop audio encoding codecs
        let options = {};
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options = { mimeType: 'audio/mp4' }; // Ideal for iPhone Safari
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            options = { mimeType: 'audio/webm' };
        }

        try {
            mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
            mediaRecorder = new MediaRecorder(stream); // Fallback to default
        }

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/mp4' });
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
        console.warn("Microphone permission denied or unavailable:", err);
        alert("Microphone access is required on iOS. Please ensure permissions are allowed in Safari settings.");
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

// Setup keyboard bindings, stop speech button, and input triggers
function setupUIHandlers() {
    const submitBtn = document.getElementById('submitBtn');
    const stopAudioBtn = document.getElementById('stopAudioBtn');
    const userInput = document.getElementById('userInput');

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

    if (stopAudioBtn) {
        stopAudioBtn.addEventListener('click', () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        });
    }

    bindTopicPills();
}

// Attach click handlers to topic pills dynamically
function bindTopicPills() {
    const topicPills = document.querySelectorAll('.pill-btn');
    const userInput = document.getElementById('userInput');

    topicPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const topic = pill.getAttribute('data-topic');
            if (userInput) userInput.value = topic;
            processUserQuery(topic);
        });
    });
}

// Process queries, generate answers, and dynamically update related pills
function processUserQuery(query) {
    lastAskedQuery = query;
    const q = query.toLowerCase();
    let answerText = "";

    if (q.includes('tell me more')) {
        answerText = `Here is a comprehensive one-minute breakdown regarding ${lastAskedQuery || 'our previous topic'}. When developing modern digital solutions, depth of execution matters. By combining clean frontend architecture, reliable serverless endpoints on Netlify, and precise AI prompting, you eliminate friction, maintain maintainable codebases, and deliver robust software lightning fast.`;
    } else if (q.includes('vibe coding')) {
        answerText = "Vibe coding represents a brilliant paradigm shift where you act as the visionary architect. Instead of writing boilerplate syntax line by line, you converse with AI to build, test, and deploy entire applications effortlessly.";
    } else if (q.includes('html')) {
        answerText = "HyperText Markup Language, or HTML, forms the foundational skeleton of any web page, structuring text, images, inputs, and semantic sections so browsers can render them correctly.";
    } else if (q.includes('prompt formula') || q.includes('formula')) {
        answerText = "The four-part prompt formula consists of: First, defining a clear role for your AI. Second, providing rich context. Third, setting strict constraints. And fourth, specifying the precise output format you require.";
    } else if (q.includes('api') || q.includes('connecting')) {
        answerText = "Connecting APIs allows your frontend user interface to securely communicate with powerhouse backend services like OpenAI, managing authentication and data exchange smoothly behind the scenes.";
    } else if (q.includes('css') || q.includes('style')) {
        answerText = "Cascading Style Sheets, or CSS, controls the visual layout, typography, and responsive design of your web interface, ensuring a clean and polished user experience across all devices.";
    } else if (q.includes('game dev physics')) {
        answerText = "Game development physics engines calculate collision detection, gravity, and momentum in real-time, allowing interactive objects to behave naturally within your application environment.";
    } else if (q.includes('media & audio sync')) {
        answerText = "Media and audio synchronization coordinates web audio APIs and visual elements precisely down to the millisecond, ensuring seamless multimedia playback across desktop and mobile devices.";
    } else {
        answerText = `Regarding your question about ${query}, mastering this concept helps you build cleaner systems, connect APIs securely, and direct AI developer tools with absolute precision.`;
    }

    updateRelatedTopics(q);
    speakBritishAnswer(answerText);
}

// Dynamically refresh related topic pills with 5 options based on context
function updateRelatedTopics(queryKey) {
    const topicPillsContainer = document.getElementById('topicPills');
    if (!topicPillsContainer) return;

    let newPillsHTML = `<button class="pill-btn primary" data-topic="Tell me more">Tell me more (1 min)</button>`;

    if (queryKey.includes('vibe coding')) {
        newPillsHTML += `
            <button class="pill-btn" data-topic="4-Part Prompt Formula">4-Part Prompt Formula</button>
            <button class="pill-btn" data-topic="Connecting APIs">Connecting APIs</button>
            <button class="pill-btn" data-topic="Game Dev Physics">Game Dev Physics</button>
            <button class="pill-btn" data-topic="Media & Audio Sync">Media & Audio Sync</button>
            <button class="pill-btn" data-topic="What is HTML?">What is HTML?</button>
        `;
    } else if (queryKey.includes('html') || queryKey.includes('css')) {
        newPillsHTML += `
            <button class="pill-btn" data-topic="Connecting APIs">Connecting APIs</button>
            <button class="pill-btn" data-topic="What is Vibe Coding?">What is Vibe Coding?</button>
            <button class="pill-btn" data-topic="Responsive Design">Responsive Design</button>
            <button class="pill-btn" data-topic="Media & Audio Sync">Media & Audio Sync</button>
            <button class="pill-btn" data-topic="4-Part Prompt Formula">4-Part Prompt Formula</button>
        `;
    } else {
        newPillsHTML += `
            <button class="pill-btn" data-topic="What is Vibe Coding?">What is Vibe Coding?</button>
            <button class="pill-btn" data-topic="4-Part Prompt Formula">4-Part Prompt Formula</button>
            <button class="pill-btn" data-topic="Connecting APIs">Connecting APIs</button>
            <button class="pill-btn" data-topic="Game Dev Physics">Game Dev Physics</button>
            <button class="pill-btn" data-topic="Media & Audio Sync">Media & Audio Sync</button>
        `;
    }

    topicPillsContainer.innerHTML = newPillsHTML;
    bindTopicPills(); 
}

// Speak text aloud forcing a British male voice
function speakBritishAnswer(text) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';

    const voices = window.speechSynthesis.getVoices();
    const britishVoice = voices.find(v => 
        v.lang === 'en-GB' && (v.name.toLowerCase().includes('male') || v.name.includes('Oliver') || v.name.includes('Daniel') || v.name.includes('Arthur') || v.name.includes('George') || v.name.includes('Ryan'))
    ) || voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang.startsWith('en'));

    if (britishVoice) {
        utterance.voice = britishVoice;
    }

    utterance.rate = 0.98; 
    utterance.pitch = 0.92; 
    
    window.speechSynthesis.speak(utterance);
}