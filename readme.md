# autocil

A TypeScript CLI tool that generates a teamocil YAML configuration for opening the current project in vim within a tmux pane.

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd autocil

# Install dependencies
npm install

# Install globally
npm link
```

## Usage

Run the command in any directory:

```bash
autocil [directory]
```

Where:
- `[directory]` is an optional path to a directory. If provided, autocil will use this directory instead of the current working directory.

Examples:

```bash
# Use the current directory
autocil

# Use a specific directory
autocil /path/to/your/project
```

This will:
1. Generate a teamocil YAML configuration for the specified project
2. Create a temporary YAML file
3. Start a new tmux session using the generated configuration
4. Display instructions for attaching to the session

The project name is determined from the package.json file if it exists, otherwise it uses the directory name.

## What is teamocil?

[Teamocil](https://github.com/remi/teamocil) is a tool to set up tmux sessions with predefined window and pane configurations using YAML files.

## License

MIT
