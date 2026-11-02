const OpenAI = require("openai");
const { toFile } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Receive base64 audio string from frontend
    const base64Audio = event.body;
    if (!base64Audio) {
      return { statusCode: 400, body: JSON.stringify({ error: "No audio data received" }) };
    }

    // Convert base64 to Buffer
    const audioBuffer = Buffer.from(base64Audio, "base64");

    // Convert buffer to file object that OpenAI SDK accepts
    const file = await toFile(audioBuffer, "audio.mp4", {
      type: "audio/mp4",
    });

    // Send to OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: transcription.text }),
    };
  } catch (error) {
    console.error("Whisper transcription error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};