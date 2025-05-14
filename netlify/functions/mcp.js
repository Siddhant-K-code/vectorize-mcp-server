const axios = require('axios');

exports.handler = async (event, context) => {
  // Only allow POST requests for API endpoints
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  // Check if environment variables are properly set
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
      body: JSON.stringify({
        error: 'Server configuration error',
        details: 'Missing required environment variables'
      })
    };
  }

  // Extract Vectorize credentials from environment variables
  const VECTORIZE_SECRETS_ENDPOINT = process.env.VECTORIZE_SECRETS_ENDPOINT;
  const VECTORIZE_ORG_ID = process.env.VECTORIZE_ORG_ID;
  const VECTORIZE_PIPELINE_ID = process.env.VECTORIZE_PIPELINE_ID;
  const VECTORIZE_TOKEN = process.env.VECTORIZE_TOKEN;

  // Parse the request body
  let body;
  try {
    body = JSON.parse(event.body);
    console.log("Received body:", JSON.stringify(body));
  } catch (error) {
    console.error("JSON parse error:", error.message);
    return {
      statusCode: 400,
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
      body: JSON.stringify({
        error: 'Missing required parameter',
        details: 'A "question" or "query" parameter is required'
      })
    };
  }

  // Forward the request to Vectorize API with the correct format
  try {
    console.log(`Processing question: "${question.substring(0, 100)}..."`);

    // Construct the request data according to Vectorize API requirements
    const requestData = {
      question: question // Use the correct field name expected by the API
    };

    // Include any additional parameters that might be allowed by the API
    if (body.params) {
      // Filter out any known problematic fields
      const { orgId, pipelineId, query, ...otherParams } = body.params;
      Object.assign(requestData, otherParams);
    }

    console.log("Sending request to Vectorize API:", JSON.stringify(requestData));

    // Construct the full endpoint URL if VECTORIZE_SECRETS_ENDPOINT doesn't already include the org and pipeline IDs
    let apiEndpoint = VECTORIZE_SECRETS_ENDPOINT;

    // If the endpoint doesn't already include the org and pipeline IDs, construct it
    if (!apiEndpoint.includes(VECTORIZE_ORG_ID) || !apiEndpoint.includes(VECTORIZE_PIPELINE_ID)) {
      apiEndpoint = `https://api.vectorize.io/v1/org/${VECTORIZE_ORG_ID}/pipelines/${VECTORIZE_PIPELINE_ID}/retrieval`;
    }

    console.log("Using API endpoint:", apiEndpoint);

    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VECTORIZE_TOKEN}`
      },
      data: requestData
    });

    console.log('Successfully processed query. Status:', response.status);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
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
      body: JSON.stringify({
        error: 'Failed to process request',
        details: error.response?.data || error.message
      })
    };
  }
};
