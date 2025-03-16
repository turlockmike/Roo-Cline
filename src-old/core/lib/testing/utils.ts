/**
 * Generates a unique ID for use in testing
 */
export function generateId(): string {
  return `test-${Math.random().toString(36).substring(2, 9)}`;
} 