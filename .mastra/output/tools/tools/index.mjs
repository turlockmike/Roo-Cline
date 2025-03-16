import { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import * as fs from 'fs/promises';
import fs__default from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs$1 from 'node:fs/promises';
import fg from 'fast-glob';
import os from 'node:os';
import * as path$1 from 'node:path';
import Parser from 'web-tree-sitter';
import { distance } from 'fastest-levenshtein';
import * as sound from 'sound-play';

const readFileTool = new Tool({
  id: "read-file",
  description: "Read the contents of a file at the specified path. Returns the file content with line numbers prefixed to each line. If reading the file fails, isError will be true and the content will be an error message.",
  inputSchema: z.object({
    path: z.string().describe("The path of the file to read Must provide the full file path (absolute path. Example: /Users/username/Documents/file.txt)")
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.string()
  }),
  execute: async ({ context: { path: filePath } }) => {
    try {
      try {
        await fs.access(filePath);
      } catch {
        return {
          isError: true,
          content: `File not found at path: ${filePath}`
        };
      }
      const content = await fs.readFile(filePath, "utf-8");
      if (!content.trim()) {
        return {
          isError: false,
          content: ""
        };
      }
      const numberedLines = content.split("\n").map(
        (line, index) => `${index + 1} | ${line}`
      ).join("\n");
      return {
        isError: false,
        content: numberedLines
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: `Error reading file: ${errorMessage}`
      };
    }
  }
});

const execAsync = promisify(exec);
const executeCommandTool = new Tool({
  id: "execute-command",
  description: "Execute a shell command and return its output. Use with caution as this can run arbitrary commands.",
  inputSchema: z.object({
    command: z.string().describe("The shell command to execute"),
    cwd: z.string().optional().describe("Working directory for command execution"),
    timeout: z.number().optional().describe("Timeout in milliseconds")
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      stdout: z.string(),
      stderr: z.string(),
      exitCode: z.number().nullable()
    })
  }),
  execute: async ({ context: { command, cwd = process.cwd(), timeout = 3e4 } }) => {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024
        // 10MB buffer
      });
      return {
        isError: false,
        content: {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 0
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        const execError = error;
        return {
          isError: true,
          content: {
            stdout: execError.stdout?.trim() || "",
            stderr: execError.stderr?.trim() || error.message,
            exitCode: execError.code || 1
          }
        };
      }
      return {
        isError: true,
        content: {
          stdout: "",
          stderr: String(error),
          exitCode: 1
        }
      };
    }
  }
});

const showImageTool = new Tool({
  id: "show-image",
  description: "Display an image from a file path or URL. Supports common image formats (jpg, png, gif, etc).",
  inputSchema: z.object({
    source: z.string().describe("The path or URL of the image to display"),
    caption: z.string().optional().describe("Optional caption to display with the image")
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.string()
  }),
  execute: async ({ context: { source, caption } }) => {
    try {
      let imageData;
      if (source.startsWith("http")) {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        imageData = await response.arrayBuffer();
      } else {
        const absolutePath = path.resolve(process.cwd(), source);
        try {
          await fs.access(absolutePath);
        } catch {
          return {
            isError: true,
            content: `Image not found at path: ${source}`
          };
        }
        imageData = await fs.readFile(absolutePath);
      }
      const base64 = Buffer.from(imageData).toString("base64");
      const mimeType = getMimeType(source);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      return {
        isError: false,
        content: `![${caption || "Image"}](${dataUrl})`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: `Error displaying image: ${errorMessage}`
      };
    }
  }
});
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  };
  return mimeTypes[ext] || "application/octet-stream";
}

const searchFilesTool = new Tool({
  id: "search-files",
  description: "Search for files in the workspace using glob patterns. Returns a list of matching files with their paths.",
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern to match files (e.g., "**/*.ts" for all TypeScript files)'),
    ignore: z.array(z.string()).optional().describe('Patterns to ignore (e.g., ["node_modules/**"])')
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.array(z.object({
      path: z.string(),
      size: z.number(),
      isDirectory: z.boolean(),
      modifiedTime: z.string()
    }))
  }),
  execute: async ({ context: { pattern, ignore = ["node_modules/**", ".git/**"] } }) => {
    try {
      const files = await fg(pattern, {
        ignore,
        onlyFiles: true
      });
      const results = await Promise.all(
        files.map(async (filePath) => {
          const stats = await fs$1.stat(filePath);
          return {
            path: filePath,
            size: stats.size,
            isDirectory: stats.isDirectory(),
            modifiedTime: stats.mtime.toISOString()
          };
        })
      );
      return {
        isError: false,
        content: results
      };
    } catch (error) {
      error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: []
      };
    }
  }
});

