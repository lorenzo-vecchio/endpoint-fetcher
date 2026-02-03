import type { Hooks, EndpointConfig, PluginOptions, HttpMethod } from './types';

/**
 * Plugin factory function type
 * Plugins export a function that takes configuration and returns PluginOptions
 */
export type Plugin<TConfig = void> = TConfig extends void
  ? () => PluginOptions
  : (config: TConfig) => PluginOptions;

/**
 * Type helper to extract plugin config type
 */
export type PluginConfig<T> = T extends Plugin<infer TConfig> ? TConfig : never;

/**
 * Creates a plugin with proper typing
 * 
 * @example
 * ```typescript
 * // Plugin without config
 * export const loggingPlugin = createPlugin(() => ({
 *   hooks: {
 *     beforeRequest: async (url, init) => {
 *       console.log('Request:', url);
 *       return { url, init };
 *     }
 *   }
 * }));
 * 
 * // Plugin with config
 * export const authPlugin = createPlugin((config: { token: string }) => ({
 *   hooks: {
 *     beforeRequest: async (url, init) => {
 *       const headers = new Headers(init.headers);
 *       headers.set('Authorization', `Bearer ${config.token}`);
 *       return { url, init: { ...init, headers } };
 *     }
 *   }
 * }));
 * 
 * // Plugin with handler wrapper (e.g., retry logic)
 * export const retryPlugin = createPlugin((config: { maxRetries: number }) => ({
 *   handlerWrapper: (originalHandler) => {
 *     return async (input, context) => {
 *       let lastError;
 *       for (let i = 0; i <= config.maxRetries; i++) {
 *         try {
 *           return await originalHandler(input, context);
 *         } catch (error) {
 *           lastError = error;
 *           if (i < config.maxRetries) {
 *             await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
 *           }
 *         }
 *       }
 *       throw lastError;
 *     };
 *   }
 * }));
 * 
 * // Plugin with both hooks and handler wrapper
 * export const cachingPlugin = createPlugin((config: { ttl: number }) => {
 *   const cache = new Map<string, { data: any; expires: number }>();
 *   
 *   return {
 *     hooks: {
 *       beforeRequest: async (url, init) => {
 *         // Add cache headers
 *         const headers = new Headers(init.headers);
 *         headers.set('Cache-Control', `max-age=${config.ttl}`);
 *         return { url, init: { ...init, headers } };
 *       }
 *     },
 *     handlerWrapper: (originalHandler) => {
 *       return async (input, context) => {
 *         const cacheKey = `${context.method}:${context.path}`;
 *         const cached = cache.get(cacheKey);
 *         
 *         if (cached && cached.expires > Date.now()) {
 *           return cached.data;
 *         }
 *         
 *         const result = await originalHandler(input, context);
 *         cache.set(cacheKey, { data: result, expires: Date.now() + config.ttl * 1000 });
 *         return result;
 *       };
 *     }
 *   };
 * }));
 * ```
 */
export function createPlugin<TConfig = void>(
  factory: Plugin<TConfig>
): Plugin<TConfig> {
  return factory;
}