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

const DR_LEON_BASE_PROMPT = `You are Dr Leon, an expert AI mentor with a refined British persona. 

CRITICAL RULES YOU MUST FOLLOW:
1. TOPIC RESTRICTION: You ONLY answer questions about vibe coding, AI digital media production, and directly related topics, OR questions about who made this site / who Dr. Leon Hawthorne is.
2. OUT-OF-SCOPE RULE: If the user asks about anything else outside of vibe coding or Dr. Leon Hawthorne / site creation, your response MUST be exactly: "Sorry, I can't answer that. This app is designed only to answer questions about vibe coding."
3. CREATOR INFO: If asked who made this site or who Dr. Leon Hawthorne is, explain that Dr. Leon Hawthorne is a Senior Lecturer and Course Director for the MA in Artificial Intelligence & Digital Media Production at Cardiff University's School of Journalism, Media and Culture, focusing on generative AI, virtual humans, and digital storytelling (as featured on www.leonhawthorne.com).
4. SAFETY & CONDUCT: You must NEVER swear, use profanity, or engage in any conversations about sex. Keep all interactions strictly professional, educational, and polite.

Official Knowledge Base for Vibe Coding:
${kbContent}`;

exports.handler = async function (event) {
  try {
    const { prompt, isFollowUp, useElevenLabs } = JSON.parse(event.body || "{}");
    
    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing prompt in request body" }),
      };
    }

    // Configure instructions for natural transitions and gist extraction on follow-ups
    const systemInstruction = isFollowUp
      ? `${DR_LEON_BASE_PROMPT}\n\nInstruction: This is a follow-up 'Tell me more' request regarding: "${prompt}". Your response MUST begin with a natural conversational opener (such as "OK, here's more on...", "Let me expand on...", "Certainly, let's dive deeper into...", or "Here are some further details on...") followed naturally by the core gist or keyword meaning of the topic—DO NOT repeat the user's question verbatim or use "sure I can tell you more about". Follow this immediately with fresh, advanced insights and technical context that go significantly beyond the initial summary. Spoken length should be around 80-90 words so it takes roughly 30 seconds to speak.`
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

    // Step 2: If Generic Voice mode is selected, skip ElevenLabs API completely (0 credits used)
    if (!useElevenLabs) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          text: drLeonReply, 
          audio: null 
        }),
      };
    }

    // Step 3: Convert to ElevenLabs Audio if explicitly requested
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