function toPosixPath(p) {
  const isExtendedLengthPath = p.startsWith("\\\\?\\");
  if (isExtendedLengthPath) {
    return p;
  }
  return p.replace(/\\/g, "/");
}
String.prototype.toPosix = function() {
  return toPosixPath(this);
};
function arePathsEqual(path1, path2) {
  if (!path1 && !path2) {
    return true;
  }
  if (!path1 || !path2) {
    return false;
  }
  path1 = normalizePath(path1);
  path2 = normalizePath(path2);
  if (process.platform === "win32") {
    return path1.toLowerCase() === path2.toLowerCase();
  }
  return path1 === path2;
}
function normalizePath(p) {
  let normalized = path$1.normalize(p);
  if (normalized.length > 1 && (normalized.endsWith("/") || normalized.endsWith("\\"))) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

async function listFiles(dirPath, recursive, limit) {
  const absolutePath = path$1.resolve(dirPath);
  const root = process.platform === "win32" ? path$1.parse(absolutePath).root : "/";
  const isRoot = arePathsEqual(absolutePath, root);
  if (isRoot) {
    return [[root], false];
  }
  const homeDir = os.homedir();
  const isHomeDir = arePathsEqual(absolutePath, homeDir);
  if (isHomeDir) {
    return [[homeDir], false];
  }
  const dirsToIgnore = [
    "node_modules",
    "__pycache__",
    "env",
    "venv",
    "target/dependency",
    "build/dependencies",
    "dist",
    "out",
    "bundle",
    "vendor",
    "tmp",
    "temp",
    "deps",
    "pkg",
    "Pods",
    ".*"
    // '!**/.*' excludes hidden directories, while '!**/.*/**' excludes only their contents. This way we are at least aware of the existence of hidden directories.
  ].map((dir) => `**/${dir}/**`);
  const options = {
    cwd: dirPath,
    dot: true,
    // do not ignore hidden files/directories
    absolute: true,
    markDirectories: true,
    // Append a / on any directories matched (/ is used on windows as well, so dont use path.sep)
    gitignore: recursive,
    // fast-glob also supports gitignore
    ignore: recursive ? dirsToIgnore : void 0,
    // just in case there is no gitignore, we ignore sensible defaults
    onlyFiles: false
    // true by default, false means it will list directories on their own too
  };
  const files = recursive ? await globbyLevelByLevel(limit, options) : (await fg("*", options)).slice(0, limit);
  return [files, files.length >= limit];
}
async function globbyLevelByLevel(limit, options) {
  let results = /* @__PURE__ */ new Set();
  let queue = ["*"];
  const globbingProcess = async () => {
    while (queue.length > 0 && results.size < limit) {
      const pattern = queue.shift();
      const filesAtLevel = await fg(pattern, options);
      for (const file of filesAtLevel) {
        if (results.size >= limit) {
          break;
        }
        results.add(file);
        if (file.endsWith("/")) {
          queue.push(`${file}*`);
        }
      }
    }
    return Array.from(results).slice(0, limit);
  };
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Globbing timeout")), 1e4);
  });
  try {
    return await Promise.race([globbingProcess(), timeoutPromise]);
  } catch (error) {
    console.warn("Globbing timed out, returning partial results");
    return Array.from(results);
  }
}

var phpQuery = `
(class_declaration
  name: (name) @name.definition.class) @definition.class

(function_definition
  name: (name) @name.definition.function) @definition.function

(method_declaration
  name: (name) @name.definition.function) @definition.function
`;

var typescriptQuery = `
(function_signature
  name: (identifier) @name.definition.function) @definition.function

(method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(module
  name: (identifier) @name.definition.module) @definition.module

(function_declaration
  name: (identifier) @name.definition.function) @definition.function

(method_definition
  name: (property_identifier) @name.definition.method) @definition.method

(class_declaration
  name: (type_identifier) @name.definition.class) @definition.class
`;

var pythonQuery = `
(class_definition
  name: (identifier) @name.definition.class) @definition.class

(function_definition
  name: (identifier) @name.definition.function) @definition.function
`;

var javascriptQuery = `
(
  (comment)* @doc
  .
  (method_definition
    name: (property_identifier) @name) @definition.method
  (#not-eq? @name "constructor")
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.method)
)

(
  (comment)* @doc
  .
  [
    (class
      name: (_) @name)
    (class_declaration
      name: (_) @name)
  ] @definition.class
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.class)
)

(
  (comment)* @doc
  .
  [
    (function_declaration
      name: (identifier) @name)
    (generator_function_declaration
      name: (identifier) @name)
  ] @definition.function
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

(
  (comment)* @doc
  .
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: [(arrow_function) (function_expression)]) @definition.function)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

(
  (comment)* @doc
  .
  (variable_declaration
    (variable_declarator
      name: (identifier) @name
      value: [(arrow_function) (function_expression)]) @definition.function)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)
`;

