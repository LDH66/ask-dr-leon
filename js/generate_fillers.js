const fs = require('fs');
const path = require('path');
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const FISH_VOICE_ID = "68e3fa24abdc47609409bb667b558a59";

const fillers = [
  { name: 'filler1', text: "Right then, let me gather my thoughts on that for you..." },
  { name: 'filler2', text: "Ah, an excellent question. Let me fetch the relevant details..." },
  { name: 'filler3', text: "Right, giving that some quick thought..." }
];

async function generateFillers() {
  // Resolved relative to root directory: ../audio (or ../public/audio if applicable)
  const audioDir = path.join(__dirname, '..', 'audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  for (const filler of fillers) {
    // 1. Generate Generic OpenAI TTS version
    console.log(`Generating OpenAI TTS for: ${filler.name}...`);
    const openAiResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "echo",
        input: filler.text,
        response_format: "mp3"
      })
    });

    if (openAiResponse.ok) {
      const buffer = await openAiResponse.arrayBuffer();
      fs.writeFileSync(path.join(audioDir, `${filler.name}_generic.mp3`), Buffer.from(buffer));
    }

    // 2. Generate Fish Audio Leon version
    console.log(`Generating Fish Audio (Leon) for: ${filler.name}...`);
    const fishResponse = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "audio/mp3"
      },
      body: JSON.stringify({
        text: filler.text,
        reference_id: FISH_VOICE_ID,
        format: "mp3"
      }),
    });

    if (fishResponse.ok) {
      const buffer = await fishResponse.arrayBuffer();
      fs.writeFileSync(path.join(audioDir, `${filler.name}_leon.mp3`), Buffer.from(buffer));
    }
  }

  console.log("✅ All filler audio files successfully generated and saved in audio/!");
}

generateFillers();