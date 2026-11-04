// Complete script.js with updated Simli initialization handling
async function initSimli() {
    console.log("[DR. LEON] Pipeline Active 🚀");
    console.log("--------------------------------------------------");

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
            return;
        }

        // If data is an array (ICE servers), handle it directly or check structure
        let iceServers = null;
        if (Array.isArray(data)) {
            iceServers = data;
            console.log("[SIMLI] Successfully retrieved ICE servers array from backend.");
        } else if (data.iceServers) {
            iceServers = data.iceServers;
            console.log("[SIMLI] Successfully retrieved ICE servers object from backend.");
        } else if (typeof data === 'string' || data.token) {
            console.log("[SIMLI] Received token string from backend.");
        }

        // Return or assign data to your Simli Client instance here
        return data;

    } catch (error) {
        console.error("[SIMLI] Failed to retrieve session token/ICE servers from Netlify.", error);
    }
}

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initSimli();
});