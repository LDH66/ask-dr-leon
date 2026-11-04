import { SimliClient, LogLevel } from "https://cdn.jsdelivr.net/npm/simli-client@latest/+esm";

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let hasAskedFirstQuestion = false;
let lastAskedQuery = "What is this site about and what is its core purpose?";
let currentVoiceEngine = "generic"; 

let simliClient = null;
let audioCtx = null;

async function initSimli() {
  try {
    const res = await fetch('/.netlify/functions/simli-token', { method: 'POST' });
    const data = await res.json();
    
    console.log("[SIMLI] Token response from backend:", data);
    const sessionToken = data.session_token;

    if (!sessionToken) {
      console.error("[SIMLI] Failed to retrieve session token string from Netlify.");
      return;
    }

    const videoElement = document.getElementById("simli-video");
    const audioElement = document.getElementById("simli-audio");

    if (!videoElement || !audioElement) {
      console.error("[SIMLI ERROR] Missing video or audio element in DOM.");
      return;
    }

    simliClient = new SimliClient(
      sessionToken,
      videoElement,
      audioElement,
      null,           // null for default LiveKit ICE config
      LogLevel.INFO,  // Log level
      "livekit"       // Explicit mode
    );

    simliClient.on("start", () => {
      console.log("[SIMLI] Avatar stream connected and visible successfully! 🚀");
    });

    simliClient.on("error", (err) => {
      console.error("[SIMLI ERROR] Runtime error event:", err);
    });

    await simliClient.start();
    console.log("[SIMLI] client.start() connected successfully.");

  } catch (err) {
    console.error("[SIMLI ERROR] Initialization failed:", err);
  }
}

// --- Shuffle Pool Logic for Fillers 1 through 8 ---
let fillerPool = [];

function getNextFillerNum() {
    if (fillerPool.length === 0) {
        fillerPool = [1, 2, 3, 4, 5, 6, 7, 8];
        for (let i = fillerPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fillerPool[i], fillerPool[j]] = [fillerPool[j], fillerPool[i]];
        }
    }
    return fillerPool.shift();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("--------------------------------------------------");
    console.log("[DR. LEON] Simli ES Module Pipeline Active 🚀");
    console.log("--------------------------------------------------");
    initSimli();
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
            currentVoiceEngine = "fishaudio";
            voiceToggleBtn.textContent = "Voice: Leon";
            voiceToggleBtn.classList.add('leon-active');
            console.log("[DR. LEON] Switched engine to: Fish Audio (Leon)");
        } else {
            currentVoiceEngine = "generic";
            voiceToggleBtn.textContent = "Voice: Generic";
            voiceToggleBtn.classList.remove('leon-active');
            console.log("[DR. LEON] Switched engine to: OpenAI TTS (Generic)");
        }
    });
}

function playInstantFiller() {
    return new Promise((resolve) => {
        const fillerNum = getNextFillerNum();
        const suffix = (currentVoiceEngine === "fishaudio") ? "leon" : "generic";
        const fillerSrc = `audio/filler${fillerNum}_${suffix}.mp3`;

        if (window.currentAudio) {
            window.currentAudio.pause();
        }

        window.currentAudio = new Audio(fillerSrc);
        window.currentAudio.onended = () => { resolve(); };
        window.currentAudio.onerror = () => { resolve(); };
        window.currentAudio.play().catch(() => { resolve(); });
    });
}

// Helper to decode base64 audio into raw PCM16 stream for Simli Lip-Sync & Playback
async function sendAudioToSimli(base64Audio) {
    if (!simliClient) return;
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        }
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
        const channelData = audioBuffer.getChannelData(0); 
        
        const pcm16 = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
            let s = Math.max(-1, Math.min(1, channelData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        simliClient.sendAudioData(new Uint8Array(pcm16.buffer));
    } catch (e) {
        console.warn("[SIMLI] PCM conversion fallback:", e);
    }
}

function queueAudioStream(base64Audio) {
    if (!base64Audio) {
        console.error("[DR. LEON ERROR] No base64 audio returned!");
        return;
    }

    sendAudioToSimli(base64Audio);
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

async function processUserQuery(query, isFollowUp = false) {
    if (!isFollowUp) {
        hasAskedFirstQuestion = true;
        lastAskedQuery = query;
    }
    
    const q = query.toLowerCase();
    updateRelatedTopics(q);

    const fillerPromise = playInstantFiller();

    try {
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: query, 
                isFollowUp: isFollowUp,
                useFishAudio: (currentVoiceEngine === "fishaudio")
            })
        });

        if (response.ok) {
            const data = await response.json();
            await fillerPromise;
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