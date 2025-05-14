// netlify/functions/sse.js
const axios = require('axios');

exports.handler = async (event, context) => {
  // Set headers for SSE
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // Handle GET requests for SSE
  if (event.httpMethod === "GET") {
    // Parse query parameters if present
    const params = event.queryStringParameters || {};
    const jsonrpc = params.jsonrpc || "2.0";
    const method = params.method;
    const id = params.id;

    // If it's a heartbeat or initial connection
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

    // Handle tools/list
    if (method === "tools/list") {
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

    // Handle prompts/list
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

    // Handle retrieval/query
    if (method === "retrieval/query") {
      try {
        // Extract parameters
        const query = params.query;
        const numResults = parseInt(params.numResults || "5");

        if (!query) {
          return {
            statusCode: 200, // Keep 200 status for SSE
            headers,
            body: `data: ${JSON.stringify({
              jsonrpc,
              id,
              error: {
                code: -32602,
                message: "Invalid params",
                data: { details: "Missing required parameter: query" }
              }
            })}\n\n`
          };
        }

        console.log(`Processing SSE query: "${query}"`);

        // Get environment variables
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

        console.log(`Received ${response.data.documents?.length || 0} documents from Vectorize API via SSE`);

        // Format the response for MCP over SSE
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
        console.error("Error in SSE retrieval/query:", error);

        return {
          statusCode: 200, // Keep 200 status for SSE
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

    // Method not found
    return {
      statusCode: 200, // Keep 200 status for SSE
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
  }

  // Handle OPTIONS for CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: ""
    };
  }

  // Other methods aren't supported in SSE
  return {
    statusCode: 405,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({
      error: "Method not allowed for SSE",
      message: "SSE endpoint only supports GET and OPTIONS requests"
    })
  };
};
