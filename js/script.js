import { SimliClient, LogLevel } from "https://cdn.jsdelivr.net/npm/simli-client@latest/+esm";

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let hasAskedFirstQuestion = false;
let lastAskedQuery = "What is this site about and what is its core purpose?";
let currentMode = "video"; // "video" or "audio"

let simliClient = null;
let audioCtx = null;
let isAudioUnlocked = false;
let currentFetchController = null;

async function initSimli() {
  if (currentMode !== "video") return; // Do not initialize Simli if user is in Audio-only mode

  if (simliClient) {
    try {
      await simliClient.close();
    } catch (e) {
      console.warn("[SIMLI] Previous client cleanup warning:", e);
    }
    simliClient = null;
  }

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
      null,           
      LogLevel.INFO,  
      "livekit"       
    );

    simliClient.on("start", () => {
      console.log("[SIMLI] Avatar stream connected and visible successfully! 🚀");
      
      if (audioElement && isAudioUnlocked) {
        audioElement.muted = false;
        audioElement.volume = 1.0;
        audioElement.play().catch(e => console.warn("[SIMLI] Audio play warning:", e));
      }
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

document.addEventListener('DOMContentLoaded', () => {
    console.log("--------------------------------------------------");
    console.log("[DR. LEON] Pipeline Active 🚀");
    console.log("--------------------------------------------------");
    initSimli();
    setupNetlifyMicrophone();
    setupUIHandlers();
    setupModeToggle();
    updateRelatedTopics(""); 

    const unlockAudio = () => {
        isAudioUnlocked = true;
        const audioElement = document.getElementById("simli-audio");
        if (audioElement) {
            audioElement.muted = false;
            audioElement.volume = 1.0;
            audioElement.play().then(() => {
                console.log("[AUDIO] iOS Safari audio element unlocked successfully.");
            }).catch(e => {
                console.warn("[AUDIO] Unlock play warning:", e);
            });
        }
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
});

function setupModeToggle() {
    const mediaModeBtn = document.getElementById('voice-toggle-btn');
    const simliVideo = document.getElementById('simli-video');
    const defaultAvatarImg = document.getElementById('default-avatar-img');

    if (!mediaModeBtn) return;

    mediaModeBtn.addEventListener('click', async () => {
        stopCurrentSpeech();

        if (currentMode === "video") {
            currentMode = "audio";
            mediaModeBtn.textContent = "Mode: Audio";
            mediaModeBtn.classList.remove('leon-active');
            
            if (simliClient) {
                try {
                    await simliClient.close();
                } catch (e) {}
                simliClient = null;
            }

            if (simliVideo) simliVideo.style.display = 'none';
            if (defaultAvatarImg) defaultAvatarImg.style.display = 'block';

            console.log("[DR. LEON] Switched to Audio-only mode");
        } else {
            currentMode = "video";
            mediaModeBtn.textContent = "Mode: Video";
            mediaModeBtn.classList.add('leon-active');

            if (simliVideo) simliVideo.style.display = 'block';
            if (defaultAvatarImg) defaultAvatarImg.style.display = 'none';

            initSimli();
            console.log("[DR. LEON] Switched to Video mode");
        }
    });
}

function stopCurrentSpeech() {
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
    }
    
    const audioElement = document.getElementById("simli-audio");
    if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
    }

    if (simliClient && currentMode === "video") {
        try {
            if (typeof simliClient.ClearBuffer === 'function') {
                simliClient.ClearBuffer();
            } else if (typeof simliClient.clearBuffer === 'function') {
                simliClient.clearBuffer();
            } else if (typeof simliClient.clearAudioData === 'function') {
                simliClient.clearAudioData();
            }
        } catch (e) {
            console.warn("[SIMLI] Buffer clear warning:", e);
        }
    }
}

async function handleAudioPlayback(base64Audio) {
    if (!base64Audio) return;

    const audioElement = document.getElementById("simli-audio");
    if (audioElement) {
        audioElement.muted = false;
        audioElement.volume = 1.0;
        audioElement.play().catch(() => {});
    }

    if (currentMode === "video" && simliClient) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            }
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
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
            
            const audioChunkData = new Uint8Array(pcm16.buffer);

            if (typeof simliClient.sendAudioDataImmediate === 'function') {
                simliClient.sendAudioDataImmediate(audioChunkData);
            } else {
                simliClient.sendAudioData(audioChunkData);
            }

            if (audioElement) {
                audioElement.play().catch(e => console.warn("[SIMLI] Audio element play retry:", e));
            }
        } catch (e) {
            console.warn("[SIMLI] PCM conversion fallback:", e);
        }
    } else {
        if (window.currentAudio) {
            window.currentAudio.pause();
        }
        const audioBlob = b64toBlob(base64Audio, 'audio/mp3');
        const audioUrl = URL.createObjectURL(audioBlob);
        
        window.currentAudio = new Audio(audioUrl);
        window.currentAudio.play().catch(e => console.warn("Audio play error:", e));
    }
}

function b64toBlob(b64Data, contentType = '', sliceSize = 512) {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}

function setupNetlifyMicrophone() {
    const micBtn = document.getElementById('mic-btn');
    const listeningIndicator = document.getElementById('listening-indicator');

    if (micBtn) micBtn.style.display = 'flex';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    micBtn.addEventListener('click', async () => {
        if (!isRecording) {
            stopCurrentSpeech(); 
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
                        const userInput = document.getElementById('prompt-input');
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
    const submitBtn = document.getElementById('submit-btn');
    const stopAudioBtn = document.getElementById('stop-audio-btn');
    const userInput = document.getElementById('prompt-input');

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
            stopCurrentSpeech();
        });
    }

    bindTopicPills();
}

function bindTopicPills() {
    const topicPills = document.querySelectorAll('.topic-pills .pill-btn, .pill-btn');
    const userInput = document.getElementById('prompt-input');

    topicPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const topic = pill.getAttribute('data-topic') || pill.textContent;
            
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
    if (currentFetchController) {
        currentFetchController.abort();
    }
    currentFetchController = new AbortController();

    stopCurrentSpeech();

    const userInput = document.getElementById('prompt-input');
    const originalPlaceholder = userInput ? userInput.placeholder : "";
    if (userInput) {
        userInput.value = "";
        userInput.placeholder = "Dr. Leon is thinking...";
        userInput.disabled = true;
    }

    if (!isFollowUp) {
        hasAskedFirstQuestion = true;
        lastAskedQuery = query;
    }
    
    const q = query.toLowerCase();
    updateRelatedTopics(q);

    try {
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: currentFetchController.signal,
            body: JSON.stringify({ 
                prompt: query, 
                isFollowUp: isFollowUp
            })
        });

        if (userInput) {
            userInput.placeholder = originalPlaceholder;
            userInput.disabled = false;
        }

        if (response.ok) {
            const data = await response.json();
            handleAudioPlayback(data.audio);
            return;
        } else {
            console.error("[DR. LEON ERROR] Server returned status:", response.status);
        }
    } catch (error) {
        if (userInput) {
            userInput.placeholder = originalPlaceholder;
            userInput.disabled = false;
        }
        if (error.name === 'AbortError') {
            console.log("[DR. LEON] Previous request superseded by new click.");
        } else {
            console.error("[DR. LEON ERROR] Fetch error:", error);
        }
    }
}

function updateRelatedTopics(queryKey) {
    const topicPillsContainer = document.getElementById('topic-pills');
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