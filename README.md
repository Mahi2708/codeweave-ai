# CodeWeave AI

CodeWeave AI is a VS Code extension for two connected jobs:

1. Project structure management — scan a workspace, respect `.gitignore`, apply common framework/dependency exclusions, select files/folders, generate a tree, and rename/create files and folders.
2. AI code transformation — use OpenAI, Gemini, or OpenRouter to generate or convert code.

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

## Run locally

```bash
npm install
npm run compile
```

Open this folder in VS Code and press `F5`.

Then open a test project and run:

`CodeWeave: Generate Project Tree`

## AI setup

Run:

`CodeWeave: Configure AI Provider`

Then choose the provider in Settings:

`codeweave.aiProvider`

Set:

`codeweave.aiModel`

Examples are provider-dependent. OpenRouter accepts provider/model slugs; Gemini and OpenAI require models available to your account.

## Package

```bash
npm run package
```

This creates a `.vsix` file. Install it with:

```bash
code --install-extension codeweave-ai-0.1.0.vsix
```

## Security

CodeWeave asks before sending source code to an external AI provider by default. Never commit API keys. Keys are stored in VS Code SecretStorage.

