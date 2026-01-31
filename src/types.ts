export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type EndpointConfig<TInput = any, TOutput = any, TError = any> = {
    method: HttpMethod;
    path: string | ((input: TInput) => string);
    handler?: (params: {
        input: TInput;
        fetch: typeof fetch;
        method: HttpMethod;
        path: string;
        baseUrl: string;
    }) => Promise<TOutput>;
};

export type Hooks = {
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

export type ApiConfig = {
    baseUrl: string;
    fetch?: typeof fetch;
    defaultHeaders?: HeadersInit;
    hooks?: Hooks;
};

export type EndpointDefinitions = Record<string, EndpointConfig>;