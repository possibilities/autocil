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
autocil [directory] [--name session-name]
```

Where:
- `[directory]` is an optional path to a directory. If provided, autocil will use this directory instead of the current working directory.
- `--name session-name` is an optional argument to specify a custom name for the tmux session. If not provided, the name from package.json or the directory name will be used.

Examples:

```bash
# Use the current directory
autocil

# Use a specific directory
autocil /path/to/your/project

# Use a custom session name
autocil --name my-project

# Use both a specific directory and a custom session name
autocil /path/to/your/project --name my-project
```

This will:
1. Generate a teamocil YAML configuration for the specified project
2. Create a temporary YAML file
3. Start a new tmux session using the generated configuration
4. Display instructions for attaching to the session

By default, the project name (used for the tmux session) is determined from the package.json file if it exists, otherwise it uses the directory name. When the `--name` argument is provided, it overrides this behavior and uses the specified name instead.

## What is teamocil?

[Teamocil](https://github.com/remi/teamocil) is a tool to set up tmux sessions with predefined window and pane configurations using YAML files.

## License

MIT
