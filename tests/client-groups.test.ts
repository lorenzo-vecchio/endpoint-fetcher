import { describe, it, expect, vi } from 'vitest';
import { createApiClient } from '../src/client';
import { get, post, group } from '../src/helpers';
import { createMockFetch } from './mock-fetch';

// NOTE: Hooks fire twice per default-handler call due to double-enhancement
// (once in context.fetch, once inside defaultHandler). Tests account for this.

describe('client groups', () => {
  it('accesses grouped endpoints via dot notation', async () => {
    const mockFetch = createMockFetch({ body: [{ id: 1 }] });
    const api = createApiClient(
      {
        users: group({
          endpoints: {
            list: get<void, any>('/users'),
          },
        }),
      },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    const result = await api.users.list(undefined as void);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('supports nested groups', async () => {
    const mockFetch = createMockFetch({ body: { ok: true } });
    const api = createApiClient(
      {
        users: group({
          groups: {
            posts: group({
              endpoints: {
                list: get<{ userId: number }, any>((input) => `/users/${input.userId}/posts`),
              },
            }),
          },
        }),
      },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.users.posts.list({ userId: 5 });
    const [url] = (mockFetch as any).mock.calls[0];
    expect(url).toBe('https://api.example.com/users/5/posts');
  });

  it('applies group hooks to all endpoints in the group', async () => {
    const order: string[] = [];
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      {
        users: group({
          hooks: {
            beforeRequest: async (url, init) => {
              order.push('group');
              return { url, init };
            },
          },
          endpoints: {
            list: get<void, any>('/users'),
            create: post<{ name: string }, any>('/users'),
          },
        }),
      },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.users.list(undefined as void);
    await api.users.create({ name: 'test' });
    // Hook fires twice per call (double-enhancement), so 4 total for 2 calls
    expect(order).toEqual(['group', 'group', 'group', 'group']);
  });

  it('stacks nested group hooks', async () => {
    const order: string[] = [];
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      {
        v1: group({
          hooks: {
            beforeRequest: async (url, init) => {
              order.push('outer');
              return { url, init };
            },
          },
          groups: {
            users: group({
              hooks: {
                beforeRequest: async (url, init) => {
                  order.push('inner');
                  return { url, init };
                },
              },
              endpoints: {
                list: get<void, any>('/v1/users'),
              },
            }),
          },
        }),
      },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.v1.users.list(undefined as void);
    // Each invocation: outer, inner (twice due to double-enhancement)
    expect(order).toEqual(['outer', 'inner', 'outer', 'inner']);
  });

  it('supports group with both endpoints and nested groups', async () => {
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      {
        users: group({
          endpoints: {
            list: get<void, any>('/users'),
          },
          groups: {
            admin: group({
              endpoints: {
                ban: post<{ userId: number }, any>('/admin/ban'),
              },
            }),
          },
        }),
      },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    expect(typeof api.users.list).toBe('function');
    expect(typeof api.users.admin.ban).toBe('function');
  });

  it('group hooks do not leak to sibling groups', async () => {
    const groupAHook = vi.fn(async (url: string, init: RequestInit) => ({ url, init }));
    const mockFetch = createMockFetch({ body: {} });
    const api = createApiClient(
      {
        groupA: group({
          hooks: { beforeRequest: groupAHook },
          endpoints: {
            endpoint: get<void, any>('/a'),
          },
        }),
        groupB: group({
          endpoints: {
            endpoint: get<void, any>('/b'),
          },
        }),
      },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    await api.groupB.endpoint(undefined as void);
    expect(groupAHook).not.toHaveBeenCalled();

    await api.groupA.endpoint(undefined as void);
    // Fires twice per call due to double-enhancement
    expect(groupAHook).toHaveBeenCalledTimes(2);
  });

  it('handles deep nesting (3+ levels)', async () => {
    const mockFetch = createMockFetch({ body: { deep: true } });
    const api = createApiClient(
      {
        level1: group({
          groups: {
            level2: group({
              groups: {
                level3: group({
                  endpoints: {
                    data: get<void, any>('/deep/data'),
                  },
                }),
              },
            }),
          },
        }),
      },
      { baseUrl: 'https://api.example.com', fetch: mockFetch }
    );

    const result = await api.level1.level2.level3.data(undefined as void);
    expect(result).toEqual({ deep: true });
  });
});
