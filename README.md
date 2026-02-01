# endpoint-fetcher

A type-safe API client builder using the Fetch API with full TypeScript support, nested groups, and hierarchical hooks.

## Installation
```bash
npm install endpoint-fetcher
```

## Features

- 🔒 **Fully type-safe** - Input and output types are enforced at compile time
- 🎯 **Dynamic paths** - Use functions to build paths from input parameters
- 🔧 **Custom handlers** - Override default behavior for specific endpoints
- 🪝 **Hierarchical hooks** - Add authentication, logging, and error handling at global, group, or endpoint level
- 📦 **Nested groups** - Organize endpoints into logical groups with shared configuration
- 🎁 **Helper functions** - Convenient `get()`, `post()`, `put()`, `patch()`, `del()`, `endpoint()`, and `group()` helpers
- 🌐 **Configurable fetch** - Pass your own fetch instance with interceptors, retries, etc.
- 📝 **Auto JSON handling** - Automatic serialization and deserialization
- 🔑 **Default headers** - Set common headers like authorization tokens

## Quick Start

```typescript
import { createApiClient, get, post, group } from 'endpoint-fetcher';

type User = { id: string; name: string; email: string };
type Post = { id: string; title: string; userId: string };

const api = createApiClient(
  {
    users: group({
      endpoints: {
        list: get<void, User[]>('/users'),
        getById: get<{ id: string }, User>(input => `/users/${input.id}`),
        create: post<Omit<User, 'id'>, User>('/users'),
      }
    }),
    posts: group({
      endpoints: {
        list: get<void, Post[]>('/posts'),
        create: post<Omit<Post, 'id'>, Post>('/posts'),
      }
    })
  },
  { baseUrl: 'https://api.example.com' }
);

// Fully type-safe usage!
const users = await api.users.list();
const user = await api.users.getById({ id: '123' });
const newPost = await api.posts.create({ title: 'Hello', userId: '123' });
```

## Table of Contents

