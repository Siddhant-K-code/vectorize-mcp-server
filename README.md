# Vectorize MCP Server

This project implements a Model Context Protocol (MCP) server for Vectorize RAG pipelines, making them accessible through Claude Desktop.

## Deployment

This server is deployed on Netlify. It requires the following environment variables:

- `VECTORIZE_SECRETS_ENDPOINT` - Vectorize API endpoint URL
- `VECTORIZE_ORG_ID` - Organization ID for Vectorize
- `VECTORIZE_PIPELINE_ID` - Pipeline ID for the RAG system
- `VECTORIZE_TOKEN` - Authentication token for Vectorize API

## Claude Desktop Configuration

There are two transport options available for connecting to this MCP server:

### Option 1: Streamable HTTP Transport (Recommended)

```json
{
  "mcpServers": {
    "gitpod-kb": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "--transport=streamable-http",
        "https://kumquat-vectorize-mcp.netlify.app/v1"
      ]
    }
  }
}
```

### Option 2: SSE Transport (Server-Sent Events)

```json
{
  "mcpServers": {
    "gitpod-kb": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://kumquat-vectorize-mcp.netlify.app/v1/sse",
        "--transport=sse"
      ]
    }
  }
}
```

## Troubleshooting

### Content Type Errors

If you see an error like this:

```
Error: SSE error: Invalid content type, expected "text/event-stream". Check that the URL is correct and points to a valid MCP SSE endpoint. The server must respond with Content-Type: text/event-stream header.
```

Ensure you're using:
1. The correct transport type that matches your endpoint (streamable-http or sse)
2. The correct endpoint URL for the selected transport:
   - For SSE: `https://kumquat-vectorize-mcp.netlify.app/v1/sse` or `https://kumquat-vectorize-mcp.netlify.app/sse`
   - For streamable-http: `https://kumquat-vectorize-mcp.netlify.app/v1` or any other endpoint

### Connection Errors

If you see an error like this:

```
upstream connect error or disconnect/reset before headers. reset reason: connection termination
```

Try the following:

1. **Switch to HTTP Transport**: Try using the streamable-http transport instead of SSE
   ```json
   {
     "mcpServers": {
       "gitpod-kb": {
         "command": "npx",
         "args": [
           "mcp-remote",
           "--transport=streamable-http",
           "https://deploy-preview-4--kumquat-vectorize-mcp.netlify.app/v1"
         ]
       }
     }
   }
   ```

2. **Check Environment Variables**: Make sure all required environment variables are set in Netlify

3. **Verify API Access**: Use the test script to verify Vectorize API connectivity:
   ```
   ./test-mcp.sh https://deploy-preview-4--kumquat-vectorize-mcp.netlify.app
   ```

4. **Review Netlify Logs**: Check the Netlify function logs for detailed error information

### Health Check

You can verify the server is running correctly by visiting the health check endpoint:
`https://kumquat-vectorize-mcp.netlify.app/health`

## Supported Methods

This MCP server implements the following methods:

- `rpc.discover` - Returns information about the server
- `tools/list` - Lists available tools
- `prompts/list` - Lists available prompts (currently none)
- `retrieval/query` - Legacy method for querying the Vectorize pipeline
- `tools/executeFunction` - Executes a function (primarily knowledge_retrieval)
- `connection/handshake` - Establishes a connection
- `connection/initialize` - Initializes a connection
- `initialize` - Claude Desktop specific initialization
- `connection/heartbeat` - Maintains connection