import fs from 'fs'
import path from 'path'
import os from 'os'

const cwd = process.cwd()
const packageJsonPath = path.join(cwd, 'package.json')

function hasDockerComposeFile(): boolean {
  const possibleFiles = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'docker-compose.json',
  ]

  return possibleFiles.some(file => fs.existsSync(path.join(cwd, file)))
}

function generateTeamocilYaml(
  projectName: string,
  hasDevScript: boolean,
  hasTestsWatchScript: boolean,
  hasTypesWatchScript: boolean,
  hasDockerCompose: boolean,
): string {
  let yamlContent = `# Teamocil configuration for ${projectName}
name: ${projectName}
windows:`

  yamlContent += `
  - name: ${projectName}
    root: ${cwd}
    layout: main-vertical
    panes:
      - commands:
        - vim
        focus: true`

  if (hasTestsWatchScript) {
    yamlContent += `
      - commands:
        - pnpm run test:watch`
  }

  if (hasTypesWatchScript) {
    yamlContent += `
      - commands:
        - pnpm run types:watch`
  }

  yamlContent += `
      - commands:
        - ${hasDevScript ? 'pnpm run dev' : 'echo "No dev script found"'}`

  if (hasDockerCompose) {
    yamlContent += `
  - name: services
    root: ${cwd}
    panes:
      - commands:
        - docker compose down 2>&1 | tee docker-output.log ; docker compose up --build 2>&1 | tee -a docker-output.log`
  }

  yamlContent += `
`

  return yamlContent
}

function getProjectInfo(): {
  name: string
  hasDevScript: boolean
  hasTestsWatchScript: boolean
  hasTypesWatchScript: boolean
} {
  let projectName = path.basename(cwd)
  let hasDevScript = false
  let hasTestsWatchScript = false
  let hasTypesWatchScript = false

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(packageJsonContent)
      if (packageJson.name) {
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
      }
    } catch (error) {}
  }

  return {
    name: projectName,
    hasDevScript,
    hasTestsWatchScript,
    hasTypesWatchScript,
  }
}

function main() {
  try {
    const {
      name: projectName,
      hasDevScript,
      hasTestsWatchScript,
      hasTypesWatchScript,
    } = getProjectInfo()

    const hasDockerCompose = hasDockerComposeFile()

    const teamocilYaml = generateTeamocilYaml(
      projectName,
      hasDevScript,
      hasTestsWatchScript,
      hasTypesWatchScript,
      hasDockerCompose,
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
    console.info('This would create a tmux session with vim open in a pane.')
    console.info(`\nTeamocil configuration written to: ${tempFilePath}`)
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
