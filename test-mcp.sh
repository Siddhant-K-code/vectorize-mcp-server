#!/bin/bash

# Test MCP server connections with different transports

BASE_URL=${1:-"https://kumquat-vectorize-mcp.netlify.app"}

echo "Testing Streamable HTTP endpoint..."
echo "Sending request to $BASE_URL/v1"
curl -s -X POST "$BASE_URL/v1" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"rpc.discover","id":1}' | jq .

echo ""
echo "Testing SSE endpoint..."
echo "Sending request to $BASE_URL/v1/sse"
curl -s -X POST "$BASE_URL/v1/sse" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"rpc.discover","id":1}'

echo ""
echo ""
echo "Testing Health endpoint..."
curl -s "$BASE_URL/health" | jq .

echo ""
echo "Claude Desktop Configuration Options:"
echo ""
echo "Option 1: Streamable HTTP (Recommended)"
echo "{
  \"mcpServers\": {
    \"gitpod-kb\": {
      \"command\": \"npx\",
      \"args\": [
        \"mcp-remote\",
        \"--transport=streamable-http\",
        \"$BASE_URL/v1\"
      ]
    }
  }
}"

echo ""
echo "Option 2: SSE"
echo "{
  \"mcpServers\": {
    \"gitpod-kb\": {
      \"command\": \"npx\",
      \"args\": [
        \"mcp-remote\",
        \"--transport=sse\",
        \"$BASE_URL/v1/sse\"
      ]
    }
  }
}"