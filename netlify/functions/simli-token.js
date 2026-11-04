exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const apiKey = process.env.SIMLI_API_KEY;

        if (!apiKey) {
            console.error('[SIMLI ERROR] SIMLI_API_KEY environment variable is missing.');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'SIMLI_API_KEY is not configured on Netlify.' })
            };
        }

        const response = await fetch('https://api.simli.ai/compose/ice', {
            method: 'GET',
            headers: {
                'x-simli-api-key': apiKey,
                'Content-Type': 'application/json'
            }
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error(`[SIMLI API ERROR] Status ${response.status}: ${responseText}`);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ error: `Simli API error (${response.status}): ${responseText}` })
            };
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { raw: responseText };
        }

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