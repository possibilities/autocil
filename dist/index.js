#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
// Get the current working directory
const cwd = process.cwd();
const packageJsonPath = path_1.default.join(cwd, 'package.json');
// Function to check if docker-compose file exists
function hasDockerComposeFile() {
    const possibleFiles = [
        'docker-compose.yml',
        'docker-compose.yaml',
        'docker-compose.json'
    ];
    return possibleFiles.some(file => fs_1.default.existsSync(path_1.default.join(cwd, file)));
}
// Function to generate teamocil YAML content
function generateTeamocilYaml(projectName, hasDevScript, hasTestsWatchScript, hasTypesWatchScript, hasDockerCompose) {
    let yamlContent = `# Teamocil configuration for ${projectName}
name: ${projectName}
windows:`;
    // Main development window
    yamlContent += `
  - name: ${projectName}
    root: ${cwd}
    layout: main-vertical
    panes:
      - commands:
        - vim
        focus: true`;
    // Add test:watch pane if it exists
    if (hasTestsWatchScript) {
        yamlContent += `
      - commands:
        - pnpm run test:watch`;
    }
    // Add types:watch pane if it exists
    if (hasTypesWatchScript) {
        yamlContent += `
      - commands:
        - pnpm run types:watch`;
    }
    // Add dev pane
    yamlContent += `
      - commands:
        - ${hasDevScript ? 'pnpm run dev' : 'echo "No dev script found"'}`;
    // Add services tab for docker-compose if it exists
    if (hasDockerCompose) {
        yamlContent += `
  - name: services
    root: ${cwd}
    panes:
      - commands:
        - docker compose down 2>&1 | tee docker-output.log ; docker compose up --build 2>&1 | tee -a docker-output.log`;
    }
    yamlContent += `
`;
    return yamlContent;
}
// Get project info from package.json
function getProjectInfo() {
    // Default to directory name
    let projectName = path_1.default.basename(cwd);
    let hasDevScript = false;
    let hasTestsWatchScript = false;
    let hasTypesWatchScript = false;
    // Try to get info from package.json if it exists
    if (fs_1.default.existsSync(packageJsonPath)) {
        try {
            const packageJsonContent = fs_1.default.readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);
            if (packageJson.name) {
                projectName = packageJson.name;
            }
            // Check for scripts
            if (packageJson.scripts) {
                if (packageJson.scripts.dev) {
                    hasDevScript = true;
                }
                if (packageJson.scripts['test:watch']) {
                    hasTestsWatchScript = true;
                }
                if (packageJson.scripts['types:watch']) {
                    hasTypesWatchScript = true;
                }
            }
        }
        catch (error) {
            // Silently fall back to directory name if package.json can't be parsed
        }
    }
    return {
        name: projectName,
        hasDevScript,
        hasTestsWatchScript,
        hasTypesWatchScript
    };
}
// Main function
function main() {
    try {
        const { name: projectName, hasDevScript, hasTestsWatchScript, hasTypesWatchScript } = getProjectInfo();
        // Check for docker-compose file
        const hasDockerCompose = hasDockerComposeFile();
        const teamocilYaml = generateTeamocilYaml(projectName, hasDevScript, hasTestsWatchScript, hasTypesWatchScript, hasDockerCompose);
        // Generate a timestamp-based random filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const randomSuffix = Math.floor(Math.random() * 10000);
        const tempFilePath = path_1.default.join(os_1.default.tmpdir(), `${projectName}_${timestamp}_${randomSuffix}.yml`);
        // Write the YAML to the temporary file
        fs_1.default.writeFileSync(tempFilePath, teamocilYaml);
        // Display the generated YAML and file location
        console.log('Generated teamocil YAML:');
        console.log('------------------------');
        console.log(teamocilYaml);
        console.log('------------------------');
        console.log('This would create a tmux session with vim open in a pane.');
        console.log(`\nTeamocil configuration written to: ${tempFilePath}`);
    }
    catch (error) {
        if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
        }
        else {
            console.error('An unknown error occurred');
        }
        process.exit(1);
    }
}
// Run the main function
main();
//# sourceMappingURL=index.js.map