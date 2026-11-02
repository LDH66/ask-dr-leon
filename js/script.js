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

    micBtn.addEventListener('click', async () => {
        if (!isRecording) {
            try {
                // Explicitly request audio stream with mobile constraints
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: true } 
                });

                let options = { mimeType: 'audio/mp4' };
                if (!MediaRecorder.isTypeSupported('audio/mp4')) {
                    options = { mimeType: 'audio/webm' };
                }

                mediaRecorder = new MediaRecorder(stream, options);
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    // Stop tracks to release microphone hardware light
                    stream.getTracks().forEach(track => track.stop());

                    const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/mp4' });
                    
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

                mediaRecorder.start();
                isRecording = true;
                micBtn.classList.add('listening');
                if (listeningIndicator) {
                    listeningIndicator.textContent = "Listening... Tap mic again to send.";
                    listeningIndicator.style.display = 'block';
                }

            } catch (err) {
                console.warn("Microphone hardware error on iOS/Mac:", err);
                alert("Could not access microphone. Please check browser and device permissions.");
            }
        } else {
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                mediaRecorder.stop();
            }
            isRecording = false;
            micBtn.classList.remove('listening');
        }
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

// Process user queries by querying the OpenAI chat backend with local fallback
async function processUserQuery(query) {
    lastAskedQuery = query;
    const q = query.toLowerCase();

    // 1. Update related topic pills immediately
    updateRelatedTopics(q);

    // 2. Handle 1-minute deep-dive expansion locally & instantly
    if (q.includes('tell me more')) {
        const deepDiveText = `Here is a comprehensive one-minute breakdown regarding ${lastAskedQuery || 'our previous topic'}. When developing modern digital solutions, depth of execution matters. By combining clean frontend architecture, reliable serverless endpoints on Netlify, and precise AI prompting, you eliminate friction, maintain maintainable codebases, and deliver robust software lightning fast.`;
        speakBritishAnswer(deepDiveText);
        return;
    }

    // 3. Attempt OpenAI backend interrogation
    try {
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: query })
        });

        if (response.ok) {
            const data = await response.json();
            speakBritishAnswer(data.reply);
            return;
        }
    } catch (error) {
        console.warn("Backend chat fetch failed, using smart local fallback:", error);
    }

    // 4. Fallback response if backend is offline
    let fallbackText = `Regarding your question about ${query}, mastering this core concept helps you build cleaner systems, connect APIs securely, and direct AI tools with absolute precision.`;
    
    if (q.includes('vibe coding')) {
        fallbackText = "Vibe coding represents a brilliant paradigm shift where you act as the visionary architect. Instead of writing boilerplate syntax line by line, you converse with AI to build, test, and deploy entire applications effortlessly.";
    } else if (q.includes('html')) {
        fallbackText = "HyperText Markup Language, or HTML, forms the foundational skeleton of any web page, structuring text, images, inputs, and semantic sections so browsers can render them correctly.";
    } else if (q.includes('prompt formula')) {
        fallbackText = "The four-part prompt formula consists of: First, defining a clear role for your AI. Second, providing rich context. Third, setting strict constraints. And fourth, specifying the precise output format you require.";
    } else if (q.includes('api')) {
        fallbackText = "Connecting APIs allows your frontend user interface to securely communicate with powerhouse backend services like OpenAI, managing authentication and data exchange smoothly behind the scenes.";
    }

    speakBritishAnswer(fallbackText);
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