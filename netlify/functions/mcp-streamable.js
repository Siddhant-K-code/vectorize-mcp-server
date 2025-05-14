// netlify/functions/mcp-streamable.js
const axios = require('axios');

exports.handler = async (event, context) => {
  // Set CORS headers for all responses
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };

  // Handle OPTIONS requests (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  // Handle JSON-RPC requests via POST
  if (event.httpMethod === "POST") {
    try {
      // Parse JSON-RPC request
      const request = JSON.parse(event.body);
      console.log("Received request:", JSON.stringify(request));

      const { jsonrpc, method, params, id } = request;

      // Handle different methods
      if (method === "tools/list") {
        return {
          statusCode: 200,
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              tools: [
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
              ]
            }
          })
        };
      }

      if (method === "prompts/list") {
        return {
          statusCode: 200,
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { prompts: [] }
          })
        };
      }

      if (method === "retrieval/query") {
        const query = params?.query;
        const numResults = params?.numResults || 5;

        if (!query) {
          return {
            statusCode: 400,
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id,
              error: {
                code: -32602,
                message: "Invalid params",
                data: "Missing required parameter: query"
              }
            })
          };
        }

        try {
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

          console.log(`Querying Vectorize API: "${query.substring(0, 50)}..."`);

          // Call Vectorize API
          const response = await axios({
            method: 'post',
            url: apiEndpoint,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${VECTORIZE_TOKEN}`
            },
            data: {
              question: query,
              numResults
            }
          });

          console.log(`Received ${response.data.documents?.length || 0} documents from Vectorize`);

          // Return results
          return {
            statusCode: 200,
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: {
                documents: response.data.documents || []
              }
            })
          };
        } catch (error) {
          console.error("API error:", error.message);
          return {
            statusCode: 500,
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id,
              error: {
                code: -32603,
                message: "Internal server error",
                data: error.message
              }
            })
          };
        }
      }

      // Handle unknown methods
      return {
        statusCode: 404,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: "Method not found"
          }
        })
      };
    } catch (error) {
      console.error("Parse error:", error.message);
      return {
        statusCode: 400,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error",
            data: error.message
          }
        })
      };
    }
  }

  // Handle GET requests (health check)
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ok",
        message: "MCP server is running. Use POST for JSON-RPC requests."
      })
    };
  }

  // Reject other methods
  return {
    statusCode: 405,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      error: "Method not allowed"
    })
  };
};
