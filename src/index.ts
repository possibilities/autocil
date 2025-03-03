import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync, spawnSync } from 'child_process'

function parseArgs(): { targetDir: string; customName?: string } {
  const args = process.argv.slice(2)
  let targetDir: string | undefined
  let customName: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && i + 1 < args.length) {
      customName = args[i + 1]
      i++
    } else if (!targetDir && !args[i].startsWith('--')) {
      targetDir = args[i]
    }
  }

  if (targetDir) {
    const resolvedPath = path.resolve(targetDir)
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: Directory does not exist: ${resolvedPath}`)
      process.exit(1)
    }
    if (!fs.statSync(resolvedPath).isDirectory()) {
      console.error(`Error: Not a directory: ${resolvedPath}`)
      process.exit(1)
    }
    return { targetDir: resolvedPath, customName }
  }

  return { targetDir: process.cwd(), customName }
}

const { targetDir, customName } = parseArgs()
const packageJsonPath = path.join(targetDir, 'package.json')

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

function executeTmuxCommand(projectName: string, tempFilePath: string): void {
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
    console.info(
      `To attach to this session, run: tmux attach-session -t ${projectName}`,
    )
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
      process.exit(2)
    }

    if (!isTeamocilInstalled()) {
      console.error('Error: teamocil is not installed or not in your PATH.')
      console.error('Please install teamocil with: gem install teamocil')
      process.exit(3)
    }

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

    console.info('Generated teamocil YAML:')
    console.info('------------------------')
    console.info(teamocilYaml)
    console.info('------------------------')

    executeTmuxCommand(projectName, tempFilePath)
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
