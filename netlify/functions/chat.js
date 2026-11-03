const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVEN_VOICE_ID = "vOUSQuw1UT28N8q4CT5l";

// Read knowledgebase.txt from root directory dynamically
let kbContent = "";
try {
  const kbPath = path.join(__dirname, "../../knowledgebase.txt");
  if (fs.existsSync(kbPath)) {
    kbContent = fs.readFileSync(kbPath, "utf8");
  }
} catch (err) {
  console.warn("Could not read knowledgebase.txt", err);
}

const DR_LEON_BASE_PROMPT = `You are Dr Leon, an expert AI mentor with a refined British persona. Ground your answers using this official knowledge base:

${kbContent}`;

exports.handler = async function (event) {
  try {
    const { prompt, isFollowUp } = JSON.parse(event.body || "{}");
    
    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing prompt in request body" }),
      };
    }

    // Configure instructions based on whether it's a standard query or a "Tell me more" follow-up
    const systemInstruction = isFollowUp
      ? `${DR_LEON_BASE_PROMPT}\n\nInstruction: This is a follow-up 'Tell me more' request about "${prompt}". Your response MUST begin with the exact phrase "Sure, I can tell you more about ${prompt}." Follow this immediately with fresh, advanced insights, technical context, or deeper explanations that go significantly beyond a basic summary without repeating previous phrasing. Spoken length should be around 80-90 words.`
      : `${DR_LEON_BASE_PROMPT}\n\nInstruction: Answer clearly and engagingly. Your spoken answer MUST be around 40-45 words so it takes roughly 15 seconds to speak.`;

    const maxTokens = isFollowUp ? 180 : 90;

    // Step 1: Generate response from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    });

    const drLeonReply = completion.choices[0].message.content;

    // Step 2: Convert to ElevenLabs Audio using turbo model for optimized speed
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}?optimize_streaming_latency=3`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: drLeonReply,
          model_id: "eleven_turbo_v2_5",
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

    // Step 3: Return Base64 encoded audio
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