import { SimliClient, LogLevel } from "https://cdn.jsdelivr.net/npm/simli-client@latest/+esm";

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let currentMode = "video"; // "video" or "audio"

let simliClient = null;
let audioCtx = null;
let isAudioUnlocked = false;
let currentFetchController = null;

let faqDatabase = [];
let fuseInstance = null;

async function initFAQDatabase() {
    try {
        const res = await fetch('data/faqs.json');
        faqDatabase = await res.json();
        
        // Render 20 FAQ buttons into graphicsPane
        const topicPillsContainer = document.getElementById('topicPills');
        if (topicPillsContainer) {
            let html = '';
            faqDatabase.forEach((faq, index) => {
                const isPrimary = index === 0 ? ' primary' : '';
                html += `<button class="pill-btn${isPrimary}" data-faq-id="${faq.id}">${faq.button_label}</button>`;
            });
            topicPillsContainer.innerHTML = html;
            bindFAQButtons();
        }

        // Initialize Fuse.js for smart fuzzy text matching
        const options = {
            includeScore: true,
            threshold: 0.4,
            keys: ['keywords', 'question', 'button_label']
        };
        fuseInstance = new Fuse(faqDatabase, options);
        console.log("[FAQ ENGINE] Loaded and indexed 20 FAQs successfully.");
    } catch (e) {
        console.error("[FAQ ENGINE] Failed to load faqs.json:", e);
    }
}

async function initSimli() {
  if (currentMode !== "video") return;

  if (simliClient) {
    try {
      await simliClient.close();
    } catch (e) {}
    simliClient = null;
  }

  try {
    const res = await fetch('/.netlify/functions/simli-token', { method: 'POST' });
    const data = await res.json();
    const sessionToken = data.session_token;
    if (!sessionToken) return;

    const videoElement = document.getElementById("simli-video");
    const audioElement = document.getElementById("simli-audio");
    if (!videoElement || !audioElement) return;

    simliClient = new SimliClient(sessionToken, videoElement, audioElement, null, LogLevel.INFO, "livekit");

    simliClient.on("start", () => {
      if (audioElement && isAudioUnlocked) {
        audioElement.muted = false;
        audioElement.volume = 1.0;
        audioElement.play().catch(() => {});
      }
    });

    await simliClient.start();
  } catch (err) {
    console.error("[SIMLI ERROR] Initialization failed:", err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("[DR. LEON] Pipeline Active 🚀");
    initSimli();
    initFAQDatabase();
    setupNetlifyMicrophone();
    setupUIHandlers();
    setupModeToggle();

    const unlockAudio = () => {
        isAudioUnlocked = true;
        const audioElement = document.getElementById("simli-audio");
        if (audioElement) {
            audioElement.muted = false;
            audioElement.volume = 1.0;
            audioElement.play().catch(() => {});
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
    const mediaModeBtn = document.getElementById('mediaModeBtn');
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
                try { await simliClient.close(); } catch (e) {}
                simliClient = null;
            }

            if (simliVideo) simliVideo.style.display = 'none';
            if (defaultAvatarImg) defaultAvatarImg.style.display = 'block';
        } else {
            currentMode = "video";
            mediaModeBtn.textContent = "Mode: Video";
            mediaModeBtn.classList.add('leon-active');

            if (simliVideo) simliVideo.style.display = 'block';
            if (defaultAvatarImg) defaultAvatarImg.style.display = 'none';

            initSimli();
        }
    });
}

function stopCurrentSpeech() {
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
    }
    
    const faqVideo = document.getElementById("faq-video");
    if (faqVideo) {
        faqVideo.pause();
        faqVideo.currentTime = 0;
        faqVideo.style.display = 'none';
    }

    const audioElement = document.getElementById("simli-audio");
    if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
    }

    if (simliClient && currentMode === "video") {
        try {
            if (typeof simliClient.ClearBuffer === 'function') simliClient.ClearBuffer();
        } catch (e) {}
    }
}

