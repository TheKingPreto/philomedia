const OAUTH_CALLBACK_PATH = '/auth/google/callback';

function cleanUrl(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

function firstHeaderValue(value = '') {
  return String(value || '').split(',')[0].trim();
}

function getHostname(value = '') {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isLocalHostname(hostname = '') {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1';
}

export function isLocalUrl(value = '') {
  const hostname = getHostname(value);
  return Boolean(hostname && isLocalHostname(hostname));
}

export function getRequestBaseUrl(req) {
  const forwardedHost = firstHeaderValue(req.get?.('x-forwarded-host'));
  const host = forwardedHost || firstHeaderValue(req.get?.('host'));

  if (!host) {
    return '';
  }

  const forwardedProtocol = firstHeaderValue(req.get?.('x-forwarded-proto'));
  const protocol = forwardedProtocol || req.protocol || 'http';
  return `${protocol}://${host}`;
}

export function getPublicBaseUrl(req, { allowLocalOverride = true } = {}) {
  const publicSiteUrl = cleanUrl(process.env.PUBLIC_BASE_URL || process.env.PUBLIC_SITE_URL);
  const requestBaseUrl = getRequestBaseUrl(req);

  if (
    publicSiteUrl
    && (
      allowLocalOverride
      || !isLocalUrl(publicSiteUrl)
      || !requestBaseUrl
      || isLocalUrl(requestBaseUrl)
    )
  ) {
    return publicSiteUrl;
  }

  return requestBaseUrl || publicSiteUrl;
}

export function buildPublicUrl(req, path) {
  return new URL(path, `${getPublicBaseUrl(req).replace(/\/+$/, '')}/`).toString();
}

export function getDefaultOAuthCallbackUrl() {
  const configuredCallbackUrl = cleanUrl(process.env.GOOGLE_CALLBACK_URL);
  if (configuredCallbackUrl) {
    return configuredCallbackUrl;
  }

  const publicSiteUrl = cleanUrl(process.env.PUBLIC_BASE_URL || process.env.PUBLIC_SITE_URL);
  if (publicSiteUrl) {
    return new URL(OAUTH_CALLBACK_PATH, `${publicSiteUrl}/`).toString();
  }

  return OAUTH_CALLBACK_PATH;
}

/**
 * Resolves the Google OAuth callback URL for Passport.
 * Decision order: explicit env callback → derived from public base URL → env fallback → relative path.
 */
export function resolveOAuthCallbackUrl(req) {
  const configured = cleanUrl(process.env.GOOGLE_CALLBACK_URL);
  const requestBase = getRequestBaseUrl(req);

  const useConfigured = Boolean(
    configured
    && (!isLocalUrl(configured) || !requestBase || isLocalUrl(requestBase)),
  );
  if (useConfigured) {
    return configured;
  }

  const baseUrl = getPublicBaseUrl(req, { allowLocalOverride: false });
  if (baseUrl) {
    return new URL(OAUTH_CALLBACK_PATH, `${baseUrl.replace(/\/+$/, '')}/`).toString();
  }

  return configured || OAUTH_CALLBACK_PATH;
}
