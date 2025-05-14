// netlify/functions/mcp.js
const axios = require('axios');

exports.handler = async (event, context) => {
  // Common headers for all responses
  const baseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Accel-Buffering": "no" // Prevents proxy buffering
  };

  // Handle OPTIONS requests (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({ status: "ok" })
    };
  }

  // Handle POST requests for JSON-RPC
  if (event.httpMethod === "POST") {
    try {
      // Parse the JSON-RPC request
      const jsonRpcRequest = JSON.parse(event.body);
      const { jsonrpc, method, params, id } = jsonRpcRequest;

      if (!method) {
        return {
          statusCode: 400,
          headers: baseHeaders,
          body: JSON.stringify({
            jsonrpc: jsonrpc || "2.0",
            id,
            error: {
              code: -32600,
              message: "Invalid Request"
            }
          })
        };
      }

      console.log(`Received JSON-RPC request: ${method}`);

      // Handle method: tools/list
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
          headers: baseHeaders,
          body: JSON.stringify({
            jsonrpc,
            id,
            result: { tools }
          })
        };
      }

      // Handle method: prompts/list
      if (method === "prompts/list") {
        return {
          statusCode: 200,
          headers: baseHeaders,
          body: JSON.stringify({
            jsonrpc,
            id,
            result: { prompts: [] }
          })
        };
      }

      // Handle method: retrieval/query
      if (method === "retrieval/query") {
        try {
          // Extract parameters
          const query = params.query;
          const numResults = params.numResults || 5;

          if (!query) {
            return {
              statusCode: 400,
              headers: baseHeaders,
              body: JSON.stringify({
                jsonrpc,
                id,
                error: {
                  code: -32602,
                  message: "Invalid params",
                  data: { details: "Missing required parameter: query" }
                }
              })
            };
          }

          console.log(`Processing query: "${query}"`);

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

          console.log(`Received ${response.data.documents?.length || 0} documents from Vectorize API`);

          // Format the response for MCP
          return {
            statusCode: 200,
            headers: baseHeaders,
            body: JSON.stringify({
              jsonrpc,
              id,
              result: { documents: response.data.documents || [] }
            })
          };
        } catch (error) {
          console.error("Error calling Vectorize API:", error);

          return {
            statusCode: 500,
            headers: baseHeaders,
            body: JSON.stringify({
              jsonrpc,
              id,
              error: {
                code: -32603,
                message: "Internal error",
                data: { details: error.message }
              }
            })
          };
        }
      }

      // Handle heartbeat
      if (method === "connection/heartbeat") {
        return {
          statusCode: 200,
          headers: baseHeaders,
          body: JSON.stringify({
            jsonrpc,
            id,
            result: { status: "connected" }
          })
        };
      }

      // Method not found
      return {
        statusCode: 404,
        headers: baseHeaders,
        body: JSON.stringify({
          jsonrpc,
          id,
          error: {
            code: -32601,
            message: "Method not found"
          }
        })
      };

    } catch (error) {
      console.error("Error processing request:", error);

      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error",
            data: { details: error.message }
          }
        })
      };
    }
  }

  // Handle GET requests (connection check)
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        status: "ok",
        message: "Gitpod MCP Server is running. Please use POST for JSON-RPC requests."
      })
    };
  }

  // Handle other HTTP methods
  return {
    statusCode: 405,
    headers: baseHeaders,
    body: JSON.stringify({
      error: "Method not allowed",
      message: "This endpoint only accepts GET, POST, and OPTIONS requests."
    })
  };
};
