import { LLMProvider, LLMInput, LLMOutput } from '../base';

export class OpenAIProvider implements LLMProvider {
  name = 'OpenAI';
  type = 'llm' as const;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, options?: { baseUrl?: string; model?: string }) {
    this.apiKey = apiKey;
    this.baseUrl = options?.baseUrl || 'https://api.openai.com/v1';
    this.model = options?.model || 'gpt-4o-mini';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generate(input: LLMInput): Promise<LLMOutput> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async generateStream(
    input: LLMInput,
    onChunk: (chunk: string) => void
  ): Promise<LLMOutput> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content || '';
          if (content) {
            fullContent += content;
            onChunk(content);
          }
        } catch {
          // Ignore parse errors for incomplete chunks
        }
      }
    }

    return { content: fullContent };
  }
}
