import { describe, it, expect, vi } from 'vitest';
import { createPlugin } from '../src/plugin';
import { createApiClient } from '../src/client';
import { get, endpoint } from '../src/helpers';
import { createMockFetch, createMockFetchSequence } from './mock-fetch';

describe('createPlugin', () => {
  it('creates plugin without config', () => {
    const plugin = createPlugin(() => ({
      hooks: {
        beforeRequest: async (url: string, init: RequestInit) => ({ url, init }),
      },
    }));

    const options = plugin();
    expect(options.hooks).toBeDefined();
    expect(options.hooks!.beforeRequest).toBeDefined();
  });

  it('creates plugin with config', () => {
    const plugin = createPlugin((config: { token: string }) => ({
      hooks: {
        beforeRequest: async (url: string, init: RequestInit) => {
          const headers = new Headers(init.headers);
          headers.set('Authorization', `Bearer ${config.token}`);
          return { url, init: { ...init, headers } };
        },
      },
    }));

    const options = plugin({ token: 'my-secret' });
    expect(options.hooks).toBeDefined();
  });
});

describe('plugin hooks integration', () => {
  it('plugin beforeRequest hook modifies headers', async () => {
    const authPlugin = createPlugin((config: { token: string }) => ({
      hooks: {
        beforeRequest: async (url: string, init: RequestInit) => {
          const headers = new Headers(init.headers);
          headers.set('Authorization', `Bearer ${config.token}`);
          return { url, init: { ...init, headers } };
        },
      },
    }));

    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      { getUsers: get<void, any>('/users') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [authPlugin({ token: 'test-token' })],
      }
    );

    await api.getUsers(undefined as void);
    const [, init] = (mockFetch as any).mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-token');
  });
});

describe('plugin handler wrappers', () => {
  it('wraps the default handler', async () => {
    const wrapperFn = vi.fn();
    const wrapperPlugin = createPlugin(() => ({
      handlerWrapper: (originalHandler) => {
        return async (input: any, context: any) => {
          wrapperFn();
          return originalHandler(input, context);
        };
      },
    }));

    const mockFetch = createMockFetch({ body: { wrapped: true } });
    const api = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [wrapperPlugin()],
      }
    );

    const result = await api.test(undefined as void);
    expect(wrapperFn).toHaveBeenCalledOnce();
    expect(result).toEqual({ wrapped: true });
  });

  it('wraps custom handlers', async () => {
    const wrapperFn = vi.fn();
    const wrapperPlugin = createPlugin(() => ({
      handlerWrapper: (originalHandler) => {
        return async (input: any, context: any) => {
          wrapperFn();
          return originalHandler(input, context);
        };
      },
    }));

    const customHandler = vi.fn(async () => ({ custom: true }));
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      {
        test: endpoint<void, any>({
          method: 'GET',
          path: '/test',
          handler: customHandler,
        }),
      },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [wrapperPlugin()],
      }
    );

    const result = await api.test(undefined as void);
    expect(wrapperFn).toHaveBeenCalledOnce();
    expect(customHandler).toHaveBeenCalledOnce();
    expect(result).toEqual({ custom: true });
  });

  it('composes multiple handler wrappers (first plugin wraps innermost)', async () => {
    const order: string[] = [];

    const pluginA = createPlugin(() => ({
      handlerWrapper: (originalHandler) => {
        return async (input: any, context: any) => {
          order.push('A-before');
          const result = await originalHandler(input, context);
          order.push('A-after');
          return result;
        };
      },
    }));

    const pluginB = createPlugin(() => ({
      handlerWrapper: (originalHandler) => {
        return async (input: any, context: any) => {
          order.push('B-before');
          const result = await originalHandler(input, context);
          order.push('B-after');
          return result;
        };
      },
    }));

    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [pluginA(), pluginB()],
      }
    );

    await api.test(undefined as void);
    // Plugin A wraps innermost, Plugin B wraps outermost
    // Execution: B-before -> A-before -> handler -> A-after -> B-after
    expect(order).toEqual(['B-before', 'A-before', 'A-after', 'B-after']);
  });

  it('plugin with both hooks and handler wrapper', async () => {
    const hookFn = vi.fn(async (url: string, init: RequestInit) => ({ url, init }));
    const wrapperFn = vi.fn();

    const dualPlugin = createPlugin(() => ({
      hooks: { beforeRequest: hookFn },
      handlerWrapper: (originalHandler) => {
        return async (input: any, context: any) => {
          wrapperFn();
          return originalHandler(input, context);
        };
      },
    }));

    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [dualPlugin()],
      }
    );

    await api.test(undefined as void);
    expect(hookFn).toHaveBeenCalled();
    expect(wrapperFn).toHaveBeenCalledOnce();
  });

  it('retry-style handler wrapper retries on failure', async () => {
    const retryPlugin = createPlugin((config: { maxRetries: number }) => ({
      handlerWrapper: (originalHandler) => {
        return async (input: any, context: any) => {
          let lastError;
          for (let i = 0; i <= config.maxRetries; i++) {
            try {
              return await originalHandler(input, context);
            } catch (error) {
              lastError = error;
            }
          }
          throw lastError;
        };
      },
    }));

    // First two calls fail, third succeeds
    const mockFetch = createMockFetchSequence([
      { status: 500, statusText: 'Internal Server Error', body: {} },
      { status: 500, statusText: 'Internal Server Error', body: {} },
      { status: 200, body: { success: true } },
    ]);

    const api = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [retryPlugin({ maxRetries: 2 })],
      }
    );

    const result = await api.test(undefined as void);
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
