#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync, spawnSync } from 'child_process'
import YAML from 'yaml'
import TOML from '@iarna/toml'

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
                              Relative paths (not starting with /, ~, or .) are resolved against 
                              the root directory: ${config.root}

Options:
  --name <session-name> Specify a custom session name (cannot be used with multiple directories)
  --no-attach           Create the tmux sessions but don't automatically attach to them
  --help                Show this help message

Examples:
  autocil                                 # Use current directory
  autocil /absolute/path/myapp            # Use absolute path
  autocil ~/projects/myapp                # Use home-relative path
  autocil ./myapp                         # Use ./myapp (relative to current directory)
  autocil myapp                           # Use ${config.root}/myapp
  autocil foo/bar                          # Use ${config.root}/foo/bar
  autocil app1 app2                       # Create sessions for multiple projects in root directory
  autocil --name my-session               # Use custom session name (single directory only)
  autocil --no-attach                     # Create session without attaching

Custom Teamocil Configurations:
  If a file named <project-name>.yaml exists in the target directory, autocil will use
  that file as the teamocil configuration instead of generating one automatically.
  For relative paths, it also checks for <path>.yaml in the root directory (${config.root}).

Project-specific Configuration:
  Place a .autocil.yaml file in your project directory to define custom commands:
  
  # .autocil.yaml
  - npm run dev
  - npm run test:watch
  - docker compose up
  
  This works for any language or toolchain (Python, Go, Rust, etc.)

Global Configuration:
  A config file can be placed at ~/.config/autocil.yaml to customize settings:
  
  root: /path/to/your/projects  # Default: ~/code
`)
  process.exit(0)
}

function parseArgs(): {
  targetDirs: Array<{ path: string; originalName: string }>
  customName?: string
  noAttach?: boolean
} {
  const config = loadConfig()
  const args = process.argv.slice(2)
  const targetDirs: Array<{ path: string; originalName: string }> = []
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
      const projectName = args[i]

      // Check if path is absolute (starts with /, ~, or Windows drive letter) or relative to cwd (starts with .)
      const isAbsolutePath =
        path.isAbsolute(projectName) || projectName.startsWith('~')
      const isRelativeToCwd = projectName.startsWith('.')

      let resolvedPath
      if (!isAbsolutePath && !isRelativeToCwd && config.root) {
        resolvedPath = path.resolve(path.join(config.root, projectName))
      } else {
        resolvedPath = path.resolve(projectName)
      }

      const dirExists = fs.existsSync(resolvedPath)
      const isDir = dirExists && fs.statSync(resolvedPath).isDirectory()

      const baseName = path.basename(resolvedPath)
      const configInRoot =
        !isAbsolutePath && !isRelativeToCwd && config.root
          ? fs.existsSync(path.join(config.root, `${projectName}.yaml`))
          : false

      if (!dirExists && !configInRoot) {
        console.error(`Error: Directory does not exist: ${resolvedPath}`)
        if (!isAbsolutePath && !isRelativeToCwd && config.root) {
          console.error(
            `Note: Looked for "${projectName}" in root directory: ${config.root}`,
          )
        }
        showHelp()
        process.exit(1)
      }

      if (dirExists && !isDir && !configInRoot) {
        console.error(`Error: Not a directory: ${resolvedPath}`)
        showHelp()
        process.exit(1)
      }

      targetDirs.push({ path: resolvedPath, originalName: projectName })
    } else if (args[i].startsWith('-')) {
      if (!validOptions.includes(args[i])) {
        console.error(`Error: Unknown option: ${args[i]}`)
        showHelp()
        process.exit(1)
      }
    }
  }

  if (targetDirs.length === 0) {
    targetDirs.push({ path: process.cwd(), originalName: '.' })
  }

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

function hasTeamocilConfig(
  dir: string,
  projectName: string,
  originalRelativeName?: string,
): string | null {
  const configPath = path.join(dir, `${projectName}.yaml`)
  if (fs.existsSync(configPath)) {
    return configPath
  }

  const config = loadConfig()
  if (config.root) {
    // First try with the original relative name if provided
    if (originalRelativeName && originalRelativeName !== '.') {
      const rootConfigPath = path.join(
        config.root,
        `${originalRelativeName}.yaml`,
      )
      if (fs.existsSync(rootConfigPath)) {
        return rootConfigPath
      }
    }

    // Fall back to just the project name
    const rootConfigPath = path.join(config.root, `${projectName}.yaml`)
    if (fs.existsSync(rootConfigPath)) {
      return rootConfigPath
    }
  }

  return null
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

function parseAutocilYaml(dir: string): string[] {
  const autocilPath = path.join(dir, '.autocil.yaml')
  const commands: string[] = []

  if (fs.existsSync(autocilPath)) {
    try {
      const autocilContent = fs.readFileSync(autocilPath, 'utf8')
      const parsed = YAML.parse(autocilContent)

      if (Array.isArray(parsed)) {
        // Simple array format
        commands.push(...parsed.filter(cmd => typeof cmd === 'string'))
      } else if (parsed && Array.isArray(parsed.commands)) {
        // Object with commands array
        commands.push(
          ...parsed.commands.filter((cmd: any) => typeof cmd === 'string'),
        )
      }
    } catch (error) {
      console.warn(
        `Warning: Could not parse .autocil.yaml: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }
  }

  return commands
}

