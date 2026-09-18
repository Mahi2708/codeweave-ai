import { AIProvider, AIRequest } from "../../types";

export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter";
  readonly label = "OpenRouter";

  constructor(private readonly apiKey: string) {}

  async generate(request: AIRequest, model: string): Promise<string> {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "CodeWeave AI"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: request.prompt }]
      })
    });

    const data: any = await response.json();
    if (!response.ok) throw new Error(data?.error?.message ?? `OpenRouter request failed (${response.status}).`);
    return data?.choices?.[0]?.message?.content ?? "";
  }
}
