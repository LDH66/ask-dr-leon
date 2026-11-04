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

    console.log(`[CHAT FUNCTION] Processing prompt: "${prompt}" (FishAudio: ${useFishAudio})`);

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

    let base64Audio = "";

    // 2. Select TTS Engine based on frontend toggle state
    if (useFishAudio) {
      console.log("[CHAT FUNCTION] Routing to Fish Audio...");
      base64Audio = await generateFishAudio(replyText);
    } else {
      console.log("[CHAT FUNCTION] Routing to OpenAI TTS...");
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
  const mp3Response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "onyx",
    input: text,
    speed: 1.05,
  });

  const buffer = Buffer.from(await mp3Response.arrayBuffer());
  return buffer.toString("base64");
}

async function generateFishAudio(text) {
  const fishApiKey = process.env.FISH_AUDIO_API_KEY;
  const fishReferenceId = process.env.FISH_AUDIO_MODEL_ID || process.env.FISH_AUDIO_REFERENCE_ID;

  if (!fishApiKey) {
    console.warn("[FISH AUDIO] Missing FISH_AUDIO_API_KEY in environment variables. Falling back to OpenAI TTS.");
    return generateOpenAITTS(text);
  }

  try {
    // Standard Fish Audio API endpoint request
    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${fishApiKey}`,
        "Content-Type": "application/json",
        "Model": "tts-1"
      },
      body: JSON.stringify({
        text: text,
        reference_id: fishReferenceId || undefined,
        format: "mp3",
        normalize: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[FISH AUDIO API ERROR]", response.status, errText);
      throw new Error(`Fish Audio failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString("base64");

  } catch (error) {
    console.error("[FISH AUDIO] Error generating audio, falling back to OpenAI TTS:", error);
    return generateOpenAITTS(text);
  }
}