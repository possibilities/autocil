#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync, spawnSync } from 'child_process'
import YAML from 'yaml'

interface Config {
  root?: string
}

function loadConfig(): Config {
  const defaultConfig: Config = {
    root: path.join(os.homedir(), 'code'),
  }

  const configPath = path.join(os.homedir(), '.config', 'autocil.yaml')

  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8')
      const parsedConfig = YAML.parse(configContent) as Config
      return { ...defaultConfig, ...parsedConfig }
    }
  } catch (error) {
    console.warn(
      `Warning: Error loading config file: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
  }

  return defaultConfig
}

function showHelp(): void {
  const config = loadConfig()

  console.log(`
Usage: autocil [directory1] [directory2] ... [options]

Creates tmux sessions with teamocil layouts for one or more projects.

Arguments:
  directory1, directory2, ...  Target directories (defaults to current directory if none specified)
                              When only a name is provided (no path separators), 
                              it will be resolved against the root directory: ${config.root}

Options:
  --name <session-name> Specify a custom session name (cannot be used with multiple directories)
  --no-attach           Create the tmux sessions but don't automatically attach to them
  --help                Show this help message

Examples:
  autocil                                 # Use current directory
  autocil ~/projects/myapp                # Use specified directory
  autocil myapp                           # Use project in root directory (${config.root}/myapp)
  autocil ~/projects/app1 ~/projects/app2 # Create sessions for multiple directories
  autocil app1 app2                       # Create sessions for multiple projects in root directory
  autocil --name my-session               # Use custom session name (single directory only)
  autocil --no-attach                     # Create session without attaching

Configuration:
  A config file can be placed at ~/.config/autocil.yaml to customize settings:
  
  root: /path/to/your/projects  # Default: ~/code
`)
  process.exit(0)
}

function parseArgs(): {
  targetDirs: string[]
  customName?: string
  noAttach?: boolean
} {
  const config = loadConfig()
  const args = process.argv.slice(2)
  const targetDirs: string[] = []
  let customName: string | undefined
  let noAttach: boolean = false
  const validOptions = ['--help', '--name', '--no-attach']

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') {
      showHelp()
    } else if (args[i] === '--name' && i + 1 < args.length) {
      customName = args[i + 1]
      i++
    } else if (args[i] === '--no-attach') {
      noAttach = true
    } else if (!args[i].startsWith('--')) {
      // Check if the argument is a directory name without path separators
      const isSimpleName = !args[i].includes('/') && !args[i].includes('\\')

      // If it's a simple name, resolve it against the root directory
      let resolvedPath
      if (isSimpleName && config.root) {
        resolvedPath = path.resolve(path.join(config.root, args[i]))
      } else {
        resolvedPath = path.resolve(args[i])
      }

      if (!fs.existsSync(resolvedPath)) {
        console.error(`Error: Directory does not exist: ${resolvedPath}`)
        if (isSimpleName && config.root) {
          console.error(
            `Note: Looked for "${args[i]}" in root directory: ${config.root}`,
          )
        }
        showHelp()
        process.exit(1)
      }

      if (!fs.statSync(resolvedPath).isDirectory()) {
        console.error(`Error: Not a directory: ${resolvedPath}`)
        showHelp()
        process.exit(1)
      }
      targetDirs.push(resolvedPath)
    } else if (args[i].startsWith('-')) {
      if (!validOptions.includes(args[i])) {
        console.error(`Error: Unknown option: ${args[i]}`)
        showHelp()
        process.exit(1)
      }
    }
  }

  // If no directories specified, use current directory
  if (targetDirs.length === 0) {
    targetDirs.push(process.cwd())
  }

  // Cannot use --name with multiple directories
  if (customName && targetDirs.length > 1) {
    console.error('Error: Cannot use --name with multiple directories')
    console.error('Each tmux session needs a unique name')
    showHelp()
    process.exit(1)
  }

  return { targetDirs, customName, noAttach }
}

const { targetDirs, customName, noAttach } = parseArgs()

function hasDockerComposeFile(dir: string): boolean {
  const possibleFiles = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'docker-compose.json',
  ]

  return possibleFiles.some(file => fs.existsSync(path.join(dir, file)))
}

function hasDockerfile(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'Dockerfile'))
}

function detectPackageManager(dir: string): string {
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) {
    return 'yarn'
  } else if (fs.existsSync(path.join(dir, 'package-lock.json'))) {
    return 'npm'
  } else {
    return 'pnpm'
  }
}

function generateTeamocilYaml(
  projectName: string,
  displayName: string,
  hasDevScript: boolean,
  hasTestsWatchScript: boolean,
  hasTypesWatchScript: boolean,
  hasDockerCompose: boolean,
  hasDockerfile: boolean,
  hasDbStudioScript: boolean,
  dir: string,
  packageManager: string,
): string {
  let yamlContent = `# Teamocil configuration for ${displayName}
name: ${projectName}
windows:`

  yamlContent += `
  - name: dev
    focus: true
    root: ${dir}
    layout: main-vertical
    panes:
      - commands:
        - vim`

  if (hasTestsWatchScript) {
    yamlContent += `
      - commands:
        - sleep 2
        - ${packageManager} run test:watch`
  }

  if (hasTypesWatchScript) {
    yamlContent += `
      - commands:
        - ${packageManager} run types:watch`
  }

  if (hasDevScript) {
    yamlContent += `
      - commands:
        - ${packageManager} run dev`
  }

  yamlContent += `
      - commands:
        - sleep 1
        - tree --gitignore
        focus: true`

  if (hasDockerCompose) {
    yamlContent += `
  - name: services
    root: ${dir}
    layout: even-horizontal
    panes:
      - commands:
        - docker compose down 2>&1 | tee docker-output.log ; docker compose up${hasDockerfile ? ' --build' : ''} 2>&1 | tee -a docker-output.log`

    if (hasDbStudioScript) {
      yamlContent += `
      - commands:
        - ${packageManager} db:studio`
    }
  }

  yamlContent += `
`

  return yamlContent
}

function sanitizePackageName(name: string): string {
  // Replace @ and / with dashes, then remove any leading dash
  return name.replace(/[@/]/g, '-').replace(/^-/, '')
}

function getProjectInfo(
  dir: string,
  customName?: string,
): {
  name: string
  displayName: string
  hasDevScript: boolean
  hasTestsWatchScript: boolean
  hasTypesWatchScript: boolean
  hasDbStudioScript: boolean
} {
  let projectName = customName || path.basename(dir)
  let displayName = projectName
  let hasDevScript = false
  let hasTestsWatchScript = false
  let hasTypesWatchScript = false
  let hasDbStudioScript = false

  const packageJsonPath = path.join(dir, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(packageJsonContent)
      if (packageJson.name && !customName) {
        displayName = packageJson.name
        projectName = sanitizePackageName(packageJson.name)
      }

      if (packageJson.scripts) {
        if (packageJson.scripts.dev) {
          hasDevScript = true
        }
        if (packageJson.scripts['test:watch']) {
          hasTestsWatchScript = true
        }
        if (packageJson.scripts['types:watch']) {
          hasTypesWatchScript = true
        }
        if (packageJson.scripts['db:studio']) {
          hasDbStudioScript = true
        }
      }
    } catch (error) {}
  }

  return {
    name: projectName,
    displayName,
    hasDevScript,
    hasTestsWatchScript,
    hasTypesWatchScript,
    hasDbStudioScript,
  }
}

function isInsideTmux(): boolean {
  return !!process.env.TMUX
}

function isTeamocilInstalled(): boolean {
  try {
    execSync('which teamocil', { stdio: 'ignore' })
    return true
  } catch (error) {
    return false
  }
}

function executeTmuxCommand(
  projectName: string,
  tempFilePath: string,
  autoAttach: boolean = false,
): void {
  try {
    try {
      execSync(`tmux kill-session -t ${projectName}`, { stdio: 'ignore' })
      console.info(`Killed existing tmux session: ${projectName}`)
    } catch (error) {}

    console.info(`Starting new tmux session: ${projectName}`)
    console.info(`Using teamocil layout: ${tempFilePath}`)

    const result = spawnSync(
      'tmux',
      ['new-session', '-d', `teamocil --layout ${tempFilePath}`],
      {
        stdio: 'inherit',
        shell: true,
      },
    )

    if (result.status !== 0) {
      throw new Error(
        `Failed to start tmux session. Exit code: ${result.status}`,
      )
    }

    console.info(`\nTmux session "${projectName}" created successfully!`)

    if (autoAttach) {
      console.info(`Attaching to tmux session "${projectName}"...`)
      setTimeout(() => {
        try {
          execSync(`tmux attach-session -t ${projectName}`, {
            stdio: 'inherit',
          })
        } catch (error) {
          console.error(
            `Error attaching to session: ${error instanceof Error ? error.message : 'unknown error'}`,
          )
        }
      }, 500)
    } else {
      console.info(
        `To attach to this session, run: tmux attach-session -t ${projectName}`,
      )
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to execute tmux command: ${error.message}`)
    } else {
      throw new Error('Failed to execute tmux command')
    }
  }
}

