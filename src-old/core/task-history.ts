import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { getConfigPaths } from '../config/config-paths';

export interface HistoryEntry {
    taskId: string;
    timestamp: number;
    task: string;
    tokensIn: number;
    tokensOut: number;
    cacheWrites: number;
    cacheReads: number;
    totalCost: number;
    model: string;
    messages: Array<{
        role: 'assistant' | 'user';
        content: string;
    }>;
    debug?: {
        mcpServers?: Array<{
            name: string;
            status: 'connecting' | 'connected' | 'disconnected';
            error?: string;
            tools?: any[];
        }>;
        requests: Array<{
            timestamp: number;
            systemPrompt: string;
            messages: Array<{
                role: 'assistant' | 'user';
                content: string;
            }>;
        }>;
        responses: Array<{
            timestamp: number;
            content: string;
            usage?: {
                tokensIn: number;
                tokensOut: number;
                cost?: number;
                providerMetadata?: Record<string, any>;
            };
        }>;
        toolUsage: Array<{
            timestamp: number;
            tool: string;
            params: Record<string, string>;
            result: string;
            error: boolean;
        }>;
    };
}

export class TaskHistory {
    private historyDir: string;

    constructor() {
        const paths = getConfigPaths();
        this.historyDir = paths.logsDir;
    }

    private async ensureHistoryDir(): Promise<void> {
        await fs.mkdir(this.historyDir, { recursive: true });
    }

    async saveTask(entry: HistoryEntry): Promise<void> {
        await this.ensureHistoryDir();
        const taskDir = path.join(this.historyDir, entry.taskId);
        await fs.mkdir(taskDir, { recursive: true });

        // Save task metadata
        const metadataPath = path.join(taskDir, 'metadata.json');
        const metadata = {
            taskId: entry.taskId,
            timestamp: entry.timestamp,
            task: entry.task,
            tokensIn: entry.tokensIn,
            tokensOut: entry.tokensOut,
            cacheWrites: entry.cacheWrites,
            cacheReads: entry.cacheReads,
            totalCost: entry.totalCost,
            model: entry.model,
            mcpServers: entry.debug?.mcpServers
        };
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        // Save conversation history
        const historyPath = path.join(taskDir, 'conversation.json');
        await fs.writeFile(historyPath, JSON.stringify(entry.messages, null, 2));

        // Save debug information if present
        if (entry.debug) {
            const debugPath = path.join(taskDir, 'debug.json');
            await fs.writeFile(debugPath, JSON.stringify(entry.debug, null, 2));
        }
    }

    async getTask(taskId: string): Promise<HistoryEntry | null> {
        try {
            const taskDir = path.join(this.historyDir, taskId);
            const metadataPath = path.join(taskDir, 'metadata.json');
            const historyPath = path.join(taskDir, 'conversation.json');

            const [metadataContent, historyContent, debugContent] = await Promise.all([
                fs.readFile(metadataPath, 'utf-8'),
                fs.readFile(historyPath, 'utf-8'),
                fs.readFile(path.join(taskDir, 'debug.json'), 'utf-8').catch(() => null)
            ]);

            const metadata = JSON.parse(metadataContent);
            const messages = JSON.parse(historyContent);
            const debug = debugContent ? JSON.parse(debugContent) : undefined;

            return {
                ...metadata,
                messages,
                debug
            };
        } catch (error) {
            return null;
        }
    }

    async listTasks(): Promise<Array<{ taskId: string; timestamp: number; task: string }>> {
        await this.ensureHistoryDir();
        const tasks: Array<{ taskId: string; timestamp: number; task: string }> = [];

        try {
            const taskDirs = await fs.readdir(this.historyDir);
            
            for (const taskId of taskDirs) {
                try {
                    const metadataPath = path.join(this.historyDir, taskId, 'metadata.json');
                    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                    const metadata = JSON.parse(metadataContent);
                    tasks.push({
                        taskId: metadata.taskId,
                        timestamp: metadata.timestamp,
                        task: metadata.task,
                    });
                } catch (error) {
                    // Skip invalid task directories
                    continue;
                }
            }
        } catch (error) {
            // Return empty array if history directory doesn't exist
            return [];
        }

        // Sort by timestamp, most recent first
        return tasks.sort((a, b) => b.timestamp - a.timestamp);
    }
}