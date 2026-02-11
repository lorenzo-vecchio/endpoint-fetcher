import { describe, it, expect, vi } from 'vitest';
import { buildUrl, mergeHooks, createEnhancedFetch } from '../src/utils';
import type { Hooks } from '../src/types';
import { createMockFetch, createFailingFetch } from './mock-fetch';

describe('buildUrl', () => {
  it('combines base URL and path with leading slash', () => {
    expect(buildUrl('/users', 'https://api.example.com')).toBe('https://api.example.com/users');
  });

  it('strips trailing slash from base URL', () => {
    expect(buildUrl('/users', 'https://api.example.com/')).toBe('https://api.example.com/users');
  });

  it('adds leading slash to path if missing', () => {
    expect(buildUrl('users', 'https://api.example.com')).toBe('https://api.example.com/users');
  });

  it('handles base URL with trailing slash and path without leading slash', () => {
    expect(buildUrl('users', 'https://api.example.com/')).toBe('https://api.example.com/users');
  });

  it('handles path with multiple segments', () => {
    expect(buildUrl('/users/123/posts', 'https://api.example.com')).toBe('https://api.example.com/users/123/posts');
  });

  it('handles root path', () => {
    expect(buildUrl('/', 'https://api.example.com')).toBe('https://api.example.com/');
  });
});

describe('mergeHooks', () => {
  it('returns empty object when no hooks provided', () => {
    const result = mergeHooks();
    expect(result).toEqual({});
  });

  it('returns empty object when only undefined hooks provided', () => {
    const result = mergeHooks(undefined, undefined);
    expect(result).toEqual({});
  });

  it('passes through single beforeRequest hook', async () => {
    const hook: Hooks = {
      beforeRequest: async (url, init) => ({ url: url + '?modified=true', init }),
    };
    const merged = mergeHooks(hook);
    const result = await merged.beforeRequest!('https://api.example.com', {});
    expect(result.url).toBe('https://api.example.com?modified=true');
  });

  it('chains multiple beforeRequest hooks in forward order', async () => {
    const order: number[] = [];
    const hook1: Hooks = {
      beforeRequest: async (url, init) => {
        order.push(1);
        return { url: url + '&a=1', init };
      },
    };
    const hook2: Hooks = {
      beforeRequest: async (url, init) => {
        order.push(2);
        return { url: url + '&b=2', init };
      },
    };
    const merged = mergeHooks(hook1, hook2);
    const result = await merged.beforeRequest!('https://api.example.com?x=0', {});
    expect(order).toEqual([1, 2]);
    expect(result.url).toBe('https://api.example.com?x=0&a=1&b=2');
  });

  it('chains afterResponse hooks in reverse order', async () => {
    const order: number[] = [];
    const hook1: Hooks = {
      afterResponse: async (response, url, init) => {
        order.push(1);
        return response;
      },
    };
    const hook2: Hooks = {
      afterResponse: async (response, url, init) => {
        order.push(2);
        return response;
      },
    };
    const merged = mergeHooks(hook1, hook2);
    const response = new Response('test');
    await merged.afterResponse!(response, 'https://api.example.com', {});
    expect(order).toEqual([2, 1]);
  });

  it('chains onError hooks in forward order', async () => {
    const order: number[] = [];
    const hook1: Hooks = {
      onError: async () => { order.push(1); },
    };
    const hook2: Hooks = {
      onError: async () => { order.push(2); },
    };
    const merged = mergeHooks(hook1, hook2);
    await merged.onError!(new Error('test'));
    expect(order).toEqual([1, 2]);
  });

  it('filters out undefined entries', () => {
    const hook: Hooks = {
      beforeRequest: async (url, init) => ({ url, init }),
    };
    const merged = mergeHooks(undefined, hook, undefined);
    expect(merged.beforeRequest).toBeDefined();
    expect(merged.afterResponse).toBeUndefined();
    expect(merged.onError).toBeUndefined();
  });

  it('only merges defined hook types', () => {
    const hook1: Hooks = {
      beforeRequest: async (url, init) => ({ url, init }),
    };
    const hook2: Hooks = {
      onError: async () => {},
    };
    const merged = mergeHooks(hook1, hook2);
    expect(merged.beforeRequest).toBeDefined();
    expect(merged.afterResponse).toBeUndefined();
    expect(merged.onError).toBeDefined();
  });

  it('passes result of one beforeRequest hook to the next', async () => {
    const hook1: Hooks = {
      beforeRequest: async (url, init) => {
        const headers = new Headers(init.headers);
        headers.set('X-First', 'true');
        return { url, init: { ...init, headers } };
      },
    };
    const hook2: Hooks = {
      beforeRequest: async (url, init) => {
        const headers = new Headers(init.headers);
        expect(headers.get('X-First')).toBe('true');
        headers.set('X-Second', 'true');
        return { url, init: { ...init, headers } };
      },
    };
    const merged = mergeHooks(hook1, hook2);
    const result = await merged.beforeRequest!('https://api.example.com', {});
    const headers = new Headers(result.init.headers);
    expect(headers.get('X-First')).toBe('true');
    expect(headers.get('X-Second')).toBe('true');
  });
});