function main() {
  try {
    if (!noAttach && isInsideTmux()) {
      console.error(
        'Error: This command cannot be run from within a tmux session.',
      )
      console.error('Please exit your current tmux session and try again.')
      console.error(
        'Or use the --no-attach option to create sessions without attaching.',
      )
      showHelp()
      process.exit(2)
    }

    if (!isTeamocilInstalled()) {
      console.error('Error: teamocil is not installed or not in your PATH.')
      console.error('Please install teamocil with: gem install teamocil')
      showHelp()
      process.exit(3)
    }

    // Process each target directory
    for (const targetDir of targetDirs) {
      const packageJsonPath = path.join(targetDir, 'package.json')
      const {
        name: projectName,
        displayName,
        hasDevScript,
        hasTestsWatchScript,
        hasTypesWatchScript,
        hasDbStudioScript,
      } = getProjectInfo(targetDir, customName)

      const hasDockerCompose = hasDockerComposeFile(targetDir)
      const hasDockerfileExists = hasDockerfile(targetDir)
      const packageManager = detectPackageManager(targetDir)

      const teamocilYaml = generateTeamocilYaml(
        projectName,
        displayName,
        hasDevScript,
        hasTestsWatchScript,
        hasTypesWatchScript,
        hasDockerCompose,
        hasDockerfileExists,
        hasDbStudioScript,
        targetDir,
        packageManager,
      )

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const randomSuffix = Math.floor(Math.random() * 10000)
      const tempFilePath = path.join(
        os.tmpdir(),
        `${projectName}_${timestamp}_${randomSuffix}.yml`,
      )

      fs.writeFileSync(tempFilePath, teamocilYaml)

      console.info(`Creating tmux session for: ${targetDir}`)
      console.info('Generated teamocil YAML:')
      console.info('------------------------')
      console.info(teamocilYaml)
      console.info('------------------------')

      // Only attach to the last session if multiple are created
      const shouldAttach =
        !noAttach && targetDir === targetDirs[targetDirs.length - 1]
      executeTmuxCommand(projectName, tempFilePath, shouldAttach)
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
    } else {
      console.error('An unknown error occurred')
    }
    process.exit(1)
  }
}

main()
