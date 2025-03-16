const ErrorCode = {
  InvalidRequest: 'INVALID_REQUEST',
  MethodNotFound: 'METHOD_NOT_FOUND',
  ExecutionError: 'EXECUTION_ERROR',
  InvalidParams: 'INVALID_PARAMS'
};

class McpError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'McpError';
  }
}

const ListToolsRequestSchema = {
  name: 'listTools',
  method: 'tools/list',
  params: {}
};

const CallToolRequestSchema = {
  name: 'callTool',
  method: 'tools/call',
  params: {
    name: '',
    arguments: {}
  }
};

module.exports = {
  ErrorCode,
  McpError,
  ListToolsRequestSchema,
  CallToolRequestSchema
};