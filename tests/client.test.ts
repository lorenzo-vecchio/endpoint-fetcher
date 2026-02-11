import { describe, it, expect, vi } from 'vitest';
import { createApiClient } from '../src/client';
import { get, post, put, patch, del, endpoint } from '../src/helpers';
import { createMockFetch } from './mock-fetch';

describe('createApiClient', () => {
  it('creates client with a simple GET endpoint', async () => {
    const mockFetch = createMockFetch({ body: [{ id: 1, name: 'Alice' }] });
    const api = createApiClient(
      { getUsers: get<void, { id: number; name: string }[]>('/users') },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    const result = await api.getUsers(undefined as void);
    expect(result).toEqual([{ id: 1, name: 'Alice' }]);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('sends GET request to correct URL', async () => {
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      { getUsers: get<void, any>('/users') },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.getUsers(undefined as void);
    const [url] = (mockFetch as any).mock.calls[0];
    expect(url).toBe('https://api.example.com/users');
  });

  it('does not send body for GET requests', async () => {
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      { getUsers: get<void, any>('/users') },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.getUsers(undefined as void);
    const [, init] = (mockFetch as any).mock.calls[0];
    expect(init.body).toBeUndefined();
  });

  it('sends JSON body for POST requests', async () => {
    const mockFetch = createMockFetch({ body: { id: 1 } });
    const api = createApiClient(
      { createUser: post<{ name: string }, { id: number }>('/users') },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.createUser({ name: 'Bob' });
    const [, init] = (mockFetch as any).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ name: 'Bob' });
  });

  it('sends JSON body for PUT requests', async () => {
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      { updateUser: put<{ name: string }, any>('/users/1') },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.updateUser({ name: 'Updated' });
    const [, init] = (mockFetch as any).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ name: 'Updated' });
  });

  it('sends JSON body for PATCH requests', async () => {
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      { patchUser: patch<{ name: string }, any>('/users/1') },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.patchUser({ name: 'Patched' });
    const [, init] = (mockFetch as any).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ name: 'Patched' });
  });

  it('does not send body for DELETE requests', async () => {
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      { deleteUser: del<void, any>('/users/1') },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.deleteUser(undefined as void);
    const [, init] = (mockFetch as any).mock.calls[0];
    expect(init.body).toBeUndefined();
  });

  it('applies default headers', async () => {
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      { getUsers: get<void, any>('/users') },
      {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        defaultHeaders: { 'X-Custom': 'value' },
      }
    );

    await api.getUsers(undefined as void);
    const [, init] = (mockFetch as any).mock.calls[0];
    expect(init.headers['X-Custom']).toBe('value');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('resolves dynamic path from input', async () => {
    const mockFetch = createMockFetch({ body: { id: 5 } });
    const api = createApiClient(
      { getUser: get<{ id: number }, any>((input) => `/users/${input.id}`) },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.getUser({ id: 5 });
    const [url] = (mockFetch as any).mock.calls[0];
    expect(url).toBe('https://api.example.com/users/5');
  });

  it('uses custom handler instead of default', async () => {
    const customHandler = vi.fn(async ({ input, fetch: f, method, path, baseUrl }) => {
      return { custom: true, input, method, path, baseUrl };
    });
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      {
        custom: endpoint<{ name: string }, any>({
          method: 'POST',
          path: '/custom',
          handler: customHandler,
        }),
      },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    const result = await api.custom({ name: 'test' });
    expect(customHandler).toHaveBeenCalledOnce();
    expect(result.custom).toBe(true);
    expect(result.input).toEqual({ name: 'test' });
    expect(result.method).toBe('POST');
    expect(result.path).toBe('/custom');
    expect(result.baseUrl).toBe('https://api.example.com');
  });

  it('throws structured error for non-OK response', async () => {
    const mockFetch = createMockFetch({
      status: 404,
      statusText: 'Not Found',
      body: { message: 'User not found' },
    });
    const api = createApiClient(
      { getUser: get<void, any>('/users/999') },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    try {
      await api.getUser(undefined as void);
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
      expect(err.statusText).toBe('Not Found');
      expect(err.error).toEqual({ message: 'User not found' });
    }
  });

  it('throws with empty error when response body is not JSON', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response('Not JSON', {
        status: 500,
        statusText: 'Internal Server Error',
      });
    }) as unknown as typeof fetch;

    const api = createApiClient(
      { getUsers: get<void, any>('/users') },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    try {
      await api.getUsers(undefined as void);
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(500);
      expect(err.error).toEqual({});
    }
  });

  it('supports multiple endpoints in flat client', async () => {
    const mockFetch = createMockFetch({ body: { ok: true } });
    const api = createApiClient(
      {
        getUsers: get<void, any>('/users'),
        createUser: post<{ name: string }, any>('/users'),
        deleteUser: del<{ id: number }, any>((input) => `/users/${input.id}`),
      },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    expect(typeof api.getUsers).toBe('function');
    expect(typeof api.createUser).toBe('function');
    expect(typeof api.deleteUser).toBe('function');
  });

  it('uses custom fetch instance instead of globalThis.fetch', async () => {
    const customFetch = createMockFetch({ body: { source: 'custom' } });
    const api = createApiClient(
      { getUsers: get<void, any>('/users') },
      { baseUrl: 'https://api.example.com', fetch: customFetch }
    );

    const result = await api.getUsers(undefined as void);
    expect(result).toEqual({ source: 'custom' });
    expect(customFetch).toHaveBeenCalledOnce();
  });
});
