import { AI_MODELS, API_ENDPOINTS } from '../core/config.js';

export default class AIProvider {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4o-mini';
    this.endpoint = config.endpoint;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
    if (this.endpoint.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://csp-helper.local';
      headers['X-Title'] = 'CSP Helper';
    }
    return headers;
  }

  async chat(messages, options = {}) {
    const body = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = JSON.parse(responseText);
        errorMessage = errorBody.error?.message || errorBody.error || errorMessage;
      } catch {}
      throw new Error(`AI API Error: ${errorMessage}`);
    }

    const data = JSON.parse(responseText);
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response format');
    }
    return data.choices[0].message.content;
  }

  async stream(messages, onChunk, options = {}) {
    const body = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      stream: true
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errData = JSON.parse(text);
        errorMsg = errData.error?.message || errData.message || errorMsg;
      } catch {}
      throw new Error(`AI API Error: ${errorMsg}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch {}
        }
      }
    }
  }
}
