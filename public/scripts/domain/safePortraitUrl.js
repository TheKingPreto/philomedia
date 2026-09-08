/**
 * Retratos de pensadores só podem apontar para hosts já na CSP
 * (`philosophersapi.com`, `upload.wikimedia.org`) ou para o proxy same-origin.
 * URLs interpoladas em innerHTML eram XSS armazenado.
 */

export const ALLOWED_PORTRAIT_HOSTS = new Set([
  'philosophersapi.com',
  'upload.wikimedia.org',
  'thumb.wikimedia.org',
]);

function stripUrlSecrets(parsed) {
  parsed.hash = '';
  parsed.username = '';
  parsed.password = '';
  return parsed;
}

function isBlockedScheme(value) {
  const lowered = String(value || '').trim().toLowerCase();
  return lowered.startsWith('javascript:')
    || lowered.startsWith('data:')
    || lowered.startsWith('vbscript:')
    || lowered.startsWith('blob:');
}

function sanitizeProxyPortraitUrl(parsed) {
  if (parsed.pathname !== '/api/assets/portrait') return '';
  const nested = sanitizePortraitUrl(parsed.searchParams.get('src'));
  if (!nested) return '';
  return `/api/assets/portrait?src=${encodeURIComponent(nested)}`;
}

/**
 * @param {unknown} raw
 * @returns {string} URL https segura, path do proxy, ou string vazia
 */
export function sanitizePortraitUrl(raw) {
  const value = String(raw || '').trim();
  if (!value || isBlockedScheme(value)) return '';

  const isProtocolRelative = value.startsWith('//');
  const isSameOriginPath = value.startsWith('/') && !isProtocolRelative;

  if (isSameOriginPath) {
    try {
      return sanitizeProxyPortraitUrl(new URL(value, 'https://philomedia.local'));
    } catch {
      return '';
    }
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return '';
  }

  if (parsed.protocol !== 'https:') return '';

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  if (!ALLOWED_PORTRAIT_HOSTS.has(host)) return '';

  return stripUrlSecrets(parsed).href;
}

/**
 * Retratos remotos da allowlist só entram no DOM via proxy same-origin.
 * A CSP bloqueia `upload.wikimedia.org` e `philosophersapi.com` em img-src.
 */
export function toDisplayPortraitUrl(raw) {
  const safeUrl = sanitizePortraitUrl(raw);
  if (!safeUrl) return '';
  if (safeUrl.startsWith('/api/assets/portrait')) return safeUrl;
  return sanitizePortraitUrl(`/api/assets/portrait?src=${encodeURIComponent(safeUrl)}`);
}

/**
 * Preenche um host de retrato via DOM (`src` em setAttribute). Nunca interpola a URL em HTML.
 * @returns {boolean} true se uma imagem segura foi aplicada
 */
export function fillPortraitHost(host, {
  url,
  alt = '',
  initials = '',
  loading = 'lazy',
  width,
  height,
  fetchPriority,
  decoding,
} = {}) {
  if (!host) return false;

  const displayUrl = toDisplayPortraitUrl(url);
  host.replaceChildren();

  if (!displayUrl) {
    host.classList.remove('philosopher-sigil-photo');
    host.textContent = String(initials || '');
    return false;
  }

  host.classList.add('philosopher-sigil-photo');
  const img = document.createElement('img');
  img.setAttribute('src', displayUrl);
  img.setAttribute('alt', String(alt || ''));
  img.loading = loading;
  if (width) img.setAttribute('width', String(width));
  if (height) img.setAttribute('height', String(height));
  if (fetchPriority) img.setAttribute('fetchpriority', fetchPriority);
  if (decoding) img.decoding = decoding;
  img.addEventListener('error', () => {
    host.classList.remove('philosopher-sigil-photo');
    host.replaceChildren();
    host.textContent = String(initials || '');
  }, { once: true });
  host.appendChild(img);
  return true;
}
