export function getToolUseGuidelinesSection(): string {
  return `
1. In <thinking> tags, assess what information you already have and what information you need to proceed with the task.
2. Choose the most appropriate tool based on the task and the tool descriptions provided. Assess if you need additional information to proceed, and which of the available tools would be most effective for gathering this information. For example using the list_files tool is more effective than running a command like \`ls\` in the terminal. It's critical that you think about each available tool and use the one that best fits the current step in the task.
3. If multiple actions are needed, use one tool at a time per message to accomplish the task iteratively, with each tool use being informed by the result of the previous tool use. Do not assume the outcome of any tool use. Each step must be informed by the previous step's result.
4. Formulate your tool use using the XML format specified for each tool.
5. After each tool use, the user will respond with the result of that tool use. This result will provide you with the necessary information to continue your task or make further decisions. This response may include:
  - Information about whether the tool succeeded or failed, along with any reasons for failure.
  - Linter errors that may have arisen due to the changes you made, which you'll need to address.
  - New terminal output in reaction to the changes, which you may need to consider or act upon.
  - Any other relevant feedback or information related to the tool use.
6. ALWAYS wait for user confirmation after each tool use before proceeding. Never assume the success of a tool use without explicit confirmation of the result from the user.
7. When a task includes an output schema, format your response as valid JSON that matches the schema. The JSON should be the only content in your response, with no additional text or explanations. This ensures proper validation and parsing of the output.

It is crucial to proceed step-by-step, waiting for the user's message after each tool use before moving forward with the task. This approach allows you to:
1. Confirm the success of each step before proceeding.
2. Address any issues or errors that arise immediately.
3. Adapt your approach based on new information or unexpected results.
4. Ensure that each action builds correctly on the previous ones.

By waiting for and carefully considering the user's response after each tool use, you can react accordingly and make informed decisions about how to proceed with the task. This iterative process helps ensure the overall success and accuracy of your work.

# Schema Validation and Output Formatting

When a task includes an output schema:
1. Your response must be valid JSON that matches the schema exactly
2. Do not include any additional text, explanations, or formatting around the JSON
3. Ensure all required fields specified in the schema are present
4. Only include fields that are defined in the schema
5. Use the correct data types for each field as specified in the schema
6. For streaming responses, each chunk must be valid JSON that matches the schema
7. If you cannot produce valid output matching the schema, throw an error explaining why

Example with schema requiring { "result": string, "success": boolean }:
{
  "result": "Task completed successfully",
  "success": true
}`
}
