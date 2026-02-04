# endpoint-fetcher

A punchy, type-safe API client builder for TypeScript. It turns your Fetch calls into a structured, hierarchical tree with zero guesswork and full compile-time safety—errors included.

## Installation

**Bash**

```
npm install endpoint-fetcher
```

## Features

* 🔒 **Total Type Safety:** Enforces types for inputs, outputs, and **errors** (**$TError$**).
* 🪝 **Hierarchical Hooks:** Cascade logic (Auth, Logging) from Global **$\rightarrow$** Group **$\rightarrow$** Endpoint.
* 📦 **Nested Groups:** Organize your API into logical, searchable namespaces.
* 🔌 **Plugin Support:** Extend functionality (e.g., caching) easily.
* 🎯 **Dynamic Paths:** Build URLs using input parameters.

---

## Simple Feature Examples

### 1. Helper Functions & Dynamic Paths

Quickly define endpoints with `get`, `post`, `put`, `patch`, or `del`.

**TypeScript**

```typescript
const getUser = get<{ id: string }, User>(input => `/users/${input.id}`);
const user = await api.getUser({ id: '123' });
```

### 2. Nested Groups

Organize your client for better DX.

**TypeScript**

```typescript
const api = createApiClient({
  admin: group({
    groups: {
      users: group({
        endpoints: { list: get<void, User[]>('/admin/users') }
      })
    }
  })
});
await api.admin.users.list();
```

### 3. Hierarchical Hooks

Attach logic at any level. `beforeRequest` flows down; `afterResponse` flows up.

**TypeScript**

```typescript
const users = group({
  hooks: {
    beforeRequest: async (url, init) => ({ url, init: { ...init, headers: { 'X-Group': 'true' } } })
  },
  endpoints: { list: get('/users') }
});
```

### 4. Type-Safe Errors

Don't just catch `any`. Define exactly what your error looks like.

**TypeScript**

```typescript
type MyError = { code: number; message: string };
const safeGet = get<void, User, MyError>('/profile');

// The internal handler uses the TError type for rejected promises
```

### 5. Custom Handlers

For when you need to handle `FormData` or `Blobs` manually.

**TypeScript**

```typescript
const upload = post<{ file: File }, { url: string }>(
  '/upload',
  async ({ input, fetch, path, baseUrl }) => {
    const fd = new FormData();
    fd.append('file', input.file);
    const res = await fetch(`${baseUrl}${path}`, { method: 'POST', body: fd });
    return res.json();
  }
);
```

### 6. Plugins

Extend the core behavior, like adding a cache layer.

**TypeScript**

```typescript
import { withPlugin } from 'endpoint-fetcher';
import { cachePlugin } from '@endpoint-fetcher/cache';

const api = createApiClient(endpoints, {
  plugins: [cachePlugin()]
});
```

---

## The "Everything Everywhere" Example

Here is how it looks when you throw the whole kitchen sink at it:

**TypeScript**

```typescript
import { createApiClient, group, get, post, patch, withPlugin } from 'endpoint-fetcher';

// 1. Setup Client
const api = createApiClient({
  auth: group({
    endpoints: {
      login: post<{ email: string }, { token: string }>('/login')
    }
  }),
  
  users: group({
    hooks: {
      beforeRequest: (url, init) => {
        const token = localStorage.getItem('jwt');
        return { url, init: { ...init, headers: { Authorization: `Bearer ${token}` } } };
      }
    },
    endpoints: {
      me: get<void, User, { message: string }>('/me'),
    },
    groups: {
      posts: group({
        endpoints: {
          update: patch<{ id: string; text: string }, Post>(i => `/posts/${i.id}`)
        }
      })
    }
  })
}, { 
  baseUrl: 'https://api.example.com',
  hooks: {
    onError: (err) => console.error("Global Catch:", err)
  }
});

// 2. Use it
const profile = await api.users.me();
await api.users.posts.update({ id: '42', text: 'Type safety is life.' });
```

---
