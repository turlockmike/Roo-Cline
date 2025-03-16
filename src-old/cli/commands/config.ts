import { Command } from 'commander'
import chalk from 'chalk'
import { ConfigLoader } from '../../config/config-loader'
import { FirstRunManager } from '../../config/first-run-manager'

export function registerConfigCommands(program: Command): Command {
  // Add configuration command
  program
    .command('config')
    .description('Manage configuration')
    .action(async () => {
      const configLoader = new ConfigLoader()

      try {
        const config = await configLoader.loadConfig()
        console.log(chalk.bold('\nConfiguration Summary:'))
        console.log(chalk.gray('─'.repeat(30)))
        console.log(`${chalk.blue('Active Profile:')}  ${config.activeProfile}`)
        console.log(`${chalk.blue('Profiles:')}        ${config.profiles.length}`)
        console.log(`${chalk.blue('Agents:')}          ${config.agents.length}`)
        console.log(`${chalk.blue('Tasks:')}           ${config.tasks.length}`)
        console.log(`${chalk.blue('Tools:')}           ${config.tools.length}`)
        console.log('')
      } catch (error) {
        console.error(chalk.red('Error loading configuration:'), error)
        process.exit(1)
      }
    })

  program
    .command('init')
    .description('Initialize configuration')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (options: any) => {
      try {
        const firstRunManager = new FirstRunManager()

        if (options.yes) {
          await firstRunManager.initializeDefaults()
        } else {
          await firstRunManager.runSetupWizard()
        }
        process.exit(0)
      } catch (error) {
        console.error(chalk.red('Error initializing configuration:'), error)
        process.exit(1)
      }
    })

  return program
}
