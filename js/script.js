// ==========================================
// DR. LEON - MAIN FRONTEND SCRIPT
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[DR. LEON] Pipeline Active 🚀");
    console.log("--------------------------------------------------");

    // Initialize Simli session / connection
    await initSimli();
    
    // Add any other page startup logic here
});

async function initSimli() {
    try {
        const response = await fetch('/.netlify/functions/simli-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        console.log("[SIMLI] Token response from backend:", data);

        if (data.error) {
            console.error("[SIMLI] Backend returned error:", data.error);
            return null;
        }

        // Handle the backend response: if it's an array of ICE servers, wrap it correctly; otherwise use data directly
        const sessionConfig = Array.isArray(data) ? { iceServers: data } : data;
        
        console.log("[SIMLI] Successfully prepared session configuration.");
        return sessionConfig;

    } catch (error) {
        console.error("[SIMLI] Failed to retrieve session data from Netlify.", error);
        return null;
    }
}