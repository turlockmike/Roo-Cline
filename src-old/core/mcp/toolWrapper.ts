import { ToolSet, ToolExecutionOptions, jsonSchema } from 'ai';
import { McpClient } from "./mcp-client";
import { McpConfig, McpConfigSchema, isMcpConfig } from './config';
import { McpTool, ParsedMcpToolResponse } from './types';
import { readFile } from 'node:fs/promises';

interface McpToolOptions {
    // Optional path to config file, defaults to ~/.hataraku/mcp_settings.json
    configPath?: string;
    // Optional config object to use instead of loading from file
    config?: McpConfig;
    // Optional callback for tool execution monitoring
    onToolCall?: (serverName: string, toolName: string, args: any, result: Promise<any>) => void;
}

/**
 * Creates a set of tools from MCP servers that can be passed to an Agent
 */
export async function getMcpTools(options?: McpToolOptions): Promise<{ tools: ToolSet; disconnect: () => Promise<void> }> {
    const client = new McpClient();
    
    // If config provided, validate and use it directly
    if (options?.config) {
        if (!isMcpConfig(options.config)) {
            throw new Error('Invalid config object provided');
        }
        await client.loadConfig(options.config);
    } 
    // If configPath provided, load and validate from that path
    else if (options?.configPath) {
        const configContent = await readFile(options.configPath, 'utf-8');
        let config: unknown;
        try {
            config = JSON.parse(configContent);
        } catch (error) {
            throw new Error('Failed to parse config file');
        }
        
        if (!isMcpConfig(config)) {
            throw new Error('Invalid config file format');
        }
        
        await client.loadConfigFromPath(options.configPath);
    }
    // Otherwise use default path
    else {
        await client.initializeServers();
    }

    const toolset: ToolSet = {};
    const servers = client.getAvailableServers();
    
    for (const serverName of servers) {
        const { tools } = await client.getServerTools(serverName);
        const serverConfig = options?.config?.mcpServers[serverName];
        
        for (const tool of tools) {
            // Skip if tool is in disabled list
            if (serverConfig?.disabledTools?.includes(tool.name)) {
                continue;
            }

            const qualifiedName = `${serverName}_${tool.name}`;
            
            toolset[qualifiedName] = {
                name: tool.name,
                description: tool.description,
                parameters: jsonSchema(tool.inputSchema),
                execute: async <T = any>(args: any): Promise<ParsedMcpToolResponse<T>> => {
                    const resultPromise = client.callTool<T>(serverName, tool.name, args);

                    if (options?.onToolCall) {
                        options.onToolCall(serverName, tool.name, args, resultPromise);
                    }

                    return resultPromise;
                },
            } as McpTool;
        }
    }

    
    return {
        tools: toolset,
        disconnect: async () => {
            for (const serverName of servers) {
                await client.disconnectServer(serverName);
            }
        }
    };
}