# Fetcher

A type-safe API client builder using the Fetch API with full TypeScript support.

## Installation

```bash
npm install fetcher
```

## Features

- 🔒 **Fully type-safe** - Input and output types are enforced at compile time
- 🎯 **Dynamic paths** - Use functions to build paths from input parameters
- 🔧 **Custom handlers** - Override default behavior for specific endpoints
- 🌐 **Configurable fetch** - Pass your own fetch instance with interceptors, retries, etc.
- 📝 **Auto JSON handling** - Automatic serialization and deserialization
- 🔑 **Default headers** - Set common headers like authorization tokens

## Basic Usage

```typescript
import { createApiClient, EndpointConfig } from 'fetcher';

type User = { id: string; name: string; email: string };

const api = createApiClient(
  {
    getUser: {
      method: 'GET',
      path: (input: { id: string }) => `/users/${input.id}`,
    } as EndpointConfig<{ id: string }, User>,
  },
  {
    baseUrl: 'https://api.example.com',
  }
);

// Fully type-safe!
const user = await api.getUser({ id: '123' });
```

## Examples

### 1. Static Path (Simple GET)

```typescript
const api = createApiClient(
  {
    listUsers: {
      method: 'GET',
      path: '/users',
    } as EndpointConfig<void, User[]>,
  },
  { baseUrl: 'https://api.example.com' }
);

// No input required
const users = await api.listUsers();
```

### 2. Dynamic Path with Function

```typescript
const api = createApiClient(
  {
    getUser: {
      method: 'GET',
      path: (input: { id: string }) => `/users/${input.id}`,
    } as EndpointConfig<{ id: string }, User>,
  
    getUserPosts: {
      method: 'GET',
      path: (input: { userId: string; page?: number }) => 
        `/users/${input.userId}/posts${input.page ? `?page=${input.page}` : ''}`,
    } as EndpointConfig<{ userId: string; page?: number }, Post[]>,
  },
  { baseUrl: 'https://api.example.com' }
);

const user = await api.getUser({ id: '123' });
const posts = await api.getUserPosts({ userId: '123', page: 2 });
```

### 3. POST with Request Body

```typescript
type CreateUserInput = { name: string; email: string };

const api = createApiClient(
  {
    createUser: {
      method: 'POST',
      path: '/users',
    } as EndpointConfig<CreateUserInput, User>,
  },
  { baseUrl: 'https://api.example.com' }
);

const newUser = await api.createUser({ 
  name: 'John Doe', 
  email: 'john@example.com' 
});
```

### 4. PUT/PATCH with Dynamic Path

```typescript
type UpdateUserInput = { 
  id: string; 
  name?: string; 
  email?: string 
};

const api = createApiClient(
  {
    updateUser: {
      method: 'PATCH',
      path: (input: UpdateUserInput) => `/users/${input.id}`,
    } as EndpointConfig<UpdateUserInput, User>,
  },
  { baseUrl: 'https://api.example.com' }
);

const updated = await api.updateUser({ 
  id: '123', 
  name: 'Jane Doe' 
});
```

### 5. DELETE

```typescript
const api = createApiClient(
  {
    deleteUser: {
      method: 'DELETE',
      path: (input: { id: string }) => `/users/${input.id}`,
    } as EndpointConfig<{ id: string }, void>,
  },
  { baseUrl: 'https://api.example.com' }
);

await api.deleteUser({ id: '123' });
```

### 6. Custom Handler for Special Cases

Use custom handlers when you need full control over the request (e.g., file uploads, custom headers, non-JSON responses).

```typescript
const api = createApiClient(
  {
    uploadFile: {
      method: 'POST',
      path: '/upload',
      handler: async ({ input, fetch }) => {
        const formData = new FormData();
        formData.append('file', input.file);
        formData.append('category', input.category);
      
        const response = await fetch('https://api.example.com/upload', {
          method: 'POST',
          body: formData,
          // Note: Don't set Content-Type for FormData
        });
      
        if (!response.ok) {
          throw new Error('Upload failed');
        }
      
        return response.json();
      },
    } as EndpointConfig
      { file: File; category: string }, 
      { url: string; id: string }
    >,

    downloadFile: {
      method: 'GET',
      path: '/download',
      handler: async ({ input, fetch }) => {
        const response = await fetch(
          `https://api.example.com/files/${input.id}`,
          { method: 'GET' }
        );
      
        if (!response.ok) {
          throw new Error('Download failed');
        }
      
        return response.blob();
      },
    } as EndpointConfig<{ id: string }, Blob>,
  },
  { baseUrl: 'https://api.example.com' }
);

// Usage
const file = new File(['content'], 'test.txt');
const result = await api.uploadFile({ file, category: 'documents' });

