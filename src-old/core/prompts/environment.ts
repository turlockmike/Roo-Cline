import * as os from 'node:os'
import { readdirSync } from 'node:fs'
import * as process from 'node:process'
import { getDefaultShell } from '../lib/utils/shell'

// Should only return max files at most, evenly divided into three sections with ellipsis in between
export function getFilesInCurrentDirectory(max = 30) {
  const files = readdirSync(process.cwd())
  const n = Math.floor(max / 3)
  if (files.length <= max) {
    return files
  }
  const firstFiles = files.slice(0, n)
  const midIndex = Math.floor(files.length / 2)
  const half = Math.floor(n / 2)
  const middleFiles = files.slice(midIndex - half, midIndex - half + n)
  const lastFiles = files.slice(-n)
  return [...firstFiles, '...', ...middleFiles, '...', ...lastFiles]
}

export function getEnvironmentInfo() {
  return `
    <environment_details>
Environment Information:
Operating System: ${os.platform()} ${os.release()}
Architecture: ${os.arch()}
CPU Cores: ${os.cpus().length}
Total Memory: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB
Free Memory: ${Math.round(os.freemem() / (1024 * 1024 * 1024))}GB
Default Shell: ${getDefaultShell()}
Home Directory: ${os.homedir()}
Current Working Directory: ${process.cwd()}
Files in Current Directory: ${getFilesInCurrentDirectory()}
Node Version: ${process.version}
Current Time: ${new Date().toLocaleString(Intl.DateTimeFormat().resolvedOptions().locale, {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })}
Locale: ${Intl.DateTimeFormat().resolvedOptions().locale}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
User Info: ${os.userInfo().username}
Package Manager: ${process.env.npm_config_user_agent?.split('/')[0] || 'npm'}
Terminal: ${process.env.TERM_PROGRAM || process.env.TERM || 'unknown'}
Git Branch: ${require('child_process')
    .execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "not a git repo"')
    .toString()
    .trim()}
</environment_details>
`
}
