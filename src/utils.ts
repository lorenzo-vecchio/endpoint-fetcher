import type { Hooks } from './types';

/**
 * Builds a complete URL from a path and base URL
 */
export function buildUrl(path: string, baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Merges multiple hooks with proper priority:
 * - beforeRequest: global -> group -> endpoint
 * - afterResponse: endpoint -> group -> global (reverse order)
 * - onError: all hooks in order
 */
export function mergeHooks(...hooksList: (Hooks | undefined)[]): Hooks {
  const merged: Hooks = {};

  const beforeRequestHooks = hooksList
    .filter((h): h is Hooks => !!h?.beforeRequest)
    .map(h => h.beforeRequest!);

  const afterResponseHooks = hooksList
    .filter((h): h is Hooks => !!h?.afterResponse)
    .map(h => h.afterResponse!)
    .reverse(); // Reverse to maintain correct order

  const onErrorHooks = hooksList
    .filter((h): h is Hooks => !!h?.onError)
    .map(h => h.onError!);

  if (beforeRequestHooks.length > 0) {
    merged.beforeRequest = async (url: string, init: RequestInit) => {
      let result = { url, init };
      for (const hook of beforeRequestHooks) {
        result = await hook(result.url, result.init);
      }
      return result;
    };
  }

  if (afterResponseHooks.length > 0) {
    merged.afterResponse = async (response: Response, url: string, init: RequestInit) => {
      let result = response;
      for (const hook of afterResponseHooks) {
        result = await hook(result, url, init);
      }
      return result;
    };
  }

  if (onErrorHooks.length > 0) {
    merged.onError = async (error: unknown) => {
      for (const hook of onErrorHooks) {
        await hook(error);
      }
    };
  }

  return merged;
}

/**
 * Creates an enhanced fetch function that applies hooks
 */
export function createEnhancedFetch(
  fetchInstance: typeof fetch,
  hooks: Hooks
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    let finalInit = { ...init };

    if (hooks.beforeRequest) {
      const result = await hooks.beforeRequest(url, finalInit);
      url = result.url;
      finalInit = result.init;
    }

    try {
      let response = await fetchInstance(url, finalInit);

      if (hooks.afterResponse) {
        response = await hooks.afterResponse(response, url, finalInit);
      }

      return response;
    } catch (error) {
      if (hooks.onError) {
        await hooks.onError(error);
      }
      throw error;
    }
  };
}