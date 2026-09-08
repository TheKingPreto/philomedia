/**
 * @file resourceAccess.js
 * @description Whitelist de campos e verificação de posse para as rotas que
 * mutam conteúdo. Passar `req.body` inteiro ao Mongoose permitia sobrescrever
 * campos que o servidor controla — em especial `legacyId`, que é a chave dos
 * pareamentos curados.
 */

/** Chaves que nunca são copiadas, mesmo que a whitelist as inclua por engano. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Copia apenas os campos permitidos, e apenas se forem propriedades próprias
 * da origem.
 */
export function pickAllowedFields(source, allowedFields) {
  const result = {};
  if (!source || typeof source !== 'object') return result;

  for (const field of allowedFields) {
    if (UNSAFE_KEYS.has(field)) continue;
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field];
    }
  }

  return result;
}

export function isAdmin(user) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

function getUserId(user) {
  return String(user?._id ?? user?.id ?? '');
}

/**
 * Um recurso sem `submittedBy` é conteúdo editorial ou importado, e só um
 * admin lhe pode tocar. Caso contrário, apenas quem o submeteu.
 */
export function canManageResource(resource, user) {
  if (!user || !resource) return false;
  if (isAdmin(user)) return true;

  const ownerId = resource.submittedBy;
  if (!ownerId) return false;

  const userId = getUserId(user);
  return userId !== '' && String(ownerId) === userId;
}

export const FORBIDDEN_MESSAGE =
  'You do not have permission to modify this resource.';
