import { LLMProvider, LLMInput, LLMOutput } from '../base';

export class OllamaProvider implements LLMProvider {
  name = 'Ollama';
  type = 'llm' as const;
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, options?: { model?: string }) {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = options?.model || 'qwen2.5:7b';
    console.log('[Ollama] Initialized with baseUrl:', this.baseUrl, 'model:', this.model);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.baseUrl) return false;

    try {
      // Check if Ollama is running by fetching available models
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available models from Ollama
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];

      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }

  async generate(input: LLMInput): Promise<LLMOutput> {
    // Use OpenAI-compatible endpoint with timeout (5 minutes for long generation)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: input.messages,
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      return {
        content: choice?.message?.content || '',
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
            }
          : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Ollama 请求超时，请检查网络连接或稍后重试');
      }
      throw error;
    }
  }

  async generateStream(
    input: LLMInput,
    onChunk: (chunk: string) => void
  ): Promise<LLMOutput> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
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
          const content = parsed.choices?.[0]?.delta?.content || '';
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

  /**
   * Use native Ollama API (alternative to OpenAI-compatible endpoint)
   */
  async generateNative(input: LLMInput): Promise<LLMOutput> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: input.messages,
        options: {
          temperature: input.temperature ?? 0.7,
          num_predict: input.maxTokens,
        },
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content || '',
      usage: data.prompt_eval_count
        ? {
            promptTokens: data.prompt_eval_count || 0,
            completionTokens: data.eval_count || 0,
            totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
          }
        : undefined,
    };
  }
}
