import { Tool } from 'ai'
import { z } from 'zod'
import { fetchTool } from './fetch'
import { readFileTool } from './read-file'
import { writeFileTool } from './write-file'
import { listFilesTool } from './list-files'
import { searchFilesTool } from './search-files'
import { searchAndReplaceTool } from './search-and-replace'
import { insertContentTool } from './insert-content'
import { applyDiffTool } from './apply-diff'
import { createExecuteCommandTool } from './execute-command'
import { listCodeDefinitionsTool } from './list-code-definitions'
import { playAudioTool } from './play-audio'
import { showImageTool } from './show-image'
import { searchReplaceV2Tool } from './search-and-replace-v2'

// Create the execute command tool with grey output
const executeCommandTool = createExecuteCommandTool({ outputColor: 'grey' })

// Export individual tools
export {
  fetchTool,
  readFileTool,
  writeFileTool,
  listFilesTool,
  searchFilesTool,
  searchAndReplaceTool,
  insertContentTool,
  applyDiffTool,
  executeCommandTool,
  listCodeDefinitionsTool,
  playAudioTool,
  showImageTool,
  searchReplaceV2Tool,
}

// Tool Sets
/**
 * Collection of network-related tools
 *
 * @example
 * ```typescript
 * import { NetworkTools } from './core/tools';
 *
 * // Access the fetch tool
 * const fetchTool = NetworkTools.fetch;
 * ```
 */
export const NetworkTools: Record<string, Tool> = {
  fetch: fetchTool,
}

/**
 * Collection of file system manipulation tools
 *
 * @example
 * ```typescript
 * import { FileSystemTools } from './core/tools';
 *
 * // Access the read_file tool
 * const readFileTool = FileSystemTools.read_file;
 * ```
 */
export const FileSystemTools: Record<string, Tool> = {
  read_file: readFileTool,
  write_file: writeFileTool,
  list_files: listFilesTool,
  search_files: searchFilesTool,
  search_and_replace: searchAndReplaceTool,
  insert_content: insertContentTool,
  apply_diff: applyDiffTool,
}

/**
 * Collection of system operation tools
 *
 * @example
 * ```typescript
 * import { SystemTools } from './core/tools';
 *
 * // Access the execute_command tool
 * const execTool = SystemTools.execute_command;
 * ```
 */
export const SystemTools: Record<string, Tool> = {
  execute_command: executeCommandTool,
}

/**
 * Collection of code analysis tools
 *
 * @example
 * ```typescript
 * import { CodeAnalysisTools } from './core/tools';
 *
 * // Access the list_code_definitions tool
 * const definitionsTool = CodeAnalysisTools.list_code_definitions;
 * ```
 */
export const CodeAnalysisTools: Record<string, Tool> = {
  list_code_definitions: listCodeDefinitionsTool,
}

/**
 * Collection of media handling tools
 *
 * @example
 * ```typescript
 * import { MediaTools } from './core/tools';
 *
 * // Access the play_audio tool
 * const audioTool = MediaTools.play_audio;
 * ```
 */
export const MediaTools: Record<string, Tool> = {
  play_audio: playAudioTool,
  show_image: showImageTool,
}

/**
 * Comprehensive collection of all available tools
 *
 * @example
 * ```typescript
 * import { ALL_TOOLS } from './core/tools';
 *
 * // Access any tool by its key
 * const fetchTool = ALL_TOOLS.fetch;
 * const readFileTool = ALL_TOOLS.read_file;
 * ```
 */
export const ALL_TOOLS: Record<string, Tool> = {
  ...NetworkTools,
  ...FileSystemTools,
  ...SystemTools,
  ...CodeAnalysisTools,
  ...MediaTools,
}

/**
 * Generates documentation for a collection of tools
 *
 * @param tools - A record mapping tool names to Tool objects
 * @returns A formatted string containing documentation for all tools in the collection
 * @example
 * ```typescript
 * const docs = getToolDocs(FileSystemTools);
 * console.log(docs);
 * // Output:
 * // ## read_file
 * // Parameters:
 * // - path: (required) The file path to read
 * // ...
 * ```
 */
export function getToolDocs(tools: Record<string, Tool>): string {
  return Object.entries(tools)
    .map(([name, tool]) => {
      if (tool.parameters instanceof z.ZodObject) {
        const params = tool.parameters.shape
        const paramDocs = Object.entries(params)
          .map(([paramName, schema]) => {
            const zodSchema = schema as z.ZodTypeAny
            const description = zodSchema.description || paramName
            const isRequired = !zodSchema.isOptional()
            return `- ${paramName}: (${isRequired ? 'required' : 'optional'}) ${description}`
          })
          .join('\n')
        return `## ${name}\nParameters:\n${paramDocs}`
      }
      return `## ${name}\nParameters: (Schema not available)`
    })
    .join('\n\n')
}
