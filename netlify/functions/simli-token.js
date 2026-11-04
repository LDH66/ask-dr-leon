export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const apiKey = process.env.SIMLI_API_KEY;
  const faceId = process.env.SIMLI_FACE_ID;

  if (!apiKey || !faceId) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Missing SIMLI_API_KEY or SIMLI_FACE_ID in environment variables." }) 
    };
  }

  try {
    const response = await fetch("https://api.simli.ai/get-session-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey: apiKey,
        faceId: faceId,
        isJPG: false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ error: errText }) };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: data.session_token || data.token || data })
    };

  } catch (error) {
    console.error("[SIMLI TOKEN ERROR]:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}