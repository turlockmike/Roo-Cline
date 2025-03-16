export function getShowImageDescription(): string {
    return `## show_image
Description: Display an image to the user. Always use this tool when you think the user should see an image. This tool will open the image using the system's default image viewer.
Parameters:
- path: (required) The path to the image file to display
Usage:
<show_image>
<path>Path to image file</path>
</show_image>

Example: Requesting to show a screenshot
<show_image>
<path>screenshots/homepage.png</path>
</show_image>`;
}