import { describe, it, expect } from 'vitest';
import { isGroupConfig } from '../src/types';

describe('isGroupConfig', () => {
  it('returns true for object with endpoints key', () => {
    expect(isGroupConfig({ endpoints: {} })).toBe(true);
  });

  it('returns true for object with groups key', () => {
    expect(isGroupConfig({ groups: {} })).toBe(true);
  });

  it('returns true for object with both endpoints and groups', () => {
    expect(isGroupConfig({ endpoints: {}, groups: {} })).toBe(true);
  });

  it('returns false for EndpointConfig object', () => {
    expect(isGroupConfig({ method: 'GET', path: '/users' })).toBe(false);
  });

  it('returns false for object with only hooks (ambiguous but treated as endpoint)', () => {
    // An object with only hooks and no endpoints/groups is not a GroupConfig
    expect(isGroupConfig({ method: 'POST', path: '/test', hooks: {} })).toBe(false);
  });
});
