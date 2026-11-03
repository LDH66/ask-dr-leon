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

    // Adjust spoken duration target based on standard ~150 words per minute speech rate
    // Standard answer = ~40-45 words (15 seconds spoken)
    // Follow-up 'Tell me more' answer = ~80-90 words (30 seconds spoken)
    const systemInstruction = isFollowUp
      ? `${DR_LEON_BASE_PROMPT}\n\nInstruction: Provide an extended, deeper elaboration on the topic. Your spoken answer MUST be around 80-90 words so it takes exactly 30 seconds to speak.`
      : `${DR_LEON_BASE_PROMPT}\n\nInstruction: Answer clearly and engagingly. Your spoken answer MUST be around 40-45 words so it takes roughly 15 seconds to speak.`;

    const maxTokens = isFollowUp ? 180 : 90;

    // Step 1: Generate response from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: isFollowUp ? `Tell me more about: ${prompt}` : prompt }
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
          model_id: "eleven_turbo_v2_5", // Latency optimized model
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