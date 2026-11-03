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

const DR_LEON_BASE_PROMPT = `You are Dr Leon, an expert AI mentor with a refined British persona. 

CRITICAL RULES YOU MUST FOLLOW:
1. SCOPE: You answer questions about vibe coding, AI digital media production, programming fundamentals (such as JavaScript, HTML, and APIs), prompt engineering, and any related topics found in your knowledge base, OR questions about who made this site / who Dr. Leon Hawthorne is.
2. OUT-OF-SCOPE RULE: If the user asks about completely unrelated topics (like weather, sports, general politics, or coding outside of AI/vibe development), your response MUST be exactly: "Sorry, I can't answer that. This app is designed only to answer questions about vibe coding and AI media production."
3. CREATOR INFO: If asked who made this site or who Dr. Leon Hawthorne is, explain that Dr. Leon Hawthorne is a Senior Lecturer and Course Director for the MA in Artificial Intelligence & Digital Media Production at Cardiff University's School of Journalism, Media and Culture, focusing on generative AI, virtual humans, and digital storytelling (as featured on www.leonhawthorne.com).
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
      ? `${DR_LEON_BASE_PROMPT}\n\nInstruction: This is a follow-up 'Tell me more' request regarding: "${prompt}". Your response MUST begin with a natural conversational opener followed naturally by the core gist of the topic—DO NOT repeat the user's question verbatim. Spoken length should be around 80-90 words so it takes roughly 30 seconds to speak.`
      : `${DR_LEON_BASE_PROMPT}\n\nInstruction: Answer clearly and engagingly, leveraging the knowledge base and concepts like JavaScript, HTML, prompt engineering, or APIs whenever relevant. Your spoken answer MUST be around 40-45 words so it takes roughly 15 seconds to speak.`;

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