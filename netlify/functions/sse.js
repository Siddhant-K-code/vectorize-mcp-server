// netlify/functions/sse.js
const axios = require('axios');

exports.handler = async (event, context) => {
  // Only handle GET requests for SSE
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  // Set up SSE headers
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // Parse the JSON-RPC request if provided
  const params = event.queryStringParameters || {};
  const jsonrpc = params.jsonrpc || "2.0";
  const method = params.method;
  const id = params.id;

  // Handle heartbeat/connection check
  if (!method || method === "connection/heartbeat") {
    return {
      statusCode: 200,
      headers,
      body: `data: ${JSON.stringify({
        jsonrpc,
        id,
        result: { status: "connected" }
      })}\n\n`
    };
  }

  // Handle JSON-RPC methods
  if (method === "prompts/list") {
    return {
      statusCode: 200,
      headers,
      body: `data: ${JSON.stringify({
        jsonrpc,
        id,
        result: { prompts: [] }
      })}\n\n`
    };
  }

  if (method === "tools/list") {
    // Define the tools your MCP server exposes
    const tools = [
      {
        name: "retrieval",
        description: "Retrieves information from the Gitpod knowledge base",
        functions: [
          {
            name: "query",
            description: "Query the Gitpod knowledge base",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The query to search for"
                },
                numResults: {
                  type: "integer",
                  description: "Number of results to return",
                  default: 5
                }
              },
              required: ["query"]
            }
          }
        ]
      }
    ];

    return {
      statusCode: 200,
      headers,
      body: `data: ${JSON.stringify({
        jsonrpc,
        id,
        result: { tools }
      })}\n\n`
    };
  }

  if (method === "retrieval/query") {
    try {
      // Extract parameters
      const query = params.query || "";
      const numResults = parseInt(params.numResults || "5");

      // Call your existing MCP endpoint
      const VECTORIZE_SECRETS_ENDPOINT = process.env.VECTORIZE_SECRETS_ENDPOINT;
      const VECTORIZE_ORG_ID = process.env.VECTORIZE_ORG_ID;
      const VECTORIZE_PIPELINE_ID = process.env.VECTORIZE_PIPELINE_ID;
      const VECTORIZE_TOKEN = process.env.VECTORIZE_TOKEN;

      // Construct API endpoint
      let apiEndpoint = VECTORIZE_SECRETS_ENDPOINT;
      if (!apiEndpoint.includes(VECTORIZE_ORG_ID) || !apiEndpoint.includes(VECTORIZE_PIPELINE_ID)) {
        apiEndpoint = `https://api.vectorize.io/v1/org/${VECTORIZE_ORG_ID}/pipelines/${VECTORIZE_PIPELINE_ID}/retrieval`;
      }

      // Forward to Vectorize API
      const response = await axios({
        method: 'post',
        url: apiEndpoint,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VECTORIZE_TOKEN}`
        },
        data: {
          question: query,
          numResults: numResults
        }
      });

      // Format the response for MCP
      return {
        statusCode: 200,
        headers,
        body: `data: ${JSON.stringify({
          jsonrpc,
          id,
          result: { documents: response.data.documents || [] }
        })}\n\n`
      };
    } catch (error) {
      console.error("Error calling Vectorize API:", error);

      return {
        statusCode: 200,  // Still return 200 for SSE
        headers,
        body: `data: ${JSON.stringify({
          jsonrpc,
          id,
          error: {
            code: -32603,
            message: "Internal error",
            data: { details: error.message }
          }
        })}\n\n`
      };
    }
  }

  // Method not supported
  return {
    statusCode: 200,  // Still return 200 for SSE
    headers,
    body: `data: ${JSON.stringify({
      jsonrpc,
      id,
      error: {
        code: -32601,
        message: "Method not found"
      }
    })}\n\n`
  };
};
