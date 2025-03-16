import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'fast-glob';

/**
 * Interface representing an exported function
 */
export interface ExportedFunction {
  name: string;
  filePath: string;
  signature: string;
  isDefault: boolean;
  documentation?: string;
}

/**
 * Interface representing an exported item (could be a function, class, variable, etc.)
 */
export interface ExportedItem {
  name: string;
  kind: string;
  filePath: string;
  isDefault: boolean;
  documentation?: string;
}

/**
 * Interface representing a re-exported item with its source chain
 */
export interface NestedExportedItem {
  name: string;
  filePath: string;
  originalSource?: string;
  originalName?: string;
  isDefault?: boolean;
  documentation?: string;
}

/**
 * Finds all exported functions in a TypeScript/JavaScript file
 * @param filePath Path to the file to analyze
 * @returns Array of exported functions
 */
export function findExportsInFile(filePath: string): ExportedFunction[] {
  // Read the file
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  
  // Create a SourceFile
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );
  
  const exportedFunctions: ExportedFunction[] = [];
  
  // Helper function to extract JSDoc comment if available
  const getJSDocComment = (node: ts.Node): string | undefined => {
    const jsDocComments = ((node as any).jsDoc as ts.JSDoc[]) || [];
    if (jsDocComments.length > 0) {
      return jsDocComments[0].comment as string;
    }
    return undefined;
  };
  
  // Helper function to get function signature
  const getFunctionSignature = (node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression): string => {
    let signature = '';
    
    // Get function name
    if (ts.isFunctionDeclaration(node) && node.name) {
      signature = node.name.text;
    }
    
    // Get parameters
    signature += '(';
    if (node.parameters) {
      signature += node.parameters.map(param => {
        let paramText = '';
        if (param.name) {
          paramText = ts.isIdentifier(param.name) ? param.name.text : param.name.getText(sourceFile);
        }
        if (param.type) {
          paramText += ': ' + param.type.getText(sourceFile);
        }
        if (param.questionToken) {
          paramText += '?';
        }
        if (param.initializer) {
          paramText += ' = ' + param.initializer.getText(sourceFile);
        }
        return paramText;
      }).join(', ');
    }
    signature += ')';
    
    // Get return type
    if (node.type) {
      signature += ': ' + node.type.getText(sourceFile);
    }
    
    return signature;
  };
  
  // Visit each node in the source file
  function visit(node: ts.Node) {
    // Check for export declarations
    if (ts.isExportDeclaration(node)) {
      // Handle named exports like: export { foo, bar }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach(element => {
          // We need to find the actual declaration of this exported item
          const name = element.name.text;
          const propertyName = element.propertyName?.text || name;
          
          // Find the declaration in the file
          ts.forEachChild(sourceFile, innerNode => {
            if (ts.isFunctionDeclaration(innerNode) && 
                innerNode.name && 
                innerNode.name.text === propertyName) {
              exportedFunctions.push({
                name,
                filePath,
                signature: getFunctionSignature(innerNode),
                isDefault: false,
                documentation: getJSDocComment(innerNode)
              });
            }
          });
        });
      }
    }
    
    // Check for exported function declarations
    if (ts.isFunctionDeclaration(node) && 
        node.name && 
        node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      const isDefault = node.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword);
      exportedFunctions.push({
        name: node.name.text,
        filePath,
        signature: getFunctionSignature(node),
        isDefault,
        documentation: getJSDocComment(node)
      });
    }
    
    // Check for variable declarations that export functions
    if (ts.isVariableStatement(node) && 
        node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      node.declarationList.declarations.forEach(declaration => {
        if (declaration.initializer) {
          if (ts.isArrowFunction(declaration.initializer) || 
              ts.isFunctionExpression(declaration.initializer)) {
            const isDefault = node.modifiers!.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword);
            if (ts.isIdentifier(declaration.name)) {
              exportedFunctions.push({
                name: declaration.name.text,
                filePath,
                signature: declaration.name.text + getFunctionSignature(declaration.initializer),
                isDefault,
                documentation: getJSDocComment(node)
              });
            }
          }
        }
      });
    }
    
    // Continue traversing the AST
    ts.forEachChild(node, visit);
  }
  
  // Start the traversal
  visit(sourceFile);
  
  return exportedFunctions;
}

