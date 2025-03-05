# AUTOCIL Commands and Guidelines

## Build/Test Commands
- Install: `npm install`
- Install globally: `npm link`
- Run locally: `ts-node src/index.ts [directory] [--name session-name]`
- Typecheck: `npx tsc --noEmit`
- Format: `npx prettier --write "src/**/*.ts"`

## Code Style Guidelines
- **Imports**: Group by built-in Node modules, then external deps, then local files
- **Formatting**: Use Prettier with default settings, 2-space indentation
- **Types**: Use strict TypeScript typing with explicit return types on functions
- **Naming**: camelCase for variables/functions, PascalCase for types/interfaces
- **Error Handling**: Use try/catch with explicit error messages and appropriate exit codes
- **Comments**: Minimal, focused on "why" not "what"
- **Structure**: Single-purpose functions with descriptive names (< 50 lines each)
- **Exports**: Prefer named exports over default exports

This project generates teamocil YAML configurations for tmux sessions and runs scripts for development
