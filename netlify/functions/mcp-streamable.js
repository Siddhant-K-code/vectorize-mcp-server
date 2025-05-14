// netlify/functions/mcp-streamable.js
const axios = require('axios').default;

exports.handler = async (event, context) => {
  // Set CORS headers for all responses
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PATCH",
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  };

  // Log all incoming requests for debugging
  console.log(`Request: ${event.httpMethod} ${event.path}`);
  console.log(`Query params: ${JSON.stringify(event.queryStringParameters)}`);
  console.log(`Request URL: ${event.rawUrl || 'N/A'}`);
  console.log(`Origin: ${event.headers.origin || event.headers.Origin || 'N/A'}`);
  console.log(`Headers: ${JSON.stringify(event.headers)}`);  
  console.log(`Path: ${event.path}, Raw path: ${event.rawPath || 'N/A'}`);

  // Handle OPTIONS requests (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    // Return explicit CORS headers for preflight requests
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PATCH",
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
      },
      body: ""
    };
  }

  // Handle JSON-RPC requests via POST
  if (event.httpMethod === "POST") {
    // Log raw body for debugging
    console.log(`Raw body: ${event.body.substring(0, 1000)}${event.body.length > 1000 ? '...' : ''}`);

    try {
      // Parse JSON-RPC request
      const request = JSON.parse(event.body);

      // Destructure request properties with defaults
      const { jsonrpc = "2.0", method = "", params = {}, id = null } = request;

      console.log(`Parsed request: method=${method}, id=${id}, params=${JSON.stringify(params)}`);

      // Handle all standard MCP methods

      // Discovery method
      if (method === "rpc.discover") {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              name: "Gitpod Knowledge Base",
              version: "1.0.0",
              transports: ["streamable-http"],
              methods: [
                "rpc.discover",
                "tools/list",
                "prompts/list",
                "retrieval/query",
                "connection/handshake",
                "connection/initialize",
                "initialize",
                "connection/heartbeat"
              ]
            }
          })
        };
      }

      // Connection handshake
      if (method === "connection/handshake" || method === "connection/initialize") {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              status: "connected",
              serverInfo: {
                name: "Gitpod Knowledge Base",
                version: "1.0.0"
              }
            }
          })
        };
      }
      
      // Initialize method - special handling for Claude Desktop client
      if (method === "initialize") {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                retrieval: true,
                tools: true
              },
              serverInfo: {
                name: "Gitpod Knowledge Base",
                version: "1.0.0"
              }
            }
          })
        };
      }

      // Connection heartbeat
      if (method === "connection/heartbeat") {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { status: "connected" }
          })
        };
      }

      // Tools list
      if (method === "tools/list") {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              tools: [
                {
                  name: "retrieval",
                  description: "Retrieves information from the Gitpod knowledge base",
                  enabled: true,
                  isSystemTool: true,
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

      // Prompts list
      if (method === "prompts/list") {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { prompts: [] }
          })
        };
      }

      // Retrieval query
      if (method === "retrieval/query") {
        // Extract query parameters
        const query = params?.query;
        const numResults = params?.numResults || 5;

        // Validate query
        if (!query) {
          console.log("Missing required parameter: query");
          return {
            statusCode: 200, // Use 200 even for errors in JSON-RPC
            headers,
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
          const VECTORIZE_SECRETS_ENDPOINT = process.env.VECTORIZE_SECRETS_ENDPOINT || '';
          const VECTORIZE_ORG_ID = process.env.VECTORIZE_ORG_ID || '';
          const VECTORIZE_PIPELINE_ID = process.env.VECTORIZE_PIPELINE_ID || '';
          const VECTORIZE_TOKEN = process.env.VECTORIZE_TOKEN || '';

          // Log environment variable status (without exposing values)
          console.log(`Environment variables present: ENDPOINT=${!!VECTORIZE_SECRETS_ENDPOINT}, ORG_ID=${!!VECTORIZE_ORG_ID}, PIPELINE_ID=${!!VECTORIZE_PIPELINE_ID}, TOKEN=${!!VECTORIZE_TOKEN}`);

          // Construct API endpoint
          let apiEndpoint = VECTORIZE_SECRETS_ENDPOINT;
          if (!apiEndpoint || !apiEndpoint.includes(VECTORIZE_ORG_ID) || !apiEndpoint.includes(VECTORIZE_PIPELINE_ID)) {
            apiEndpoint = `https://api.vectorize.io/v1/org/${VECTORIZE_ORG_ID}/pipelines/${VECTORIZE_PIPELINE_ID}/retrieval`;
          }

          console.log(`Querying Vectorize API at ${apiEndpoint} with query: "${query.substring(0, 50)}..."`);

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

          // Log success
          console.log(`Received ${response.data.documents?.length || 0} documents from Vectorize API`);

          // Return formatted results
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: {
                documents: (response.data.documents || []).map(doc => ({
                  text: doc.text || doc.content || doc.pageContent || '',
                  metadata: doc.metadata || {},
                  score: doc.score || doc.similarity || 0
                }))
              }
            })
          };
        } catch (error) {
          // Log detailed error
          console.error("Vectorize API error:", error.message);
          if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response data:", JSON.stringify(error.response.data));
          }

          // Return error in JSON-RPC format
          return {
            statusCode: 200, // Use 200 for JSON-RPC errors
            headers,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id,
              error: {
                code: -32603,
                message: "Internal server error",
                data: {
                  message: error.message,
                  status: error.response?.status,
                  data: error.response?.data
                }
              }
            })
          };
        }
      }

      // Log unknown methods
      console.warn(`Unknown method requested: ${method}`);

      // Handle unknown methods
      return {
        statusCode: 200, // Use 200 for JSON-RPC errors
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: "Method not found",
            data: {
              method: method,
              supportedMethods: [
                "rpc.discover",
                "tools/list",
                "prompts/list",
                "retrieval/query",
                "connection/handshake",
                "connection/initialize",
                "initialize",
                "connection/heartbeat"
              ]
            }
          }
        })
      };
    } catch (error) {
      // Handle JSON parse errors
      console.error("Parse error:", error.message);
      return {
        statusCode: 200, // Use 200 for JSON-RPC errors
        headers,
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

  // Handle GET requests (health check and basic info)
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: "ok",
        message: "Gitpod Knowledge Base MCP Server is running",
        serverInfo: {
          name: "Gitpod Knowledge Base",
          version: "1.0.0",
          transport: "streamable-http"
        },
        supportedMethods: [
          "rpc.discover",
          "tools/list",
          "prompts/list",
          "retrieval/query",
          "connection/handshake",
          "connection/initialize",
          "initialize",
          "connection/heartbeat"
        ],
        usage: "POST JSON-RPC 2.0 formatted requests to this endpoint"
      })
    };
  }

  // Handle PATCH requests similar to POST
  if (event.httpMethod === "PATCH") {
    // Process PATCH like POST for compatibility
    return exports.handler({...event, httpMethod: "POST"}, context);
  }

  // Reject other HTTP methods
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({
      error: "Method not allowed",
      message: "This endpoint only supports GET, POST, PATCH, and OPTIONS requests"
    })
  };
};
