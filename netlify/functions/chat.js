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

    // 1. Fast text generation (strict limit for instant speed)
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are Dr. Leon, an expert tech educator explaining Vibe Coding and software development. Answer extremely concisely in 2 to 3 short sentences max. Be punchy, direct, and conversational."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 120,
      temperature: 0.7,
    });

    const replyText = chatCompletion.choices[0].message.content;
    console.log(`[CHAT FUNCTION] Generated reply: "${replyText}"`);

    // 2. Generate audio using your specific Fish Audio Cloned Voice ID
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
  
  // Your exact personal voice model ID hardcoded here
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
        reference_id: voiceModelId, // Bound directly to your cloned voice
        format: "mp3",
        normalize: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[FISH AUDIO API ERROR]", response.status, errText);
      throw new Error(`Fish Audio failed with status ${response.status}: ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString("base64");

  } catch (error) {
    console.error("[FISH AUDIO] Error generating audio:", error);
    throw error;
  }
}