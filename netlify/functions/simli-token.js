const SIMLI_FACE_ID = "bc1070f5-6eec-4a9e-ac5e-1ad282a06624";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Check what key is actually being loaded
  const rawKey = process.env.SIMLI_API_KEY;
  console.log("[NETLIFY] SIMLI_API_KEY present:", !!rawKey, "Length:", rawKey ? rawKey.length : 0);

  const apiKey = rawKey || "kdaiuahahvdm2sib2rzqm";

  try {
    const response = await fetch("https://api.simli.ai/compose/token", {
      method: "POST",
      headers: {
        "x-simli-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        faceId: SIMLI_FACE_ID,
        maxSessionLength: 600,
        maxIdleTime: 180
      })
    });

    const respText = await response.text();
    console.log("[NETLIFY] Simli API Status:", response.status, "Response:", respText);

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: respText }) };
    }

    const data = JSON.parse(respText);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: data.session_token })
    };
  } catch (err) {
    console.error("Simli Function Crash:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};