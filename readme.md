# autocil

A CLI tool that automatically generates and runs tmux sessions with teamocil layouts for your development projects.

## Requirements

- tmux
- teamocil (`gem install teamocil`)
- Node.js

## Installation

```bash
# Install globally
pnpm install -g autocil

# Or install from source
git clone https://github.com/yourusername/autocil.git
cd autocil
pnpm install
pnpm build
pnpm link --global
```

## Features

- Creates tmux sessions with smart layouts based on project structure
- Automatically detects package manager (npm, yarn, pnpm)
- Discovers and runs dev, test, and type-checking scripts
- Sets up Docker Compose services when present
- Supports multiple projects in a single command
- Customizable session names and behavior

## Usage

```bash
autocil [directory1] [directory2] ... [options]
```

### Arguments

- `directory1, directory2, ...` - Target directories (defaults to current directory)
  - When only a name is provided with no path separators, it will look in your configured root directory (default: `~/code`)

### Options

- `--name <session-name>` - Specify a custom session name (single directory only)
- `--no-attach` - Create sessions without automatically attaching
- `--help` - Show help message

### Examples

```bash
autocil                                 # Use current directory
autocil ~/projects/myapp                # Use specified directory
autocil myapp                           # Use project in root directory (~/code/myapp)
autocil ~/projects/app1 ~/projects/app2 # Create sessions for multiple directories
autocil app1 app2                       # Create sessions for multiple projects in root directory
autocil --name my-session               # Use custom session name (single directory only)
autocil --no-attach                     # Create session without attaching
```

## Configuration

You can customize settings by creating a config file at `~/.config/autocil.yaml`:

```yaml
# Define the root directory where autocil looks for projects
root: /path/to/your/projects  # Default: ~/code
```

## How It Works

Autocil analyzes your project and:

1. Detects project structure (package.json, Docker, etc.)
2. Generates appropriate teamocil YAML configuration
3. Creates tmux sessions with customized layouts:
   - Editor (vim) in main pane
   - Test watcher if `test:watch` script exists
   - Type checker if `types:watch` script exists
   - Development server if `dev` script exists
   - Docker Compose services if docker-compose.yml exists
   - Database UI if `db:studio` script exists

## License

MIT