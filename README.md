# autocil

A TypeScript CLI tool that generates a teamocil YAML configuration for opening the current project in vim within a tmux pane.

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd autocil

# Install dependencies
npm install

# Build the project
npm run build

# Install globally
npm link
```

## Usage

Run the command in any directory:

```bash
autocil
```

This will generate a teamocil YAML configuration for the current project and display it. The project name is determined from the package.json file if it exists, otherwise it uses the directory name.

Currently, the tool only displays the generated YAML content. In future versions, it will create a temporary file that can be used with teamocil to set up a tmux session.

## What is teamocil?

[Teamocil](https://github.com/remi/teamocil) is a tool to set up tmux sessions with predefined window and pane configurations using YAML files.

## Development

```bash
# Run in development mode
npm run dev

# Build the project
npm run build
```

## License

MIT
