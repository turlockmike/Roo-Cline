export function getSchemaValidationSection(): string {
    return `
# Schema Validation and Output Formatting

When a task includes an output schema:
1. Your response must be valid JSON that matches the schema exactly
2. Do not include any additional text, explanations, or formatting around the JSON
3. Ensure all required fields specified in the schema are present
4. Only include fields that are defined in the schema
5. Use the correct data types for each field as specified in the schema
6. For streaming responses, each chunk must be valid JSON that matches the schema
7. If you cannot produce valid output matching the schema, throw an error explaining why
8. When calling attempt_completion, ensure the result is valid JSON that matches the schema

Example with schema requiring { "foo": string, "num": number }:
<attempt_completion>
  {
    "foo": "bar",
    "num": 123
  }
</attempt_completion>

Remember:
- The JSON output must be parseable - use proper quotes and escape special characters
- Numbers should not be quoted unless the schema specifically requires a string
- Boolean values should be true/false, not "true"/"false"
- Arrays and objects should use proper JSON syntax
- Do not include any markdown formatting or code blocks around the JSON
- The entire response should be valid JSON, with no other text before or after`
} 