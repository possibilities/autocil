# AUTOCIL Commands and Guidelines

This project generates teamocil YAML configurations for tmux sessions and runs scripts for development

## Build/Test Commands
- Install: `npm install`
- Install globally: `npm link`
- Run locally: `ts-node src/index.ts [directory1] [directory2] ... [--name session-name]` (Note: --name cannot be used with multiple directories)
- Typecheck: `npx tsc --noEmit`
- Format: `npx prettier --write "src/**/*.ts"`

## Code Style Guidelines
- **Imports**: Group by built-in Node modules, then external deps, then local files
- **Formatting**: Use Prettier with default settings, 2-space indentation
- **Types**: Use strict TypeScript typing with explicit return types on functions
- **Naming**: camelCase for variables/functions, PascalCase for types/interfaces
- **Error Handling**: Use try/catch with explicit error messages and appropriate exit codes
- **Comments**: Never add comments. Use explanatory symbol names instead.
- **Structure**: Single-purpose functions with descriptive names (< 50 lines each)
- **Exports**: Prefer named exports over default exports

## Best practices
- As needed update readme.md and CLAUDE.md files after making changes
- Always run prettier after making changes or adding files
- Offer to create a commit after making changes
