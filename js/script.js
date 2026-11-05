import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { prompt, isFollowUp } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "Prompt is required" }) };
    }

    console.log(`[CHAT FUNCTION] Processing prompt: "${prompt}"`);

    // Strict Out-of-Scope Guard Check
    const lowerPrompt = prompt.toLowerCase();
    const allowedKeywords = [
      "vibe", "coding", "javascript", "html", "css", "api", "prompt", "leon", 
      "cardiff", "media", "ai", "app", "site", "faq", "database", "sql", "json", 
      "git", "cursor", "netlify", "debug", "portfolio", "game", "mobile", "pwa"
    ];
    
    const isOffTopic = 
      lowerPrompt.includes("trump") || 
      lowerPrompt.includes("blair") || 
      lowerPrompt.includes("weather") || 
      lowerPrompt.includes("football") || 
      lowerPrompt.includes("president") || 
      lowerPrompt.includes("prime minister") ||
      !allowedKeywords.some(keyword => lowerPrompt.includes(keyword));

    let replyText = "";

    if (isOffTopic && !isFollowUp) {
      replyText = "Sorry, I can't answer that. I can only answer questions about vibe coding and directly relevant subjects";
    } else {
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are Dr. Leon, an expert tech educator and lecturer in Digital Media Production at Cardiff University, explaining Vibe Coding and media app development. Answer extremely concisely in 2 to 3 short sentences max. Be punchy, direct, and conversational.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 120,
        temperature: 0.7,
      });

      replyText = chatCompletion.choices[0].message.content;
    }

    console.log(`[CHAT FUNCTION] Reply text: "${replyText}"`);

    const base64Audio = await generateFishAudio(replyText);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: replyText,
        audio: base64Audio
      }),
    };

  } catch (error) {
    console.error("[CHAT FUNCTION ERROR]:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" }),
    };
  }
}

async function generateFishAudio(text) {
  const fishApiKey = process.env.FISH_AUDIO_API_KEY;
  const voiceModelId = "68e3fa24abdc47609409bb667b558a59";

  if (!fishApiKey) {
    throw new Error("Missing FISH_AUDIO_API_KEY environment variable in Netlify.");
  }

  try {
    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${fishApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text,
        reference_id: voiceModelId,
        format: "mp3",
        normalize: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fish Audio failed with status ${response.status}: ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");

  } catch (error) {
    console.error("[FISH AUDIO] Error generating audio:", error);
    throw error;
  }
}