const blob = await api.downloadFile({ id: 'file-123' });
```

### 7. Using Custom Fetch Instance

Pass a configured fetch instance for authentication, retries, logging, etc.

```typescript
// Custom fetch with interceptors
const customFetch: typeof fetch = async (input, init) => {
  console.log('Request:', input);
  
  // Add auth token
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${getToken()}`);
  
  const response = await fetch(input, {
    ...init,
    headers,
  });
  
  console.log('Response:', response.status);
  
  // Handle 401
  if (response.status === 401) {
    await refreshToken();
    // Retry request
    return fetch(input, init);
  }
  
  return response;
};

const api = createApiClient(
  {
    getUser: {
      method: 'GET',
      path: (input: { id: string }) => `/users/${input.id}`,
    } as EndpointConfig<{ id: string }, User>,
  },
  {
    baseUrl: 'https://api.example.com',
    fetch: customFetch, // Use custom fetch
  }
);
```

### 8. With Default Headers

```typescript
const api = createApiClient(
  {
    getUser: {
      method: 'GET',
      path: (input: { id: string }) => `/users/${input.id}`,
    } as EndpointConfig<{ id: string }, User>,
  },
  {
    baseUrl: 'https://api.example.com',
    defaultHeaders: {
      'Authorization': 'Bearer your-token-here',
      'X-API-Key': 'your-api-key',
      'X-Custom-Header': 'custom-value',
    },
  }
);
```

### 9. With Error Types

```typescript
type ApiError = { 
  message: string; 
  code: string; 
  details?: Record<string, any> 
};

const api = createApiClient(
  {
    createUser: {
      method: 'POST',
      path: '/users',
    } as EndpointConfig<CreateUserInput, User, ApiError>,
  },
  { baseUrl: 'https://api.example.com' }
);

try {
  const user = await api.createUser({ 
    name: 'John', 
    email: 'invalid-email' 
  });
} catch (error) {
  // Error will have shape: { status, statusText, error: ApiError }
  console.error(error);
}
```

### 10. Complex Example - Full API Client

```typescript
import { createApiClient, EndpointConfig } from 'fetcher';

// Types
type User = { id: string; name: string; email: string };
type Post = { id: string; title: string; content: string; userId: string };
type Comment = { id: string; content: string; postId: string };
type ApiError = { message: string; code: string };

// Create client
const api = createApiClient(
  {
    // Users
    listUsers: {
      method: 'GET',
      path: '/users',
    } as EndpointConfig<void, User[], ApiError>,

    getUser: {
      method: 'GET',
      path: (input: { id: string }) => `/users/${input.id}`,
    } as EndpointConfig<{ id: string }, User, ApiError>,

    createUser: {
      method: 'POST',
      path: '/users',
    } as EndpointConfig<Omit<User, 'id'>, User, ApiError>,

    updateUser: {
      method: 'PATCH',
      path: (input: Partial<User> & { id: string }) => `/users/${input.id}`,
    } as EndpointConfig<Partial<User> & { id: string }, User, ApiError>,

    deleteUser: {
      method: 'DELETE',
      path: (input: { id: string }) => `/users/${input.id}`,
    } as EndpointConfig<{ id: string }, void, ApiError>,

    // Posts
    getUserPosts: {
      method: 'GET',
      path: (input: { userId: string }) => `/users/${input.userId}/posts`,
    } as EndpointConfig<{ userId: string }, Post[], ApiError>,

    createPost: {
      method: 'POST',
      path: '/posts',
    } as EndpointConfig<Omit<Post, 'id'>, Post, ApiError>,

    // Custom handler for search with query params
    searchPosts: {
      method: 'GET',
      path: '/posts/search',
      handler: async ({ input, fetch, path }) => {
        const params = new URLSearchParams({
          q: input.query,
          ...(input.limit && { limit: input.limit.toString() }),
        });
      
        const response = await fetch(
          `https://api.example.com${path}?${params}`,
          { method: 'GET' }
        );
      
        if (!response.ok) throw new Error('Search failed');
        return response.json();
      },
    } as EndpointConfig
      { query: string; limit?: number }, 
      Post[], 
      ApiError
    >,
  },
  {
    baseUrl: 'https://api.example.com',
    defaultHeaders: {
      'Authorization': 'Bearer token123',
    },
  }
);

// Usage - all type-safe!
const users = await api.listUsers();
const user = await api.getUser({ id: '1' });
const newUser = await api.createUser({ name: 'John', email: 'john@example.com' });
const posts = await api.getUserPosts({ userId: '1' });
const searchResults = await api.searchPosts({ query: 'typescript', limit: 10 });
```

## API Reference

### `createApiClient(endpoints, config)`

Creates a type-safe API client.

**Parameters:**

- `endpoints`: Object mapping endpoint names to configurations

  - `method`: HTTP method ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')
  - `path`: Static string or function `(input) => string`
  - `handler`: Optional custom handler function (receives `{ input, fetch, method, path }`)
- `config`: Client configuration

  - `baseUrl`: Base URL for all requests
  - `fetch`: Optional custom fetch instance
  - `defaultHeaders`: Optional headers applied to all requests

**Returns:** Type-safe client object with methods for each endpoint

## TypeScript Support

Full TypeScript support with generic types:

```typescript
EndpointConfig<TInput, TOutput, TError>
```

- `TInput`: Input parameter type
- `TOutput`: Response type
- `TError`: Error type (optional)

## License

MIT