describe('createEnhancedFetch', () => {
  it('delegates to fetch instance when no hooks', async () => {
    const mockFetch = createMockFetch({ body: { ok: true } });
    const enhanced = createEnhancedFetch(mockFetch, {});
    const response = await enhanced('https://api.example.com/test');
    expect(mockFetch).toHaveBeenCalledOnce();
    const data = await response.json();
    expect(data).toEqual({ ok: true });
  });

  it('applies beforeRequest hook to modify URL', async () => {
    const mockFetch = createMockFetch({ body: {} });
    const hooks: Hooks = {
      beforeRequest: async (url, init) => ({ url: url + '?auth=token', init }),
    };
    const enhanced = createEnhancedFetch(mockFetch, hooks);
    await enhanced('https://api.example.com/test');
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test?auth=token', expect.anything());
  });

  it('applies beforeRequest hook to modify init', async () => {
    const mockFetch = createMockFetch({ body: {} });
    const hooks: Hooks = {
      beforeRequest: async (url, init) => ({
        url,
        init: { ...init, headers: { 'Authorization': 'Bearer token' } },
      }),
    };
    const enhanced = createEnhancedFetch(mockFetch, hooks);
    await enhanced('https://api.example.com/test');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/test',
      expect.objectContaining({ headers: { 'Authorization': 'Bearer token' } })
    );
  });

  it('applies afterResponse hook to transform response', async () => {
    const mockFetch = createMockFetch({ body: { original: true } });
    const hooks: Hooks = {
      afterResponse: async (response, url, init) => {
        return new Response(JSON.stringify({ transformed: true }), {
          status: response.status,
          headers: response.headers,
        });
      },
    };
    const enhanced = createEnhancedFetch(mockFetch, hooks);
    const response = await enhanced('https://api.example.com/test');
    const data = await response.json();
    expect(data).toEqual({ transformed: true });
  });

  it('calls onError hook on fetch failure', async () => {
    const error = new Error('Network error');
    const mockFetch = createFailingFetch(error);
    const onError = vi.fn();
    const hooks: Hooks = { onError };
    const enhanced = createEnhancedFetch(mockFetch, hooks);

    await expect(enhanced('https://api.example.com/test')).rejects.toThrow('Network error');
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('re-throws error after onError hook runs', async () => {
    const error = new Error('Connection refused');
    const mockFetch = createFailingFetch(error);
    const hooks: Hooks = { onError: async () => {} };
    const enhanced = createEnhancedFetch(mockFetch, hooks);

    await expect(enhanced('https://api.example.com/test')).rejects.toThrow('Connection refused');
  });

  it('handles URL object input', async () => {
    const mockFetch = createMockFetch({ body: {} });
    const hooks: Hooks = {
      beforeRequest: async (url, init) => ({ url: url + '?from=url-obj', init }),
    };
    const enhanced = createEnhancedFetch(mockFetch, hooks);
    await enhanced(new URL('https://api.example.com/test'));
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test?from=url-obj', expect.anything());
  });
});
