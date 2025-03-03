#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';

// Get the current working directory
const cwd = process.cwd();
const packageJsonPath = path.join(cwd, 'package.json');

// Function to generate teamocil YAML content
function generateTeamocilYaml(projectName: string, hasDevScript: boolean): string {
  return `# Teamocil configuration for ${projectName}
name: ${projectName}
windows:
  - name: ${projectName}
    root: ${cwd}
    layout: main-vertical
    panes:
      - commands:
        - vim
        focus: true
      - commands:
        - ${hasDevScript ? 'npm run dev' : 'echo "No dev script found"'}
`;
}

// Get project info from package.json
function getProjectInfo(): { name: string; hasDevScript: boolean } {
  // Default to directory name
  let projectName = path.basename(cwd);
  let hasDevScript = false;
  
  // Try to get info from package.json if it exists
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      if (packageJson.name) {
        projectName = packageJson.name;
      }
      
      // Check if there's a dev script
      if (packageJson.scripts && packageJson.scripts.dev) {
        hasDevScript = true;
      }
    } catch (error) {
      // Silently fall back to directory name if package.json can't be parsed
    }
  }
  
  return { name: projectName, hasDevScript };
}

// Main function
function main() {
  try {
    const { name: projectName, hasDevScript } = getProjectInfo();
    const teamocilYaml = generateTeamocilYaml(projectName, hasDevScript);
    
    // For now, just echo the content
    console.log('Generated teamocil YAML:');
    console.log('------------------------');
    console.log(teamocilYaml);
    console.log('------------------------');
    console.log('This would create a tmux session with vim open in a pane.');
    
    // In the future, this would write to a temporary file
    // const tempFilePath = path.join(os.tmpdir(), `${projectName}.yml`);
    // fs.writeFileSync(tempFilePath, teamocilYaml);
    // console.log(`Teamocil configuration written to: ${tempFilePath}`);
    
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unknown error occurred');
    }
    process.exit(1);
  }
}

// Run the main function
main();
