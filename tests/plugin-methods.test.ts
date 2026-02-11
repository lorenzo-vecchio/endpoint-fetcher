import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { createPlugin } from '../src/plugin';
import { createApiClient } from '../src/client';
import { get } from '../src/helpers';
import { createMockFetch } from './mock-fetch';

describe('plugin methods', () => {
  it('exposes plugin methods grouped by plugin name', () => {
    const myPlugin = createPlugin('myPlugin', () => ({
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
    expect(client.plugins.myPlugin).toBeDefined();
    expect(typeof client.plugins.myPlugin.greet).toBe('function');
  });

  it('plugin method returns expected value', () => {
    const myPlugin = createPlugin('myPlugin', () => ({
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

    expect(client.plugins.myPlugin.add(2, 3)).toBe(5);
  });

  it('groups methods from multiple plugins separately', () => {
    const pluginA = createPlugin('pluginA', () => ({
      methods: {
        foo: () => 'from-a',
      },
    }));

    const pluginB = createPlugin('pluginB', () => ({
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

    expect(client.plugins.pluginA.foo()).toBe('from-a');
    expect(client.plugins.pluginB.bar(5)).toBe(10);
  });

  it('does not add plugins property when no plugins have methods', () => {
    const hookOnlyPlugin = createPlugin('hookOnly', () => ({
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
    const configPlugin = createPlugin('config', (config: { prefix: string }) => ({
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

    expect(client.plugins.config.format('hello')).toBe('LOG: hello');
  });

  it('plugin with methods and hooks coexist', async () => {
    const hookFn = vi.fn(async (url: string, init: RequestInit) => ({ url, init }));

    const dualPlugin = createPlugin('dual', () => ({
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
    expect(client.plugins.dual.getStatus()).toBe('active');

    // Hooks still work
    await client.test(undefined as void);
    expect(hookFn).toHaveBeenCalled();
  });

  it('methods with same name in different plugins are kept separate', () => {
    const pluginA = createPlugin('pluginA', () => ({
      methods: {
        shared: () => 'from-a',
      },
    }));

    const pluginB = createPlugin('pluginB', () => ({
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

    // Methods are now grouped by plugin, so both can coexist
    expect(client.plugins.pluginA.shared()).toBe('from-a');
    expect(client.plugins.pluginB.shared()).toBe('from-b');
  });

  it('plugin methods work alongside normal endpoint calls', async () => {
    const myPlugin = createPlugin('myPlugin', () => ({
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
    expect(client.plugins.myPlugin.getVersion()).toBe('1.0.0');

    // Endpoint still works
    const users = await client.users(undefined as void);
    expect(users).toEqual([{ id: 1 }]);
  });

  it('async plugin methods work correctly', async () => {
    const asyncPlugin = createPlugin('asyncPlugin', () => ({
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

    const data = await client.plugins.asyncPlugin.fetchData();
    expect(data).toEqual({ result: 42 });
  });
});

describe('plugin methods type-level tests', () => {
  it('infers plugin method types correctly', () => {
    const myPlugin = createPlugin('myPlugin', () => ({
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

    expectTypeOf(client.plugins.myPlugin.greet).toBeFunction();
    expectTypeOf(client.plugins.myPlugin.add).toBeFunction();
    expectTypeOf(client.plugins.myPlugin.greet('test')).toBeString();
    expectTypeOf(client.plugins.myPlugin.add(1, 2)).toBeNumber();
  });

  it('merges method types from multiple plugins', () => {
    const pluginA = createPlugin('pluginA', () => ({
      methods: { foo: () => 'a' as const },
    }));
    const pluginB = createPlugin('pluginB', () => ({
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

    expectTypeOf(client.plugins.pluginA.foo).toBeFunction();
    expectTypeOf(client.plugins.pluginB.bar).toBeFunction();
    expectTypeOf(client.plugins.pluginB.bar(5)).toBeNumber();
  });

  it('endpoint types are preserved alongside plugin methods', () => {
    const myPlugin = createPlugin('myPlugin', () => ({
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
    expectTypeOf(client.plugins.myPlugin.version).toBeFunction();
  });
});

describe('named plugins', () => {
  it('groups methods by plugin name', () => {
    const metricsPlugin = createPlugin('metrics', () => ({
      methods: {
        getMetrics: () => 'data',
        reset: () => true,
      },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [metricsPlugin()],
      }
    );

    expect(client.plugins.metrics).toBeDefined();
    expect(typeof client.plugins.metrics.getMetrics).toBe('function');
    expect(typeof client.plugins.metrics.reset).toBe('function');
    expect(client.plugins.metrics.getMetrics()).toBe('data');
    expect(client.plugins.metrics.reset()).toBe(true);
  });

  it('works with multiple plugins', () => {
    const authPlugin = createPlugin('auth', () => ({
      methods: { login: () => 'logged-in' },
    }));

    const helperPlugin = createPlugin('helper', () => ({
      methods: { helper: () => 'help' },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [authPlugin(), helperPlugin()],
      }
    );

    expect(client.plugins.auth.login()).toBe('logged-in');
    expect(client.plugins.helper.helper()).toBe('help');
  });

  it('throws error on duplicate plugin names', () => {
    const plugin1 = createPlugin('cache', () => ({
      methods: { get: () => 'data1' },
    }));

    const plugin2 = createPlugin('cache', () => ({
      methods: { set: () => true },
    }));

    const mockFetch = createMockFetch({ body: [] });
    
    expect(() => {
      createApiClient(
        { test: get<void, any>('/test') },
        {
          baseUrl: 'https://api.example.com',
          fetch: mockFetch,
          plugins: [plugin1(), plugin2()],
        }
      );
    }).toThrow('Duplicate plugin name: "cache"');
  });

  it('preserves plugin order', () => {
    const plugin1 = createPlugin('plugin1', () => ({
      methods: { a: () => 'a' },
    }));

    const plugin2 = createPlugin('plugin2', () => ({
      methods: { b: () => 'b' },
    }));

    const plugin3 = createPlugin('plugin3', () => ({
      methods: { c: () => 'c' },
    }));

    const mockFetch = createMockFetch({ body: [] });
    const client = createApiClient(
      { test: get<void, any>('/test') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [plugin1(), plugin2(), plugin3()],
      }
    );

    expect(client.plugins.plugin1.a()).toBe('a');
    expect(client.plugins.plugin2.b()).toBe('b');
    expect(client.plugins.plugin3.c()).toBe('c');
  });
});
