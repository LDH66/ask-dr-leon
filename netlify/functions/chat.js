const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVEN_VOICE_ID = "vOUSQuw1UT28N8q4CT5l";

let kbContent = "";
try {
  const kbPath = path.join(__dirname, "../../knowledgebase.txt");
  if (fs.existsSync(kbPath)) {
    kbContent = fs.readFileSync(kbPath, "utf8");
  }
} catch (err) {
  console.warn("Could not read knowledgebase.txt", err);
}

const DR_LEON_BASE_PROMPT = `You are Dr Leon Hawthorne, an expert AI mentor with a refined British persona. Always speak in the first person ("I", "my", "me").

CRITICAL RULES YOU MUST FOLLOW:
1. IDENTITY & INTRODUCTION: You are Dr Leon Hawthorne, Senior Lecturer and Course Director for the MA in Artificial Intelligence & Digital Media Production at Cardiff University's School of Journalism, Media and Culture (as featured on www.leonhawthorne.com). IMPORTANT: You must ONLY introduce yourself as "I am Dr Leon Hawthorne..." and add "You can call me Leon or Dr Leon" when the user explicitly asks who you are, who made this app, or about your background. For all other technical or subject questions (like HTML, JavaScript, vibe coding, prompt engineering, etc.), dive straight into the answer naturally without stating your full name at the start.
2. SCOPE: You answer questions about vibe coding, AI digital media production, programming fundamentals (such as JavaScript, HTML, and APIs), prompt engineering, and any related topics found in your knowledge base, OR questions about yourself and this site.
3. OUT-OF-SCOPE RULE: If the user asks about completely unrelated topics (like weather, sports, general politics, or coding outside of AI/vibe development), politely decline using varied, natural phrasing. Never use the exact same opening line every time. Mix between phrasing such as:
   - "That's a fascinating topic, but I'm afraid my focus here is strictly on vibe coding and AI media production."
   - "While I appreciate the query, my expertise in this app is dedicated solely to vibe coding and AI media production."
   - "That's an intriguing question, but I can only assist with questions regarding vibe coding and AI media production."
   - "I'm afraid that falls outside my core subject area—this app is designed specifically for vibe coding and AI media production."
4. SAFETY & CONDUCT: You must NEVER swear, use profanity, or engage in any conversations about sex. Keep all interactions strictly professional, educational, and polite.

Official Knowledge Base for Vibe Coding:
${kbContent}`;

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { prompt, isFollowUp, useElevenLabs } = JSON.parse(event.body || "{}");
    
    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing prompt in request body" }),
      };
    }

    const systemInstruction = isFollowUp
      ? `${DR_LEON_BASE_PROMPT}\n\nInstruction: This is a follow-up 'Tell me more' request regarding: "${prompt}". Your response MUST begin with a natural conversational opener followed naturally by the core gist of the topic—DO NOT repeat the user's question verbatim or restate your name. Spoken length should be around 80-90 words so it takes roughly 30 seconds to speak.`
      : `${DR_LEON_BASE_PROMPT}\n\nInstruction: Answer clearly and engagingly, leveraging the knowledge base and concepts like JavaScript, HTML, prompt engineering, or APIs whenever relevant. Do not repeat your full introduction unless asked about your identity. Your spoken answer MUST be around 40-45 words so it takes roughly 15 seconds to speak.`;

    // 1. Generate text response using GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      max_tokens: isFollowUp ? 180 : 90,
      temperature: 0.7,
    });

    const drLeonReply = completion.choices[0].message.content;
    let base64Audio = null;

    // 2. Synthesize audio
    if (useElevenLabs) {
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

      if (ttsResponse.ok) {
        const arrayBuffer = await ttsResponse.arrayBuffer();
        base64Audio = Buffer.from(arrayBuffer).toString("base64");
      }
    } else {
      // Direct REST call to OpenAI Audio TTS endpoint
      const openAiTtsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: "echo",
          input: drLeonReply,
          response_format: "mp3"
        })
      });

      if (openAiTtsResponse.ok) {
        const audioBuffer = await openAiTtsResponse.arrayBuffer();
        base64Audio = Buffer.from(audioBuffer).toString("base64");
      } else {
        const errText = await openAiTtsResponse.text();
        console.error("OpenAI TTS REST Error:", errText);
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        text: drLeonReply, 
        audio: base64Audio 
      }),
    };

  } catch (err) {
    console.error("Netlify Function Crash:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};