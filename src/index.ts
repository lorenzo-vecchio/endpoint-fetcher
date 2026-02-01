export * from './types';

import type {
  HttpMethod,
  EndpointConfig,
  ApiConfig,
  EndpointDefinitions,
  Hooks,
  GroupConfig
} from './types';
import { isGroupConfig } from './types';

export function createApiClient<TEndpoints extends EndpointDefinitions>(
  endpoints: TEndpoints,
  config: ApiConfig
) {
  const fetchInstance = config.fetch ?? globalThis.fetch;

  const buildUrl = (path: string, baseUrl: string) => {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  };

  // Merge hooks with priority: global -> group -> endpoint for beforeRequest
  // and endpoint -> group -> global for afterResponse (reverse order)
  const mergeHooks = (...hooksList: (Hooks | undefined)[]): Hooks => {
    const merged: Hooks = {};

    const beforeRequestHooks = hooksList
      .filter((h): h is Hooks => !!h?.beforeRequest)
      .map(h => h.beforeRequest!);

    const afterResponseHooks = hooksList
      .filter((h): h is Hooks => !!h?.afterResponse)
      .map(h => h.afterResponse!)
      .reverse(); // Reverse to maintain correct order

    const onErrorHooks = hooksList
      .filter((h): h is Hooks => !!h?.onError)
      .map(h => h.onError!);

    if (beforeRequestHooks.length > 0) {
      merged.beforeRequest = async (url: string, init: RequestInit) => {
        let result = { url, init };
        for (const hook of beforeRequestHooks) {
          result = await hook(result.url, result.init);
        }
        return result;
      };
    }

    if (afterResponseHooks.length > 0) {
      merged.afterResponse = async (response: Response, url: string, init: RequestInit) => {
        let result = response;
        for (const hook of afterResponseHooks) {
          result = await hook(result, url, init);
        }
        return result;
      };
    }

    if (onErrorHooks.length > 0) {
      merged.onError = async (error: unknown) => {
        for (const hook of onErrorHooks) {
          await hook(error);
        }
      };
    }

    return merged;
  };

  const createEnhancedFetch = (hooks: Hooks) => {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      let finalInit = { ...init };

      if (hooks.beforeRequest) {
        const result = await hooks.beforeRequest(url, finalInit);
        url = result.url;
        finalInit = result.init;
      }

      try {
        let response = await fetchInstance(url, finalInit);

        if (hooks.afterResponse) {
          response = await hooks.afterResponse(response, url, finalInit);
        }

        return response;
      } catch (error) {
        if (hooks.onError) {
          await hooks.onError(error);
        }
        throw error;
      }
    };
  };

  const defaultHandler = async <TInput, TOutput>(
    method: HttpMethod,
    path: string,
    input: TInput,
    hooks: Hooks
  ): Promise<TOutput> => {
    const url = buildUrl(path, config.baseUrl);

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...config.defaultHeaders,
      },
    };

    if (method !== 'GET' && method !== 'DELETE' && input !== undefined) {
      options.body = JSON.stringify(input);
    }

    const enhancedFetch = createEnhancedFetch(hooks);
    const response = await enhancedFetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        statusText: response.statusText,
        error,
      };
    }

    return response.json();
  };

  type ExtractEndpointTypes<T> =
    T extends EndpointConfig<infer TInput, infer TOutput, any>
    ? (input: TInput) => Promise<TOutput>
    : T extends GroupConfig
    ? ExtractGroupTypes<T>
    : never;

  type ExtractGroupTypes<T extends GroupConfig> =
    & (T extends { endpoints: infer E extends EndpointDefinitions }
      ? {
        [K in keyof E]: E[K] extends EndpointConfig<infer TInput, infer TOutput, any>
        ? (input: TInput) => Promise<TOutput>
        : E[K] extends GroupConfig
        ? ExtractGroupTypes<E[K]>
        : never
      }
      : {})
    & (T extends { groups: infer G extends Record<string, GroupConfig> }
      ? {
        [K in keyof G]: ExtractGroupTypes<G[K]>
      }
      : {});

  type Client<T extends EndpointDefinitions> = {
    [K in keyof T]: ExtractEndpointTypes<T[K]>;
  };

  const processEndpoints = (
    definitions: EndpointDefinitions,
    parentHooks: Hooks[] = []
  ): any => {
    const result: any = {};

    for (const [name, definition] of Object.entries(definitions)) {
      if (isGroupConfig(definition)) {
        const groupHooks = [...parentHooks];
        if (definition.hooks) {
          groupHooks.push(definition.hooks);
        }

        result[name] = {};

        if (definition.endpoints) {
          const nestedEndpoints = processEndpoints(definition.endpoints, groupHooks);
          Object.assign(result[name], nestedEndpoints);
        }

        if (definition.groups) {
          const nestedGroups = processEndpoints(definition.groups, groupHooks);
          Object.assign(result[name], nestedGroups);
        }
      } else {
        const endpoint = definition as EndpointConfig;
        const mergedHooks = mergeHooks(config.hooks, ...parentHooks);

        result[name] = async (input: any) => {
          const path = typeof endpoint.path === 'function'
            ? endpoint.path(input)
            : endpoint.path;

          if (endpoint.handler) {
            const enhancedFetch = createEnhancedFetch(mergedHooks);
            return endpoint.handler({
              input,
              fetch: enhancedFetch,
              method: endpoint.method,
              path,
              baseUrl: config.baseUrl,
            });
          }

          return defaultHandler(endpoint.method, path, input, mergedHooks);
        };
      }
    }

    return result;
  };

  const client = processEndpoints(endpoints) as Client<TEndpoints>;

  return client;
}

