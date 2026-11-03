let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let lastAskedQuery = "";

document.addEventListener('DOMContentLoaded', () => {
    setupNetlifyMicrophone();
    setupUIHandlers();
});

// Play Base64 MP3 audio returned from backend
function playElevenLabsAudio(base64Audio) {
    if (window.currentAudio) {
        window.currentAudio.pause();
    }
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
    window.currentAudio = new Audio(audioUrl);
    window.currentAudio.play().catch(err => {
        console.warn("Audio playback interrupted or blocked by browser:", err);
    });
}

// Local Speech Synthesis fallback
function speakBritishAnswer(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';

    const voices = window.speechSynthesis.getVoices();
    const britishVoice = voices.find(v => 
        v.lang === 'en-GB' && (v.name.toLowerCase().includes('male') || v.name.includes('Oliver') || v.name.includes('Daniel'))
    ) || voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang.startsWith('en'));

    if (britishVoice) utterance.voice = britishVoice;
    utterance.rate = 0.98; 
    utterance.pitch = 0.92; 
    window.speechSynthesis.speak(utterance);
}

// Setup Microphone recording for iOS/Mac/Desktop
function setupNetlifyMicrophone() {
    const micBtn = document.getElementById('micBtn');
    const listeningIndicator = document.getElementById('listeningIndicator');

    if (micBtn) micBtn.style.display = 'flex';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    micBtn.addEventListener('click', async () => {
        if (!isRecording) {
            try {
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
                    if (event.data.size > 0) audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    stream.getTracks().forEach(track => track.stop());
                    const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/mp4' });
                    
                    if (listeningIndicator) {
                        listeningIndicator.textContent = "Processing audio...";
                        listeningIndicator.style.display = 'block';
                    }

                    const transcribedText = await sendAudioToBackend(audioBlob);
                    
                    if (transcribedText) {
                        const userInput = document.getElementById('userInput');
                        if (userInput) userInput.value = transcribedText;
                        processUserQuery(transcribedText, false);
                    }
                    
                    if (listeningIndicator) listeningIndicator.style.display = 'none';
                };

                mediaRecorder.start();
                isRecording = true;
                micBtn.classList.add('listening');
                if (listeningIndicator) {
                    listeningIndicator.textContent = "Listening... Tap mic again to send.";
                    listeningIndicator.style.display = 'block';
                }

            } catch (err) {
                console.warn("Microphone access error:", err);
                alert("Microphone access denied or unsupported. Please check device permissions.");
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

// Send user voice audio to Netlify Whisper Transcribe Endpoint
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

// Attach UI Event Listeners
function setupUIHandlers() {
    const submitBtn = document.getElementById('submitBtn');
    const stopAudioBtn = document.getElementById('stopAudioBtn');
    const userInput = document.getElementById('userInput');

    if (submitBtn && userInput) {
        submitBtn.addEventListener('click', () => {
            const query = userInput.value.trim();
            if (query) processUserQuery(query, false);
        });

        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = userInput.value.trim();
                if (query) {
                    userInput.blur();
                    processUserQuery(query, false);
                }
            }
        });
    }

    if (stopAudioBtn) {
        stopAudioBtn.addEventListener('click', () => {
            if (window.currentAudio) window.currentAudio.pause();
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        });
    }

    bindTopicPills();
}

function bindTopicPills() {
    const topicPills = document.querySelectorAll('.pill-btn');
    const userInput = document.getElementById('userInput');

    topicPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const topic = pill.getAttribute('data-topic');
            if (topic === "Tell me more") {
                // Trigger deeper follow-up on the last asked query
                if (lastAskedQuery) {
                    processUserQuery(lastAskedQuery, true);
                } else {
                    processUserQuery("Vibe Coding", true);
                }
            } else {
                if (userInput) userInput.value = topic;
                processUserQuery(topic, false);
            }
        });
    });
}

// Send User Query to Backend Serverless Function (`chat.js`)
async function processUserQuery(query, isFollowUp = false) {
    if (!isFollowUp) {
        lastAskedQuery = query;
    }
    
    const q = query.toLowerCase();
    updateRelatedTopics(q);

    try {
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: query, 
                isFollowUp: isFollowUp 
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.audio) {
                playElevenLabsAudio(data.audio);
            } else {
                speakBritishAnswer(data.text || data.reply);
            }
            return;
        }
    } catch (error) {
        console.warn("Netlify function error, using fallback:", error);
    }

    speakBritishAnswer(`Regarding ${query}, mastering this core concept helps you build cleaner systems and direct AI tools with precision.`);
}

// Refresh dynamic suggestion pills (Removed '(1 min)' from button text)
function updateRelatedTopics(queryKey) {
    const topicPillsContainer = document.getElementById('topicPills');
    if (!topicPillsContainer) return;

    let newPillsHTML = `<button class="pill-btn primary" data-topic="Tell me more">Tell me more</button>`;

    if (queryKey.includes('vibe coding')) {
        newPillsHTML += `
            <button class="pill-btn" data-topic="4-Part Prompt Formula">4-Part Prompt Formula</button>
            <button class="pill-btn" data-topic="Connecting APIs">Connecting APIs</button>
            <button class="pill-btn" data-topic="Game Dev Physics">Game Dev Physics</button>
            <button class="pill-btn" data-topic="Media & Audio Sync">Media & Audio Sync</button>
            <button class="pill-btn" data-topic="What is HTML?">What is HTML?</button>
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