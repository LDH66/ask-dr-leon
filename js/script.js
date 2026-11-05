/**
 * ==========================================
 * SECTION 1: IMPORTS & GLOBAL STATE VARIABLES
 * ==========================================
 * Imports the Simli WebRTC client and initializes global 
 * tracking variables for recording, modes, audio context, and Fuse.js.
 */
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

// FAQ Data and Fuse.js instance
let faqList = [];
let fuseInstance = null;


/**
 * ==========================================
 * SECTION 2: FAQ & FUSE.JS INITIALIZATION
 * ==========================================
 * Asynchronously fetches local FAQ items from data/faqs.json 
 * and sets up the Fuse.js fuzzy search engine instance.
 */
async function loadFaqsAndInitFuse() {
    try {
        const res = await fetch('/data/faqs.json');
        if (res.ok) {
            faqList = await res.json();
            console.log(`[FAQS] Successfully loaded ${faqList.length} FAQs from /data/faqs.json`);
            
            const options = {
                keys: ['button_label', 'question', 'keywords', 'answer'],
                includeScore: true,
                threshold: 0.4 
            };
            fuseInstance = new Fuse(faqList, options);
        } else {
            console.warn("[FAQS] Could not load /data/faqs.json, status:", res.status);
        }
    } catch (err) {
        console.error("[FAQS] Error fetching /data/faqs.json:", err);
    }
}


/**
 * ==========================================
 * SECTION 3: SIMLI AVATAR INITIALIZATION
 * ==========================================
 * Fetches a secure WebRTC session token from Netlify functions 
 * and starts the live Simli video avatar stream.
 */
async function initSimli() {
  if (currentMode !== "video") return;

  if (simliClient) {
    try {
      await simliClient.close();
    } catch (e) {
      console.warn("[SIMLI] Previous client cleanup warning:", e);
    }
    simliClient = null;
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  try {
    const res = await fetch('/.netlify/functions/simli-token', { method: 'POST' });
    const data = await res.json();
    const sessionToken = data.session_token || data.token;

    if (!sessionToken) return;

    const videoElement = document.getElementById("simli-video");
    const audioElement = document.getElementById("simli-audio");

    if (!videoElement || !audioElement) return;

    simliClient = new SimliClient(
      sessionToken,
      videoElement,
      audioElement,
      null,           
      LogLevel.INFO,  
      "livekit"       
    );

    simliClient.on("start", () => {
      if (audioElement && isAudioUnlocked) {
        audioElement.muted = false;
        audioElement.volume = 1.0;
        audioElement.play().catch(e => {});
      }
    });

    await simliClient.start();
  } catch (err) {
    console.error("[SIMLI ERROR] Initialization failed:", err);
  }
}


/**
 * ==========================================
 * SECTION 4: DOM CONTENT LOADED & AUDIO UNLOCK
 * ==========================================
 * Fires when the webpage loads. Bootstraps core modules 
 * and sets up global event listeners to unlock browser audio restrictions.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("--------------------------------------------------");
    console.log("[DR. LEON] Pipeline Active 🚀");
    console.log("--------------------------------------------------");
    loadFaqsAndInitFuse();
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
            audioElement.play().then(() => {}).catch(e => {});
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


/**
 * ==========================================
 * SECTION 5: MODE TOGGLE (VIDEO / AUDIO)
 * ==========================================
 * Switches the interface between live Simli video avatar mode 
 * and standard audio-only mode.
 */
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


/**
 * ==========================================
 * SECTION 6: SPEECH & PLAYBACK STOPPER
 * ==========================================
 * Immediately halts any active audio playback, video playback, 
 * or microphone buffering across the site.
 */
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

    const faqVideo = document.getElementById("faq-video");
    if (faqVideo) {
        faqVideo.pause();
        faqVideo.currentTime = 0;
        faqVideo.style.display = 'none';
    }

    const simliVideo = document.getElementById("simli-video");
    if (simliVideo && currentMode === "video") {
        simliVideo.style.display = 'block';
    }

    if (simliClient && currentMode === "video") {
        try {
            if (typeof simliClient.ClearBuffer === 'function') simliClient.ClearBuffer();
            else if (typeof simliClient.clearBuffer === 'function') simliClient.clearBuffer();
        } catch (e) {}
    }
}


/**
 * ==========================================
 * SECTION 7: LOCAL FAQ ASSET PLAYER
 * ==========================================
 * Plays pre-recorded local `.mp4` video assets or `.mp3` audio assets 
 * matching a selected FAQ item.
 */
