import OpenAI from "openai";
import { Readable } from "stream";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const base64Audio = event.body;
    if (!base64Audio) {
      return { statusCode: 400, body: JSON.stringify({ error: "No audio data provided" }) };
    }

    const buffer = Buffer.from(base64Audio, 'base64');
    
    // Convert buffer into a format OpenAI SDK accepts
    const file = await OpenAI.toFile(Readable.from(buffer), "audio.mp4", {
      type: "audio/mp4",
    });

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
    console.error("[TRANSCRIBE ERROR]:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" }),
    };
  }
}