/**
 * Finds all exported functions in a directory
 * @param directory Directory to search in
 * @param pattern Glob pattern for files to include (default: **\/*.{ts,js})
 * @returns Array of exported functions
 */
export function findExportsInDirectory(directory: string, pattern: string = '**/*.{ts,js}'): ExportedFunction[] {
  const files = glob.sync(pattern, { cwd: directory, absolute: true });
  
  let allExports: ExportedFunction[] = [];
  
  files.forEach(file => {
    try {
      const exports = findExportsInFile(file);
      allExports = [...allExports, ...exports];
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  });
  
  return allExports;
}

/**
 * Finds all exported items (functions, classes, variables, etc.) in a file
 * @param filePath Path to the file to analyze
 * @returns Array of exported items
 */
export function findAllExportsInFile(filePath: string): ExportedItem[] {
  // Read the file
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  
  // Create a SourceFile
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );
  
  const exportedItems: ExportedItem[] = [];
  
  // Helper function to extract JSDoc comment if available
  const getJSDocComment = (node: ts.Node): string | undefined => {
    const jsDocComments = ((node as any).jsDoc as ts.JSDoc[]) || [];
    if (jsDocComments.length > 0) {
      return jsDocComments[0].comment as string;
    }
    return undefined;
  };
  
  // Helper function to get node kind as string
  const getNodeKindName = (node: ts.Node): string => {
    if (ts.isFunctionDeclaration(node)) return 'function';
    if (ts.isClassDeclaration(node)) return 'class';
    if (ts.isInterfaceDeclaration(node)) return 'interface';
    if (ts.isTypeAliasDeclaration(node)) return 'type';
    if (ts.isEnumDeclaration(node)) return 'enum';
    if (ts.isVariableDeclaration(node)) {
      if (node.initializer) {
        if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
          return 'function';
        }
        if (ts.isObjectLiteralExpression(node.initializer)) {
          return 'object';
        }
      }
      return 'variable';
    }
    return ts.SyntaxKind[node.kind] || 'unknown';
  };
  
  // Visit each node in the source file
  function visit(node: ts.Node) {
    // Check for export declarations
    if (ts.isExportDeclaration(node)) {
      // Handle named exports like: export { foo, bar }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach(element => {
          const name = element.name.text;
          const propertyName = element.propertyName?.text || name;
          
          // Find the declaration in the file
          ts.forEachChild(sourceFile, innerNode => {
            let foundNode: ts.Node | undefined;
            
            if (ts.isFunctionDeclaration(innerNode) && 
                innerNode.name && 
                innerNode.name.text === propertyName) {
              foundNode = innerNode;
            } else if (ts.isClassDeclaration(innerNode) && 
                      innerNode.name && 
                      innerNode.name.text === propertyName) {
              foundNode = innerNode;
            } else if (ts.isInterfaceDeclaration(innerNode) && 
                      innerNode.name && 
                      innerNode.name.text === propertyName) {
              foundNode = innerNode;
            } else if (ts.isTypeAliasDeclaration(innerNode) && 
                      innerNode.name && 
                      innerNode.name.text === propertyName) {
              foundNode = innerNode;
            } else if (ts.isEnumDeclaration(innerNode) && 
                      innerNode.name && 
                      innerNode.name.text === propertyName) {
              foundNode = innerNode;
            } else if (ts.isVariableStatement(innerNode)) {
              innerNode.declarationList.declarations.forEach(decl => {
                if (ts.isIdentifier(decl.name) && decl.name.text === propertyName) {
                  foundNode = decl;
                }
              });
            }
            
            if (foundNode) {
              exportedItems.push({
                name,
                kind: getNodeKindName(foundNode),
                filePath,
                isDefault: false,
                documentation: getJSDocComment(foundNode)
              });
            }
          });
        });
      }
    }
    
    // Check for exported declarations
    if ((node as any).modifiers?.some((modifier: ts.Modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      const isDefault = (node as any).modifiers.some((modifier: ts.Modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
      
      if (ts.isFunctionDeclaration(node) && node.name) {
        exportedItems.push({
          name: node.name.text,
          kind: 'function',
          filePath,
          isDefault,
          documentation: getJSDocComment(node)
        });
      } else if (ts.isClassDeclaration(node) && node.name) {
        exportedItems.push({
          name: node.name.text,
          kind: 'class',
          filePath,
          isDefault,
          documentation: getJSDocComment(node)
        });
      } else if (ts.isInterfaceDeclaration(node) && node.name) {
        exportedItems.push({
          name: node.name.text,
          kind: 'interface',
          filePath,
          isDefault,
          documentation: getJSDocComment(node)
        });
      } else if (ts.isTypeAliasDeclaration(node) && node.name) {
        exportedItems.push({
          name: node.name.text,
          kind: 'type',
          filePath,
          isDefault,
          documentation: getJSDocComment(node)
        });
      } else if (ts.isEnumDeclaration(node) && node.name) {
        exportedItems.push({
          name: node.name.text,
          kind: 'enum',
          filePath,
          isDefault,
          documentation: getJSDocComment(node)
        });
      } else if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(declaration => {
          if (ts.isIdentifier(declaration.name)) {
            exportedItems.push({
              name: declaration.name.text,
              kind: getNodeKindName(declaration),
              filePath,
              isDefault,
              documentation: getJSDocComment(node)
            });
          }
        });
      }
    }
    
    // Continue traversing the AST
    ts.forEachChild(node, visit);
  }
  
  // Start the traversal
  visit(sourceFile);
  
  return exportedItems;
}

/**
 * Finds all exported items in a directory
 * @param directory Directory to search in
 * @param pattern Glob pattern for files to include (default: **\/*.{ts,js})
 * @returns Array of exported items
 */
export function findAllExportsInDirectory(directory: string, pattern: string = '**/*.{ts,js}'): ExportedItem[] {
  const files = glob.sync(pattern, { cwd: directory, absolute: true });
  
  let allExports: ExportedItem[] = [];
  
  files.forEach(file => {
    try {
      const exports = findAllExportsInFile(file);
      allExports = [...allExports, ...exports];
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  });
  
  return allExports;
}

/**
 * Helper function to resolve a source path
 * @param baseDir Base directory to resolve from
 * @param source Source path to resolve
 * @returns Resolved path or null if not found
 */
function resolveSourcePath(baseDir: string, source: string): string | null {
  // Handle node_modules imports
  if (source.startsWith('.') || source.startsWith('/')) {
    // Resolve relative paths
    let resolvedPath = path.resolve(baseDir, source);
    
    // Check if the path exists
    if (fs.existsSync(resolvedPath)) {
      // If it's a directory, look for an index file
      const stats = fs.statSync(resolvedPath);
      if (stats.isDirectory()) {
        for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
          const indexPath = path.join(resolvedPath, `index${ext}`);
          if (fs.existsSync(indexPath)) {
            return indexPath;
          }
        }
        return null; // Directory exists but no index file found
      }
      return resolvedPath;
    }
    
    // Try adding extensions
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const pathWithExt = `${resolvedPath}${ext}`;
      if (fs.existsSync(pathWithExt)) {
        return pathWithExt;
      }
    }
  }
  
  // Could not resolve the path
  return null;
}