function parsePyprojectToml(dir: string): {
  hasDevScript: boolean
  watchScripts: Array<{ name: string; script: string }>
} {
  const pyprojectPath = path.join(dir, 'pyproject.toml')
  let hasDevScript = false
  const watchScripts: Array<{ name: string; script: string }> = []

  if (fs.existsSync(pyprojectPath)) {
    try {
      const pyprojectContent = fs.readFileSync(pyprojectPath, 'utf8')
      const pyproject = TOML.parse(pyprojectContent) as any

      if (
        pyproject.tool &&
        pyproject.tool.autocil &&
        pyproject.tool.autocil.scripts
      ) {
        const scripts = pyproject.tool.autocil.scripts

        // Check for dev script
        if (scripts.dev) {
          hasDevScript = true
          // Add dev script to watchScripts for consistency
          watchScripts.push({ name: 'dev', script: String(scripts.dev) })
        }

        // Find all scripts ending with :watch
        Object.entries(scripts).forEach(([name, script]) => {
          if (name.endsWith(':watch')) {
            watchScripts.push({ name, script: String(script) })
          }
        })
      }
    } catch (error) {
      console.warn(
        `Warning: Could not parse pyproject.toml: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }
  }

  return { hasDevScript, watchScripts }
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
  watchScripts: Array<{ name: string; script: string }> = [],
  isPythonProject: boolean = false,
  autocilCommands: string[] = [],
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

  // If we have .autocil.yaml commands, use those exclusively
  if (autocilCommands.length > 0) {
    for (const command of autocilCommands) {
      yamlContent += `
      - commands:
        - ${command}`
    }
  } else {
    // Otherwise, use the existing logic for backward compatibility
    // Add specific script panes for backward compatibility
    if (hasTestsWatchScript) {
      yamlContent += `
      - commands:
        - sleep 2
        - ${isPythonProject ? '' : packageManager + ' run '}test:watch`
    }

    if (hasTypesWatchScript) {
      yamlContent += `
      - commands:
        - ${isPythonProject ? '' : packageManager + ' run '}types:watch`
    }

    // Add all watch scripts that aren't already added, excluding the dev script
    const addedScripts = new Set(['test:watch', 'types:watch', 'dev'])
    for (const { name, script } of watchScripts) {
      if (!addedScripts.has(name) && name !== 'dev') {
        // For Python projects, use the script directly
        // For JS/TS projects, use packageManager run name
        const scriptCommand = isPythonProject
          ? script
          : `${packageManager} run ${name}`

        yamlContent += `
      - commands:
        - ${scriptCommand}`
        addedScripts.add(name)
      }
    }

    // Add dev script at the end to ensure it runs after all :watch scripts
    for (const { name, script } of watchScripts) {
      if (name === 'dev') {
        const scriptCommand = isPythonProject
          ? script
          : `${packageManager} run ${name}`

        yamlContent += `
      - commands:
        - ${scriptCommand}`
        break
      }
    }
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
        - ${isPythonProject ? 'python -m db.studio' : `${packageManager} db:studio`}`
    }
  }

  yamlContent += `
`

  return yamlContent
}

function sanitizePackageName(name: string): string {
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
  watchScripts: Array<{ name: string; script: string }>
  isPythonProject: boolean
} {
  let projectName = customName || path.basename(dir)
  let displayName = projectName
  let hasDevScript = false
  let hasTestsWatchScript = false
  let hasTypesWatchScript = false
  let hasDbStudioScript = false
  let isPythonProject = false
  const watchScripts: Array<{ name: string; script: string }> = []

  // Check for pyproject.toml first
  const pyprojectPath = path.join(dir, 'pyproject.toml')
  if (fs.existsSync(pyprojectPath)) {
    isPythonProject = true
    try {
      const { hasDevScript: pyDevScript, watchScripts: pyWatchScripts } =
        parsePyprojectToml(dir)

      // Add Python scripts to our collection
      if (pyDevScript) {
        hasDevScript = true
      }

      // Add watch scripts from pyproject.toml
      watchScripts.push(...pyWatchScripts)
    } catch (error) {
      console.warn(
        `Warning: Error processing pyproject.toml: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }
  }

  // Also check for package.json (may have both in some projects)
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
          // Add dev script to watchScripts for consistency
          watchScripts.push({
            name: 'dev',
            script: String(packageJson.scripts.dev),
          })
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

        // Find all scripts ending with :watch
        Object.entries(packageJson.scripts).forEach(([name, script]) => {
          if (name.endsWith(':watch')) {
            watchScripts.push({ name, script: String(script) })
          }
        })
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
    watchScripts,
    isPythonProject,
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

    for (const target of targetDirs) {
      const targetDir = target.path
      const dirExists = fs.existsSync(targetDir)

      const projectBaseName = path.basename(targetDir)
      let displayName = projectBaseName
      let projectName = customName || projectBaseName

      const existingConfigPath = hasTeamocilConfig(
        targetDir,
        projectName,
        target.originalName,
      )
      let tempFilePath: string

      if (existingConfigPath) {
        console.info(`Found existing teamocil config: ${existingConfigPath}`)
        tempFilePath = existingConfigPath

        try {
          const configContent = fs.readFileSync(existingConfigPath, 'utf8')
          const parsedConfig = YAML.parse(configContent)
          if (parsedConfig && parsedConfig.name) {
            projectName = parsedConfig.name
            displayName = parsedConfig.name
            console.info(`Using session name from config: ${projectName}`)
          }
        } catch (error) {
          console.warn(
            `Warning: Could not parse teamocil config: ${error instanceof Error ? error.message : 'unknown error'}`,
          )
        }
      } else if (!dirExists) {
        console.error(
          `Error: Directory does not exist and no config file found: ${targetDir}`,
        )
        process.exit(1)
      } else {
        const packageJsonPath = path.join(targetDir, 'package.json')
        const {
          name: projName,
          displayName: dispName,
          hasDevScript,
          hasTestsWatchScript,
          hasTypesWatchScript,
          hasDbStudioScript,
          watchScripts,
          isPythonProject,
        } = getProjectInfo(targetDir, customName)

        projectName = projName
        displayName = dispName

        const hasDockerCompose = hasDockerComposeFile(targetDir)
        const hasDockerfileExists = hasDockerfile(targetDir)
        const packageManager = detectPackageManager(targetDir)
        const autocilCommands = parseAutocilYaml(targetDir)

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
          watchScripts,
          isPythonProject,
          autocilCommands,
        )

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const randomSuffix = Math.floor(Math.random() * 10000)
        tempFilePath = path.join(
          os.tmpdir(),
          `${projectName}_${timestamp}_${randomSuffix}.yml`,
        )

        fs.writeFileSync(tempFilePath, teamocilYaml)

        console.info('Generated teamocil YAML:')
        console.info('------------------------')
        console.info(teamocilYaml)
        console.info('------------------------')
      }

      console.info(
        `Creating tmux session for: ${targetDir}${!dirExists ? ' (using config file only)' : ''}`,
      )

      const shouldAttach =
        !noAttach && targetDir === targetDirs[targetDirs.length - 1].path
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
