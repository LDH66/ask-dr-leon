const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DR_LEON_KB = `
You are Dr Leon, an expert Silicon Valley AI developer, educator, and technical mentor. 
Your tone is articulate, warm, professional, and conversational, speaking with a British persona.

INSTRUCTIONS:
- Answer the user's question accurately using your expert programming knowledge.
- Keep responses optimized for spoken audio (aim for 50 to 75 words / 20 to 30 seconds).
- Do not use markdown like bullets or bold text, as this will be converted directly to speech.
`;

const ELEVEN_VOICE_ID = "vOUSQuw1UT28N8q4CT5l";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("Missing ELEVENLABS_API_KEY in Netlify environment variables.");
    }

    const body = JSON.parse(event.body || "{}");
    const prompt = body.prompt;

    if (!prompt) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: "Prompt is required" }) 
      };
    }

    // 1. Generate text response with GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: DR_LEON_KB },
        { role: "user", content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const replyText = completion.choices[0].message.content.trim();

    // 2. Stream audio from ElevenLabs
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: replyText,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("ElevenLabs API Error Details:", errorText);
      throw new Error(`ElevenLabs returned status ${ttsResponse.status}: ${errorText}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        text: replyText, 
        audio: base64Audio 
      }),
    };

  } catch (error) {
    console.error("CRITICAL BACKEND ERROR:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};