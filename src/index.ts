import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync, spawnSync } from 'child_process'

function showHelp(): void {
  console.log(`
Usage: autocil [directory1] [directory2] ... [options]

Creates tmux sessions with teamocil layouts for one or more projects.

Arguments:
  directory1, directory2, ...  Target directories (defaults to current directory if none specified)

Options:
  --name <session-name> Specify a custom session name (cannot be used with multiple directories)
  --no-attach           Create the tmux sessions but don't automatically attach to them
  --help                Show this help message

Examples:
  autocil                                 # Use current directory
  autocil ~/projects/myapp                # Use specified directory
  autocil ~/projects/app1 ~/projects/app2 # Create sessions for multiple directories
  autocil --name my-session               # Use custom session name (single directory only)
  autocil --no-attach                     # Create session without attaching
`)
  process.exit(0)
}

function parseArgs(): {
  targetDirs: string[]
  customName?: string
  noAttach?: boolean
} {
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
      const resolvedPath = path.resolve(args[i])
      if (!fs.existsSync(resolvedPath)) {
        console.error(`Error: Directory does not exist: ${resolvedPath}`)
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

function generateTeamocilYaml(
  projectName: string,
  hasDevScript: boolean,
  hasTestsWatchScript: boolean,
  hasTypesWatchScript: boolean,
  hasDockerCompose: boolean,
  hasDbStudioScript: boolean,
  dir: string,
): string {
  let yamlContent = `# Teamocil configuration for ${projectName}
name: ${projectName}
windows:`

  yamlContent += `
  - name: code
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
        - pnpm run test:watch`
  }

  if (hasTypesWatchScript) {
    yamlContent += `
      - commands:
        - pnpm run types:watch`
  }

  if (hasDevScript) {
    yamlContent += `
      - commands:
        - pnpm run dev`
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
        - docker compose down 2>&1 | tee docker-output.log ; docker compose up --build 2>&1 | tee -a docker-output.log`

    if (hasDbStudioScript) {
      yamlContent += `
      - commands:
        - pnpm db:studio`
    }
  }

  yamlContent += `
`

  return yamlContent
}

function getProjectInfo(
  dir: string,
  customName?: string,
): {
  name: string
  hasDevScript: boolean
  hasTestsWatchScript: boolean
  hasTypesWatchScript: boolean
  hasDbStudioScript: boolean
} {
  let projectName = customName || path.basename(dir)
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
        projectName = packageJson.name
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
    if (isInsideTmux()) {
      console.error(
        'Error: This command cannot be run from within a tmux session.',
      )
      console.error('Please exit your current tmux session and try again.')
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
        hasDevScript,
        hasTestsWatchScript,
        hasTypesWatchScript,
        hasDbStudioScript,
      } = getProjectInfo(targetDir, customName)

      const hasDockerCompose = hasDockerComposeFile(targetDir)

      const teamocilYaml = generateTeamocilYaml(
        projectName,
        hasDevScript,
        hasTestsWatchScript,
        hasTypesWatchScript,
        hasDockerCompose,
        hasDbStudioScript,
        targetDir,
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
