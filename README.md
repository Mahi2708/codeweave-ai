# Editree AI

Editree AI is a VS Code extension for two connected jobs:

1. **Project structure management** — scan a workspace, respect `.gitignore`, apply common framework/dependency exclusions, select files/folders, generate a project tree, and rename/create files and folders.

2. **AI code transformation** — use OpenAI, Gemini, or OpenRouter to generate or transform code.

## Current MVP

- Project tree scanner
- `.gitignore` support
- Common generated/dependency/cache exclusions
- Select-all / clear selection
- Markdown tree generation + clipboard copy
- File/folder rename
- File/folder creation
- AI file generation
- AI selected-file/selection transformation
- OpenAI, Gemini, and OpenRouter provider adapters
- API keys stored with VS Code SecretStorage
- Configurable provider/model and AI confirmation

## Run Locally

```bash
npm install
npm run compile