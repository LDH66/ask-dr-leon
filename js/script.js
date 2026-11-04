async function initSimli() {
  try {
    const res = await fetch('/.netlify/functions/simli-token', { method: 'POST' });
    const data = await res.json();
    
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

    // Correct positional constructor signature for LiveKit mode
    simliClient = new SimliClient(
      sessionToken,
      videoElement,
      audioElement,
      null,          // null for default LiveKit ICE config
      LogLevel.INFO, // Log level
      "livekit"      // Explicit mode
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