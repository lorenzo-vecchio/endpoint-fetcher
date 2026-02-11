/**
 * HTTP methods supported by the API client
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Configuration for an API endpoint
 */
export type EndpointConfig<TInput = any, TOutput = any, TError = any> = {
  method: HttpMethod;
  path: string | ((input: TInput) => string);
  hooks?: Hooks;
  handler?: (params: {
    input: TInput;
    fetch: typeof fetch;
    method: HttpMethod;
    path: string;
    baseUrl: string;
  }) => Promise<TOutput>;
};

/**
 * Lifecycle hooks for request/response processing
 */
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

/**
 * Configuration for a group of endpoints
 */
export type GroupConfig = {
  hooks?: Hooks;
  endpoints?: EndpointDefinitions;
  groups?: Record<string, GroupConfig>;
};

/**
 * Plugin options returned by plugin factory functions
 */
export type PluginOptions<
  TName extends string = string,
  TMethods extends Record<string, (...args: any[]) => any> = {}
> = {
  name: TName;
  hooks?: Hooks;
  handlerWrapper?: <TInput, TOutput, TError>(
    originalHandler: (
      input: TInput,
      context: {
        fetch: typeof fetch;
        method: HttpMethod;
        path: string;
        baseUrl: string;
      }
    ) => Promise<TOutput>,
    endpoint: EndpointConfig<TInput, TOutput, TError>
  ) => (
    input: TInput,
    context: {
      fetch: typeof fetch;
      method: HttpMethod;
      path: string;
      baseUrl: string;
    }
  ) => Promise<TOutput>;
  methods?: TMethods;
};

/**
 * Extracts the name and methods from a single PluginOptions.
 */
type ExtractPluginNameAndMethods<T> = 
  T extends PluginOptions<infer TName, infer TMethods>
    ? { [K in TName]: TMethods }
    : {};

/**
 * Recursively builds the plugin methods type.
 */
type BuildPluginMethods<T extends readonly PluginOptions<any, any>[], Acc = {}> = 
  T extends readonly [infer First extends PluginOptions<any, any>, ...infer Rest extends readonly PluginOptions<any, any>[]]
    ? BuildPluginMethods<Rest, Acc & ExtractPluginNameAndMethods<First>>
    : Acc;

/**
 * Extracts and groups method types from a tuple of PluginOptions.
 * Creates a nested object where keys are plugin names and values are the plugin's methods.
 */
export type ExtractPluginMethods<T extends readonly PluginOptions<any, any>[]> = 
  BuildPluginMethods<T>;

/**
 * Configuration for the API client
 */
export type ApiConfig<
  TPlugins extends readonly PluginOptions<any, any>[] = readonly PluginOptions[]
> = {
  baseUrl: string;
  fetch?: typeof fetch;
  defaultHeaders?: HeadersInit;
  hooks?: Hooks;
  plugins?: TPlugins;
};

/**
 * Definition of endpoints - can be either individual endpoints or groups
 */
export type EndpointDefinitions = Record<string, EndpointConfig<any, any> | GroupConfig>;

/**
 * Type guard to check if a config is a GroupConfig
 */
export function isGroupConfig(config: EndpointConfig | GroupConfig): config is GroupConfig {
  return 'endpoints' in config || 'groups' in config;
}