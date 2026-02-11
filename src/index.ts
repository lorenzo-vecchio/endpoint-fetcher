/**
 * API Client Library
 * 
 * A type-safe, flexible API client with support for hooks,
 * grouped endpoints, custom handlers, and plugins.
 */

// Export all types
export type {
  HttpMethod,
  EndpointConfig,
  Hooks,
  GroupConfig,
  ApiConfig,
  EndpointDefinitions,
  PluginOptions,
  ExtractPluginMethods
} from './types';

export { isGroupConfig } from './types';

// Export the main client creator
export { createApiClient } from './client';

// Export helper functions
export {
  endpoint,
  group,
  get,
  post,
  put,
  patch,
  del
} from './helpers';

// Export plugin utilities
export {
  createPlugin,
  type Plugin,
  type PluginConfig,
  type PluginMethods
} from './plugin';

// Export utilities (in case users need them)
export {
  buildUrl,
  mergeHooks,
  createEnhancedFetch
} from './utils';