/**
 * Helper function to detect re-exports in a file
 * @param filePath Path to the file to analyze
 * @returns Array of re-exported items
 */
function findReExportsInFile(filePath: string): NestedExportedItem[] {
  const reExports: NestedExportedItem[] = [];
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  
  // Create a SourceFile
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );
  
  // Visit each node in the source file
  function visit(node: ts.Node) {
    // Check for export declarations with module specifiers (re-exports)
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const source = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
      
      // Handle named exports like: export { foo, bar } from './module'
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach(element => {
          const name = element.name.text;
          const propertyName = element.propertyName?.text || name;
          reExports.push({ 
            name: propertyName !== name ? `${propertyName} as ${name}` : name, 
            originalSource: source,
            filePath
          });
        });
      }
      // Handle wildcard exports like: export * from './module'
      else if (!node.exportClause) {
        reExports.push({ 
          name: '*', 
          originalSource: source,
          filePath
        });
      }
    }
    
    // Continue traversing the AST
    ts.forEachChild(node, visit);
  }
  
  // Start the traversal
  visit(sourceFile);
  
  return reExports;
}

/**
 * Helper function to find direct exports in a file (not re-exports)
 * @param filePath Path to the file to analyze
 * @returns Array of directly exported items
 */
function findDirectExportsInFile(filePath: string): NestedExportedItem[] {
  const directExports: NestedExportedItem[] = [];
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const baseDir = path.dirname(filePath);
  
  // Create a SourceFile
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  // Track imported items with their resolved paths
  const importedItems = new Map<string, string | null>();
  
  // Helper function to extract JSDoc comment if available
  const getJSDocComment = (node: ts.Node): string | undefined => {
    const jsDocComments = ((node as any).jsDoc as ts.JSDoc[]) || [];
    if (jsDocComments.length > 0) {
      return jsDocComments[0].comment as string;
    }
    return undefined;
  };
  
  // First pass: collect imports
  function collectImports(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const source = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
      const resolvedPath = resolveSourcePath(baseDir, source);
      if (node.importClause) {
        if (node.importClause.name) {
          // Default import
          importedItems.set(node.importClause.name.text, resolvedPath);
        }
        if (node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            // Named imports
            node.importClause.namedBindings.elements.forEach(element => {
              importedItems.set(element.name.text, resolvedPath);
            });
          }
        }
      }
    }
    ts.forEachChild(node, collectImports);
  }
  
  // Visit each node in the source file
  function visit(node: ts.Node) {
    // Check for exported declarations (classes, interfaces, functions, etc.)
    if ((node as any).modifiers?.some((modifier: ts.Modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      const isDefault = (node as any).modifiers.some((modifier: ts.Modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
      
      let name = '';
      
      if (ts.isFunctionDeclaration(node) && node.name) {
        name = node.name.text;
      } else if (ts.isClassDeclaration(node) && node.name) {
        name = node.name.text;
      } else if (ts.isInterfaceDeclaration(node) && node.name) {
        name = node.name.text;
      } else if (ts.isTypeAliasDeclaration(node) && node.name) {
        name = node.name.text;
      } else if (ts.isEnumDeclaration(node) && node.name) {
        name = node.name.text;
      } else if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(declaration => {
          if (ts.isIdentifier(declaration.name)) {
            const name = declaration.name.text;
            const resolvedPath = importedItems.get(name);
            directExports.push({
              name,
              filePath: resolvedPath || filePath,
              isDefault,
              documentation: getJSDocComment(node)
            });
          }
        });
        return; // Already processed variable declarations
      }
      
      if (name) {
        const resolvedPath = importedItems.get(name);
        directExports.push({
          name,
          filePath: resolvedPath || filePath,
          isDefault,
          documentation: getJSDocComment(node)
        });
      }
    }
    
    // Check for export declarations without module specifiers (direct exports)
    if (ts.isExportDeclaration(node) && !node.moduleSpecifier) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach(element => {
          const name = element.name.text;
          const propertyName = element.propertyName?.text || name;
          let documentation;
          
          ts.forEachChild(sourceFile, innerNode => {
            let foundNode: ts.Node | undefined;
            
            if (ts.isFunctionDeclaration(innerNode) && 
                innerNode.name && 
                innerNode.name.text === propertyName) {
              foundNode = innerNode;
            } else if (ts.isClassDeclaration(innerNode) && 
                      innerNode.name && 
                      innerNode.name.text === propertyName) {
              foundNode = innerNode;
            } else if (ts.isInterfaceDeclaration(innerNode) && 
                      innerNode.name && 
                      innerNode.name.text === propertyName) {
              foundNode = innerNode;
            } else if (ts.isTypeAliasDeclaration(innerNode) && 
                      innerNode.name && 
                      innerNode.name.text === propertyName) {
              foundNode = innerNode;
            } else if (ts.isEnumDeclaration(innerNode) && 
                      innerNode.name && 
                      innerNode.name.text === propertyName) {
              foundNode = innerNode;
            } else if (ts.isVariableStatement(innerNode)) {
              innerNode.declarationList.declarations.forEach(decl => {
                if (ts.isIdentifier(decl.name) && decl.name.text === propertyName) {
                  foundNode = decl;
                }
              });
            }
            
            if (foundNode) {
              documentation = getJSDocComment(foundNode);
            }
          });
          
          const resolvedPath = importedItems.get(propertyName);
          directExports.push({
            name: propertyName !== name ? `${propertyName} as ${name}` : name,
            filePath: resolvedPath || filePath,
            documentation
          });
        });
      }
    }
    
    // Continue traversing the AST
    ts.forEachChild(node, visit);
  }
  
  // First collect imports
  collectImports(sourceFile);
  // Then process exports
  visit(sourceFile);
  
  return directExports;
}

