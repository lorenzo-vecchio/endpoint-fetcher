import type {
  HttpMethod,
  EndpointConfig,
  ApiConfig,
  EndpointDefinitions,
  GroupConfig,
  Hooks
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
 * Process endpoint definitions and create the client methods
 */
function processEndpoints(
  definitions: EndpointDefinitions,
  config: ApiConfig,
  fetchInstance: typeof fetch,
  parentHooks: Hooks[] = []
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
          groupHooks
        );
        Object.assign(result[name], nestedEndpoints);
      }

      if (definition.groups) {
        const nestedGroups = processEndpoints(
          definition.groups,
          config,
          fetchInstance,
          groupHooks
        );
        Object.assign(result[name], nestedGroups);
      }
    } else {
      const endpoint = definition as EndpointConfig;
      const mergedHooks = mergeHooks(config.hooks, ...parentHooks, endpoint.hooks);

      result[name] = async (input: any) => {
        const path = typeof endpoint.path === 'function'
          ? endpoint.path(input)
          : endpoint.path;

        if (endpoint.handler) {
          const enhancedFetch = createEnhancedFetch(fetchInstance, mergedHooks);
          return endpoint.handler({
            input,
            fetch: enhancedFetch,
            method: endpoint.method,
            path,
            baseUrl: config.baseUrl,
          });
        }

        return defaultHandler(
          endpoint.method,
          path,
          input,
          mergedHooks,
          config,
          fetchInstance
        );
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
 * const api = createApiClient({
 *   users: {
 *     endpoints: {
 *       getAll: get<void, User[]>('/users'),
 *       getById: get<{ id: number }, User>((input) => `/users/${input.id}`)
 *     }
 *   }
 * }, {
 *   baseUrl: 'https://api.example.com'
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
  const client = processEndpoints(endpoints, config, fetchInstance) as Client<TEndpoints>;
  return client;
}