- [Basic Usage](#basic-usage)
- [Helper Functions](#helper-functions)
- [Groups](#groups)
- [Hooks System](#hooks-system)
- [Custom Handlers](#custom-handlers)
- [Advanced Examples](#advanced-examples)
- [API Reference](#api-reference)

## Basic Usage

### Simple Endpoints (No Groups)

```typescript
import { createApiClient, get, post, put, patch, del } from 'endpoint-fetcher';

type User = { id: string; name: string; email: string };

const api = createApiClient(
  {
    getUser: get<{ id: string }, User>(input => `/users/${input.id}`),
    listUsers: get<void, User[]>('/users'),
    createUser: post<Omit<User, 'id'>, User>('/users'),
    updateUser: patch<Partial<User> & { id: string }, User>(input => `/users/${input.id}`),
    deleteUser: del<{ id: string }, void>(input => `/users/${input.id}`),
  },
  { baseUrl: 'https://api.example.com' }
);

const user = await api.getUser({ id: '123' });
const users = await api.listUsers();
```

## Helper Functions

The library provides convenient helper functions for common patterns:

### `endpoint(config)` - Generic Endpoint

```typescript
import { endpoint } from 'endpoint-fetcher';

const getUserEndpoint = endpoint<{ id: string }, User>({
  method: 'GET',
  path: input => `/users/${input.id}`,
  hooks: {
    beforeRequest: async (url, init) => {
      console.log('Fetching user...');
      return { url, init };
    }
  }
});
```

### `get(path, handler?, hooks?)` - GET Requests

```typescript
import { get } from 'endpoint-fetcher';

// Simple GET with no input
const listUsers = get<void, User[]>('/users');

// GET with path parameters
const getUser = get<{ id: string }, User>(input => `/users/${input.id}`);

// GET with custom handler
const downloadFile = get<{ id: string }, Blob>(
  input => `/files/${input.id}`,
  async ({ fetch, path, baseUrl }) => {
    const response = await fetch(`${baseUrl}${path}`, { method: 'GET' });
    return response.blob();
  }
);
```

### `post(path, handler?, hooks?)` - POST Requests

```typescript
import { post } from 'endpoint-fetcher';

type CreateUserInput = { name: string; email: string };

const createUser = post<CreateUserInput, User>('/users');

// With hooks
const createUserWithLogging = post<CreateUserInput, User>(
  '/users',
  undefined,
  {
    afterResponse: async (response) => {
      console.log('User created!');
      return response;
    }
  }
);
```

### `put(path, handler?, hooks?)` - PUT Requests

```typescript
import { put } from 'endpoint-fetcher';

const replaceUser = put<User, User>(input => `/users/${input.id}`);
```

### `patch(path, handler?, hooks?)` - PATCH Requests

```typescript
import { patch } from 'endpoint-fetcher';

const updateUser = patch<Partial<User> & { id: string }, User>(
  input => `/users/${input.id}`
);
```

### `del(path, handler?, hooks?)` - DELETE Requests

```typescript
import { del } from 'endpoint-fetcher';

const deleteUser = del<{ id: string }, void>(input => `/users/${input.id}`);
```

### `group(config)` - Create Groups

```typescript
import { group, get, post } from 'endpoint-fetcher';

const usersGroup = group({
  hooks: {
    beforeRequest: async (url, init) => {
      console.log('Users API call:', url);
      return { url, init };
    }
  },
  endpoints: {
    list: get<void, User[]>('/users'),
    create: post<CreateUserInput, User>('/users'),
  }
});
```

## Groups

Groups allow you to organize related endpoints together with shared configuration and hooks.

### Basic Groups

```typescript
import { createApiClient, group, get, post, del } from 'endpoint-fetcher';

const api = createApiClient(
  {
    users: group({
      endpoints: {
        list: get<void, User[]>('/users'),
        getById: get<{ id: string }, User>(input => `/users/${input.id}`),
        create: post<CreateUserInput, User>('/users'),
        delete: del<{ id: string }, void>(input => `/users/${input.id}`),
      }
    }),
    posts: group({
      endpoints: {
        list: get<void, Post[]>('/posts'),
        getById: get<{ id: string }, Post>(input => `/posts/${input.id}`),
      }
    })
  },
  { baseUrl: 'https://api.example.com' }
);

// Usage
const users = await api.users.list();
const user = await api.users.getById({ id: '123' });
const posts = await api.posts.list();
```

### Nested Groups

Groups can be nested to create deep organizational hierarchies:

```typescript
const api = createApiClient(
  {
    admin: group({
      groups: {
        users: group({
          endpoints: {
            list: get<void, User[]>('/admin/users'),
            ban: post<{ id: string }, void>(input => `/admin/users/${input.id}/ban`),
          }
        }),
        reports: group({
          endpoints: {
            daily: get<{ date: string }, Report>(input => `/admin/reports/daily/${input.date}`),
            monthly: get<{ month: string }, Report>(input => `/admin/reports/monthly/${input.month}`),
          }
        })
      }
    }),
    public: group({
      endpoints: {
        status: get<void, { status: string }>('/status'),
      }
    })
  },
  { baseUrl: 'https://api.example.com' }
);

// Usage
const users = await api.admin.users.list();
await api.admin.users.ban({ id: '123' });
const report = await api.admin.reports.daily({ date: '2024-01-01' });
const status = await api.public.status();
```

### Mixed Groups (Endpoints + Nested Groups)

Groups can contain both direct endpoints and nested groups:

```typescript
const api = createApiClient(
  {
    users: group({
      // Direct endpoints in this group
      endpoints: {
        list: get<void, User[]>('/users'),
        create: post<CreateUserInput, User>('/users'),
      },
      // Nested groups
      groups: {
        profile: group({
          endpoints: {
            get: get<{ userId: string }, Profile>(input => `/users/${input.userId}/profile`),
            update: patch<ProfileUpdate, Profile>(input => `/users/${input.userId}/profile`),
          }
        }),
        settings: group({
          endpoints: {
            get: get<{ userId: string }, Settings>(input => `/users/${input.userId}/settings`),
            update: put<SettingsUpdate, Settings>(input => `/users/${input.userId}/settings`),
          }
        })
      }
    })
  },
  { baseUrl: 'https://api.example.com' }
);

// Usage
const users = await api.users.list();
const profile = await api.users.profile.get({ userId: '123' });
const settings = await api.users.settings.get({ userId: '123' });
```

## Hooks System

Hooks allow you to add cross-cutting concerns at three levels: global, group, and endpoint. They execute in a specific order to provide fine-grained control.

### Hook Execution Order

**For `beforeRequest` hooks** (executed in order):
1. Global hooks (from config)
2. Parent group hooks
3. Child group hooks
4. Endpoint-specific hooks

**For `afterResponse` hooks** (executed in reverse order):
1. Endpoint-specific hooks
2. Child group hooks
3. Parent group hooks
4. Global hooks

**For `onError` hooks** (executed in order):
1. Global hooks
2. Group hooks (parent to child)
3. Endpoint-specific hooks

### Global Hooks

Applied to all requests across the entire API client:

```typescript
const api = createApiClient(
  {
    users: group({
      endpoints: {
        list: get<void, User[]>('/users'),
      }
    })
  },
  {
    baseUrl: 'https://api.example.com',
    hooks: {
      beforeRequest: async (url, init) => {
        // Add auth to ALL requests
        const token = localStorage.getItem('jwt');
        return {
          url,
          init: {
            ...init,
            headers: {
              ...init.headers,
              Authorization: `Bearer ${token}`,
            }
          }
        };
      },
      afterResponse: async (response) => {
        // Global response logging
        console.log('Response:', response.status);
        return response;
      },
      onError: async (error) => {
        // Global error tracking
        console.error('API Error:', error);
      }
    }
  }
);
```

### Group Hooks

Applied to all endpoints within a group (and its nested groups):

```typescript
const api = createApiClient(
  {
    admin: group({
      hooks: {
        beforeRequest: async (url, init) => {
          // Add admin-specific header to all admin endpoints
          return {
            url,
            init: {
              ...init,
              headers: {
                ...init.headers,
                'X-Admin-Request': 'true',
              }
            }
          };
        },
        afterResponse: async (response) => {
          // Log all admin actions
          console.log('Admin action:', response.url);
          return response;
        }
      },
      endpoints: {
        deleteUser: del<{ id: string }, void>(input => `/admin/users/${input.id}`),
      }
    }),
    public: group({
      hooks: {
        beforeRequest: async (url, init) => {
          // Different headers for public endpoints
          return {
            url,
            init: {
              ...init,
              headers: {
                ...init.headers,
                'X-Public-Request': 'true',
              }
            }
          };
        }
      },
      endpoints: {
        getPosts: get<void, Post[]>('/posts'),
      }
    })
  },
  { baseUrl: 'https://api.example.com' }
);
```

### Endpoint Hooks

Applied to a specific endpoint only:

```typescript
const api = createApiClient(
  {
    users: group({
      endpoints: {
        list: get<void, User[]>('/users'),
        create: post<CreateUserInput, User>(
          '/users',
          undefined,
          {
            // Hooks specific to user creation
            beforeRequest: async (url, init) => {
              console.log('Creating user...');
              return { url, init };
            },
            afterResponse: async (response) => {
              console.log('User created successfully!');
              return response;
            }
          }
        ),
      }
    })
  },
  { baseUrl: 'https://api.example.com' }
);
```

### Hierarchical Hooks Example

```typescript
const api = createApiClient(
  {
    admin: group({
      hooks: {
        beforeRequest: async (url, init) => {
          console.log('1. Admin group hook');
          return { url, init };
        }
      },
      groups: {
        users: group({
          hooks: {
            beforeRequest: async (url, init) => {
              console.log('2. Users subgroup hook');
              return { url, init };
            }
          },
          endpoints: {
            create: post<CreateUserInput, User>(
              '/admin/users',
              undefined,
              {
                beforeRequest: async (url, init) => {
                  console.log('3. Endpoint-specific hook');
                  return { url, init };
                }
              }
            ),
          }
        })
      }
    })
  },
  {
    baseUrl: 'https://api.example.com',
    hooks: {
      beforeRequest: async (url, init) => {
        console.log('0. Global hook');
        return { url, init };
      }
    }
  }
);

// When calling api.admin.users.create(), logs:
// 0. Global hook
// 1. Admin group hook
// 2. Users subgroup hook
// 3. Endpoint-specific hook
```

### Hook Use Cases

**Authentication & Authorization:**
```typescript
const api = createApiClient(
  {
    public: group({
      endpoints: {
        login: post<LoginInput, AuthResponse>('/auth/login'),
      }
    }),
    protected: group({
      hooks: {
        beforeRequest: async (url, init) => {
          const token = localStorage.getItem('jwt');
          if (!token) {
            throw new Error('Not authenticated');
          }
          return {
            url,
            init: {
              ...init,
              headers: {
                ...init.headers,
                Authorization: `Bearer ${token}`,
              }
            }
          };
        }
      },
      endpoints: {
        getProfile: get<void, User>('/profile'),
        updateProfile: patch<Partial<User>, User>('/profile'),
      }
    })
  },
  { baseUrl: 'https://api.example.com' }
);
```

**Rate Limiting Per Group:**
```typescript
const createRateLimiter = (requestsPerSecond: number) => {
  let lastRequest = 0;
  const minInterval = 1000 / requestsPerSecond;

  return async (url: string, init: RequestInit) => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequest;
    
    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, minInterval - timeSinceLastRequest)
      );
    }
    
    lastRequest = Date.now();
    return { url, init };
  };
};

const api = createApiClient(
  {
    analytics: group({
      hooks: {
        beforeRequest: createRateLimiter(2) // Max 2 requests/second
      },
      endpoints: {
        track: post<TrackingEvent, void>('/analytics/track'),
      }
    }),
    users: group({
      hooks: {
        beforeRequest: createRateLimiter(10) // Max 10 requests/second
      },
      endpoints: {
        list: get<void, User[]>('/users'),
      }
    })
  },
  { baseUrl: 'https://api.example.com' }
);
```

## Custom Handlers

For special cases like file uploads, streaming, or non-JSON responses:

```typescript
const api = createApiClient(
  {
    files: group({
      endpoints: {
        upload: post<{ file: File; name: string }, { url: string }>(
          '/files',
          async ({ input, fetch, path, baseUrl }) => {
            const formData = new FormData();
            formData.append('file', input.file);
            formData.append('name', input.name);

            const response = await fetch(`${baseUrl}${path}`, {
              method: 'POST',
              body: formData,
              // Don't set Content-Type for FormData
            });

            if (!response.ok) {
              throw new Error('Upload failed');
            }

            return response.json();
          }
        ),
        download: get<{ id: string }, Blob>(
          input => `/files/${input.id}`,
          async ({ fetch, path, baseUrl }) => {
            const response = await fetch(`${baseUrl}${path}`, {
              method: 'GET'
            });

            if (!response.ok) {
              throw new Error('Download failed');
            }

            return response.blob();
          }
        ),
      }
    })
  },
  { baseUrl: 'https://api.example.com' }
);

// Usage
const file = new File(['content'], 'document.pdf');
const result = await api.files.upload({ file, name: 'My Document' });
const blob = await api.files.download({ id: 'file-123' });
```

## Advanced Examples

### Complete API Client with All Features

```typescript
import { createApiClient, group, get, post, put, patch, del } from 'endpoint-fetcher';

// Types
type User = { id: string; name: string; email: string; role: string };
type Post = { id: string; title: string; content: string; userId: string };
type Comment = { id: string; content: string; postId: string; userId: string };
type AdminStats = { users: number; posts: number; activeToday: number };

// Token management
const getToken = () => localStorage.getItem('jwt');
const setToken = (token: string) => localStorage.setItem('jwt', token);

const refreshToken = async (): Promise<string> => {
  const response = await fetch('https://api.example.com/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      refreshToken: localStorage.getItem('refreshToken') 
    }),
  });
  const data = await response.json();
  return data.token;
};

// Create API client
const api = createApiClient(
  {
    // Public endpoints (no auth required)
    public: group({
      endpoints: {
        status: get<void, { status: string; version: string }>('/status'),
        getPosts: get<void, Post[]>('/posts'),
        getPost: get<{ id: string }, Post>(input => `/posts/${input.id}`),
      }
    }),

    // Authentication
    auth: group({
      endpoints: {
        login: post<{ email: string; password: string }, { token: string; user: User }>('/auth/login'),
        register: post<{ name: string; email: string; password: string }, { token: string; user: User }>('/auth/register'),
        logout: post<void, void>('/auth/logout'),
      }
    }),

    // Protected user endpoints
    users: group({
      hooks: {
        beforeRequest: async (url, init) => {
          // All user endpoints require auth
          const token = getToken();
          if (!token) {
            throw new Error('Authentication required');
          }
          return { url, init };
        }
      },
      endpoints: {
        me: get<void, User>('/users/me'),
        updateMe: patch<Partial<User>, User>('/users/me'),
      },
      groups: {
        // User's posts
        posts: group({
          endpoints: {
            list: get<void, Post[]>('/users/me/posts'),
            create: post<Omit<Post, 'id' | 'userId'>, Post>('/users/me/posts'),
            update: patch<Partial<Post> & { id: string }, Post>(
              input => `/users/me/posts/${input.id}`
            ),
            delete: del<{ id: string }, void>(input => `/users/me/posts/${input.id}`),
          }
        }),
        // User's comments
        comments: group({
          endpoints: {
            list: get<void, Comment[]>('/users/me/comments'),
            create: post<Omit<Comment, 'id' | 'userId'>, Comment>('/users/me/comments'),
          }
        })
      }
    }),

    // Admin endpoints
    admin: group({
      hooks: {
        beforeRequest: async (url, init) => {
          // Admin endpoints need special header
          const token = getToken();
          if (!token) {
            throw new Error('Authentication required');
          }
          return {
            url,
            init: {
              ...init,
              headers: {
                ...init.headers,
                'X-Admin-Request': 'true',
              }
            }
          };
        },
        afterResponse: async (response) => {
          // Log all admin actions
          console.log('Admin action:', response.url, response.status);
          return response;
        }
      },
      endpoints: {
        stats: get<void, AdminStats>('/admin/stats'),
      },
      groups: {
        users: group({
          endpoints: {
            list: get<{ page?: number; limit?: number }, User[]>(
              input => {
                const params = new URLSearchParams();
                if (input?.page) params.set('page', input.page.toString());
                if (input?.limit) params.set('limit', input.limit.toString());
                return `/admin/users?${params}`;
              }
            ),
            get: get<{ id: string }, User>(input => `/admin/users/${input.id}`),
            ban: post<{ id: string; reason: string }, void>(
              input => `/admin/users/${input.id}/ban`
            ),
            unban: post<{ id: string }, void>(input => `/admin/users/${input.id}/unban`),
            delete: del<{ id: string }, void>(input => `/admin/users/${input.id}`),
          }
        }),
        posts: group({
          endpoints: {
            list: get<void, Post[]>('/admin/posts'),
            delete: del<{ id: string }, void>(input => `/admin/posts/${input.id}`),
            feature: post<{ id: string }, Post>(input => `/admin/posts/${input.id}/feature`),
          }
        })
      }
    })
  },
  {
    baseUrl: 'https://api.example.com',
    defaultHeaders: {
      'Content-Type': 'application/json',
    },
    hooks: {
      // Global: Add JWT to all requests
      beforeRequest: async (url, init) => {
        const token = getToken();
        if (token) {
          return {
            url,
            init: {
              ...init,
              headers: {
                ...init.headers,
                Authorization: `Bearer ${token}`,
              }
            }
          };
        }
        return { url, init };
      },

      // Global: Handle 401 and refresh token
      afterResponse: async (response, url, init) => {
        if (response.status === 401 && !url.includes('/auth/')) {
          try {
            const newToken = await refreshToken();
            setToken(newToken);

            // Retry with new token
            return fetch(url, {
              ...init,
              headers: {
                ...init.headers,
                Authorization: `Bearer ${newToken}`,
              },
            });
          } catch (error) {
            // Refresh failed, redirect to login
            window.location.href = '/login';
            throw error;
          }
        }
        return response;
      },

      // Global: Error tracking
      onError: async (error) => {
        console.error('API Error:', error);
        // Could integrate with Sentry, etc.
        // Sentry.captureException(error);
      },
    }
  }
);

// Usage examples:

// Public endpoints
const status = await api.public.status();
const posts = await api.public.getPosts();

// Auth
const { token, user } = await api.auth.login({ 
  email: 'user@example.com', 
  password: 'password123' 
});
setToken(token);

// User endpoints (auto-authenticated via global hooks)
const me = await api.users.me();
await api.users.updateMe({ name: 'New Name' });

// User's posts
const myPosts = await api.users.posts.list();
const newPost = await api.users.posts.create({ 
  title: 'My Post', 
  content: 'Content here' 
});

// Admin endpoints (admin hooks + global hooks)
const stats = await api.admin.stats();
const users = await api.admin.users.list({ page: 1, limit: 20 });
await api.admin.users.ban({ id: '123', reason: 'Spam' });
await api.admin.posts.delete({ id: 'post-456' });
```

### Search with Query Parameters

```typescript
const api = createApiClient(
  {
    search: group({
      endpoints: {
        posts: get<{ query: string; tags?: string[]; limit?: number }, Post[]>(
          '/search/posts',
          async ({ input, fetch, path, baseUrl }) => {
            const params = new URLSearchParams({ q: input.query });
            
            if (input.tags) {
              input.tags.forEach(tag => params.append('tag', tag));
            }
            
            if (input.limit) {
              params.set('limit', input.limit.toString());
            }

            const response = await fetch(
              `${baseUrl}${path}?${params}`,
              { method: 'GET' }
            );

            if (!response.ok) {
              throw new Error('Search failed');
            }

            return response.json();
          }
        ),
      }
    })
  },
  { baseUrl: 'https://api.example.com' }
);

// Usage
const results = await api.search.posts({ 
  query: 'typescript', 
  tags: ['programming', 'tutorial'],
  limit: 20 
});
```

### Retry Logic with Exponential Backoff

```typescript
const api = createApiClient(
  {
    users: group({
      endpoints: {
        list: get<void, User[]>('/users'),
      }
    })
  },
  {
    baseUrl: 'https://api.example.com',
    hooks: {
      afterResponse: async (response, url, init) => {
        // Retry on 5xx errors
        if (response.status >= 500) {
          const retryCount = (init.headers as any)['X-Retry-Count'] || 0;

          if (retryCount < 3) {
            // Exponential backoff: 1s, 2s, 4s
            await new Promise(resolve => 
              setTimeout(resolve, Math.pow(2, retryCount) * 1000)
            );

            console.log(`Retrying request (attempt ${retryCount + 1})...`);

            return fetch(url, {
              ...init,
              headers: {
                ...init.headers,
                'X-Retry-Count': (retryCount + 1).toString(),
              },
            });
          }
        }

        return response;
      }
    }
  }
);
```

## API Reference

### `createApiClient<TEndpoints>(endpoints, config)`

Creates a type-safe API client.

**Parameters:**

- `endpoints`: Object mapping endpoint names to endpoint configs or groups
- `config`: Client configuration
  - `baseUrl`: Base URL for all requests
  - `fetch?`: Optional custom fetch instance
  - `defaultHeaders?`: Optional headers applied to all requests
  - `hooks?`: Optional global hooks

**Returns:** Typed client object

### `endpoint<TInput, TOutput, TError>(config)`

Helper to create a typed endpoint configuration.

**Parameters:**
- `config`: EndpointConfig object
  - `method`: HTTP method
  - `path`: Static string or function `(input: TInput) => string`
  - `handler?`: Optional custom handler
  - `hooks?`: Optional endpoint-specific hooks

**Returns:** EndpointConfig

### `group<T>(config)`

Helper to create a typed group configuration.

**Parameters:**
- `config`: GroupConfig object
  - `hooks?`: Optional hooks for all endpoints in this group
  - `endpoints?`: Object mapping names to endpoint configs
  - `groups?`: Object mapping names to nested group configs

**Returns:** GroupConfig

### HTTP Method Helpers

All HTTP helpers have the same signature:

```typescript
method<TInput, TOutput>(
  path: string | ((input: TInput) => string),
  handler?: CustomHandler,
  hooks?: Hooks
)
```

- **`get<TInput, TOutput>(path, handler?, hooks?)`** - GET requests
- **`post<TInput, TOutput>(path, handler?, hooks?)`** - POST requests
- **`put<TInput, TOutput>(path, handler?, hooks?)`** - PUT requests
- **`patch<TInput, TOutput>(path, handler?, hooks?)`** - PATCH requests
- **`del<TInput, TOutput>(path, handler?, hooks?)`** - DELETE requests (named `del` to avoid conflict with JS keyword)

### Hooks

All hooks are optional and can be defined at global, group, or endpoint level.

```typescript
type Hooks = {
  beforeRequest?: (
    url: string,
    init: RequestInit
  ) => Promise<{ url: string; init: RequestInit }> | { url: string; init: RequestInit };

  afterResponse?: (
    response: Response,
    url: string,
    init: RequestInit
  ) => Promise<Response> | Response;

  onError?: (error: unknown) => Promise<void> | void;
};
```

**Hook execution order:**
- `beforeRequest`: Global → Parent Groups → Child Groups → Endpoint
- `afterResponse`: Endpoint → Child Groups → Parent Groups → Global
- `onError`: Global → Parent Groups → Child Groups → Endpoint

### Custom Handler

```typescript
type CustomHandler<TInput, TOutput> = (context: {
  input: TInput;
  fetch: typeof fetch; // Enhanced with hooks
  method: HttpMethod;
  path: string;
  baseUrl: string;
}) => Promise<TOutput>;
```

### TypeScript Types

```typescript
type EndpointConfig<TInput = any, TOutput = any, TError = any> = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string | ((input: TInput) => string);
  handler?: CustomHandler<TInput, TOutput>;
  hooks?: Hooks;
};

type GroupConfig = {
  hooks?: Hooks;
  endpoints?: Record<string, EndpointConfig>;
  groups?: Record<string, GroupConfig>;
};

type ApiConfig = {
  baseUrl: string;
  fetch?: typeof fetch;
  defaultHeaders?: HeadersInit;
  hooks?: Hooks;
};
```

## Best Practices

### 1. Organize with Groups

Use groups to organize related endpoints and apply shared configuration:

```typescript
const api = createApiClient(
  {
    v1: group({
      groups: {
        users: group({ endpoints: { /* ... */ } }),
        posts: group({ endpoints: { /* ... */ } }),
      }
    }),
    v2: group({
      groups: {
        users: group({ endpoints: { /* ... */ } }),
      }
    })
  },
  { baseUrl: 'https://api.example.com' }
);
```

### 2. Use Hierarchical Hooks

Apply hooks at the appropriate level:
- **Global**: Authentication, error tracking
- **Group**: Authorization, rate limiting, logging
- **Endpoint**: Special handling, validation

### 3. Leverage Helper Functions

Use helper functions for cleaner, more readable code:

```typescript
// Instead of:
const endpoint1 = {
  method: 'GET' as const,
  path: '/users'
} as EndpointConfig<void, User[]>;

// Use:
const endpoint2 = get<void, User[]>('/users');
```

### 4. Type Everything

Define clear types for inputs and outputs:

```typescript
type CreatePostInput = {
  title: string;
  content: string;
  tags?: string[];
};

type Post = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
};

const createPost = post<CreatePostInput, Post>('/posts');
```

### 5. Keep Custom Handlers Minimal

Use custom handlers only when necessary:
- File uploads/downloads
- Streaming responses
- Non-JSON responses
- Complex query parameters

### 6. Centralize Your API Client

Create one client instance and export it:

```typescript
// api/client.ts
export const api = createApiClient(/* ... */);

// Other files
import { api } from './api/client';
const users = await api.users.list();
```

## License

MIT