async function playLocalFaqAsset(faqItem) {
    stopCurrentSpeech();

    if (simliClient && currentMode === "video") {
        try { await simliClient.close(); } catch (e) {}
        simliClient = null;
    }

    const simliVideo = document.getElementById("simli-video");
    const faqVideo = document.getElementById("faq-video");
    const defaultAvatarImg = document.getElementById("default-avatar-img");

    if (currentMode === "video") {
        if (faqVideo && faqItem.video_file) {
            if (simliVideo) simliVideo.style.display = 'none';
            if (defaultAvatarImg) defaultAvatarImg.style.display = 'none';
            
            faqVideo.src = faqItem.video_file;
            faqVideo.style.display = 'block';
            try {
                await faqVideo.play();
                console.log(`[LOCAL ASSET] Playing video: ${faqItem.video_file}`);
            } catch (e) {
                console.warn("[LOCAL ASSET] Video play error:", e);
            }
        }
    } else {
        if (defaultAvatarImg) defaultAvatarImg.style.display = 'block';
        if (simliVideo) simliVideo.style.display = 'none';
        if (faqVideo) faqVideo.style.display = 'none';

        if (faqItem.audio_file) {
            window.currentAudio = new Audio(faqItem.audio_file);
            window.currentAudio.play().catch(e => console.warn("[LOCAL ASSET] Audio play error:", e));
            console.log(`[LOCAL ASSET] Playing audio: ${faqItem.audio_file}`);
        }
    }
}


/**
 * ==========================================
 * SECTION 8: DYNAMIC AUDIO PLAYBACK (LLM)
 * ==========================================
 * Handles streaming base64 audio chunks into Simli's audio buffer 
 * or fallback HTML5 audio elements for live LLM responses.
 */
async function handleAudioPlayback(base64Audio) {
    if (!base64Audio) return;

    if (currentMode === "video" && !simliClient) {
        await initSimli();
    }

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

            if (audioElement) audioElement.play().catch(e => {});
        } catch (e) {
            console.warn("[SIMLI] PCM conversion fallback:", e);
        }
    } else {
        if (window.currentAudio) window.currentAudio.pause();
        const audioBlob = b64toBlob(base64Audio, 'audio/mp3');
        const audioUrl = URL.createObjectURL(audioBlob);
        window.currentAudio = new Audio(audioUrl);
        window.currentAudio.play().catch(e => {});
    }
}


/**
 * ==========================================
 * SECTION 9: BASE64 TO BLOB CONVERTER
 * ==========================================
 * Helper utility to convert base64 audio strings into playable Blob objects.
 */
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


/**
 * ==========================================
 * SECTION 10: NETLIFY MICROPHONE RECORDING
 * ==========================================
 * Manages voice recording via browser MediaRecorder API 
 * and sends captured audio blobs to the backend transcription function.
 */
function setupNetlifyMicrophone() {
    const micBtn = document.getElementById('micBtn');
    const listeningIndicator = document.getElementById('listeningIndicator');

    if (!micBtn) return;
    micBtn.style.display = 'flex';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    micBtn.addEventListener('click', async () => {
        if (!isRecording) {
            stopCurrentSpeech(); 
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: true } 
                });

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
                alert("Microphone access denied or unsupported.");
            }
        } else {
            if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
            isRecording = false;
            micBtn.classList.remove('listening');
        }
    });
}


/**
 * ==========================================
 * SECTION 11: AUDIO TRANSCRIPTION SENDER
 * ==========================================
 * Uploads recorded audio to Netlify serverless transcription endpoint.
 */
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
        return null;
    }
}


/**
 * ==========================================
 * SECTION 12: UI INPUT & BUTTON HANDLERS
 * ==========================================
 * Binds click and keypress listeners to text input submissions, audio controls, and the pause/play toggle.
 */
function setupUIHandlers() {
    const submitBtn = document.getElementById('submitBtn');
    const stopAudioBtn = document.getElementById('stopAudioBtn');
    const pausePlayBtn = document.getElementById('pausePlayBtn');
    const pausePlayIcon = document.getElementById('pausePlayIcon');
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
            stopCurrentSpeech();
            if (pausePlayIcon) {
                // Reset icon back to Pause bars when stopped
                pausePlayIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
            }
        });
    }

    if (pausePlayBtn && pausePlayIcon) {
        pausePlayBtn.addEventListener('click', () => {
            const faqVideo = document.getElementById('faq-video');
            const simliVideo = document.getElementById('simli-video');
            const simliAudio = document.getElementById('simli-audio');
            const activeAudio = window.currentAudio;

            let targetMedia = null;
            if (faqVideo && faqVideo.style.display === 'block') {
                targetMedia = faqVideo;
            } else if (simliVideo && simliVideo.style.display === 'block') {
                targetMedia = simliVideo;
            } else {
                targetMedia = activeAudio || simliAudio;
            }

            if (!targetMedia) return;

            // Check actual pause state
            const isCurrentlyPaused = targetMedia.paused || targetMedia.ended;

            if (isCurrentlyPaused) {
                targetMedia.play().then(() => {
                    if (simliAudio && targetMedia === simliVideo) simliAudio.play().catch(e => {});
                    // Switch icon to Pause (II bars)
                    pausePlayIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
                }).catch(e => console.warn("[PAUSE/PLAY] Resume blocked:", e));
            } else {
                targetMedia.pause();
                if (simliAudio && targetMedia === simliVideo) simliAudio.pause();
                // Switch icon to Play (▶ triangle)
                pausePlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
            }
        });
    }

    bindTopicPills();
}
/**
 * ==========================================
 * SECTION 13: TOPIC PILL EVENT BINDINGS
 * ==========================================
 * Attaches click handlers to suggested topic pills in the UI.
 */
