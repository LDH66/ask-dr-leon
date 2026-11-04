exports.handler = async function(event, context) {
    // CORS headers to prevent cross-origin issues
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle browser preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const apiKey = process.env.SIMLI_API_KEY;

        if (!apiKey) {
            console.error('[SIMLI ERROR] SIMLI_API_KEY is not set in Netlify environment variables.');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error: SIMLI_API_KEY missing.' })
            };
        }

        // Request token/session from Simli API
        const response = await fetch('https://api.simli.ai/get-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apiKey: apiKey })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SIMLI ERROR] API responded with status ${response.status}: ${errorText}`);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ error: `Simli API error: ${errorText}` })
            };
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('[SIMLI EXCEPTION]', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' })
        };
    }
};