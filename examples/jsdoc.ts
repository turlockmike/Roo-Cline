import chalk from 'chalk';
import * as path from 'path';
import { analyzeFileTask } from './agents/jsdoc';
import { findNestedExports } from '../src-old/experimental/analyzer/export-analyzer';

interface TaskResult {
  filePath: string;
  success: boolean;
  error?: string;
}

async function main() {
  // Get file path from command line arguments
  const targetFile = process.argv[2];
  
  // Check if target file is provided
  if (!targetFile) {
    console.error(chalk.red('\n❌ Error: Target file is required'));
    showUsage();
    process.exit(1);
  }
  
  console.log(chalk.cyan('\n📝 JSDoc Generator\n'));
  
  const results: TaskResult[] = [];
  
  try {
    // Initialize tasks
    console.log(chalk.cyan(`📊 Analyzing file: ${targetFile}`));
    
    // Use export analyzer to find all nested exports
    const absolutePath = path.resolve(process.cwd(), targetFile);
    const exportedItems = await findNestedExports(absolutePath);
    
    // Group exports by source file
    const fileGroups = exportedItems.reduce((acc, item) => {
      if (!acc[item.filePath]) {acc[item.filePath] = [];}
      acc[item.filePath].push(item);
      return acc;
    }, {} as Record<string, typeof exportedItems>);

    // Process each source file in parallel
    const tasks = Object.entries(fileGroups).map(async ([filePath, items]) => {
      const relativePath = path.relative(process.cwd(), filePath);
      console.log(chalk.gray(`\n   Processing file: ${relativePath}`));
      console.log(chalk.gray(`   Found ${items.length} exported items`));
      
      try {
        await analyzeFileTask.run({ filePath, exportedFunctions: items }, {verbose: true});
        results.push({ filePath: relativePath, success: true });
      } catch (error) {
        results.push({ 
          filePath: relativePath, 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    // Wait for all tasks to complete
    await Promise.all(tasks);
    
    // Report results
    console.log(chalk.bold('\n📋 Results Summary:\n'));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length > 0) {
      console.log(chalk.green('✅ Successfully processed:'));
      successful.forEach(r => console.log(`   ${r.filePath}`));
    }
    
    if (failed.length > 0) {
      console.log(chalk.red('\n❌ Failed to process:'));
      failed.forEach(r => {
        console.log(`   ${r.filePath}`);
        console.log(chalk.gray(`   Error: ${r.error}`));
      });
    }
    
    console.log(chalk.bold(`\n📊 Summary: ${successful.length} succeeded, ${failed.length} failed\n`));
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Error analyzing file: ${error}`));
    process.exit(1);
  }
}

function showUsage() {
  console.log(chalk.yellow('\nUsage: ts-node examples/jsdoc.ts <target-file>'));
  console.log(chalk.gray('\nExample: ts-node examples/jsdoc.ts src/index.ts\n'));
}

// Run the main function if this file is being run directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  });
}