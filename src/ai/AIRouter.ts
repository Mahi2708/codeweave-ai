import * as vscode from "vscode";
import { AIProvider, AIRequest } from "../types";
import { GeminiProvider } from "./providers/GeminiProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { OpenRouterProvider } from "./providers/OpenRouterProvider";

const SECRET_KEYS: Record<string, string> = {
  openai: "codeweave.openaiApiKey",
  gemini: "codeweave.geminiApiKey",
  openrouter: "codeweave.openrouterApiKey"
};

export class AIRouter {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async configure(): Promise<void> {
    const provider = vscode.workspace.getConfiguration("codeweave").get<string>("aiProvider", "openrouter");
    const secretKey = SECRET_KEYS[provider];
    const current = await this.context.secrets.get(secretKey);
    const key = await vscode.window.showInputBox({
      prompt: `Enter your ${provider} API key`,
      password: true,
      ignoreFocusOut: true,
      value: current ?? ""
    });
    if (key !== undefined) {
      await this.context.secrets.store(secretKey, key.trim());
      vscode.window.showInformationMessage(`${provider} API key saved securely in VS Code SecretStorage.`);
    }
  }

  async generate(request: AIRequest): Promise<string> {
    const config = vscode.workspace.getConfiguration("codeweave");
    const providerId = config.get<string>("aiProvider", "openrouter");
    const model = config.get<string>("aiModel", "openrouter/free");

    const secretKey = SECRET_KEYS[providerId];
    const apiKey = await this.context.secrets.get(secretKey);
    if (!apiKey) {
      throw new Error(`No ${providerId} API key is configured. Run "CodeWeave: Configure AI Provider".`);
    }

    let provider: AIProvider;
    switch (providerId) {
      case "openai":
        provider = new OpenAIProvider(apiKey);
        break;
      case "gemini":
        provider = new GeminiProvider(apiKey);
        break;
      default:
        provider = new OpenRouterProvider(apiKey);
    }

    return provider.generate(request, model);
  }
}
