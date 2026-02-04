import { LLMProvider, LLMInput, LLMOutput, LLMMessage } from '../base';

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export class GeminiProvider implements LLMProvider {
  name = 'Google Gemini';
  type = 'llm' as const;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, options?: { model?: string }) {
    this.apiKey = apiKey;
    this.model = options?.model || 'gemini-1.5-flash';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  private convertMessages(messages: LLMMessage[]): { contents: GeminiContent[]; systemInstruction?: { parts: { text: string }[] } } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    const contents: GeminiContent[] = otherMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const result: { contents: GeminiContent[]; systemInstruction?: { parts: { text: string }[] } } = { contents };

    if (systemMessages.length > 0) {
      result.systemInstruction = {
        parts: [{ text: systemMessages.map((m) => m.content).join('\n') }],
      };
    }

    return result;
  }

  async generate(input: LLMInput): Promise<LLMOutput> {
    const { contents, systemInstruction } = this.convertMessages(input.messages);

    const response = await fetch(
      `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: {
            temperature: input.temperature ?? 0.7,
            maxOutputTokens: input.maxTokens ?? 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';

    return {
      content,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  }

  async generateStream(
    input: LLMInput,
    onChunk: (chunk: string) => void
  ): Promise<LLMOutput> {
    const { contents, systemInstruction } = this.convertMessages(input.messages);

    const response = await fetch(
      `${this.baseUrl}/models/${this.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: {
            temperature: input.temperature ?? 0.7,
            maxOutputTokens: input.maxTokens ?? 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
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
        if (!data || data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) {
            fullContent += text;
            onChunk(text);
          }
        } catch {
          // Ignore parse errors for incomplete chunks
        }
      }
    }

    return { content: fullContent };
  }
}