function playFAQMedia(faqItem) {
    stopCurrentSpeech();

    const simliVideo = document.getElementById('simli-video');
    const faqVideo = document.getElementById('faq-video');
    const defaultImg = document.getElementById('default-avatar-img');
    const userInput = document.getElementById('userInput');

    if (userInput) userInput.value = faqItem.question;

    if (currentMode === "video") {
        // Video Mode: Play pre-recorded MP4 video instantly
        if (simliVideo) simliVideo.style.display = 'none';
        if (defaultImg) defaultImg.style.display = 'none';

        if (faqVideo) {
            faqVideo.src = faqItem.video_file;
            faqVideo.style.display = 'block';
            faqVideo.currentTime = 0;
            faqVideo.play().catch(e => console.warn("FAQ Video play error:", e));
        }
    } else {
        // Audio Mode: Show Default-image.jpg and play pre-recorded MP3
        if (simliVideo) simliVideo.style.display = 'none';
        if (faqVideo) faqVideo.style.display = 'none';
        if (defaultImg) defaultImg.style.display = 'block';

        window.currentAudio = new Audio(faqItem.audio_file);
        window.currentAudio.play().catch(e => console.warn("FAQ Audio play error:", e));
    }
}

function bindFAQButtons() {
    const buttons = document.querySelectorAll('.pill-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const faqId = btn.getAttribute('data-faq-id');
            const found = faqDatabase.find(f => f.id === faqId);
            if (found) {
                playFAQMedia(found);
            }
        });
    });
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
            if (audioCtx.state === 'suspended') await audioCtx.resume();

            const binaryString = atob(base64Audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

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

            if (audioElement) audioElement.play().catch(() => {});
        } catch (e) {
            console.warn("[SIMLI] PCM conversion fallback:", e);
        }
    } else {
        if (window.currentAudio) window.currentAudio.pause();
        const audioBlob = b64toBlob(base64Audio, 'audio/mp3');
        window.currentAudio = new Audio(URL.createObjectURL(audioBlob));
        window.currentAudio.play().catch(e => console.warn("Audio play error:", e));
    }
}

function b64toBlob(b64Data, contentType = '', sliceSize = 512) {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
        byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: contentType });
}

function setupNetlifyMicrophone() {
    const micBtn = document.getElementById('micBtn');
    const listeningIndicator = document.getElementById('listeningIndicator');

    if (micBtn) micBtn.style.display = 'flex';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    micBtn.addEventListener('click', async () => {
        if (!isRecording) {
            stopCurrentSpeech(); 
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
                let options = { mimeType: 'audio/mp4' };
                if (!MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/webm' };

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
                        processUserQuery(transcribedText);
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
                alert("Microphone access denied or unsupported.");
            }
        } else {
            if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
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
                const response = await fetch('/.netlify/functions/transcribe', { method: 'POST', body: base64Audio });
                const data = await response.json();
                resolve(data.text);
            };
        });
    } catch (error) {
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
        stopAudioBtn.addEventListener('click', () => stopCurrentSpeech());
    }
}

async function processUserQuery(query) {
    // 1. Check Fuse.js local FAQ match first (Fuzzy matching)
    if (fuseInstance) {
        const results = fuseInstance.search(query);
        if (results.length > 0 && results[0].score <= 0.35) {
            console.log(`[FAQ ENGINE] Matched query locally: "${results[0].item.question}"`);
            playFAQMedia(results[0].item);
            return;
        }
    }

    // 2. Fallback to live Netlify chat function if no local FAQ match is found
    if (currentFetchController) currentFetchController.abort();
    currentFetchController = new AbortController();

    stopCurrentSpeech();
    const userInput = document.getElementById('userInput');
    const originalPlaceholder = userInput ? userInput.placeholder : "";
    if (userInput) {
        userInput.value = "";
        userInput.placeholder = "Dr. Leon is thinking...";
        userInput.disabled = true;
    }

    try {
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: currentFetchController.signal,
            body: JSON.stringify({ prompt: query, isFollowUp: false })
        });

        if (userInput) {
            userInput.placeholder = originalPlaceholder;
            userInput.disabled = false;
        }

        if (response.ok) {
            const data = await response.json();
            handleAudioPlayback(data.audio);
        }
    } catch (error) {
        if (userInput) {
            userInput.placeholder = originalPlaceholder;
            userInput.disabled = false;
        }
    }
}