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

// REPLACE THIS WITH YOUR ELEVENLABS VOICE ID
const ELEVEN_VOICE_ID = "4b8d101937c957cd6943d009f0968cc53850c2c59fa321c10e13150ca3ef84a1";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt } = JSON.parse(event.body);

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

    // 2. Stream audio directly from ElevenLabs using your custom voice clone
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
      console.error("ElevenLabs API Error:", errorText);
      throw new Error(`ElevenLabs error: ${ttsResponse.statusText}`);
    }

    // 3. Convert MP3 buffer to Base64 to return to script.js for instant playback
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
    console.error("Chat backend error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};