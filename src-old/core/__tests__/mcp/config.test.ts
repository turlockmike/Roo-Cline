import { McpConfigSchema, isMcpConfig, parseMcpConfig, interpolateEnvVars } from '../../mcp/config';

describe('MCP Config Validation', () => {
  describe('Schema Validation', () => {
    it('validates a minimal valid config', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: [],
          },
        },
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('validates a complete valid config', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: ['arg1', 'arg2'],
            env: {
              KEY: 'value',
            },
            disabledTools: ['tool1', 'tool2'],
          },
        },
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('rejects config with missing required fields', () => {
      const config = {
        mcpServers: {
          'test-server': {
            // Missing command
            args: [],
          },
        },
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('rejects config with invalid types', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 123, // Should be string
            args: ['test'],
          },
        },
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('Type Guard', () => {
    it('returns true for valid config', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: [],
          },
        },
      };
      expect(isMcpConfig(config)).toBe(true);
    });

    it('returns false for invalid config', () => {
      const config = {
        mcpServers: {
          'test-server': {
            args: [],
          },
        },
      };
      expect(isMcpConfig(config)).toBe(false);
    });

    it('returns false for non-object values', () => {
      expect(isMcpConfig(null)).toBe(false);
      expect(isMcpConfig(undefined)).toBe(false);
      expect(isMcpConfig('string')).toBe(false);
      expect(isMcpConfig(123)).toBe(false);
    });
  });

  describe('Environment Variable Interpolation', () => {
    beforeEach(() => {
      // Clear and set test environment variables
      process.env.TEST_VAR = 'test-value';
      process.env.MCP_API_KEY = 'secret-key';
    });

    afterEach(() => {
      // Clean up test environment variables
      delete process.env.TEST_VAR;
      delete process.env.MCP_API_KEY;
    });

    it('interpolates environment variables in strings', () => {
      expect(interpolateEnvVars('value-${TEST_VAR}')).toBe('value-test-value');
      expect(interpolateEnvVars('${MCP_API_KEY}')).toBe('secret-key');
    });

    it('interpolates multiple environment variables in one string', () => {
      expect(interpolateEnvVars('${TEST_VAR}-${MCP_API_KEY}'))
        .toBe('test-value-secret-key');
    });

    it('throws error for undefined environment variables', () => {
      expect(() => interpolateEnvVars('${UNDEFINED_VAR}'))
        .toThrow('Environment variable UNDEFINED_VAR is not set');
    });

    it('validates and interpolates environment variables in config', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'test-${TEST_VAR}',
            args: ['arg-${MCP_API_KEY}'],
            env: {
              KEY: 'value-${TEST_VAR}',
            },
          },
        },
      };

      const result = parseMcpConfig(config);
      expect(result.mcpServers['test-server'].command).toBe('test-test-value');
      expect(result.mcpServers['test-server'].args[0]).toBe('arg-secret-key');
      expect(result.mcpServers['test-server'].env?.KEY).toBe('value-test-value');
    });

    it('throws error for invalid config with undefined environment variables', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: ['${UNDEFINED_VAR}'],
          },
        },
      };

      expect(() => parseMcpConfig(config))
        .toThrow('Environment variable UNDEFINED_VAR is not set');
    });
  });
});