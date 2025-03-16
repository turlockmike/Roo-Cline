/**
 * Utility for environment variable interpolation in configuration strings
 * Supports ${VAR_NAME} and ${VAR_NAME:-default} syntax
 */

/**
 * Interpolate environment variables in a string
 * Replaces ${VAR_NAME} with the value of the environment variable
 * Supports default values with ${VAR_NAME:-default} syntax
 *
 * @param input String with environment variable references
 * @returns String with environment variables interpolated
 */
export function interpolateEnvVars(input: string): string {
  if (typeof input !== 'string') {
    return input
  }

  // Match ${VAR_NAME} or ${VAR_NAME:-default}
  return input.replace(/\${([^}]+)}/g, (match, p1) => {
    // Check if there's a default value specified
    const parts = p1.split(':-')
    const varName = parts[0]
    const defaultValue = parts.length > 1 ? parts[1] : ''

    // Return environment variable value or default
    return process.env[varName] || defaultValue
  })
}

/**
 * Interpolate environment variables in an object recursively
 * Processes all string values in the object
 *
 * @param obj Object with potential environment variable references
 * @returns Object with environment variables interpolated
 */
export function interpolateEnvVarsInObject<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  const result = Array.isArray(obj) ? [...obj] : { ...obj }

  for (const key in result) {
    const value = result[key]

    if (typeof value === 'string') {
      result[key] = interpolateEnvVars(value)
    } else if (value && typeof value === 'object') {
      result[key] = interpolateEnvVarsInObject(value)
    }
  }

  return result as T
}
