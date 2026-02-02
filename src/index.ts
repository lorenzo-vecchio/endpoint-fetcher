/**
 * API Client Library
 * 
 * A type-safe, flexible API client with support for hooks,
 * grouped endpoints, and custom handlers.
 */

// Export all types
export type {
  HttpMethod,
  EndpointConfig,
  Hooks,
  GroupConfig,
  ApiConfig,
  EndpointDefinitions
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

// Export utilities (in case users need them)
export {
  buildUrl,
  mergeHooks,
  createEnhancedFetch
} from './utils';