export * from './types';

import type { 
  HttpMethod, 
  EndpointConfig, 
  ApiConfig, 
  EndpointDefinitions 
} from './types';

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

    const response = await fetchInstance(url, options);

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

  // Extract types helper - note the syntax here
  type ExtractEndpointTypes<T> = 
    T extends EndpointConfig<infer TInput, infer TOutput, any>
      ? (input: TInput) => Promise<TOutput>
      : never;

  // Build client type
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
          fetch: fetchInstance,
          method: endpoint.method,
          path,
        });
      }

      return defaultHandler(endpoint.method, path, input);
    }) as any;
  }

  return client;
}