function bindTopicPills() {
    const topicPills = document.querySelectorAll('.pill-btn');
    const userInput = document.getElementById('userInput');

    topicPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const topic = pill.getAttribute('data-topic');
            
            if (topic === "Tell me more") {
                if (!hasAskedFirstQuestion) {
                    processUserQuery("Who are you and what is your background?", false);
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


/**
 * ==========================================
 * SECTION 14: USER QUERY PROCESSOR & ROUTER
 * ==========================================
 * Core routing pipeline: checks local Fuse.js FAQ matches first, 
 * then falls back to the Netlify LLM chat function if no local asset matches.
 */
async function processUserQuery(query, isFollowUp = false) {
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

    if (!isFollowUp) {
        hasAskedFirstQuestion = true;
        lastAskedQuery = query;
    }
    
    const q = query.toLowerCase();
    updateRelatedTopics(q);

    // 1. Check Fuzzy Match against loaded FAQs across button_label, question, keywords, and answer
    if (fuseInstance && faqList.length > 0 && !isFollowUp) {
        const results = fuseInstance.search(query);
        if (results.length > 0 && results[0].score <= 0.30) {
            console.log(`[FUZZY MATCH] Found match "${results[0].item.button_label}" with score ${results[0].score}`);
            if (userInput) {
                userInput.placeholder = originalPlaceholder;
                userInput.disabled = false;
            }
            await playLocalFaqAsset(results[0].item);
            return;
        }
    }

    // 2. Fallback to Netlify LLM + Fish Audio serverless function if no strong local FAQ match
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
        }
    } catch (error) {
        if (userInput) {
            userInput.placeholder = originalPlaceholder;
            userInput.disabled = false;
        }
        if (error.name !== 'AbortError') {
            console.error("[DR. LEON ERROR] Fetch error:", error);
        }
    }
}


/**
 * ==========================================
 * SECTION 15: DYNAMIC RELATED TOPICS UPDATER
 * ==========================================
 * Updates and renders relevant topic recommendation pills in the UI based on conversation context.
 */
function updateRelatedTopics(queryKey) {
    const topicPillsContainer = document.getElementById('topicPills');
    if (!topicPillsContainer) return;

    let newPillsHTML = `<button class="pill-btn primary" data-topic="Tell me more">Tell me more</button>`;

    // Render the 10 selected questions/topics as pills
    const topics = [
        "What is Vibe Coding?",
        "Do I need a Computer Science degree?",
        "What is the role of JavaScript?",
        "What are the best AI coding tools?",
        "What is Prompt Engineering?",
        "How does 4-Part Prompt Formula work?",
        "How do I connect external web APIs?",
        "How do I debug errors in my code?",
        "How was this application built?",
        "Who is Dr. Leon Hawthorne?"
    ];

    topics.forEach(topic => {
        newPillsHTML += `<button class="pill-btn" data-topic="${topic}">${topic}</button>`;
    });

    topicPillsContainer.innerHTML = newPillsHTML;
    bindTopicPills(); 
}


/**
 * ==========================================
 * SECTION 16: MOBILE AUTO-PLAY & GESTURE BYPASS FOR WEBRTC
 * ==========================================
 * Automatically unlocks media playback on iOS, Chrome, and Safari mobile browsers 
 * upon the user's first tap or click interaction.
 */
document.addEventListener('click', function unlockAudioAndVideo() {
    const audioEl = document.getElementById('simli-audio');
    const videoEl = document.getElementById('simli-video');
    
    if (audioEl) {
        audioEl.muted = false;
        audioEl.volume = 1.0;
        audioEl.play().catch(() => {});
    }
    if (videoEl) {
        videoEl.play().catch(() => {});
    }

    if (window.AudioContext || window.webkitAudioContext) {
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (tempCtx.state === 'suspended') {
            tempCtx.resume();
        }
    }
    
    document.removeEventListener('click', unlockAudioAndVideo);
}, { once: true });