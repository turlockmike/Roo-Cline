import { exec } from 'child_process';
import * as path from 'path';
import * as util from 'util';

const execAsync = util.promisify(exec);

/**
 * Searches for files matching a pattern using ripgrep
 *
 * @param cwd - The current working directory from which to execute the search
 * @param searchPath - The path to search within
 * @param pattern - The regex pattern to search for in files
 * @param filePattern - Optional glob pattern to filter which files to search
 * @returns A string containing the search results or 'No matches found' if no results
 * @throws Will throw an error if the ripgrep command fails for reasons other than no matches
 * @example
 * ```typescript
 * // Search for "function" in all TypeScript files in the src directory
 * const results = await searchFiles('/path/to/project', 'src', 'function', '*.ts');
 * ```
 */
export async function searchFiles(
    cwd: string,
    searchPath: string,
    pattern: string,
    filePattern?: string
): Promise<string> {
    try {
        // Build ripgrep command
        let command = `rg --no-heading --line-number "${pattern}"`;
        if (filePattern) {
            command += ` -g "${filePattern}"`;
        }
        command += ` "${searchPath}"`;

        const { stdout } = await execAsync(command, { cwd });
        return stdout || 'No matches found';
    } catch (error) {
        if (error.code === 1 && !error.stdout) {
            return 'No matches found';
        }
        throw error;
    }
}