import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { createPlugin } from '../src/plugin';
import { createApiClient } from '../src/client';
import { get } from '../src/helpers';
import { createMockFetch } from './mock-fetch';

describe('plugin methods', () => {
  it('exposes plugin methods on client.plugins', () => {
    const myPlugin = createPlugin(() => ({
      methods: {
        greet: (name: string) => `Hello ${name}`,
      },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { users: get<void, any>('/users') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [myPlugin()],
      }
    );

    expect(client.plugins).toBeDefined();
    expect(typeof client.plugins.greet).toBe('function');
  });

  it('plugin method returns expected value', () => {
    const myPlugin = createPlugin(() => ({
      methods: {
        add: (a: number, b: number) => a + b,
      },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { users: get<void, any>('/users') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [myPlugin()],
      }
    );

    expect(client.plugins.add(2, 3)).toBe(5);
  });

  it('merges methods from multiple plugins', () => {
    const pluginA = createPlugin(() => ({
      methods: {
        foo: () => 'from-a',
      },
    }));

    const pluginB = createPlugin(() => ({
      methods: {
        bar: (x: number) => x * 2,
      },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [pluginA(), pluginB()],
      }
    );

    expect(client.plugins.foo()).toBe('from-a');
    expect(client.plugins.bar(5)).toBe(10);
  });

  it('does not add plugins property when no plugins have methods', () => {
    const hookOnlyPlugin = createPlugin(() => ({
      hooks: {
        beforeRequest: async (url: string, init: RequestInit) => ({ url, init }),
      },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [hookOnlyPlugin()],
      }
    );

    expect((client as any).plugins).toBeUndefined();
  });

  it('does not add plugins property when no plugins provided', () => {
    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
      }
    );

    expect((client as any).plugins).toBeUndefined();
  });

  it('plugin methods can use closure over plugin config', () => {
    const configPlugin = createPlugin((config: { prefix: string }) => ({
      methods: {
        format: (text: string) => `${config.prefix}: ${text}`,
      },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [configPlugin({ prefix: 'LOG' })],
      }
    );

    expect(client.plugins.format('hello')).toBe('LOG: hello');
  });

  it('plugin with methods and hooks coexist', async () => {
    const hookFn = vi.fn(async (url: string, init: RequestInit) => ({ url, init }));

    const dualPlugin = createPlugin(() => ({
      hooks: { beforeRequest: hookFn },
      methods: {
        getStatus: () => 'active',
      },
    }));

    const mockFetch = createMockFetch({ body: {} });
    const client = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [dualPlugin()],
      }
    );

    // Methods work
    expect(client.plugins.getStatus()).toBe('active');

    // Hooks still work
    await client.test(undefined as void);
    expect(hookFn).toHaveBeenCalled();
  });

  it('later plugin methods override earlier ones with same name', () => {
    const pluginA = createPlugin(() => ({
      methods: {
        shared: () => 'from-a',
      },
    }));

    const pluginB = createPlugin(() => ({
      methods: {
        shared: () => 'from-b',
      },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [pluginA(), pluginB()],
      }
    );

    // Object.assign behavior: last plugin wins
    expect((client.plugins as any).shared()).toBe('from-b');
  });

  it('plugin methods work alongside normal endpoint calls', async () => {
    const myPlugin = createPlugin(() => ({
      methods: {
        getVersion: () => '1.0.0',
      },
    }));

    const mockFetch = createMockFetch({ body: [{ id: 1 }] });
    const client = createApiClient(
      { users: get<void, { id: number }[]>('/users') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [myPlugin()],
      }
    );

    // Plugin method works
    expect(client.plugins.getVersion()).toBe('1.0.0');

    // Endpoint still works
    const users = await client.users(undefined as void);
    expect(users).toEqual([{ id: 1 }]);
  });

  it('async plugin methods work correctly', async () => {
    const asyncPlugin = createPlugin(() => ({
      methods: {
        fetchData: async () => ({ result: 42 }),
      },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [asyncPlugin()],
      }
    );

    const data = await client.plugins.fetchData();
    expect(data).toEqual({ result: 42 });
  });
});

describe('plugin methods type-level tests', () => {
  it('infers plugin method types correctly', () => {
    const myPlugin = createPlugin(() => ({
      methods: {
        greet: (name: string) => `Hello ${name}`,
        add: (a: number, b: number) => a + b,
      },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { users: get<void, { id: number }[]>('/users') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [myPlugin()],
      }
    );

    expectTypeOf(client.plugins.greet).toBeFunction();
    expectTypeOf(client.plugins.add).toBeFunction();
    expectTypeOf(client.plugins.greet('test')).toBeString();
    expectTypeOf(client.plugins.add(1, 2)).toBeNumber();
  });

  it('merges method types from multiple plugins', () => {
    const pluginA = createPlugin(() => ({
      methods: { foo: () => 'a' as const },
    }));
    const pluginB = createPlugin(() => ({
      methods: { bar: (x: number) => x * 2 },
    }));

    const mockFetch = createMockFetch({ body: 'ok' });
    const client = createApiClient(
      { test: get<void, string>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [pluginA(), pluginB()],
      }
    );

    expectTypeOf(client.plugins.foo).toBeFunction();
    expectTypeOf(client.plugins.bar).toBeFunction();
    expectTypeOf(client.plugins.bar(5)).toBeNumber();
  });

  it('endpoint types are preserved alongside plugin methods', () => {
    const myPlugin = createPlugin(() => ({
      methods: { version: () => '1.0' },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      {
        getUsers: get<void, { id: number; name: string }[]>('/users'),
        createUser: get<{ name: string }, { id: number }>('/users'),
      },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [myPlugin()],
      }
    );

    expectTypeOf(client.getUsers).toBeFunction();
    expectTypeOf(client.createUser).toBeFunction();
    expectTypeOf(client.plugins.version).toBeFunction();
  });
});
