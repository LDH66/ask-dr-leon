const OpenAI = require('openai');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        // Receive base64 audio from frontend and convert to buffer
        const audioBuffer = Buffer.from(event.body, 'base64');
        const file = await OpenAI.toFile(audioBuffer, 'audio.webm');

        const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: "whisper-1",
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ text: transcription.text }),
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};