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
    const defaultAvatarImg = document.getElementById("default-avatar-img");

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
      // Switch visibility from fallback image to live video stream once started
      if (defaultAvatarImg) defaultAvatarImg.style.display = 'none';
      if (videoElement) videoElement.style.display = 'block';
    });

    await simliClient.start();
  } catch (err) {
    console.error("[SIMLI ERROR] Initialization failed:", err);
    // Fallback to static image if initialization errors out
    const videoElement = document.getElementById("simli-video");
    const defaultAvatarImg = document.getElementById("default-avatar-img");
    if (videoElement) videoElement.style.display = 'none';
    if (defaultAvatarImg) defaultAvatarImg.style.display = 'block';
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
        
        // Initialize Simli only after user interaction unlocks mobile media pipelines
        if (!simliClient && currentMode === "video") {
            initSimli();
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
    const defaultAvatarImg = document.getElementById("default-avatar-img");
    if (simliVideo && currentMode === "video") {
        simliVideo.style.display = 'block';
        if (defaultAvatarImg) defaultAvatarImg.style.display = 'none';
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
                audioCtx = new (window.AudioContext || window.webkitAudioContext)