import * as process from 'node:process'
import { userInfo } from 'node:os'

/**
 * Returns the path to the user's default shell
 */
export function getDefaultShell(): string {
  const { env } = process

  if (process.platform === 'win32') {
    return env.COMSPEC || 'cmd.exe'
  }

  try {
    const { shell } = userInfo()
    if (shell) {
      return shell
    }
  } catch {}

  if (process.platform === 'darwin') {
    return env.SHELL || '/bin/zsh'
  }

  return env.SHELL || '/bin/sh'
}
