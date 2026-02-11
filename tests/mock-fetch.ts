import { vi } from 'vitest';

export type MockResponseConfig = {
  status?: number;
  statusText?: string;
  body?: any;
  headers?: Record<string, string>;
};

export function createMockFetch(defaultResponse?: MockResponseConfig) {
  const config = {
    status: 200,
    statusText: 'OK',
    body: {},
    headers: {},
    ...defaultResponse,
  };

  const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return new Response(JSON.stringify(config.body), {
      status: config.status,
      statusText: config.statusText,
      headers: { 'Content-Type': 'application/json', ...config.headers },
    });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

  return mockFetch;
}

export function createMockFetchSequence(responses: MockResponseConfig[]) {
  let callIndex = 0;
  const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const config = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return new Response(JSON.stringify(config.body ?? {}), {
      status: config.status ?? 200,
      statusText: config.statusText ?? 'OK',
      headers: { 'Content-Type': 'application/json', ...(config.headers ?? {}) },
    });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

  return mockFetch;
}

export function createFailingFetch(error: Error = new Error('Network error')) {
  const mockFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    throw error;
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

  return mockFetch;
}
