import { Command } from 'commander'
import chalk from 'chalk'
import { input, select, confirm } from '@inquirer/prompts'
import { ProfileManager } from '../../config/profile-manager'
import { FirstRunManager } from '../../config/first-run-manager'
import { Profile } from '../../config/profile-config'

export function registerProfileCommands(program: Command): Command {
  const profileCommand = program.command('profile').description('Manage profiles')

  profileCommand
    .command('list')
    .description('List all profiles')
    .action(async () => {
      try {
        const profileManager = new ProfileManager()
        const profiles = await profileManager.listProfiles()
        const activeProfile = (await profileManager.getActiveProfile()).name

        console.log(chalk.bold('\nAvailable Profiles:'))
        for (const profile of profiles) {
          if (profile === activeProfile) {
            console.log(`  ${chalk.green('●')} ${chalk.bold(profile)} ${chalk.gray('(active)')}`)
          } else {
            console.log(`  ${chalk.gray('○')} ${profile}`)
          }
        }
        console.log('')
      } catch (error) {
        console.error(chalk.red('Error listing profiles:'), error)
        process.exit(1)
      }
    })

  profileCommand
    .command('show [name]')
    .description('Show profile details')
    .action(async (name?: string) => {
      try {
        const profileManager = new ProfileManager()
        const profileName = name || (await profileManager.getActiveProfile()).name
        const profile = await profileManager.getProfile(profileName)

        console.log(chalk.bold(`\nProfile: ${profile.name}`))
        console.log(chalk.gray('─'.repeat(30)))
        console.log(`${chalk.blue('Description:')}  ${profile.description || 'No description'}`)
        console.log(`${chalk.blue('Provider:')}     ${profile.provider || 'Not set'}`)
        console.log(`${chalk.blue('Model:')}        ${profile.model || 'Not set'}`)
        console.log(`${chalk.blue('Agent:')}        ${profile.agent || 'Not set'}`)
        console.log(`${chalk.blue('Tools:')}        ${profile.tools?.join(', ') || 'None'}`)

        // Display knowledge base settings if available
        if (profile.knowledgeBase) {
          console.log(chalk.blue('\nKnowledge Base Settings:'))
          console.log(`  ${chalk.gray('•')} ID:         ${profile.knowledgeBase.knowledgeBaseId}`)
          console.log(`  ${chalk.gray('•')} Model ARN:  ${profile.knowledgeBase.modelArn || 'Default'}`)
          console.log(`  ${chalk.gray('•')} Region:     ${profile.knowledgeBase.region || 'Default'}`)
        }

        console.log(chalk.blue('\nOptions:'))
        console.log(
          `  ${chalk.gray('•')} Streaming:   ${
            profile.options?.stream ? chalk.green('Enabled') : chalk.red('Disabled')
          }`,
        )
        console.log(
          `  ${chalk.gray('•')} Sound:       ${
            profile.options?.sound ? chalk.green('Enabled') : chalk.red('Disabled')
          }`,
        )
        console.log(`  ${chalk.gray('•')} Max Retries: ${profile.options?.maxRetries || 3}`)
        console.log(`  ${chalk.gray('•')} Max Steps: ${profile.options?.maxSteps || 50}`)
        console.log('')
      } catch (error) {
        console.error(chalk.red('Error showing profile:'), error)
        process.exit(1)
      }
    })

  profileCommand
    .command('use <name>')
    .description('Use a profile')
    .action(async (name: string) => {
      try {
        const profileManager = new ProfileManager()
        await profileManager.setActiveProfile(name)
        console.log(chalk.green(`Profile '${name}' set as active successfully.`))
      } catch (error) {
        console.error(chalk.red('Error activating profile:'), error)
        process.exit(1)
      }
    })

  profileCommand
    .command('create')
    .description('Create a new profile')
    .action(async () => {
      try {
        const firstRunManager = new FirstRunManager()
        await firstRunManager.createDefaultProfileWithWizard()
        console.log(chalk.green('Profile created successfully.'))
      } catch (error) {
        console.error(chalk.red('Error creating profile:'), error)
        process.exit(1)
      }
    })

  profileCommand
    .command('edit <n>')
    .description('Edit an existing profile')
    .action(async (name: string) => {
      try {
        const profileManager = new ProfileManager()

        // First, check if the profile exists
        let profile: Profile
        try {
          profile = await profileManager.getProfile(name)
        } catch (error) {
          console.error(chalk.red(`Profile '${name}' not found.`))
          process.exit(1)
          return
        }

        console.log(chalk.bold(`\nEditing Profile: ${profile.name}`))
        console.log(chalk.gray('─'.repeat(30)))

        // Ask for description
        const description = await input({
          message: 'Profile description:',
          default: profile.description || 'Default Hataraku profile',
        })

        // Choose provider
        const provider = await select({
          message: 'Select provider:',
          choices: [
            { name: 'OpenRouter (Anthropic, OpenAI, etc.)', value: 'openrouter' },
            { name: 'Anthropic', value: 'anthropic' },
            { name: 'AWS Bedrock', value: 'bedrock' },
          ],
          default: profile.provider,
        })

        // Choose model based on provider
        let modelChoices
        switch (provider) {
          case 'openrouter':
            modelChoices = [
              { name: 'Claude 3.7 Sonnet', value: 'anthropic/claude-3.7-sonnet' },
              { name: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
              { name: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
              { name: 'Gemini Flash 1.5', value: 'google/gemini-flash-1.5' },
              { name: 'DeepSeek R1', value: 'deepseek/deepseek-r1' },
              { name: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' },
            ]
            break
          case 'anthropic':
            modelChoices = [
              { name: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-20250219' },
              { name: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
            ]
            break
          case 'bedrock':
            modelChoices = [
              { name: 'Claude 3.7 Sonnet', value: 'us.anthropic.claude-3-7-sonnet-20250219-v1.0' },
              { name: 'Claude 3.5 Sonnet', value: 'us.anthropic.claude-3-5-sonnet-20241022-v2.0' },
            ]
            break
          default:
            modelChoices = [{ name: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-20250219' }]
        }

        const model = await select({
          message: 'Select model:',
          choices: modelChoices,
          default: profile.model,
        })

        // Provider-specific options
        let providerOptions = profile.providerOptions || {}

        if (provider === 'bedrock') {
          const awsProfile = await input({
            message: 'AWS profile to use:',
            default: providerOptions.profile || 'default',
          })
          providerOptions = { ...providerOptions, profile: awsProfile }
        }

        // Configure options
        const stream = await confirm({
          message: 'Enable streaming responses?',
          default: profile.options?.stream ?? true,
        })

        const sound = await confirm({
          message: 'Enable sound effects?',
          default: profile.options?.sound ?? true,
        })

        // Create updated profile
        const updatedProfile: Partial<Profile> = {
          description,
          provider: provider as string,
          model: model as string,
          providerOptions,
          options: {
            ...(profile.options || {}),
            stream,
            sound,
          },
        }

        // Save profile updates
        await profileManager.updateProfile(name, updatedProfile)
        console.log(chalk.green(`Profile '${name}' updated successfully.`))
      } catch (error) {
        console.error(chalk.red('Error editing profile:'), error)
        process.exit(1)
      }
    })

  profileCommand
    .command('set-kb <profile>')
    .description('Set knowledge base configuration for a profile')
    .action(async (profileName: string) => {
      try {
        const profileManager = new ProfileManager()

        // Check if profile exists
        try {
          await profileManager.getProfile(profileName)
        } catch (error) {
          console.error(chalk.red(`Profile '${profileName}' not found.`))
          process.exit(1)
        }

        console.log(chalk.cyan(`\nConfiguring Knowledge Base settings for profile: ${chalk.bold(profileName)}`))

        // Get knowledge base ID
        const knowledgeBaseId = await input({
          message: 'Knowledge Base ID:',
          validate: value => (value.trim() !== '' ? true : 'Knowledge Base ID is required'),
        })

        // Get model ARN (optional)
        const modelArn = await input({
          message: 'Model ARN (optional, press Enter to use default):',
        })

        // Get region (optional)
        const region = await input({
          message: 'AWS Region (optional, press Enter to use default):',
        })

        // Update profile
        await profileManager.updateProfile(profileName, {
          knowledgeBase: {
            knowledgeBaseId,
            ...(modelArn ? { modelArn } : {}),
            ...(region ? { region } : {}),
          },
        })

        console.log(chalk.green(`\nKnowledge Base configuration for profile '${profileName}' updated successfully.`))
      } catch (error) {
        console.error(chalk.red('Error setting knowledge base configuration:'), error)
        process.exit(1)
      }
    })

  profileCommand
    .command('delete <name>')
    .description('Delete a profile')
    .action(async (name: string) => {
      try {
        const profileManager = new ProfileManager()
        const confirmed = await confirm({
          message: `Are you sure you want to delete profile '${name}'?`,
          default: false,
        })

        if (!confirmed) {
          console.log(chalk.yellow('Profile deletion cancelled.'))
          return
        }

        await profileManager.deleteProfile(name)
        console.log(chalk.green(`Profile '${name}' deleted successfully.`))
      } catch (error) {
        console.error(chalk.red('Error deleting profile:'), error)
        process.exit(1)
      }
    })

  return program
}
