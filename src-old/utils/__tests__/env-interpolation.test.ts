import { interpolateEnvVars, interpolateEnvVarsInObject } from '../env-interpolation'

describe('Environment Variable Interpolation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Setup mock environment variables for testing
    process.env = { ...originalEnv }
    process.env.TEST_VAR = 'test-value'
    process.env.ANOTHER_VAR = 'another-value'
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('interpolateEnvVars', () => {
    it('should replace environment variables with their values', () => {
      const input = 'Value: ${TEST_VAR}'
      const result = interpolateEnvVars(input)
      expect(result).toBe('Value: test-value')
    })

    it('should handle multiple environment variables in a string', () => {
      const input = 'First: ${TEST_VAR}, Second: ${ANOTHER_VAR}'
      const result = interpolateEnvVars(input)
      expect(result).toBe('First: test-value, Second: another-value')
    })

    it('should use default values for undefined environment variables', () => {
      const input = 'Default: ${UNDEFINED_VAR:-fallback}'
      const result = interpolateEnvVars(input)
      expect(result).toBe('Default: fallback')
    })

    it('should return empty string for undefined environment variables without defaults', () => {
      const input = 'Empty: ${UNDEFINED_VAR}'
      const result = interpolateEnvVars(input)
      expect(result).toBe('Empty: ')
    })

    it('should handle strings without environment variables', () => {
      const input = 'No variables here'
      const result = interpolateEnvVars(input)
      expect(result).toBe('No variables here')
    })

    it('should handle non-string inputs', () => {
      // @ts-ignore - Testing with non-string input for robustness
      const result = interpolateEnvVars(123)
      expect(result).toBe(123)
    })
  })

  describe('interpolateEnvVarsInObject', () => {
    it('should interpolate environment variables in object string values', () => {
      const input = {
        str: 'Value: ${TEST_VAR}',
        num: 123,
        bool: true,
      }

      const result = interpolateEnvVarsInObject(input)

      expect(result).toEqual({
        str: 'Value: test-value',
        num: 123,
        bool: true,
      })
    })

    it('should interpolate environment variables in nested objects', () => {
      const input = {
        nested: {
          str: 'Value: ${TEST_VAR}',
          arr: ['item', '${ANOTHER_VAR}'],
        },
      }

      const result = interpolateEnvVarsInObject(input)

      expect(result).toEqual({
        nested: {
          str: 'Value: test-value',
          arr: ['item', 'another-value'],
        },
      })
    })

    it('should interpolate environment variables in arrays', () => {
      const input = ['${TEST_VAR}', 'static', '${ANOTHER_VAR}']

      const result = interpolateEnvVarsInObject(input)

      expect(result).toEqual(['test-value', 'static', 'another-value'])
    })

    it('should handle null and undefined values', () => {
      const input = {
        nullValue: null,
        undefinedValue: undefined,
        str: '${TEST_VAR}',
      }

      const result = interpolateEnvVarsInObject(input)

      expect(result).toEqual({
        nullValue: null,
        undefinedValue: undefined,
        str: 'test-value',
      })
    })

    it('should handle non-object inputs', () => {
      expect(interpolateEnvVarsInObject('plain string')).toBe('plain string')
      expect(interpolateEnvVarsInObject(123)).toBe(123)
      expect(interpolateEnvVarsInObject(null)).toBe(null)
      expect(interpolateEnvVarsInObject(undefined)).toBe(undefined)
    })
  })
})
