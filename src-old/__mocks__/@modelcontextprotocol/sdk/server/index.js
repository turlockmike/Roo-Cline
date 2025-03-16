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

class Server {
  constructor(config, options) {
    this.config = config;
    this.options = options;
    this.requestHandlers = new Map();
  }

  setRequestHandler(schema, handler) {
    if (!schema || !schema.method) {
      throw new Error('Invalid schema');
    }
    this.requestHandlers.set(schema.method, handler);
  }

  async connect() {
    // Mock connection
  }

  async close() {
    // Mock close
  }

  getHandler(method) {
    return this.requestHandlers.get(method);
  }
}

module.exports = {
  Server,
  ListToolsRequestSchema,
  CallToolRequestSchema
};