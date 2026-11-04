import { SimliClient } from "https://unpkg.com/simli-client@latest/dist/index.js";

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
    
    if (!data.session_token) {
      console.error("[SIMLI] Failed to retrieve session token:", data);
      return;
    }

    const videoElement = document.getElementById("simli-video");
    const audioElement = document.getElementById("simli-audio");

    if (!videoElement || !audioElement) {
      console.error("[SIMLI ERROR] Missing video/audio DOM elements.");
      return;
    }

    // Instantiate using numeric log level (4) instead of LogLevel enum
    simliClient = new SimliClient(
      data.session_token,
      videoElement,
      audioElement,
      null,           
      4   
    );

    simliClient.on("start", () => {
      console.log("[SIMLI] Avatar stream connected and visible successfully! 🚀");
    });

    simliClient.on("error", (err) => {
      console.error("[SIMLI ERROR] Runtime error event:", err);
    });

    await simliClient.start();
    console.log("[SIMLI] client.start() resolved successfully.");

  } catch (err) {
    console.error("[SIMLI ERROR] Initialization failed:", err);
  }
}