var javaQuery = `
(class_declaration
  name: (identifier) @name.definition.class) @definition.class

(method_declaration
  name: (identifier) @name.definition.method) @definition.method

(interface_declaration
  name: (identifier) @name.definition.interface) @definition.interface
`;

var rustQuery = `
(struct_item
    name: (type_identifier) @name.definition.class) @definition.class

(declaration_list
    (function_item
        name: (identifier) @name.definition.method)) @definition.method

(function_item
    name: (identifier) @name.definition.function) @definition.function
`;

var rubyQuery = `
(
  (comment)* @doc
  .
  [
    (method
      name: (_) @name.definition.method) @definition.method
    (singleton_method
      name: (_) @name.definition.method) @definition.method
  ]
  (#strip! @doc "^#\\s*")
  (#select-adjacent! @doc @definition.method)
)

(alias
  name: (_) @name.definition.method) @definition.method

(
  (comment)* @doc
  .
  [
    (class
      name: [
        (constant) @name.definition.class
        (scope_resolution
          name: (_) @name.definition.class)
      ]) @definition.class
    (singleton_class
      value: [
        (constant) @name.definition.class
        (scope_resolution
          name: (_) @name.definition.class)
      ]) @definition.class
  ]
  (#strip! @doc "^#\\s*")
  (#select-adjacent! @doc @definition.class)
)

(
  (module
    name: [
      (constant) @name.definition.module
      (scope_resolution
        name: (_) @name.definition.module)
    ]) @definition.module
)
`;

var cppQuery = `
(struct_specifier name: (type_identifier) @name.definition.class body:(_)) @definition.class

(declaration type: (union_specifier name: (type_identifier) @name.definition.class)) @definition.class

(function_declarator declarator: (identifier) @name.definition.function) @definition.function

(function_declarator declarator: (field_identifier) @name.definition.function) @definition.function

(function_declarator declarator: (qualified_identifier scope: (namespace_identifier) @scope name: (identifier) @name.definition.method)) @definition.method

(type_definition declarator: (type_identifier) @name.definition.type) @definition.type

(class_specifier name: (type_identifier) @name.definition.class) @definition.class
`;

var cQuery = `
(struct_specifier name: (type_identifier) @name.definition.class body:(_)) @definition.class

(declaration type: (union_specifier name: (type_identifier) @name.definition.class)) @definition.class

(function_declarator declarator: (identifier) @name.definition.function) @definition.function

(type_definition declarator: (type_identifier) @name.definition.type) @definition.type
`;

var csharpQuery = `
(class_declaration
 name: (identifier) @name.definition.class
) @definition.class

(interface_declaration
 name: (identifier) @name.definition.interface
) @definition.interface

(method_declaration
 name: (identifier) @name.definition.method
) @definition.method

(namespace_declaration
 name: (identifier) @name.definition.module
) @definition.module
`;

var goQuery = `
(
  (comment)* @doc
  .
  (function_declaration
    name: (identifier) @name.definition.function) @definition.function
  (#strip! @doc "^//\\s*")
  (#set-adjacent! @doc @definition.function)
)

(
  (comment)* @doc
  .
  (method_declaration
    name: (field_identifier) @name.definition.method) @definition.method
  (#strip! @doc "^//\\s*")
  (#set-adjacent! @doc @definition.method)
)

(type_spec
  name: (type_identifier) @name.definition.type) @definition.type
`;

var swiftQuery = `
(class_declaration
  name: (type_identifier) @name) @definition.class

(protocol_declaration
  name: (type_identifier) @name) @definition.interface

(class_declaration
    (class_body
        [
            (function_declaration
                name: (simple_identifier) @name
            )
            (subscript_declaration
                (parameter (simple_identifier) @name)
            )
            (init_declaration "init" @name)
            (deinit_declaration "deinit" @name)
        ]
    )
) @definition.method

(class_declaration
    (class_body
        [
            (property_declaration
                (pattern (simple_identifier) @name)
            )
        ]
    )
) @definition.property

(property_declaration
    (pattern (simple_identifier) @name)
) @definition.property

(function_declaration
    name: (simple_identifier) @name) @definition.function
`;

