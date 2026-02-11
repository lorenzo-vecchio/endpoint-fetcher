import { describe, it, expect } from 'vitest';
import { endpoint, group, get, post, put, patch, del } from '../src/helpers';

describe('endpoint', () => {
  it('returns the config object as-is', () => {
    const config = { method: 'GET' as const, path: '/users' };
    expect(endpoint(config)).toBe(config);
  });

  it('preserves all properties', () => {
    const handler = async () => ({});
    const hooks = { beforeRequest: async (url: string, init: RequestInit) => ({ url, init }) };
    const config = { method: 'POST' as const, path: '/users', handler, hooks };
    const result = endpoint(config);
    expect(result.method).toBe('POST');
    expect(result.path).toBe('/users');
    expect(result.handler).toBe(handler);
    expect(result.hooks).toBe(hooks);
  });
});

describe('group', () => {
  it('returns the group config as-is', () => {
    const config = {
      endpoints: {
        list: { method: 'GET' as const, path: '/items' },
      },
    };
    const result = group(config);
    expect(result).toBe(config);
  });

  it('preserves hooks and nested groups', () => {
    const config = {
      hooks: { onError: async () => {} },
      endpoints: { list: { method: 'GET' as const, path: '/items' } },
      groups: {
        nested: { endpoints: { get: { method: 'GET' as const, path: '/nested' } } },
      },
    };
    const result = group(config);
    expect(result.hooks).toBeDefined();
    expect(result.endpoints).toBeDefined();
    expect(result.groups).toBeDefined();
  });
});

describe('get', () => {
  it('creates endpoint config with GET method', () => {
    const result = get('/users');
    expect(result.method).toBe('GET');
    expect(result.path).toBe('/users');
  });

  it('supports function path', () => {
    const result = get<{ id: number }, any>((input) => `/users/${input.id}`);
    expect(result.method).toBe('GET');
    expect(typeof result.path).toBe('function');
    expect((result.path as Function)({ id: 42 })).toBe('/users/42');
  });

  it('supports optional handler', () => {
    const handler = async () => ({ data: true });
    const result = get('/users', handler);
    expect(result.handler).toBe(handler);
  });

  it('supports optional hooks', () => {
    const hooks = { beforeRequest: async (url: string, init: RequestInit) => ({ url, init }) };
    const result = get('/users', undefined, hooks);
    expect(result.hooks).toBe(hooks);
  });
});

describe('post', () => {
  it('creates endpoint config with POST method', () => {
    const result = post('/users');
    expect(result.method).toBe('POST');
    expect(result.path).toBe('/users');
  });

  it('supports function path', () => {
    const result = post<{ id: number }, any>((input) => `/users/${input.id}`);
    expect(typeof result.path).toBe('function');
  });
});

describe('put', () => {
  it('creates endpoint config with PUT method', () => {
    const result = put('/users');
    expect(result.method).toBe('PUT');
    expect(result.path).toBe('/users');
  });

  it('supports function path', () => {
    const result = put<{ id: number }, any>((input) => `/users/${input.id}`);
    expect(typeof result.path).toBe('function');
  });
});

describe('patch', () => {
  it('creates endpoint config with PATCH method', () => {
    const result = patch('/users');
    expect(result.method).toBe('PATCH');
    expect(result.path).toBe('/users');
  });

  it('supports function path', () => {
    const result = patch<{ id: number }, any>((input) => `/users/${input.id}`);
    expect(typeof result.path).toBe('function');
  });
});

describe('del', () => {
  it('creates endpoint config with DELETE method', () => {
    const result = del('/users');
    expect(result.method).toBe('DELETE');
    expect(result.path).toBe('/users');
  });

  it('supports function path', () => {
    const result = del<{ id: number }, any>((input) => `/users/${input.id}`);
    expect(typeof result.path).toBe('function');
  });
});
