import { ToolResponse } from '../lib/types';

export function formatToolResponse(response: ToolResponse): string {
    if (typeof response === 'string') {
        return response;
    }
    
    // Handle array of message blocks
    return response.map(block => {
        switch (block.type) {
            case 'text':
                return block.text;
            case 'image':
                return `[Image: ${block.image_url.url}]`;
            case 'tool_use':
                return `[Tool Use: ${block.tool_name}]`;
            case 'tool_result':
                return `[Tool Result: ${block.result}]`;
            default:
                return '';
        }
    }).join('\n');
}