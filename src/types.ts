export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type EndpointConfig<TInput = any, TOutput = any, TError = any> = {
    method: HttpMethod;
    path: string | ((input: TInput) => string);
    handler?: (params: {
        input: TInput;
        fetch: typeof fetch;
        method: HttpMethod;
        path: string;
    }) => Promise<TOutput>;
};

export type ApiConfig = {
    baseUrl: string;
    fetch?: typeof fetch;
    defaultHeaders?: HeadersInit;
};

export type EndpointDefinitions = Record<string, EndpointConfig>;