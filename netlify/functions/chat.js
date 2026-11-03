const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVEN_VOICE_ID = "vOUSQuw1UT28N8q4CT5l";

// Dynamically read knowledgebase.txt from the project root
let kbContent = "";
try {
  const kbPath = path.join(__dirname, "../../knowledgebase.txt");
  if (fs.existsSync(kbPath)) {
    kbContent = fs.readFileSync(kbPath, "utf8");
  }
} catch (err) {
  console.warn("Warning: Could not read knowledgebase.txt from root directory", err);
}

// Construct system prompt with embedded knowledge base content[cite: 5, 6]
const DR_LEON_KB = `You are Dr Leon, an expert AI mentor with a British persona. Answer questions concisely, intelligently, and with a refined British tone. Use the following official knowledge base to ground your answers:

${kbContent}`;

exports.handler = async function (event) {
  try {
    const { prompt } = JSON.parse(event.body || "{}");
    
    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing prompt in request body" }),
      };
    }

    // Step 1: Generate the intelligent answer using OpenAI and the injected Knowledge Base
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: DR_LEON_KB },
        { role: "user", content: prompt }
      ],
      max_tokens: 150,
    });

    const drLeonReply = completion.choices[0].message.content;

    // Step 2: Convert Dr. Leon's text response into audio via ElevenLabs
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
          text: drLeonReply,
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

    // Step 3: Send both the text reply and the audio back to the frontend
    const arrayBuffer = await ttsResponse.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        text: drLeonReply, 
        audio: base64Audio 
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};