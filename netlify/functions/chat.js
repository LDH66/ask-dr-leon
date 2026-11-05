/**
 * ==========================================
 * SECTION 1: OPENAI INITIALIZATION
 * ==========================================
 * Imports the OpenAI library and initializes the API client 
 * using environment variables.
 */
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


/**
 * ==========================================
 * SECTION 2: NETLIFY SERVERLESS HANDLER
 * ==========================================
 * Main entry point for the Netlify function. Validates HTTP methods, 
 * parses incoming user prompts, and coordinates response generation 
 * using semantic LLM boundary enforcement.
 */
export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { prompt, isFollowUp } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "Prompt is required" }) };
    }

    console.log(`[CHAT FUNCTION] Processing custom prompt: "${prompt}"`);

    // Semantic text generation with strict boundary enforcement in system instructions
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Dr. Leon, an expert tech educator and lecturer in Digital Media Production at Cardiff University, explaining Vibe Coding and media app development. 

CRITICAL INSTRUCTION:
Your primary job is to answer questions strictly about Vibe Coding, programming fundamentals (such as JavaScript, HTML, CSS), AI media tools, and your course at Cardiff University. 
Evaluate the user's query semantically. If the query is about politics, general celebrities, sports, world events, or anything outside of Vibe Coding and directly related subjects, do NOT attempt to answer it. 
Instead, respond with EXACTLY this sentence and nothing else, with no introductory or concluding text:
"Sorry, I can't answer that. I can only answer questions about vibe coding and directly relevant subjects"

When answering valid questions, keep your response concise in 2 to 3 short sentences max. Be punchy, direct, and conversational.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 120,
      temperature: 0.3, // Lower temperature helps ensure strict adherence to fallback instructions
    });

    const replyText = chatCompletion.choices[0].message.content.trim();
    console.log(`[CHAT FUNCTION] Generated reply: "${replyText}"`);

    // Generate audio using your specific Fish Audio Cloned Voice ID
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


/**
 * ==========================================
 * SECTION 3: FISH AUDIO TTS GENERATOR
 * ==========================================
 * Sends text to Fish Audio's text-to-speech API using your specific 
 * cloned voice ID and returns the audio encoded as a base64 string.
 */
async function generateFishAudio(text) {
  const fishApiKey = process.env.FISH_AUDIO_API_KEY;
  const voiceModelId = "68e3fa24abdc47609409bb667b558a59"; // Your exact cloned voice ID

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