async function loadLanguage(langName) {
  return await Parser.Language.load(path.join(__dirname, `tree-sitter-${langName}.wasm`));
}
let isParserInitialized = false;
async function initializeParser() {
  if (!isParserInitialized) {
    await Parser.init();
    isParserInitialized = true;
  }
}
async function loadRequiredLanguageParsers(filesToParse) {
  await initializeParser();
  const extensionsToLoad = new Set(filesToParse.map((file) => path.extname(file).toLowerCase().slice(1)));
  const parsers = {};
  for (const ext of extensionsToLoad) {
    let language;
    let query;
    switch (ext) {
      case "js":
      case "jsx":
        language = await loadLanguage("javascript");
        query = language.query(javascriptQuery);
        break;
      case "ts":
        language = await loadLanguage("typescript");
        query = language.query(typescriptQuery);
        break;
      case "tsx":
        language = await loadLanguage("tsx");
        query = language.query(typescriptQuery);
        break;
      case "py":
        language = await loadLanguage("python");
        query = language.query(pythonQuery);
        break;
      case "rs":
        language = await loadLanguage("rust");
        query = language.query(rustQuery);
        break;
      case "go":
        language = await loadLanguage("go");
        query = language.query(goQuery);
        break;
      case "cpp":
      case "hpp":
        language = await loadLanguage("cpp");
        query = language.query(cppQuery);
        break;
      case "c":
      case "h":
        language = await loadLanguage("c");
        query = language.query(cQuery);
        break;
      case "cs":
        language = await loadLanguage("c_sharp");
        query = language.query(csharpQuery);
        break;
      case "rb":
        language = await loadLanguage("ruby");
        query = language.query(rubyQuery);
        break;
      case "java":
        language = await loadLanguage("java");
        query = language.query(javaQuery);
        break;
      case "php":
        language = await loadLanguage("php");
        query = language.query(phpQuery);
        break;
      case "swift":
        language = await loadLanguage("swift");
        query = language.query(swiftQuery);
        break;
      default:
        throw new Error(`Unsupported language: ${ext}`);
    }
    const parser = new Parser();
    parser.setLanguage(language);
    parsers[ext] = { parser, query };
  }
  return parsers;
}

async function fileExistsAtPath$1(filePath) {
  try {
    await fs__default.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function parseSourceCodeForDefinitionsTopLevel(dirPath) {
  const dirExists = await fileExistsAtPath$1(path.resolve(dirPath));
  if (!dirExists) {
    return "This directory does not exist or you do not have permission to access it.";
  }
  const [allFiles, _] = await listFiles(dirPath, false, 200);
  let result = "";
  const { filesToParse} = separateFiles(allFiles);
  const languageParsers = await loadRequiredLanguageParsers(filesToParse);
  for (const file of filesToParse) {
    const definitions = await parseFile(file, languageParsers);
    if (definitions) {
      result += `${path.relative(dirPath, file).toPosix()}
${definitions}
`;
    }
  }
  return result ? result : "No source code definitions found.";
}
function separateFiles(allFiles) {
  const extensions = [
    "js",
    "jsx",
    "ts",
    "tsx",
    "py",
    // Rust
    "rs",
    "go",
    // C
    "c",
    "h",
    // C++
    "cpp",
    "hpp",
    // C#
    "cs",
    // Ruby
    "rb",
    "java",
    "php",
    "swift"
  ].map((e) => `.${e}`);
  const filesToParse = allFiles.filter((file) => extensions.includes(path.extname(file))).slice(0, 50);
  const remainingFiles = allFiles.filter((file) => !filesToParse.includes(file));
  return { filesToParse, remainingFiles };
}
async function parseFile(filePath, languageParsers) {
  const fileContent = await fs.readFile(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const { parser, query } = languageParsers[ext] || {};
  if (!parser || !query) {
    return `Unsupported file type: ${filePath}`;
  }
  let formattedOutput = "";
  try {
    const tree = parser.parse(fileContent);
    const captures = query.captures(tree.rootNode);
    captures.sort((a, b) => a.node.startPosition.row - b.node.startPosition.row);
    const lines = fileContent.split("\n");
    let lastLine = -1;
    captures.forEach((capture) => {
      const { node, name } = capture;
      const startLine = node.startPosition.row;
      const endLine = node.endPosition.row;
      if (lastLine !== -1 && startLine > lastLine + 1) {
        formattedOutput += "|----\n";
      }
      if (name.includes("name") && lines[startLine]) {
        formattedOutput += `\u2502${lines[startLine]}
`;
      }
      lastLine = endLine;
    });
  } catch (error) {
    console.log(`Error parsing file: ${error}
`);
  }
  if (formattedOutput.length > 0) {
    return `|----
${formattedOutput}|----
`;
  }
  return void 0;
}

const listCodeDefinitionsTool = new Tool({
  id: "list-code-definitions",
  description: "List definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This provides insights into the codebase structure and important constructs.",
  inputSchema: z.object({
    path: z.string().describe("The path of the directory to list top level source code definitions for")
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      definitions: z.string(),
      path: z.string()
    })
  }),
  execute: async ({ context: { path: dirPath } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), dirPath);
      const definitions = await parseSourceCodeForDefinitionsTopLevel(absolutePath);
      if (!definitions || definitions.trim() === "") {
        return {
          isError: false,
          content: {
            definitions: `No code definitions found in ${dirPath}`,
            path: dirPath
          }
        };
      }
      return {
        isError: false,
        content: {
          definitions,
          path: dirPath
        }
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          definitions: `Error listing code definitions: ${error instanceof Error ? error.message : String(error)}`,
          path: dirPath
        }
      };
    }
  }
});

