import {
  canManageResource,
  isAdmin,
  pickAllowedFields,
} from '../../src/utils/resourceAccess.js';

describe('pickAllowedFields', () => {
  test('keeps only whitelisted fields', () => {
    const picked = pickAllowedFields(
      { quoteText: 'A', authorName: 'B', legacyId: 1035, isGenerated: true },
      ['quoteText', 'authorName']
    );

    expect(picked).toEqual({ quoteText: 'A', authorName: 'B' });
  });

  test('drops legacyId, the key used by curated matches', () => {
    const picked = pickAllowedFields({ legacyId: 1035 }, ['quoteText']);
    expect(picked).not.toHaveProperty('legacyId');
  });

  test('never copies prototype-mangling keys, even if whitelisted', () => {
    const body = JSON.parse('{"__proto__": {"polluted": true}, "quoteText": "A"}');
    const picked = pickAllowedFields(body, ['quoteText', '__proto__']);

    expect(picked.quoteText).toBe('A');
    expect(picked.polluted).toBeUndefined();
    expect({}.polluted).toBeUndefined();
  });

  test('preserves absent fields as absent instead of undefined', () => {
    const picked = pickAllowedFields({ quoteText: 'A' }, ['quoteText', 'themes']);
    expect(Object.prototype.hasOwnProperty.call(picked, 'themes')).toBe(false);
  });

  test('returns an empty object for non-object input', () => {
    expect(pickAllowedFields(null, ['a'])).toEqual({});
    expect(pickAllowedFields('string', ['a'])).toEqual({});
  });
});

describe('isAdmin', () => {
  test('is true only for the admin role', () => {
    expect(isAdmin({ role: 'admin' })).toBe(true);
    expect(isAdmin({ role: 'ADMIN' })).toBe(true);
    expect(isAdmin({ role: 'user' })).toBe(false);
    expect(isAdmin({})).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe('canManageResource', () => {
  const owner = { _id: '507f1f77bcf86cd799439011' };
  const stranger = { _id: '507f1f77bcf86cd799439022' };

  test('allows the submitter', () => {
    const resource = { submittedBy: owner._id };
    expect(canManageResource(resource, owner)).toBe(true);
  });

  test('compares ObjectId and string forms of the same id', () => {
    const resource = { submittedBy: { toString: () => owner._id } };
    expect(canManageResource(resource, owner)).toBe(true);
  });

  test('rejects another authenticated user', () => {
    const resource = { submittedBy: owner._id };
    expect(canManageResource(resource, stranger)).toBe(false);
  });

  test('rejects everyone but admins on editorial content', () => {
    const editorial = { submittedBy: null };
    expect(canManageResource(editorial, owner)).toBe(false);
    expect(canManageResource(editorial, { role: 'admin' })).toBe(true);
  });

  test('rejects a user without an id even when submittedBy is set', () => {
    const resource = { submittedBy: owner._id };
    expect(canManageResource(resource, { displayName: 'No id' })).toBe(false);
  });

  test('rejects a missing user or resource', () => {
    expect(canManageResource({ submittedBy: owner._id }, null)).toBe(false);
    expect(canManageResource(null, owner)).toBe(false);
  });
});
