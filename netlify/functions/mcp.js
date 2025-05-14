const axios = require('axios');

exports.handler = async (event, context) => {
  // Extract Vectorize credentials from environment variables
  const requiredEnvVars = [
    'VECTORIZE_SECRETS_ENDPOINT',
    'VECTORIZE_ORG_ID',
    'VECTORIZE_PIPELINE_ID',
    'VECTORIZE_TOKEN'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: 'Server configuration error',
        details: 'Missing required environment variables'
      })
    };
  }

  const VECTORIZE_SECRETS_ENDPOINT = process.env.VECTORIZE_SECRETS_ENDPOINT;
  const VECTORIZE_ORG_ID = process.env.VECTORIZE_ORG_ID;
  const VECTORIZE_PIPELINE_ID = process.env.VECTORIZE_PIPELINE_ID;
  const VECTORIZE_TOKEN = process.env.VECTORIZE_TOKEN;

  console.log(`Received ${event.httpMethod} request`);

  // Handle OPTIONS requests (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      },
      body: ""
    };
  }

  // Check if this is a GET request for SSE streaming
  if (event.httpMethod === "GET") {
    // Parse query parameters for SSE requests
    const params = event.queryStringParameters || {};
    const question = params.question || params.query;

    if (!question) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: 'Missing required parameter',
          details: 'A "question" or "query" parameter is required'
        })
      };
    }

    // Construct the API endpoint
    let apiEndpointUrl = VECTORIZE_SECRETS_ENDPOINT;
    if (!apiEndpointUrl.includes(VECTORIZE_ORG_ID) || !apiEndpointUrl.includes(VECTORIZE_PIPELINE_ID)) {
      apiEndpointUrl = `https://api.vectorize.io/v1/org/${VECTORIZE_ORG_ID}/pipelines/${VECTORIZE_PIPELINE_ID}/retrieval`;
    }

    // Handle the request
    return await handleRequest(question, params.numResults, apiEndpointUrl, VECTORIZE_TOKEN);
  }

  // Handle standard POST requests
  if (event.httpMethod === "POST") {
    // Parse the request body
    let body;
    try {
      body = JSON.parse(event.body);
      console.log("Received body:", JSON.stringify(body));
    } catch (error) {
      console.error("JSON parse error:", error.message);
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: 'Invalid request body',
          details: error.message
        })
      };
    }

    // Get the question from either the 'question' or 'query' field
    const question = body.question || body.query;
    if (!question) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: 'Missing required parameter',
          details: 'A "question" or "query" parameter is required'
        })
      };
    }

    // Construct the API endpoint
    let apiEndpointUrl = VECTORIZE_SECRETS_ENDPOINT;
    if (!apiEndpointUrl.includes(VECTORIZE_ORG_ID) || !apiEndpointUrl.includes(VECTORIZE_PIPELINE_ID)) {
      apiEndpointUrl = `https://api.vectorize.io/v1/org/${VECTORIZE_ORG_ID}/pipelines/${VECTORIZE_PIPELINE_ID}/retrieval`;
    }

    return await handleRequest(question, body.numResults, apiEndpointUrl, VECTORIZE_TOKEN);
  }

  // If we get here, it's an unsupported method
  return {
    statusCode: 405,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({ error: "Method not allowed" })
  };
};

// Helper function to handle the API request (used by both GET and POST handlers)
async function handleRequest(question, numResults, apiEndpoint, token) {
  try {
    console.log(`Processing question: "${question.substring(0, 100)}..."`);

    // Construct the request data according to Vectorize API requirements
    const requestData = {
      question: question,
      numResults: parseInt(numResults) || 5
    };

    console.log("Sending request to Vectorize API:", JSON.stringify(requestData));
    console.log("Using API endpoint:", apiEndpoint);

    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      data: requestData
    });

    console.log('Successfully processed query. Status:', response.status);

    // Return the response with CORS headers for browser clients
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      },
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    // Detailed error logging
    console.error('Error calling Vectorize API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data));
    }

    return {
      statusCode: error.response?.status || 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: 'Failed to process request',
        details: error.response?.data || error.message
      })
    };
  }
}
