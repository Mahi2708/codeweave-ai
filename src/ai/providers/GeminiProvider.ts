import { AIProvider, AIRequest } from "../../types";

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly label = "Gemini";

  constructor(private readonly apiKey: string) {}

  async generate(request: AIRequest, model: string): Promise<string> {
    const safeModel = model.startsWith("models/") ? model : `models/${model}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${safeModel}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": this.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: request.prompt }]
          }
        ]
      })
    });

    const data: any = await response.json();
    if (!response.ok) throw new Error(data?.error?.message ?? `Gemini request failed (${response.status}).`);

    return (data?.candidates ?? [])
      .flatMap((candidate: any) => candidate?.content?.parts ?? [])
      .map((part: any) => part?.text)
      .filter(Boolean)
      .join("\n");
  }
}
