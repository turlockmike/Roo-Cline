class StdioServerTransport {
  constructor() {
    this.connected = false;
  }

  async connect() {
    this.connected = true;
  }

  async disconnect() {
    this.connected = false;
  }

  async close() {
    await this.disconnect();
  }

  isConnected() {
    return this.connected;
  }

  async send(message) {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }
    // Mock sending message
    return true;
  }

  async receive() {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }
    // Mock receiving message
    return null;
  }
}

module.exports = {
  StdioServerTransport
};