import type { EndpointConfig, GroupConfig, Hooks } from './types';

/**
 * Helper function to create a typed endpoint configuration
 */
export const endpoint = <TInput = void, TOutput = any, TError = any>(
  config: EndpointConfig<TInput, TOutput, TError>
): EndpointConfig<TInput, TOutput, TError> => config;

/**
 * Helper function to create a typed group configuration
 * @param config - The group configuration
 * @returns A properly typed group config
 * 
 * @example
 * ```typescript
 * const usersGroup = group({
 *   hooks: { beforeRequest: async (url, init) => ({ url, init }) },
 *   endpoints: {
 *     getAll: endpoint<void, User[]>({ method: 'GET', path: '/users' })
 *   }
 * });
 * ```
 */
export const group = <T extends GroupConfig>(config: T): T => config;

/**
 * Convenience helper for GET requests
 * @template TInput - The input type (defaults to void for no input)
 * @template TOutput - The output/response type
 * @template TError - The error type (defaults to any)
 * @param path - URL path string or function that generates path from input
 * @param handler - Optional custom handler function
 * @param hooks - Optional hooks specific to this GET endpoint
 * 
 * @example
 * ```typescript
 * // Simple GET with no input
 * const getPosts = get<void, Post[]>('/posts');
 * 
 * // GET with path parameters
 * const getPost = get<{ id: number }, Post>((input) => `/posts/${input.id}`);
 * 
 * // GET with custom error type
 * const getPostWithError = get<{ id: number }, Post, ApiError>((input) => `/posts/${input.id}`);
 * ```
 */
export const get = <TInput = void, TOutput = any, TError = any>(
  path: string | ((input: TInput) => string),
  handler?: EndpointConfig<TInput, TOutput, TError>['handler'],
  hooks?: Hooks
) => endpoint<TInput, TOutput, TError>({ method: 'GET', path, handler, hooks });

/**
 * Convenience helper for POST requests
 * @template TInput - The input/body type
 * @template TOutput - The output/response type
 * @template TError - The error type (defaults to any)
 * @param path - URL path string or function that generates path from input
 * @param handler - Optional custom handler function
 * @param hooks - Optional hooks specific to this POST endpoint
 * @example
 * ```typescript
 * const createPost = post<CreatePostInput, Post>('/posts');
 * 
 * // POST with custom error type
 * const createPostWithError = post<CreatePostInput, Post, ValidationError>('/posts');
 * ```
 */
export const post = <TInput, TOutput = any, TError = any>(
  path: string | ((input: TInput) => string),
  handler?: EndpointConfig<TInput, TOutput, TError>['handler'],
  hooks?: Hooks
) => endpoint<TInput, TOutput, TError>({ method: 'POST', path, handler, hooks });

/**
 * Convenience helper for PUT requests
 * @template TInput - The input/body type
 * @template TOutput - The output/response type
 * @template TError - The error type (defaults to any)
 * @param path - URL path string or function that generates path from input
 * @param handler - Optional custom handler function
 * @param hooks - Optional hooks specific to this PUT endpoint
 * @example
 * ```typescript
 * const updatePost = put<UpdatePostInput, Post>((input) => `/posts/${input.id}`);
 * 
 * // PUT with custom error type
 * const updatePostWithError = put<UpdatePostInput, Post, ApiError>((input) => `/posts/${input.id}`);
 * ```
 */
export const put = <TInput, TOutput = any, TError = any>(
  path: string | ((input: TInput) => string),
  handler?: EndpointConfig<TInput, TOutput, TError>['handler'],
  hooks?: Hooks
) => endpoint<TInput, TOutput, TError>({ method: 'PUT', path, handler, hooks });

/**
 * Convenience helper for PATCH requests
 * @template TInput - The input/body type
 * @template TOutput - The output/response type
 * @template TError - The error type (defaults to any)
 * @param path - URL path string or function that generates path from input
 * @param handler - Optional custom handler function
 * @param hooks - Optional hooks specific to this PATCH endpoint
 * 
 * @example
 * ```typescript
 * const patchPost = patch<Partial<Post>, Post>((input) => `/posts/${input.id}`);
 * 
 * // PATCH with custom error type
 * const patchPostWithError = patch<Partial<Post>, Post, ValidationError>((input) => `/posts/${input.id}`);
 * ```
 */
export const patch = <TInput, TOutput = any, TError = any>(
  path: string | ((input: TInput) => string),
  handler?: EndpointConfig<TInput, TOutput, TError>['handler'],
  hooks?: Hooks
) => endpoint<TInput, TOutput, TError>({ method: 'PATCH', path, handler, hooks });

/**
 * Convenience helper for DELETE requests
 * Named 'del' to avoid conflict with JavaScript's delete keyword
 * @template TInput - The input type (usually contains ID)
 * @template TOutput - The output/response type (often void or empty object)
 * @template TError - The error type (defaults to any)
 * @param path - URL path string or function that generates path from input
 * @param handler - Optional custom handler function
 * @param hooks - Optional hooks specific to this DELETE endpoint
 * 
 * @example
 * ```typescript
 * const deletePost = del<{ id: number }, void>((input) => `/posts/${input.id}`);
 * 
 * // DELETE with custom error type
 * const deletePostWithError = del<{ id: number }, void, ApiError>((input) => `/posts/${input.id}`);
 * ```
 */
export const del = <TInput = void, TOutput = any, TError = any>(
  path: string | ((input: TInput) => string),
  handler?: EndpointConfig<TInput, TOutput, TError>['handler'],
  hooks?: Hooks
) => endpoint<TInput, TOutput, TError>({ method: 'DELETE', path, handler, hooks });