# endpoint-fetcher

A type-safe API client builder using the Fetch API with full TypeScript support.

## Installation
```bash
npm install endpoint-fetcher
```

## Features

- 🔒 **Fully type-safe** - Input and output types are enforced at compile time
- 🎯 **Dynamic paths** - Use functions to build paths from input parameters
- 🔧 **Custom handlers** - Override default behavior for specific endpoints
- 🪝 **Hooks system** - Add authentication, logging, and error handling globally
- 🌐 **Configurable fetch** - Pass your own fetch instance with interceptors, retries, etc.
- 📝 **Auto JSON handling** - Automatic serialization and deserialization
- 🔑 **Default headers** - Set common headers like authorization tokens

## Basic Usage
```typescript
import { createApiClient, EndpointConfig } from 'endpoint-fetcher';

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

### 6. Using Hooks for Authentication

Hooks allow you to add cross-cutting concerns like authentication, logging, and error handling that apply to all requests (including custom handlers).
```typescript
const api = createApiClient(
  {
    getUser: {
      method: 'GET',
      path: (input: { id: string }) => `/users/${input.id}`,
    } as EndpointConfig<{ id: string }, User>,
    
    createUser: {
      method: 'POST',
      path: '/users',
    } as EndpointConfig<CreateUserInput, User>,
  },
  {
    baseUrl: 'https://api.example.com',
    hooks: {
      // Add JWT token to all requests
      beforeRequest: async (url, init) => {
        const token = localStorage.getItem('jwt');
        return {
          url,
          init: {
            ...init,
            headers: {
              ...init.headers,
              Authorization: token ? `Bearer ${token}` : '',
            },
          },
        };
      },
      
      // Handle 401 and refresh token
      afterResponse: async (response, url, init) => {
        if (response.status === 401) {
          // Refresh token
          const newToken = await refreshToken();
          localStorage.setItem('jwt', newToken);
          
          // Retry request with new token
          return fetch(url, {
            ...init,
            headers: {
              ...init.headers,
              Authorization: `Bearer ${newToken}`,
            },
          });
        }
        return response;
      },
      
      // Log errors
      onError: async (error) => {
        console.error('API Error:', error);
        // Send to error tracking service
        // trackError(error);
      },
    },
  }
);

// All requests automatically include JWT token
const user = await api.getUser({ id: '123' });
const newUser = await api.createUser({ name: 'John', email: 'john@example.com' });
```

### 7. Hooks with Custom Handlers

Hooks work seamlessly with custom handlers - the custom handler receives an enhanced `fetch` that already has hooks applied.
```typescript
const api = createApiClient(
  {
    uploadFile: {
      method: 'POST',
      path: '/upload',
      handler: async ({ input, fetch, path, baseUrl }) => {
        const formData = new FormData();
        formData.append('file', input.file);
        
        // This fetch already has JWT from beforeRequest hook!
        const response = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Upload failed');
        }
        
        return response.json();
      },
    } as EndpointConfig<{ file: File }, { url: string }>,
  },
  {
    baseUrl: 'https://api.example.com',
    hooks: {
      beforeRequest: async (url, init) => {
        const token = localStorage.getItem('jwt');
        return {
          url,
          init: {
            ...init,
            headers: {
              ...init.headers,
              Authorization: token ? `Bearer ${token}` : '',
            },
          },
        };
      },
    },
  }
);

// File upload will automatically include JWT token
const file = new File(['content'], 'test.txt');
const result = await api.uploadFile({ file });
```

### 8. Advanced Hooks - Request Logging and Retry Logic
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
    hooks: {
      beforeRequest: async (url, init) => {
        // Log all requests
        console.log(`[${init.method}] ${url}`);
        
        // Add authentication
        const token = localStorage.getItem('jwt');
        
        // Add correlation ID for tracking
        const correlationId = crypto.randomUUID();
        
        return {
          url,
          init: {
            ...init,
            headers: {
              ...init.headers,
              Authorization: token ? `Bearer ${token}` : '',
              'X-Correlation-ID': correlationId,
            },
          },
        };
      },
      
      afterResponse: async (response, url, init) => {
        // Log response
        console.log(`[${response.status}] ${url}`);
        
        // Retry on network errors or 5xx
        if (!response.ok && response.status >= 500) {
          const retryCount = (init.headers as any)['X-Retry-Count'] || 0;
          
          if (retryCount < 3) {
            console.log(`Retrying request (attempt ${retryCount + 1})...`);
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => 
              setTimeout(resolve, Math.pow(2, retryCount) * 1000)
            );
            
            return fetch(url, {
              ...init,
              headers: {
                ...init.headers,
                'X-Retry-Count': retryCount + 1,
              },
            });
          }
        }
        
        return response;
      },
      
      onError: async (error) => {
        console.error('Request failed:', error);
        
        // Send to error tracking
        if (window.analytics) {
          window.analytics.track('API Error', {
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      },
    },
  }
);
```

### 9. Custom Handler for Special Cases

