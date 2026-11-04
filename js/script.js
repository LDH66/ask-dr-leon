let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let hasAskedFirstQuestion = false;
let lastAskedQuery = "What is this site about and what is its core purpose?";
let currentVoiceEngine = "generic"; // Default voice mode: OpenAI TTS ("generic")

// --- Shuffle Pool Logic for Fillers 1 through 8 ---
let fillerPool = [];

function getNextFillerNum() {
    if (fillerPool.length === 0) {
        // Create an array of numbers 1 through 8
        fillerPool = [1, 2, 3, 4, 5, 6, 7, 8];
        // Fisher-Yates Shuffle algorithm to randomize the pool
        for (let i = fillerPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fillerPool[i], fillerPool[j]] = [fillerPool[j], fillerPool[i]];
        }
        console.log("[DR. LEON] Filler pool reshuffled:", fillerPool);
    }
    // Pull the next filler number from the front of the shuffled pool
    return fillerPool.shift();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("--------------------------------------------------");
    console.log("[DR. LEON] Audio Pipeline with Local Fillers Active 🚀");
    console.log("--------------------------------------------------");
    setupNetlifyMicrophone();
    setupUIHandlers();
    setupVoiceToggle();
    updateRelatedTopics(""); 
});

function setupVoiceToggle() {
    const voiceToggleBtn = document.getElementById('voiceToggleBtn');
    if (!voiceToggleBtn) return;

    voiceToggleBtn.addEventListener('click', () => {
        if (currentVoiceEngine === "generic") {
            currentVoiceEngine = "elevenlabs";
            voiceToggleBtn.textContent = "Voice: Leon";
            voiceToggleBtn.classList.add('leon-active');
            console.log("[DR. LEON] Switched engine to: ElevenLabs (Leon)");
        } else {
            currentVoiceEngine = "generic";
            voiceToggleBtn.textContent = "Voice: Generic";
            voiceToggleBtn.classList.remove('leon-active');
            console.log("[DR. LEON] Switched engine to: OpenAI TTS (Generic)");
        }
    });
}

// Play an instant local filler sound, pulling from the non-repeating 1–8 pool
function playInstantFiller() {
    return new Promise((resolve) => {
        const fillerNum = getNextFillerNum();
        const suffix = (currentVoiceEngine === "elevenlabs") ? "leon" : "generic";
        const fillerSrc = `audio/filler${fillerNum}_${suffix}.mp3`;

        if (window.currentAudio) {
            window.currentAudio.pause();
        }

        console.log("[DR. LEON] Playing instant filler:", fillerSrc);
        window.currentAudio = new Audio(fillerSrc);
        
        // Ensure the main answer never cuts off the filler early
        window.currentAudio.onended = () => {
            resolve();
        };

        window.currentAudio.onerror = (err) => {
            console.warn("[DR. LEON] Filler playback prevented or failed:", err);
            resolve(); // Resolve anyway so the main answer can proceed if audio fails
        };

        window.currentAudio.play().catch(err => {
            console.warn("[DR. LEON] Filler autoplay restricted by browser policy:", err);
            resolve();
        });
    });
}

// Queue / Play the real backend audio stream only AFTER the filler finishes
function queueAudioStream(base64Audio) {
    if (!base64Audio) {
        console.error("[DR. LEON ERROR] No base64 audio returned!");
        return;
    }

    console.log("[DR. LEON] Main response audio ready. Waiting for filler to complete...");

    const playMain = () => {
        if (window.currentAudio && window.currentAudio.paused && window.currentAudio.src.startsWith('data:audio')) {
            return; // Already playing
        }
        console.log("[DR. LEON] Swapping to main response audio stream.");
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        window.currentAudio = new Audio(audioUrl);
        window.currentAudio.play().catch(err => {
            console.warn("[DR. LEON WARNING] Main audio playback restricted:", err);
        });
    };

    if (window.currentAudio && !window.currentAudio.ended) {
        const existingOnEnded = window.currentAudio.onended;
        window.currentAudio.onended = () => {
            if (typeof existingOnEnded === 'function') existingOnEnded();
            playMain();
        };
    } else {
        playMain();
    }
}

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
                        hasAskedFirstQuestion = true;
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
                console.warn("Microphone error:", err);
                alert("Microphone access denied or unsupported.");
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

