import { z } from "zod";

export interface AiProvider {
  generateObject<T>(input: { system: string; prompt: string; schema: z.ZodType<T> }): Promise<T>;
}

const ChatResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1),
});

export class OpenAiCompatibleProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly endpoint = "https://api.openai.com/v1/chat/completions",
  ) {}

  async generateObject<T>({ system, prompt, schema }: { system: string; prompt: string; schema: z.ZodType<T> }): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
    const content = ChatResponseSchema.parse(await response.json()).choices[0]!.message.content;
    return schema.parse(JSON.parse(content));
  }
}

export function configuredAiProvider(): AiProvider | null {
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!key || !model) return null;
  return new OpenAiCompatibleProvider(key, model, process.env.AI_API_URL);
}