function insertGroups(lines, groups) {
  const sortedGroups = [...groups].sort((a, b) => b.index - a.index);
  let result = [...lines];
  for (const { index, elements } of sortedGroups) {
    const insertAt = Math.max(0, Math.min(index, result.length));
    result.splice(insertAt, 0, ...elements);
  }
  return result;
}
const insertContentTool = new Tool({
  id: "insert-content",
  description: "Insert content at specific line numbers in a file. Multiple insertions can be performed in a single operation.",
  inputSchema: z.object({
    path: z.string().describe("The path of the file to modify"),
    operations: z.array(z.object({
      start_line: z.number().min(1).describe("The line number where content should be inserted (1-based)"),
      content: z.string().describe("The content to insert at the specified line")
    })).describe("Array of insert operations, each specifying where to insert content")
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      message: z.string(),
      success: z.boolean(),
      path: z.string(),
      operationsCount: z.number()
    })
  }),
  execute: async ({ context: { path: filePath, operations } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      try {
        await fs.access(absolutePath);
      } catch {
        return {
          isError: true,
          content: {
            message: `File not found at path: ${filePath}`,
            success: false,
            path: filePath,
            operationsCount: 0
          }
        };
      }
      const fileContent = await fs.readFile(absolutePath, "utf8");
      const lines = fileContent.split("\n");
      const insertOperations = operations.map((op) => ({
        index: op.start_line - 1,
        // Convert to 0-based index
        elements: op.content.split("\n")
      }));
      const updatedLines = insertGroups(lines, insertOperations);
      const updatedContent = updatedLines.join("\n");
      if (updatedContent === fileContent) {
        return {
          isError: false,
          content: {
            message: `No changes needed for '${filePath}'`,
            success: true,
            path: filePath,
            operationsCount: 0
          }
        };
      }
      await fs.writeFile(absolutePath, updatedContent, "utf-8");
      return {
        isError: false,
        content: {
          message: `Successfully inserted content at ${operations.length} location(s) in ${filePath}`,
          success: true,
          path: filePath,
          operationsCount: operations.length
        }
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          message: `Error inserting content: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
          path: filePath,
          operationsCount: 0
        }
      };
    }
  }
});

const listFilesTool = new Tool({
  id: "list-files",
  description: "List files and directories within the specified directory. If recursive is true, it lists all files (with relative paths) recursively.",
  inputSchema: z.object({
    path: z.string().describe("The path of the directory to list contents for (relative to the current working directory)"),
    recursive: z.boolean().optional().describe("Set to true for a recursive listing, false or omitted for top-level only.")
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      files: z.array(z.string()),
      hasMore: z.boolean(),
      totalCount: z.number(),
      path: z.string()
    })
  }),
  execute: async ({ context: { path: dirPath, recursive = false } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), dirPath);
      const [files, hasMore] = await listFiles(absolutePath, recursive, 1e3);
      const relativePaths = files.map((file) => {
        const relPath = path.relative(absolutePath, file);
        return relPath.replace(/[\\/]+$/, "").split(path.sep).join("/");
      });
      return {
        isError: false,
        content: {
          files: relativePaths.sort(),
          hasMore,
          totalCount: relativePaths.length,
          path: dirPath
        }
      };
    } catch (error) {
      error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: {
          files: [],
          hasMore: false,
          totalCount: 0,
          path: dirPath
        }
      };
    }
  }
});

const ResponseFormat = {
  json: "json",
  text: "text",
  html: "html"
};
const fetchTool = new Tool({
  id: "fetch",
  description: "Fetches content from a URL. Supports different response formats (html, json, text) and custom headers.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to fetch from"),
    format: z.enum(["json", "text", "html"]).optional().describe("The expected response format. Defaults to text."),
    headers: z.string().optional().describe("A JSON string containing custom headers to send with the request")
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      data: z.string(),
      format: z.enum(["json", "text", "html"]),
      statusCode: z.number().optional(),
      statusText: z.string().optional()
    })
  }),
  execute: async ({ context: { url, format = ResponseFormat.text, headers: headersStr } }) => {
    try {
      const headers = headersStr ? JSON.parse(headersStr) : {};
      const response = await fetch(url, { headers });
      if (!response.ok) {
        return {
          isError: true,
          content: {
            data: `HTTP error ${response.status}: ${response.statusText}`,
            format: ResponseFormat.text,
            statusCode: response.status,
            statusText: response.statusText
          }
        };
      }
      let data;
      switch (format) {
        case ResponseFormat.json:
          const jsonData = await response.json();
          data = JSON.stringify(jsonData, null, 2);
          break;
        case ResponseFormat.html:
          data = await response.text();
          break;
        default:
          data = await response.text();
      }
      return {
        isError: false,
        content: {
          data,
          format,
          statusCode: response.status,
          statusText: response.statusText
        }
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          data: `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`,
          format: ResponseFormat.text
        }
      };
    }
  }
});

function applyDiff(originalContent, diffContent, startLine, endLine) {
  try {
    const searchMatch = diffContent.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/);
    if (!searchMatch) {
      return {
        success: false,
        error: "Invalid diff format. Expected <<<<<<< SEARCH, =======, and >>>>>>> REPLACE markers.",
        details: { diffContent }
      };
    }
    const [, searchBlock, replaceBlock] = searchMatch;
    const lines = originalContent.split("\n");
    if (typeof startLine === "number" && typeof endLine === "number") {
      if (startLine < 1 || endLine > lines.length || startLine > endLine) {
        return {
          success: false,
          error: `Invalid line range: ${startLine}-${endLine}. File has ${lines.length} lines.`,
          details: { startLine, endLine, fileLength: lines.length }
        };
      }
      const beforeSection = lines.slice(0, startLine - 1);
      const targetSection = lines.slice(startLine - 1, endLine).join("\n");
      const afterSection = lines.slice(endLine);
      if (targetSection.trim() !== searchBlock.trim()) {
        return {
          success: false,
          error: "Search content does not match the specified lines in the file.",
          details: {
            expected: searchBlock.trim(),
            found: targetSection.trim(),
            lineRange: `${startLine}-${endLine}`
          }
        };
      }
      const modifiedContent2 = [
        ...beforeSection,
        ...replaceBlock.split("\n"),
        ...afterSection
      ].join("\n");
      return {
        success: true,
        content: modifiedContent2
      };
    }
    const fullContent = lines.join("\n");
    if (!fullContent.includes(searchBlock.trim())) {
      return {
        success: false,
        error: "Search content not found in file.",
        details: {
          searchContent: searchBlock.trim()
        }
      };
    }
    const modifiedContent = fullContent.replace(searchBlock, replaceBlock);
    return {
      success: true,
      content: modifiedContent
    };
  } catch (error) {
    return {
      success: false,
      error: `Error applying diff: ${error instanceof Error ? error.message : String(error)}`,
      details: { error }
    };
  }
}
const applyDiffTool = new Tool({
  id: "apply-diff",
  description: "Apply a diff to a file, replacing specific content with new content. The diff should be in a block format with SEARCH and REPLACE sections.",
  inputSchema: z.object({
    path: z.string().describe("The path of the file to modify"),
    diff: z.string().describe("The diff content in block format with SEARCH and REPLACE sections"),
    start_line: z.number().optional().describe("Starting line number for the replacement (1-based)"),
    end_line: z.number().optional().describe("Ending line number for the replacement (1-based)")
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      message: z.string(),
      success: z.boolean(),
      path: z.string(),
      details: z.any().optional()
    })
  }),
  execute: async ({ context: { path: filePath, diff, start_line, end_line } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      try {
        await fs.access(absolutePath);
      } catch {
        return {
          isError: true,
          content: {
            message: `File not found at path: ${filePath}`,
            success: false,
            path: filePath
          }
        };
      }
      const originalContent = await fs.readFile(absolutePath, "utf-8");
      const result = applyDiff(originalContent, diff, start_line, end_line);
      if (!result.success) {
        return {
          isError: true,
          content: {
            message: `Failed to apply diff: ${result.error}`,
            success: false,
            path: filePath,
            details: result.details
          }
        };
      }
      await fs.writeFile(absolutePath, result.content, "utf-8");
      return {
        isError: false,
        content: {
          message: `Successfully applied diff to ${filePath}`,
          success: true,
          path: filePath
        }
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          message: `Error applying diff: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
          path: filePath
        }
      };
    }
  }
});

