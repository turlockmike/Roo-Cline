export function getWaitForUserDescription(): string {
  return `## wait_for_user
Description: Pause execution and wait for user input. This tool should be used when you need to gather additional information or confirmation from the user before proceeding.
Parameters:
- prompt: (required) The message to display to the user before waiting for input
Usage:
<wait_for_user>
<prompt>Your message to the user</prompt>
</wait_for_user>

Example: Requesting user confirmation before proceeding
<wait_for_user>
<prompt>Please confirm you want to proceed with the deployment (yes/no)</prompt>
</wait_for_user>`
}