// TODO: helper function do not support error type generics yet

export const endpoint = <TInput = void, TOutput = any>(
  config: EndpointConfig<TInput, TOutput>
): EndpointConfig<TInput, TOutput> => config;

/**
 * Helper function to create a typed group configuration
 * @param config - The group configuration
 * @returns A properly typed group config
 * 
 * @example
 * ```typescript
 * const usersGroup = group({
 *   hooks: { beforeRequest: async (url, init) => ({ url, init }) },
 *   endpoints: {
 *     getAll: endpoint<void, User[]>({ method: 'GET', path: '/users' })
 *   }
 * });
 * ```
 */
export const group = <T extends GroupConfig>(config: T): T => config;

/**
 * Convenience helper for GET requests
 * @template TInput - The input type (defaults to void for no input)
 * @template TOutput - The output/response type
 * @param path - URL path string or function that generates path from input
 * @param handler - Optional custom handler function
 * 
 * @example
 * ```typescript
 * // Simple GET with no input
 * const getPosts = get<void, Post[]>('/posts');
 * 
 * // GET with path parameters
 * const getPost = get<{ id: number }, Post>((input) => `/posts/${input.id}`);
 * ```
 */
export const get = <TInput = void, TOutput = any>(
  path: string | ((input: TInput) => string),
  handler?: EndpointConfig<TInput, TOutput>['handler']
) => endpoint<TInput, TOutput>({ method: 'GET', path, handler });

/**
 * Convenience helper for POST requests
 * @template TInput - The input/body type
 * @template TOutput - The output/response type
 * @param path - URL path string or function that generates path from input
 * @param handler - Optional custom handler function
 * 
 * @example
 * ```typescript
 * const createPost = post<CreatePostInput, Post>('/posts');
 * ```
 */
export const post = <TInput, TOutput = any>(
  path: string | ((input: TInput) => string),
  handler?: EndpointConfig<TInput, TOutput>['handler']
) => endpoint<TInput, TOutput>({ method: 'POST', path, handler });

/**
 * Convenience helper for PUT requests
 * @template TInput - The input/body type
 * @template TOutput - The output/response type
 * @param path - URL path string or function that generates path from input
 * @param handler - Optional custom handler function
 * 
 * @example
 * ```typescript
 * const updatePost = put<UpdatePostInput, Post>((input) => `/posts/${input.id}`);
 * ```
 */
export const put = <TInput, TOutput = any>(
  path: string | ((input: TInput) => string),
  handler?: EndpointConfig<TInput, TOutput>['handler']
) => endpoint<TInput, TOutput>({ method: 'PUT', path, handler });

/**
 * Convenience helper for PATCH requests
 * @template TInput - The input/body type
 * @template TOutput - The output/response type
 * @param path - URL path string or function that generates path from input
 * @param handler - Optional custom handler function
 * 
 * @example
 * ```typescript
 * const patchPost = patch<Partial<Post>, Post>((input) => `/posts/${input.id}`);
 * ```
 */
export const patch = <TInput, TOutput = any>(
  path: string | ((input: TInput) => string),
  handler?: EndpointConfig<TInput, TOutput>['handler']
) => endpoint<TInput, TOutput>({ method: 'PATCH', path, handler });

/**
 * Convenience helper for DELETE requests
 * Named 'del' to avoid conflict with JavaScript's delete keyword
 * @template TInput - The input type (usually contains ID)
 * @template TOutput - The output/response type (often void or empty object)
 * @param path - URL path string or function that generates path from input
 * @param handler - Optional custom handler function
 * 
 * @example
 * ```typescript
 * const deletePost = del<{ id: number }, void>((input) => `/posts/${input.id}`);
 * ```
 */
export const del = <TInput = void, TOutput = any>(
  path: string | ((input: TInput) => string),
  handler?: EndpointConfig<TInput, TOutput>['handler']
) => endpoint<TInput, TOutput>({ method: 'DELETE', path, handler });