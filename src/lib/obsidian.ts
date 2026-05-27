export interface ObsidianConnectionConfig {
  host: string;
  port: number;
  apiKey?: string;
}

export interface ObsidianFile {
  path: string;
  content?: string;
  stat?: {
    ctime: number;
    mtime: number;
    size: number;
  };
}

export interface SearchResult {
  path: string;
  content: string;
  score?: number;
}

const DEFAULT_CONFIG: ObsidianConnectionConfig = {
  host: 'localhost',
  port: 27124,
};

export class ObsidianClient {
  private config: ObsidianConnectionConfig;

  constructor(config?: Partial<ObsidianConnectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private get baseUrl() {
    return `http://${this.config.host}:${this.config.port}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Obsidian API error ${res.status}: ${text || res.statusText}`);
    }

    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  async health(): Promise<boolean> {
    try {
      await this.request<unknown>('GET', '/');
      return true;
    } catch {
      return false;
    }
  }

  async readNote(path: string): Promise<string> {
    const result = await this.request<ObsidianFile>('GET', `/vault/${encodeURIComponent(path)}`);
    return result.content ?? '';
  }

  async writeNote(path: string, content: string): Promise<void> {
    await this.request('PUT', `/vault/${encodeURIComponent(path)}`, { content });
  }

  async appendNote(path: string, content: string): Promise<void> {
    const existing = await this.readNote(path).catch(() => '');
    await this.writeNote(path, existing ? `${existing}\n\n${content}` : content);
  }

  async deleteNote(path: string): Promise<void> {
    await this.request('DELETE', `/vault/${encodeURIComponent(path)}`);
  }

  async listFiles(dir?: string): Promise<string[]> {
    const path = dir ? `/vault/${encodeURIComponent(dir)}/` : '/vault/';
    const result = await this.request<{ files: string[] }>('GET', path);
    return result.files ?? [];
  }

  async search(query: string): Promise<SearchResult[]> {
    const result = await this.request<{ results: SearchResult[] }>(
      'POST', '/search/simple/', { query }
    );
    return result.results ?? [];
  }

  async getActiveFile(): Promise<string | null> {
    try {
      const result = await this.request<{ file: string }>('GET', '/active');
      return result.file ?? null;
    } catch {
      return null;
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await this.request('GET', `/vault/${encodeURIComponent(path)}`);
      return true;
    } catch {
      return false;
    }
  }
}
