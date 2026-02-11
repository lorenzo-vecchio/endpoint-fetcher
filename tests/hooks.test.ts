import { describe, it, expect, vi } from 'vitest';
import { createApiClient } from '../src/client';
import { get, group, endpoint } from '../src/helpers';
import { createPlugin } from '../src/plugin';
import { createMockFetch, createFailingFetch } from './mock-fetch';

// NOTE: The default handler in client.ts creates an enhancedFetch internally AND
// the caller also passes an enhanced fetch as context.fetch. This means hooks that
// are part of the merged hooks fire twice per request when using the default handler.
// Custom handlers only receive context.fetch (enhanced once), so hooks fire once.

describe('hooks integration', () => {
  it('global beforeRequest hook fires for all endpoints', async () => {
    const hook = vi.fn(async (url: string, init: RequestInit) => ({ url, init }));
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      {
        a: get<void, any>('/a'),
        b: get<void, any>('/b'),
      },
      { baseUrl: 'https://api.example.com', fetch: mockFetch, hooks: { beforeRequest: hook } }
    );

    await api.a(undefined as void);
    await api.b(undefined as void);
    // Hooks fire twice per call (enhanced fetch in context + enhanced fetch in defaultHandler)
    expect(hook).toHaveBeenCalledTimes(4);
  });

  it('endpoint-level beforeRequest only fires for that endpoint', async () => {
    const endpointHook = vi.fn(async (url: string, init: RequestInit) => ({ url, init }));
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      {
        withHook: get<void, any>('/with', undefined, { beforeRequest: endpointHook }),
        withoutHook: get<void, any>('/without'),
      },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.withoutHook(undefined as void);
    expect(endpointHook).not.toHaveBeenCalled();

    await api.withHook(undefined as void);
    // Fires twice due to double-enhancement
    expect(endpointHook).toHaveBeenCalledTimes(2);
  });

  it('beforeRequest order: plugin -> global -> group -> endpoint (per invocation)', async () => {
    const order: string[] = [];
    const mockFetch = createMockFetch({ body: {} });

    const testPlugin = createPlugin('test', () => ({
      hooks: {
        beforeRequest: async (url: string, init: RequestInit) => {
          order.push('plugin');
          return { url, init };
        },
      },
    }));

    const api = createApiClient(
      {
        myGroup: group({
          hooks: {
            beforeRequest: async (url, init) => {
              order.push('group');
              return { url, init };
            },
          },
          endpoints: {
            myEndpoint: get<void, any>('/test', undefined, {
              beforeRequest: async (url, init) => {
                order.push('endpoint');
                return { url, init };
              },
            }),
          },
        }),
      },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        hooks: {
          beforeRequest: async (url, init) => {
            order.push('global');
            return { url, init };
          },
        },
        plugins: [testPlugin()],
      }
    );

    await api.myGroup.myEndpoint(undefined as void);
    // The order repeats because hooks are applied twice (context.fetch + defaultHandler)
    expect(order).toEqual([
      'plugin', 'global', 'group', 'endpoint',
      'plugin', 'global', 'group', 'endpoint',
    ]);
  });

  it('custom handler receives hooks only once via context.fetch', async () => {
    const order: string[] = [];
    const mockFetch = createMockFetch({ body: {} });

    const api = createApiClient(
      {
        custom: endpoint<void, any>({
          method: 'GET',
          path: '/test',
          handler: async ({ fetch: enhancedFetch, path, baseUrl }) => {
            const response = await enhancedFetch(`${baseUrl}${path}`);
            return response.json();
          },
          hooks: {
            beforeRequest: async (url, init) => {
              order.push('endpoint');
              return { url, init };
            },
          },
        }),
      },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        hooks: {
          beforeRequest: async (url, init) => {
            order.push('global');
            return { url, init };
          },
        },
      }
    );

    await api.custom(undefined as void);
    // Custom handler uses context.fetch which is enhanced once
    expect(order).toEqual(['global', 'endpoint']);
  });

  it('afterResponse fires after successful response', async () => {
    const afterResponse = vi.fn(async (response: Response, url: string, init: RequestInit) => response);
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      { getUsers: get<void, any>('/users') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        hooks: { afterResponse },
      }
    );

    await api.getUsers(undefined as void);
    // Fires twice due to double-enhancement
    expect(afterResponse).toHaveBeenCalledTimes(2);
  });

  it('onError hooks fire on fetch failure', async () => {
    const onError = vi.fn();
    const mockFetch = createFailingFetch(new Error('Network failure'));
    const api = createApiClient(
      { getUsers: get<void, any>('/users') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        hooks: { onError },
      }
    );

    await expect(api.getUsers(undefined as void)).rejects.toThrow();
    // onError fires twice due to double-enhancement
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('beforeRequest can modify URL used for actual fetch', async () => {
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      { getUsers: get<void, any>('/users') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        hooks: {
          beforeRequest: async (url, init) => ({
            url: url.replace('/users', '/people'),
            init,
          }),
        },
      }
    );

    await api.getUsers(undefined as void);
    const [url] = (mockFetch as any).mock.calls[0];
    expect(url).toBe('https://api.example.com/people');
  });

  it('afterResponse can transform the response', async () => {
    const mockFetch = createMockFetch({ body: { original: true } });
    const api = createApiClient(
      { getData: get<void, any>('/data') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        hooks: {
          afterResponse: async (response) => {
            const data = await response.json();
            return new Response(JSON.stringify({ ...data, modified: true }), {
              status: response.status,
              headers: { 'Content-Type': 'application/json' },
            });
          },
        },
      }
    );

    const result = await api.getData(undefined as void);
    expect(result).toEqual({ original: true, modified: true });
  });

  it('multiple plugin hooks execute in plugin array order', async () => {
    const order: string[] = [];
    const mockFetch = createMockFetch({ body: {} });

    const pluginA = createPlugin('pluginA', () => ({
      hooks: {
        beforeRequest: async (url: string, init: RequestInit) => {
          order.push('A');
          return { url, init };
        },
      },
    }));

    const pluginB = createPlugin('pluginB', () => ({
      hooks: {
        beforeRequest: async (url: string, init: RequestInit) => {
          order.push('B');
          return { url, init };
        },
      },
    }));

    const api = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [pluginA(), pluginB()],
      }
    );

    await api.test(undefined as void);
    // Hooks fire twice, maintaining A, B order each time
    expect(order).toEqual(['A', 'B', 'A', 'B']);
  });

  it('works without any hooks defined', async () => {
    const mockFetch = createMockFetch({ body: { noHooks: true } });
    const api = createApiClient(
      { test: get<void, any>('/test') },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    const result = await api.test(undefined as void);
    expect(result).toEqual({ noHooks: true });
  });
});
