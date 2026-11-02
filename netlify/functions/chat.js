const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DR_LEON_KB = "You are Dr Leon, an expert AI mentor with a British persona.";
const ELEVEN_VOICE_ID = "vOUSQuw1UT28N8q4CT5l";

exports.handler = async function (event) {
  try {
    const { prompt } = JSON.parse(event.body || "{}");
    
    // Call ElevenLabs Text-to-Speech API
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
          text: prompt || "Hello, this is a test.",
          model_id: "eleven_multilingual_v2",
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `ElevenLabs error: ${errorText}` }),
      };
    }

    // Convert audio stream to base64 to send back to the frontend
    const arrayBuffer = await ttsResponse.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({ audio: base64Audio }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};