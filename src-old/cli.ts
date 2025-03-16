#!/usr/bin/env node

import { program, main } from './cli/index';

// Only run the program if this file is being run directly
if (require.main === module) {
  // Parse command line arguments
  program.parse();
  
  // If no arguments or a subcommand, don't run main
  if (program.commands.some(cmd => cmd.name() === program.args[0])) {
    // No need to call main() if running a subcommand
  } else {
    const task = program.args.join(' ');
    if (task.length === 0)
      {program.setOptionValue('interactive', true)}
    main(task, program).then((code) => {
      process.exit(code);
    }).catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  }
}

// Export for testing and programmatic use
export { program, main, runCLI } from './cli/index';