const BUFFER_LINES = 20;
function getSimilarity(original, search) {
  if (search === "") {
    return 1;
  }
  const normalizeStr = (str) => str.replace(/\s+/g, " ").trim();
  const normalizedOriginal = normalizeStr(original);
  const normalizedSearch = normalizeStr(search);
  if (normalizedOriginal === normalizedSearch) {
    return 1;
  }
  const dist = distance(normalizedOriginal, normalizedSearch);
  const maxLength = Math.max(normalizedOriginal.length, normalizedSearch.length);
  return 1 - dist / maxLength;
}
const searchAndReplaceTool = new Tool({
  id: "search-and-replace",
  description: "Search and replace content in a file with support for fuzzy matching and line number targeting.",
  inputSchema: z.object({
    path: z.string().describe("The path of the file to modify"),
    search: z.string().describe("The content to search for"),
    replace: z.string().describe("The content to replace with"),
    start_line: z.number().optional().describe("Starting line number for the search (1-based)"),
    end_line: z.number().optional().describe("Ending line number for the search (1-based)"),
    fuzzy_threshold: z.number().optional().describe("Fuzzy matching threshold (0.0 to 1.0, default: 1.0 for exact match)")
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      message: z.string(),
      success: z.boolean(),
      path: z.string(),
      matchDetails: z.object({
        matchIndex: z.number(),
        similarity: z.number(),
        originalContent: z.string(),
        matchedContent: z.string()
      }).optional()
    })
  }),
  execute: async ({ context: { path: filePath, search, replace, start_line, end_line, fuzzy_threshold = 1 } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      try {
        await fs.access(absolutePath);
      } catch {
        return {
          isError: true,
          content: {
            message: `File not found at path: ${filePath}`,
            success: false,
            path: filePath
          }
        };
      }
      const originalContent = await fs.readFile(absolutePath, "utf8");
      const lines = originalContent.split("\n");
      if (!search.trim()) {
        if (!start_line || !end_line || start_line !== end_line) {
          return {
            isError: true,
            content: {
              message: "Empty search requires exact line number for insertion",
              success: false,
              path: filePath
            }
          };
        }
      }
      let searchStartIndex = 0;
      let searchEndIndex = lines.length;
      if (start_line && end_line) {
        if (start_line < 1 || end_line > lines.length || start_line > end_line) {
          return {
            isError: true,
            content: {
              message: `Invalid line range: ${start_line}-${end_line} (file has ${lines.length} lines)`,
              success: false,
              path: filePath
            }
          };
        }
        searchStartIndex = Math.max(0, start_line - BUFFER_LINES - 1);
        searchEndIndex = Math.min(lines.length, end_line + BUFFER_LINES);
      }
      let bestMatchIndex = -1;
      let bestMatchScore = 0;
      let bestMatchContent = "";
      if (start_line && end_line) {
        const exactStartIndex = start_line - 1;
        const exactEndIndex = end_line - 1;
        const chunk = lines.slice(exactStartIndex, exactEndIndex + 1).join("\n");
        const similarity = getSimilarity(chunk, search);
        if (similarity >= fuzzy_threshold) {
          bestMatchIndex = exactStartIndex;
          bestMatchScore = similarity;
          bestMatchContent = chunk;
        }
      }
      if (bestMatchIndex === -1) {
        const searchLines = search.split("\n");
        for (let i = searchStartIndex; i <= searchEndIndex - searchLines.length; i++) {
          const chunk = lines.slice(i, i + searchLines.length).join("\n");
          const similarity = getSimilarity(chunk, search);
          if (similarity > bestMatchScore) {
            bestMatchScore = similarity;
            bestMatchIndex = i;
            bestMatchContent = chunk;
          }
        }
      }
      if (bestMatchIndex === -1 || bestMatchScore < fuzzy_threshold) {
        return {
          isError: true,
          content: {
            message: `No match found meeting similarity threshold (${fuzzy_threshold})`,
            success: false,
            path: filePath,
            matchDetails: {
              matchIndex: bestMatchIndex,
              similarity: bestMatchScore,
              originalContent: search,
              matchedContent: bestMatchContent
            }
          }
        };
      }
      const beforeLines = lines.slice(0, bestMatchIndex);
      const afterLines = lines.slice(bestMatchIndex + search.split("\n").length);
      const updatedContent = [...beforeLines, ...replace.split("\n"), ...afterLines].join("\n");
      await fs.writeFile(absolutePath, updatedContent, "utf8");
      return {
        isError: false,
        content: {
          message: `Successfully replaced content at line ${bestMatchIndex + 1}`,
          success: true,
          path: filePath,
          matchDetails: {
            matchIndex: bestMatchIndex,
            similarity: bestMatchScore,
            originalContent: search,
            matchedContent: bestMatchContent
          }
        }
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          message: `Error performing search and replace: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
          path: filePath
        }
      };
    }
  }
});

async function fileExistsAtPath(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
function preprocessContent(content) {
  let processedContent = content;
  if (processedContent.startsWith("```")) {
    processedContent = processedContent.split("\n").slice(1).join("\n").trim();
  }
  if (processedContent.endsWith("```")) {
    processedContent = processedContent.split("\n").slice(0, -1).join("\n").trim();
  }
  processedContent = processedContent.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&quot;/g, '"');
  return processedContent;
}
function detectCodeOmission(content, predictedLineCount) {
  const actualLineCount = content.split("\n").length;
  if (predictedLineCount !== 0 && actualLineCount !== predictedLineCount) {
    return true;
  }
  const omissionIndicators = [
    "// rest of code unchanged",
    "/* previous code */",
    "// ... rest of the code ...",
    "// ... existing code ...",
    "/* ... */"
  ];
  return omissionIndicators.some((indicator) => content.includes(indicator));
}
const writeFileTool = new Tool({
  id: "write-file",
  description: "Write content to a file at the specified path. Creates directories if they don't exist. If the file exists, it will be overwritten.",
  inputSchema: z.object({
    path: z.string().describe("The path of the file to write to (relative to the current working directory)"),
    content: z.string().describe("The content to write to the file. ALWAYS provide the COMPLETE intended content of the file."),
    line_count: z.number().int().min(0).describe("The number of lines in the file")
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      message: z.string(),
      success: z.boolean(),
      path: z.string()
    })
  }),
  execute: async ({ context: { path: filePath, content, line_count } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      const fileExists = await fileExistsAtPath(absolutePath);
      const processedContent = preprocessContent(content);
      if (detectCodeOmission(processedContent, line_count)) {
        return {
          isError: true,
          content: {
            message: `Content appears to be truncated or contains omission indicators. File has ${processedContent.split("\n").length} lines but was predicted to have ${line_count} lines. Please provide complete file content without omissions.`,
            success: false,
            path: filePath
          }
        };
      }
      const actualLineCount = processedContent.split("\n").length;
      if (line_count !== 0 && actualLineCount !== line_count) {
        return {
          isError: true,
          content: {
            message: `Line count mismatch: expected ${line_count} but content has ${actualLineCount} lines`,
            success: false,
            path: filePath
          }
        };
      }
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, processedContent, "utf-8");
      const action = fileExists ? "updated" : "created";
      return {
        isError: false,
        content: {
          message: `File successfully ${action} at ${filePath}`,
          success: true,
          path: filePath
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: {
          message: `Error writing file: ${errorMessage}`,
          success: false,
          path: filePath
        }
      };
    }
  }
});

