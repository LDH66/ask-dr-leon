let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let hasAskedFirstQuestion = false;
let lastAskedQuery = "What is this site about and what is its core purpose?";
let currentVoiceEngine = "generic"; // Default voice mode: OpenAI TTS ("generic")

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

// Play an instant local filler sound based on the active voice engine (generic vs leon)
function playInstantFiller() {
    const fillerNum = Math.floor(Math.random() * 3) + 1; // Random number 1, 2, or 3
    const suffix = (currentVoiceEngine === "elevenlabs") ? "leon" : "generic";
    const fillerSrc = `audio/filler${fillerNum}_${suffix}.mp3`;

    if (window.currentAudio) {
        window.currentAudio.pause();
    }

    console.log("[DR. LEON] Playing instant filler:", fillerSrc);
    window.currentAudio = new Audio(fillerSrc);
    window.currentAudio.play().catch(err => {
        console.warn("[DR. LEON] Filler playback prevented by browser policy:", err);
    });
}

// Play the real backend audio stream once it arrives
function playAudioStream(base64Audio) {
    if (!base64Audio) {
        console.error("[DR. LEON ERROR] No base64 audio returned!");
        return;
    }

    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio = null;
    }

    console.log("[DR. LEON] Swapping to main response audio stream.");
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
    window.currentAudio = new Audio(audioUrl);
    window.currentAudio.play().catch(err => {
        console.warn("[DR. LEON WARNING] Main audio playback restricted:", err);
    });
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

// Process Query: Instantly plays matching local filler, fetches response in background, then plays main audio
async function processUserQuery(query, isFollowUp = false) {
    if (!isFollowUp) {
        hasAskedFirstQuestion = true;
        lastAskedQuery = query;
    }
    
    const q = query.toLowerCase();
    updateRelatedTopics(q);

    // 1. INSTANT PERCEIVED LATENCY CHEAT: Play matching local voice filler immediately!
    playInstantFiller();

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
            
            // 2. Seamlessly swap to the real response audio once it arrives from the backend
            playAudioStream(data.audio);
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