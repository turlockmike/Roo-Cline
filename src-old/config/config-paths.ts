import * as os from 'os'
import * as path from 'path'
import { mkdirSync } from 'fs'

export interface ConfigPaths {
  configDir: string
  dataDir: string
  toolsDir: string
  agentsDir: string
  tasksDir: string
  logsDir: string
}

/**
 * Get configuration paths following XDG Base Directory Specification
 * @see https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
 */
export function getConfigPaths(): ConfigPaths {
  // Get XDG base directories with fallbacks
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')

  // Base directories for hataraku
  const configDir = path.join(xdgConfigHome, 'hataraku')
  const dataDir = path.join(xdgDataHome, 'hataraku')

  // Subdirectories
  return {
    configDir,
    dataDir,
    toolsDir: path.join(configDir, 'tools'),
    agentsDir: path.join(configDir, 'agents'),
    tasksDir: path.join(configDir, 'tasks'),
    logsDir: path.join(dataDir, 'logs'),
  }
}

/**
 * Create all required configuration directories
 * @throws {Error} If directory creation fails
 */
export function createConfigDirectories(): void {
  try {
    const paths = getConfigPaths()

    // Create all directories recursively
    mkdirSync(paths.configDir, { recursive: true })
    mkdirSync(paths.toolsDir, { recursive: true })
    mkdirSync(paths.agentsDir, { recursive: true })
    mkdirSync(paths.tasksDir, { recursive: true })
    mkdirSync(paths.dataDir, { recursive: true })
    mkdirSync(paths.logsDir, { recursive: true })
  } catch (error) {
    throw new Error('Failed to create configuration directories: ' + (error as Error).message)
  }
}
