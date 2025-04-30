# autocil

A TypeScript CLI tool that generates a teamocil YAML configuration for opening the current project in a tmux pane with common tasks and scripts automatically run for development

## Installation

```bash
pnpm install
pnpm build
pnpm link --global
```

## Usage

Run the command in any directory:

```bash
autocil [directory1] [directory2] ... [--name session-name] [--no-attach]
```

Where:

- `[directory1] [directory2] ...` are optional paths to directories or project names. If provided, autocil will create tmux sessions for each directory. If not provided, it will use the current working directory.
- `--name session-name` is an optional argument to specify a custom name for the tmux session. If not provided, the name from package.json or the directory name will be used. Note: This option cannot be used with multiple directories.
- `--no-attach` creates the tmux sessions without automatically attaching to them.

Examples:

```bash
# Use the current directory
autocil

# Use a specific directory
autocil /path/to/your/project

# Use a project name in the root directory (defaults to ~/code)
autocil myproject

# Create sessions for multiple directories
autocil /path/to/project1 /path/to/project2 /path/to/project3

# Create sessions for multiple projects in the root directory
autocil project1 project2 project3

# Use a custom session name
autocil --name my-project

# Use both a specific directory and a custom session name
autocil /path/to/your/project --name my-project

# Create session without attaching
autocil --no-attach
```

This will:

1. Generate a teamocil YAML configuration for each specified project
2. Detect the appropriate package manager (npm, yarn, or pnpm) based on lock files
3. Create temporary YAML files
4. Start new tmux sessions using the generated configurations
5. Automatically attach to the last created session (unless --no-attach is specified)
6. Display instructions for attaching to the sessions

By default, the project name (used for the tmux session) is determined from the package.json file if it exists, otherwise it uses the directory name. When the `--name` argument is provided, it overrides this behavior and uses the specified name instead.

When multiple directories are specified, tmux sessions will be created for each one, but you'll only be automatically attached to the last session created.

## Configuration

You can configure autocil by creating a YAML configuration file at `~/.config/autocil.yaml`.

Current configuration options:

- `root`: The root directory where autocil looks for projects. Default: `~/code`

Example configuration:

```yaml
# ~/.config/autocil.yaml
root: /home/user/projects
```

When using a project name without path separators (e.g., `autocil myproject`), autocil will look for the project in this root directory.

## What is teamocil?

[Teamocil](https://github.com/remi/teamocil) is a tool to set up tmux sessions with predefined window and pane configurations using YAML files.

## License

MIT
