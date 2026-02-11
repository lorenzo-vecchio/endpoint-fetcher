# endpoint-fetcher

A type-safe API client builder using the Fetch API with full TypeScript support, nested groups, and hierarchical hooks.

## Installation

```bash
npm install endpoint-fetcher
```

## Features

* **Fully type-safe** - Input and output types are enforced at compile time
* **Dynamic paths** - Use functions to build paths from input parameters
* **Custom handlers** - Override default behavior for specific endpoints
* **Hierarchical hooks** - Add authentication, logging, and error handling at global, group, or endpoint level
* **Nested groups** - Organize endpoints into logical groups with shared configuration
* **Helper functions** - Convenient `get()`, `post()`, `put()`, `patch()`, `del()`, `endpoint()`, and `group()` helpers
* **Configurable fetch** - Pass your own fetch instance or wrap it with plugins (caching, retries, etc.)
* **Robust Error Types** - Specific error classes for HTTP, Network, and Parsing issues
* **Auto JSON handling** - Automatic serialization and deserialization
* **Default headers** - Set common headers like authorization tokens
* **Plugin support** - Extend functionality with official or custom plugins like caching and retries

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

## Documentation

For full documentation, guides, and API reference, visit **[endpoint-fetcher.lorenzovecchio.dev](https://endpoint-fetcher.lorenzovecchio.dev)**.

## License

MIT
