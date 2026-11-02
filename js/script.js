// Process query by interrogating OpenAI & Knowledge Base via Netlify Function
async function processUserQuery(query) {
    lastAskedQuery = query;
    const q = query.toLowerCase();

    // Instant handling for 1-minute deep-dive expansion
    if (q.includes('tell me more')) {
        const deepDiveText = `Here is a comprehensive one-minute breakdown regarding ${lastAskedQuery || 'our previous topic'}. When developing modern digital solutions, depth of execution matters. By combining clean frontend architecture, reliable serverless endpoints on Netlify, and precise AI prompting, you eliminate friction, maintain maintainable codebases, and deliver robust software lightning fast.`;
        updateRelatedTopics(q);
        speakBritishAnswer(deepDiveText);
        return;
    }

    try {
        console.log("Interrogating OpenAI knowledge base for:", query);
        
        // Call your Netlify serverless function running GPT-4o-mini
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: query })
        });

        if (response.ok) {
            const data = await response.json();
            updateRelatedTopics(q);
            speakBritishAnswer(data.reply);
        } else {
            console.warn("Backend chat function error, using smart fallback.");
            fallbackResponse(query);
        }
    } catch (error) {
        console.error("Connection error to AI engine:", error);
        fallbackResponse(query);
    }
}

// Fallback response if offline or backend isn't reached
function fallbackResponse(query) {
    const fallbackText = `Regarding your question about ${query}, mastering this core concept helps you build cleaner systems, connect APIs securely, and direct AI tools with absolute precision.`;
    updateRelatedTopics(query.toLowerCase());
    speakBritishAnswer(fallbackText);
}