import * as vscode from "vscode";
import { FileScanner } from "./filesystem/scanner";
import { createFile, createFolder, renameUri } from "./filesystem/fileOperations";
import { AIRouter } from "./ai/AIRouter";
import { ManagerPanel } from "./webview/ManagerPanel";
import { ProjectNode } from "./types";

let lastRoot: vscode.Uri | undefined;
let lastTree: ProjectNode | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const scanner = new FileScanner();
  const ai = new AIRouter(context);

  const getRoot = (resource?: vscode.Uri): vscode.Uri | undefined => {
    if (resource) {
      const workspace = vscode.workspace.getWorkspaceFolder(resource);
      return workspace?.uri ?? resource;
    }
    return vscode.workspace.workspaceFolders?.[0]?.uri;
  };

  const scan = async (resource?: vscode.Uri): Promise<ProjectNode | undefined> => {
    const root = getRoot(resource);
    if (!root) {
      vscode.window.showWarningMessage("Open a workspace or folder first.");
      return undefined;
    }

    const cfg = vscode.workspace.getConfiguration("codeweave");
    const tree = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "CodeWeave: Scanning project..." },
      () => scanner.scan(root, {
        respectGitignore: cfg.get<boolean>("respectGitignore", true),
        useFrameworkIgnores: cfg.get<boolean>("useFrameworkIgnores", true),
        showIgnored: cfg.get<boolean>("showIgnoredInSelector", false),
        maxDepth: cfg.get<number>("maxDepth", 20)
      })
    );

    lastRoot = root;
    lastTree = tree;
    return tree;
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("codeweave.generateTree", async (resource?: vscode.Uri) => {
      const tree = await scan(resource);
      if (!tree) return;

      const panel = new ManagerPanel(context.extensionUri);
      panel.show(tree, async (relativePath, newName) => {
        const target = vscode.Uri.joinPath(lastRoot!, ...relativePath.split("/"));
        await renameUri(target, newName);
        lastTree = await scan(lastRoot);
      });
    }),

    vscode.commands.registerCommand("codeweave.openManager", async (resource?: vscode.Uri) => {
      const tree = await scan(resource);
      if (!tree) return;
      const panel = new ManagerPanel(context.extensionUri);
      panel.show(tree, async (relativePath, newName) => {
        const target = vscode.Uri.joinPath(lastRoot!, ...relativePath.split("/"));
        await renameUri(target, newName);
        lastTree = await scan(lastRoot);
      });
    }),

    vscode.commands.registerCommand("codeweave.renamePath", async (resource?: vscode.Uri) => {
      const uri = resource ?? vscode.window.activeTextEditor?.document.uri;
      if (!uri) {
        vscode.window.showWarningMessage("Select a file or folder first.");
        return;
      }
      const oldName = uri.path.split("/").pop() ?? "";
      const newName = await vscode.window.showInputBox({ prompt: "New file/folder name", value: oldName });
      if (!newName || newName === oldName) return;
      await renameUri(uri, newName);
      vscode.window.showInformationMessage(`Renamed ${oldName} → ${newName}`);
    }),

    vscode.commands.registerCommand("codeweave.createFile", async (resource?: vscode.Uri) => {
      const parent = await resolveDirectory(resource);
      if (!parent) return;
      const name = await vscode.window.showInputBox({ prompt: "File name, e.g. src/example.ts" });
      if (!name) return;
      const content = await vscode.window.showInputBox({ prompt: "Initial content (optional)" }) ?? "";
      const target = await createFile(parent, name, content);
      const doc = await vscode.workspace.openTextDocument(target);
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("codeweave.createFolder", async (resource?: vscode.Uri) => {
      const parent = await resolveDirectory(resource);
      if (!parent) return;
      const name = await vscode.window.showInputBox({ prompt: "Folder name" });
      if (!name) return;
      await createFolder(parent, name);
      vscode.window.showInformationMessage(`Created folder ${name}`);
    }),

    vscode.commands.registerCommand("codeweave.aiTransform", async (resource?: vscode.Uri) => {
      const editor = vscode.window.activeTextEditor;
      const uri = resource ?? editor?.document.uri;
      if (!uri) {
        vscode.window.showWarningMessage("Open or select a source file first.");
        return;
      }

      let source = "";
      let language = "";
      if (editor && editor.document.uri.toString() === uri.toString()) {
        source = editor.selection.isEmpty
          ? editor.document.getText()
          : editor.document.getText(editor.selection);
        language = editor.document.languageId;
      } else {
        const bytes = await vscode.workspace.fs.readFile(uri);
        source = Buffer.from(bytes).toString("utf8");
        language = guessLanguage(uri.path);
      }

      const targetLanguage = await vscode.window.showInputBox({
        prompt: "Target language/framework or transformation",
        placeHolder: "e.g. Python, TypeScript + React, Kotlin, Spring Boot"
      });
      if (!targetLanguage) return;

      const instruction = await vscode.window.showInputBox({
        prompt: "What should CodeWeave do?",
        value: `Convert the selected code to ${targetLanguage}. Preserve behavior and explain important compatibility changes.`
      });
      if (!instruction) return;

      const cfg = vscode.workspace.getConfiguration("codeweave");
      const maxChars = cfg.get<number>("maxAiContextChars", 60000);
      const clipped = source.length > maxChars ? source.slice(0, maxChars) + "\n/* Context truncated by CodeWeave. */" : source;

      if (cfg.get<boolean>("confirmAiFileSend", true)) {
        const confirm = await vscode.window.showWarningMessage(
          `CodeWeave will send ${Math.min(source.length, maxChars).toLocaleString()} characters to your configured AI provider.`,
          { modal: true },
          "Continue"
        );
        if (confirm !== "Continue") return;
      }

      const prompt = [
        "You are CodeWeave AI, a careful software transformation assistant.",
        instruction,
        `Source language: ${language}`,
        `Target: ${targetLanguage}`,
        "Return only the transformed code in a single fenced code block. Do not include a second code block.",
        "",
        "SOURCE:",
        "```",
        clipped,
        "```"
      ].join("\n");

      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "CodeWeave AI: Transforming..." },
        () => ai.generate({ prompt, context: clipped, language })
      );

      const cleaned = extractCode(result);
      const targetName = await vscode.window.showInputBox({
        prompt: "Output file name (leave blank to show result in a new editor)",
        value: ""
      });

      if (targetName) {
        const parent = vscode.Uri.joinPath(uri, "..");
        const target = vscode.Uri.joinPath(parent, targetName);
        await vscode.workspace.fs.writeFile(target, Buffer.from(cleaned, "utf8"));
        const doc = await vscode.workspace.openTextDocument(target);
        await vscode.window.showTextDocument(doc);
      } else {
        const doc = await vscode.workspace.openTextDocument({ content: cleaned, language });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      }
    }),

    vscode.commands.registerCommand("codeweave.aiGenerateFile", async (resource?: vscode.Uri) => {
      const parent = await resolveDirectory(resource);
      if (!parent) return;

      const fileName = await vscode.window.showInputBox({
        prompt: "File to generate",
        placeHolder: "e.g. UserController.java"
      });
      if (!fileName) return;

      const request = await vscode.window.showInputBox({
        prompt: "Describe what the file should contain",
        placeHolder: "Create a REST controller for User CRUD..."
      });
      if (!request) return;

      const cfg = vscode.workspace.getConfiguration("codeweave");
      if (cfg.get<boolean>("confirmAiFileSend", true)) {
        const confirm = await vscode.window.showWarningMessage(
          "CodeWeave will send your generation prompt to the configured AI provider.",
          { modal: true },
          "Continue"
        );
        if (confirm !== "Continue") return;
      }

      const prompt = [
        "You are CodeWeave AI.",
        `Generate production-quality code for the file: ${fileName}`,
        request,
        "Return only the file contents. Do not wrap the answer in markdown fences."
      ].join("\n");

      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "CodeWeave AI: Generating..." },
        () => ai.generate({ prompt, context: "" })
      );

      const target = await createFile(parent, fileName, extractCode(result));
      const doc = await vscode.workspace.openTextDocument(target);
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("codeweave.configureAi", () => ai.configure())
  );
}

async function resolveDirectory(resource?: vscode.Uri): Promise<vscode.Uri | undefined> {
  if (resource) {
    const stat = await vscode.workspace.fs.stat(resource);
    return stat.type === vscode.FileType.Directory ? resource : vscode.Uri.joinPath(resource, "..");
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

function guessLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescriptreact", js: "javascript", jsx: "javascriptreact",
    java: "java", py: "python", cs: "csharp", cpp: "cpp", c: "c",
    go: "go", rs: "rust", kt: "kotlin", swift: "swift", php: "php",
    rb: "ruby", dart: "dart", json: "json", html: "html", css: "css",
    sql: "sql", sh: "shellscript", yaml: "yaml", yml: "yaml"
  };
  return map[ext ?? ""] ?? "plaintext";
}

function extractCode(text: string): string {
  const match = text.match(/```(?:[^\n]*)\n([\s\S]*?)```/);
  return (match ? match[1] : text).trim() + "\n";
}

export function deactivate(): void {}
