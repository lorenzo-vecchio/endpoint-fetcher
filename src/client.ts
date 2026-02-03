import type {
  HttpMethod,
  EndpointConfig,
  ApiConfig,
  EndpointDefinitions,
  GroupConfig,
  Hooks,
  PluginOptions
} from './types';
import { isGroupConfig } from './types';
import { buildUrl, mergeHooks, createEnhancedFetch } from './utils';

/**
 * Default handler for API requests
 */
async function defaultHandler<TInput, TOutput, TError = any>(
  method: HttpMethod,
  path: string,
  input: TInput,
  hooks: Hooks,
  config: ApiConfig,
  fetchInstance: typeof fetch
): Promise<TOutput> {
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

  const enhancedFetch = createEnhancedFetch(fetchInstance, hooks);
  const response = await enhancedFetch(url, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as TError;
    throw {
      status: response.status,
      statusText: response.statusText,
      error,
    } as { status: number; statusText: string; error: TError };
  }

  return response.json();
}

/**
 * Apply plugin handler wrappers to a handler function
 */
function applyHandlerWrappers<TInput, TOutput, TError>(
  baseHandler: (
    input: TInput,
    context: {
      fetch: typeof fetch;
      method: HttpMethod;
      path: string;
      baseUrl: string;
    }
  ) => Promise<TOutput>,
  plugins: PluginOptions[],
  endpoint: EndpointConfig<TInput, TOutput, TError>
): (
  input: TInput,
  context: {
    fetch: typeof fetch;
    method: HttpMethod;
    path: string;
    baseUrl: string;
  }
) => Promise<TOutput> {
  let wrappedHandler = baseHandler;
  
  // Apply plugin wrappers in order (first plugin wraps innermost)
  for (const plugin of plugins) {
    if (plugin.handlerWrapper) {
      wrappedHandler = plugin.handlerWrapper(wrappedHandler, endpoint);
    }
  }
  
  return wrappedHandler;
}

/**
 * Process endpoint definitions and create the client methods
 */
function processEndpoints(
  definitions: EndpointDefinitions,
  config: ApiConfig,
  fetchInstance: typeof fetch,
  parentHooks: Hooks[] = [],
  plugins: PluginOptions[] = []
): any {
  const result: any = {};

  for (const [name, definition] of Object.entries(definitions)) {
    if (isGroupConfig(definition)) {
      const groupHooks = [...parentHooks];
      if (definition.hooks) {
        groupHooks.push(definition.hooks);
      }

      result[name] = {};

      if (definition.endpoints) {
        const nestedEndpoints = processEndpoints(
          definition.endpoints,
          config,
          fetchInstance,
          groupHooks,
          plugins
        );
        Object.assign(result[name], nestedEndpoints);
      }

      if (definition.groups) {
        const nestedGroups = processEndpoints(
          definition.groups,
          config,
          fetchInstance,
          groupHooks,
          plugins
        );
        Object.assign(result[name], nestedGroups);
      }
    } else {
      const endpoint = definition as EndpointConfig;
      
      // Collect hooks from plugins
      const pluginHooks = plugins.map(p => p.hooks).filter(Boolean) as Hooks[];
      
      // Merge hooks in order: plugin -> global -> group -> endpoint
      const mergedHooks = mergeHooks(...pluginHooks, config.hooks, ...parentHooks, endpoint.hooks);

      result[name] = async (input: any) => {
        const path = typeof endpoint.path === 'function'
          ? endpoint.path(input)
          : endpoint.path;

        // Create the base handler (either custom or default)
        let baseHandler: (
          input: any,
          context: {
            fetch: typeof fetch;
            method: HttpMethod;
            path: string;
            baseUrl: string;
          }
        ) => Promise<any>;

        if (endpoint.handler) {
          // Use custom handler
          baseHandler = async (input, context) => {
            return endpoint.handler!({
              input,
              fetch: context.fetch,
              method: context.method,
              path: context.path,
              baseUrl: context.baseUrl,
            });
          };
        } else {
          // Use default handler
          baseHandler = async (input, context) => {
            return defaultHandler(
              context.method,
              context.path,
              input,
              mergedHooks,
              config,
              context.fetch
            );
          };
        }

        // Apply plugin handler wrappers
        const wrappedHandler = applyHandlerWrappers(baseHandler, plugins, endpoint);

        // Execute the wrapped handler
        const enhancedFetch = createEnhancedFetch(fetchInstance, mergedHooks);
        return wrappedHandler(input, {
          fetch: enhancedFetch,
          method: endpoint.method,
          path,
          baseUrl: config.baseUrl,
        });
      };
    }
  }

  return result;
}

/**
 * Type extraction for endpoint configurations
 */
type ExtractEndpointTypes<T> =
  T extends EndpointConfig<infer TInput, infer TOutput, any>
  ? (input: TInput) => Promise<TOutput>
  : T extends GroupConfig
  ? ExtractGroupTypes<T>
  : never;

/**
 * Type extraction for group configurations
 */
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

/**
 * The resulting client type
 */
type Client<T extends EndpointDefinitions> = {
  [K in keyof T]: ExtractEndpointTypes<T[K]>;
};

/**
 * Creates a typed API client from endpoint definitions
 * 
 * @param endpoints - Endpoint definitions
 * @param config - API configuration
 * @returns A typed API client
 * 
 * @example
 * ```typescript
 * import { createApiClient } from './client';
 * import { authPlugin } from './plugins/auth';
 * import { retryPlugin } from './plugins/retry';
 * 
 * const api = createApiClient({
 *   users: {
 *     endpoints: {
 *       getAll: get<void, User[]>('/users'),
 *       getById: get<{ id: number }, User>((input) => `/users/${input.id}`)
 *     }
 *   }
 * }, {
 *   baseUrl: 'https://api.example.com',
 *   plugins: [
 *     authPlugin({ token: 'my-token' }),
 *     retryPlugin({ maxRetries: 3 })
 *   ]
 * });
 * 
 * // Usage
 * const users = await api.users.getAll();
 * const user = await api.users.getById({ id: 1 });
 * ```
 */
export function createApiClient<TEndpoints extends EndpointDefinitions>(
  endpoints: TEndpoints,
  config: ApiConfig
) {
  const fetchInstance = config.fetch ?? globalThis.fetch;
  const plugins = config.plugins ?? [];
  const client = processEndpoints(
    endpoints,
    config,
    fetchInstance,
    [],
    plugins
  ) as Client<TEndpoints>;
  return client;
}