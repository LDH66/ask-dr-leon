import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { prompt, isFollowUp, useFishAudio } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "Prompt is required" }) };
    }

    console.log(`[CHAT FUNCTION] Processing prompt: "${prompt}" (FollowUp: ${isFollowUp})`);

    // 1. Generate a short, snappy text response from OpenAI (Fast model + strict token limit)
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and lightweight model
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
      max_tokens: 120, // Strict limit ensures fast generation time
      temperature: 0.7,
    });

    const replyText = chatCompletion.choices[0].message.content;
    console.log(`[CHAT FUNCTION] Generated reply: "${replyText}"`);

    let base64Audio = "";

    // 2. Convert text to speech using the ultra-fast 'tts-1' model
    if (useFishAudio) {
      // Placeholder or integration for Fish Audio if enabled
      // If Fish Audio isn't fully configured yet, it falls back gracefully or uses OpenAI TTS
      base64Audio = await generateOpenAITTS(replyText);
    } else {
      base64Audio = await generateOpenAITTS(replyText);
    }

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

async function generateOpenAITTS(text) {
  // Using 'tts-1' (standard speed model) instead of 'tts-1-hd' for maximum speed
  const mp3Response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "onyx", // Deep, professional voice matching Dr. Leon's persona
    input: text,
    speed: 1.05, // Slightly accelerated speech for snappier delivery
  });

  const buffer = Buffer.from(await mp3Response.arrayBuffer());
  return buffer.toString("base64");
}