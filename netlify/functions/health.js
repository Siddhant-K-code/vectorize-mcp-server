// Place this in netlify/functions/health.js
exports.handler = async (event) => {
  const envVars = [
    'VECTORIZE_SECRETS_ENDPOINT',
    'VECTORIZE_ORG_ID',
    'VECTORIZE_PIPELINE_ID',
    'VECTORIZE_TOKEN'
  ];

  const missingVars = envVars.filter(varName => !process.env[varName]);
  const status = missingVars.length === 0 ? 'configured' : 'partially configured';

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PATCH",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    },
    body: JSON.stringify({
      status: 'ok',
      service: 'Vectorize MCP Server',
      environment: status,
      supportedMethods: ['GET', 'POST', 'OPTIONS', 'PATCH'],
      requestMethod: event.httpMethod,
      timestamp: new Date().toISOString()
    })
  };
};