const SUPPORTED_FORMATS = [".mp3", ".wav", ".ogg", ".aac", ".m4a"];
const playAudioTool = new Tool({
  id: "play-audio",
  description: "Play an audio file or speak text using text-to-speech.",
  inputSchema: z.object({
    path: z.string().describe("The path to the audio file to play")
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      message: z.string(),
      success: z.boolean(),
      path: z.string().optional()
    })
  }),
  execute: async ({ context: { path: audioPath } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), audioPath);
      try {
        await fs.access(absolutePath);
      } catch {
        return {
          isError: true,
          content: {
            message: `Audio file not found at path: ${audioPath}`,
            success: false,
            path: audioPath
          }
        };
      }
      const ext = path.extname(absolutePath).toLowerCase();
      if (!SUPPORTED_FORMATS.includes(ext)) {
        return {
          isError: true,
          content: {
            message: `Unsupported audio format: ${ext}. Supported formats: ${SUPPORTED_FORMATS.join(", ")}`,
            success: false,
            path: audioPath
          }
        };
      }
      const soundPromise = sound.play(absolutePath);
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(resolve, 1e3);
      });
      await Promise.race([soundPromise, timeoutPromise]);
      return {
        isError: false,
        content: {
          message: `Playing audio file: ${audioPath}`,
          success: true,
          path: audioPath
        }
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          message: `Error playing audio: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
          path: audioPath
        }
      };
    }
  }
});

const CODING_TOOLS = {
  readFileTool,
  showImageTool,
  searchFilesTool,
  executeCommandTool,
  listCodeDefinitionsTool,
  fetchTool,
  listFilesTool,
  insertContentTool,
  applyDiffTool,
  searchAndReplaceTool
};

export { CODING_TOOLS, applyDiffTool, executeCommandTool, fetchTool, insertContentTool, listCodeDefinitionsTool, listFilesTool, playAudioTool, readFileTool, searchAndReplaceTool, searchFilesTool, showImageTool, writeFileTool };