Use custom handlers when you need full control over the request (e.g., file uploads, custom headers, non-JSON responses). The handler receives `{ input, fetch, method, path, baseUrl }`.
```typescript
const api = createApiClient(
  {
    uploadFile: {
      method: 'POST',
      path: '/upload',
      handler: async ({ input, fetch, path, baseUrl }) => {
        const formData = new FormData();
        formData.append('file', input.file);
        formData.append('category', input.category);
  
        const response = await fetch(`${baseUrl}${path}`, {
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
      path: (input: { id: string }) => `/files/${input.id}`,
      handler: async ({ input, fetch, path, baseUrl }) => {
        const response = await fetch(
          `${baseUrl}${path}`,
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

### 10. Using Custom Fetch Instance

Pass a configured fetch instance for authentication, retries, logging, etc. Note: If you use both hooks and a custom fetch instance, hooks will wrap your custom fetch.
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

### 11. With Default Headers
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

### 12. With Error Types
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

### 13. Complex Example - Full API Client with Hooks
```typescript
import { createApiClient, EndpointConfig } from 'endpoint-fetcher';

// Types
type User = { id: string; name: string; email: string };
type Post = { id: string; title: string; content: string; userId: string };
type Comment = { id: string; content: string; postId: string };
type ApiError = { message: string; code: string };

// Token management
const getToken = () => localStorage.getItem('jwt');
const setToken = (token: string) => localStorage.setItem('jwt', token);

const refreshToken = async (): Promise<string> => {
  const response = await fetch('https://api.example.com/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') }),
  });
  const data = await response.json();
  return data.token;
};

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
      handler: async ({ input, fetch, path, baseUrl }) => {
        const params = new URLSearchParams({
          q: input.query,
          ...(input.limit && { limit: input.limit.toString() }),
        });
  
        const response = await fetch(
          `${baseUrl}${path}?${params}`,
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
      'Content-Type': 'application/json',
    },
    hooks: {
      // Add JWT to all requests
      beforeRequest: async (url, init) => {
        const token = getToken();
        return {
          url,
          init: {
            ...init,
            headers: {
              ...init.headers,
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          },
        };
      },
      
      // Handle 401 and refresh token
      afterResponse: async (response, url, init) => {
        if (response.status === 401) {
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
      
      // Global error handling
      onError: async (error) => {
        console.error('API Error:', error);
        // You could integrate with error tracking here
        // Sentry.captureException(error);
      },
    },
  }
);

// Usage - all type-safe and automatically authenticated!
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
  - `handler`: Optional custom handler function (receives `{ input, fetch, method, path, baseUrl }`)
- `config`: Client configuration
  - `baseUrl`: Base URL for all requests
  - `fetch`: Optional custom fetch instance
  - `defaultHeaders`: Optional headers applied to all requests
  - `hooks`: Optional hooks for cross-cutting concerns
    - `beforeRequest`: `(url: string, init: RequestInit) => Promise<{ url: string; init: RequestInit }> | { url: string; init: RequestInit }`
    - `afterResponse`: `(response: Response, url: string, init: RequestInit) => Promise<Response> | Response`
    - `onError`: `(error: unknown) => Promise<void> | void`

**Returns:** Type-safe client object with methods for each endpoint

### Hooks

Hooks allow you to intercept and modify requests and responses globally:

- **`beforeRequest`**: Called before each request. Modify the URL or request init (headers, body, etc.). Useful for adding authentication tokens, logging, or adding custom headers.

- **`afterResponse`**: Called after receiving a response. Can modify or replace the response. Useful for token refresh on 401, response transformation, or retry logic.

- **`onError`**: Called when any error occurs during a request. Useful for logging, error tracking, or global error handling.

**Note:** Hooks apply to all requests, including those made by custom handlers. When using a custom handler, the `fetch` function passed to it already has hooks applied.

### Custom Handler Parameters

When using a custom handler, you receive an object with:

- `input`: The typed input parameters passed to the endpoint
- `fetch`: The fetch instance with hooks already applied (either custom or global)
- `method`: The HTTP method for this endpoint
- `path`: The resolved path (after applying input to path function if applicable)
- `baseUrl`: The base URL from the client configuration

This allows you to construct full URLs using `${baseUrl}${path}` in your custom handlers.

## TypeScript Support

Full TypeScript support with generic types:
```typescript
EndpointConfig<TInput, TOutput, TError>
```

- `TInput`: Input parameter type
- `TOutput`: Response type
- `TError`: Error type (optional)

## Best Practices

1. **Use hooks for cross-cutting concerns**: Authentication, logging, error tracking should be in hooks, not repeated in every endpoint.

2. **Keep custom handlers for special cases**: Use custom handlers only when you need special request/response handling (file uploads, streaming, non-JSON responses).

3. **Leverage TypeScript**: Define your types and let the library enforce them at compile time.

4. **Centralize your API client**: Create one instance and export it for use across your application.

5. **Handle errors gracefully**: Use the `onError` hook for global error handling, but also handle specific errors where needed.

## License

MIT