/**
 * Recursively follow re-export chains to find the original source
 * @param filePath Path to the file to analyze
 * @param maxDepth Maximum recursion depth (default: 10)
 * @param visited Set of already visited files to prevent circular dependencies
 * @returns Array of nested exported items
 */
export async function findNestedExports(filePath: string, maxDepth = 10, visited = new Set<string>()): Promise<NestedExportedItem[]> {
  if (maxDepth <= 0) return [];
  if (visited.has(filePath)) return []; // Prevent circular dependencies
  
  visited.add(filePath);
  const baseDir = path.dirname(filePath);
  const reExports = findReExportsInFile(filePath);
  const directExports = findDirectExportsInFile(filePath);
  
  // Add direct exports to the result
  const result: NestedExportedItem[] = [...directExports];
  
  // Process each re-export
  for (const reExport of reExports) {
    // Handle wildcard exports
    if (reExport.name === '*') {
      // For wildcard exports, we need to find all exports from the source file
      const sourcePath = resolveSourcePath(baseDir, reExport.originalSource);
      if (sourcePath) {
        try {
          // Find all exports in the source file
          const sourceExports = await findNestedExports(sourcePath, maxDepth - 1, new Set(visited));
          // Add them to our results with the original source path
          sourceExports.forEach(item => {
            if (!item.originalSource) {
              item.originalSource = reExport.originalSource;
            }
          });
          result.push(...sourceExports);
        } catch (error) {
          console.error(`Error processing wildcard export from ${reExport.originalSource}: ${error}`);
        }
      }
      continue;
    }
    
    let currentItem = { ...reExport };
    
    // Resolve the source path
    let sourcePath = resolveSourcePath(baseDir, reExport.originalSource);
    if (!sourcePath) {
      // If we can't resolve the path, keep the original
      result.push(currentItem);
      continue;
    }
    
    // Follow the re-export chain
    let depth = 0;
    let currentVisited = new Set(visited);
    while (depth < maxDepth) {
      try {
        // Check if the source file exists
        if (!fs.existsSync(sourcePath) || currentVisited.has(sourcePath)) {
          break;
        }
        
        currentVisited.add(sourcePath);
        
        // Find re-exports in the source file
        const nestedExports = findReExportsInFile(sourcePath);
        
        // Look for the current export name in the nested exports
        const nestedExport = nestedExports.find(e => e.name === currentItem.name);
        if (!nestedExport) {
          // If not found, we've reached the original source
          break;
        }
        
        // Update the current item and continue following the chain
        currentItem.originalSource = currentItem.originalSource || currentItem.filePath;
        currentItem.originalName = currentItem.originalName || currentItem.name;
        currentItem.filePath = nestedExport.filePath;
        
        // Resolve the new source path
        const newBaseDir = path.dirname(sourcePath);
        sourcePath = resolveSourcePath(newBaseDir, nestedExport.originalSource);
        if (!sourcePath) {
          break;
        }
        
        depth++;
      } catch (error) {
        console.error(`Error following re-export chain: ${error}`);
        break;
      }
    }
    
    // Store the final result
    result.push(currentItem);
  }
  
  return result;
}

/**
 * Finds all nested exports in a directory
 * @param directory Directory to search in
 * @param pattern Glob pattern for files to include (default: **\/*.{ts,js})
 * @returns Array of nested exported items
 */
export async function findNestedExportsInDirectory(directory: string, pattern: string = '**/*.{ts,js}'): Promise<NestedExportedItem[]> {
  const files = glob.sync(pattern, { cwd: directory, absolute: true });
  
  let allExports: NestedExportedItem[] = [];
  
  for (const file of files) {
    try {
      const exports = await findNestedExports(file);
      allExports = [...allExports, ...exports];
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }
  
  return allExports;
} 