import { AIProvider, AIRequest } from "../../types";

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly label = "OpenAI";

  constructor(private readonly apiKey: string) {}

  async generate(request: AIRequest, model: string): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: request.prompt }]
          }
        ]
      })
    });

    const data: any = await response.json();
    if (!response.ok) throw new Error(data?.error?.message ?? `OpenAI request failed (${response.status}).`);

    if (typeof data.output_text === "string") return data.output_text;

    const parts: string[] = [];
    for (const item of data.output ?? []) {
      for (const content of item.content ?? []) {
        if (typeof content.text === "string") parts.push(content.text);
      }
    }
    return parts.join("\n").trim();
  }
}
