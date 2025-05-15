# Agent Instructions for Vectorize MCP Server

## Common Commands

- Build the server: `npm run build`
- Run and test locally with inspector: `npm run dev` 
- Run and test locally with SSE inspector: `npm run dev:sse`
- Test deployed endpoints: `./test-mcp.sh`
- Format code: `npm run format`
- Lint code: `npm run lint`

## Code Structure

- `src/index.ts` - Main MCP server for local development
- `netlify/functions/mcp-streamable.js` - Netlify serverless function for normal HTTP transport
- `netlify/functions/mcp-sse.js` - Netlify serverless function for SSE transport
- `netlify/functions/health.js` - Health check endpoint

## Transport Methods

The server supports two transports:

1. `streamable-http` - Uses normal HTTP with Content-Type: application/json
2. `sse` - Server-Sent Events with Content-Type: text/event-stream

There are specific redirects in `netlify.toml` for each transport method to ensure
proper Content-Type headers are set.

## Environment Variables

- `VECTORIZE_SECRETS_ENDPOINT` - Vectorize API endpoint URL
- `VECTORIZE_ORG_ID` - Organization ID for Vectorize
- `VECTORIZE_PIPELINE_ID` - Pipeline ID for the RAG system
- `VECTORIZE_TOKEN` - Authentication token for Vectorize API