function setupUIHandlers() {
    const submitBtn = document.getElementById('submitBtn');
    const stopAudioBtn = document.getElementById('stopAudioBtn');
    const userInput = document.getElementById('userInput');

    if (submitBtn && userInput) {
        submitBtn.addEventListener('click', () => {
            const query = userInput.value.trim();
            if (query) {
                hasAskedFirstQuestion = true;
                processUserQuery(query, false);
            }
        });

        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = userInput.value.trim();
                if (query) {
                    userInput.blur();
                    hasAskedFirstQuestion = true;
                    processUserQuery(query, false);
                }
            }
        });
    }

    if (stopAudioBtn) {
        stopAudioBtn.addEventListener('click', () => {
            if (window.currentAudio) window.currentAudio.pause();
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
                if (!hasAskedFirstQuestion) {
                    processUserQuery("What is this site about and what is its core purpose?", false);
                } else {
                    processUserQuery(lastAskedQuery, true);
                }
            } else {
                hasAskedFirstQuestion = true;
                if (userInput) userInput.value = topic;
                processUserQuery(topic, false);
            }
        });
    });
}

// Process Query: Instantly plays varying filler in parallel while fetching background response, then queues main audio cleanly
async function processUserQuery(query, isFollowUp = false) {
    if (!isFollowUp) {
        hasAskedFirstQuestion = true;
        lastAskedQuery = query;
    }
    
    const q = query.toLowerCase();
    updateRelatedTopics(q);

    // 1. Instantly trigger the local filler sound with shuffled pool variation[cite: 1]
    const fillerPromise = playInstantFiller();

    console.log("[DR. LEON] Fetching background response for:", query);

    try {
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: query, 
                isFollowUp: isFollowUp,
                useElevenLabs: (currentVoiceEngine === "elevenlabs")
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log("[DR. LEON] Background response received.");
            
            // 2. Wait for the filler to finish 100% before allowing the main audio to trigger[cite: 1]
            await fillerPromise;

            // 3. Seamlessly play the real response audio[cite: 1]
            queueAudioStream(data.audio);
            return;
        } else {
            console.error("[DR. LEON ERROR] Server returned status:", response.status);
        }
    } catch (error) {
        console.error("[DR. LEON ERROR] Fetch error:", error);
    }
}

function updateRelatedTopics(queryKey) {
    const topicPillsContainer = document.getElementById('topicPills');
    if (!topicPillsContainer) return;

    let newPillsHTML = `<button class="pill-btn primary" data-topic="Tell me more">Tell me more</button>`;

    if (queryKey.includes('vibe coding')) {
        newPillsHTML += `
            <button class="pill-btn" data-topic="4-Part Prompt Formula">4-Part Prompt Formula</button>
            <button class="pill-btn" data-topic="Connecting APIs">Connecting APIs</button>
            <button class="pill-btn" data-topic="Prompt Engineering">Prompt Engineering</button>
            <button class="pill-btn" data-topic="What is JavaScript?">What is JavaScript?</button>
            <button class="pill-btn" data-topic="What is HTML?">What is HTML?</button>
        `;
    } else {
        newPillsHTML += `
            <button class="pill-btn" data-topic="What is Vibe Coding?">What is Vibe Coding?</button>
            <button class="pill-btn" data-topic="4-Part Prompt Formula">4-Part Prompt Formula</button>
            <button class="pill-btn" data-topic="Connecting APIs">Connecting APIs</button>
            <button class="pill-btn" data-topic="Prompt Engineering">Prompt Engineering</button>
            <button class="pill-btn" data-topic="What is JavaScript?">What is JavaScript?</button>
        `;
    }

    topicPillsContainer.innerHTML = newPillsHTML;
    bindTopicPills(); 
}