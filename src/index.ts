export * from './types';

import type { 
  HttpMethod, 
  EndpointConfig, 
  ApiConfig, 
  EndpointDefinitions,
  Hooks
} from './types';

export function createApiClient<TEndpoints extends EndpointDefinitions>(
  endpoints: TEndpoints,
  config: ApiConfig
) {
  const fetchInstance = config.fetch ?? globalThis.fetch;
  const hooks = config.hooks;

  const buildUrl = (path: string, baseUrl: string) => {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  };

  // Enhanced fetch that applies hooks - matches fetch signature
  const enhancedFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    // Convert input to string URL
    let url = typeof input === 'string' 
      ? input 
      : input instanceof URL 
      ? input.toString() 
      : input.url;
    
    let finalInit = { ...init };

    // Run beforeRequest hook
    if (hooks?.beforeRequest) {
      const result = await hooks.beforeRequest(url, finalInit);
      url = result.url;
      finalInit = result.init;
    }

    try {
      let response = await fetchInstance(url, finalInit);

      // Run afterResponse hook
      if (hooks?.afterResponse) {
        response = await hooks.afterResponse(response, url, finalInit);
      }

      return response;
    } catch (error) {
      // Run onError hook
      if (hooks?.onError) {
        await hooks.onError(error);
      }
      throw error;
    }
  };

  const defaultHandler = async <TInput, TOutput>(
    method: HttpMethod,
    path: string,
    input: TInput
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
      : never;

  type Client = {
    [K in keyof TEndpoints]: ExtractEndpointTypes<TEndpoints[K]>;
  };

  const client = {} as Client;

  for (const [name, endpoint] of Object.entries(endpoints)) {
    client[name as keyof Client] = (async (input: any) => {
      const path = typeof endpoint.path === 'function' 
        ? endpoint.path(input) 
        : endpoint.path;

      if (endpoint.handler) {
        return endpoint.handler({
          input,
          fetch: enhancedFetch,
          method: endpoint.method,
          path,
          baseUrl: config.baseUrl,
        });
      }

      return defaultHandler(endpoint.method, path, input);
    }) as any;
  }

  return client;
}