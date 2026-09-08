const DEFAULT_USER_AGENT = 'PhiloMedia/1.0 (+https://github.com/Lucassilva027/philomedia)';

export const MAX_PORTRAIT_BYTES = 512 * 1024;
export const MAX_JSON_PROXY_BYTES = 512 * 1024;

export const PORTRAIT_ALLOWED_HOSTS = new Set([
  'upload.wikimedia.org',
  'thumb.wikimedia.org',
  'philosophersapi.com',
  'www.philosophersapi.com',
]);

export const WIKI_SUMMARY_ALLOWED_HOSTS = new Set([
  'en.wikipedia.org',
  'pt.wikipedia.org',
]);

export const PHILOSOPHERS_DIRECTORY_URL = 'https://philosophersapi.com/api/philosophers';

export function isAllowedPortraitHost(hostname) {
  return PORTRAIT_ALLOWED_HOSTS.has(String(hostname || '').toLowerCase());
}

export function isAllowedWikiSummaryHost(hostname) {
  return WIKI_SUMMARY_ALLOWED_HOSTS.has(String(hostname || '').toLowerCase());
}

export function parsePortraitSource(raw) {
  const source = String(raw || '').trim();
  if (!source) {
    return { error: 'Portrait source is required.', status: 400 };
  }

  let portraitUrl;
  try {
    portraitUrl = new URL(source);
  } catch {
    return { error: 'Invalid portrait source.', status: 400 };
  }

  if (!['https:', 'http:'].includes(portraitUrl.protocol)) {
    return { error: 'Portrait protocol is not allowed.', status: 400 };
  }

  if (!isAllowedPortraitHost(portraitUrl.hostname)) {
    return { error: 'Portrait host is not allowed.', status: 403 };
  }

  return { url: portraitUrl };
}

export function buildWikiSummaryUrl(title, lang = 'en') {
  const cleaned = String(title || '').trim();
  if (!cleaned) {
    return { error: 'Wiki title is required.', status: 400 };
  }

  const locale = String(lang || 'en').trim().toLowerCase().startsWith('pt') ? 'pt' : 'en';
  const host = `${locale}.wikipedia.org`;
  if (!isAllowedWikiSummaryHost(host)) {
    return { error: 'Wiki host is not allowed.', status: 403 };
  }

  const encoded = encodeURIComponent(cleaned.replace(/\s+/g, '_'));
  return { url: new URL(`https://${host}/api/rest_v1/page/summary/${encoded}`) };
}

/**
 * Lê o body com teto duro. Aborta se Content-Length ou o stream ultrapassar.
 */
export async function readLimitedBody(response, maxBytes, { abort } = {}) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    abort?.();
    const error = new Error('Upstream body exceeds size limit.');
    error.status = 413;
    error.code = 'payload_too_large';
    throw error;
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      const error = new Error('Upstream body exceeds size limit.');
      error.status = 413;
      error.code = 'payload_too_large';
      throw error;
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      abort?.();
      reader.cancel().catch(() => {});
      const error = new Error('Upstream body exceeds size limit.');
      error.status = 413;
      error.code = 'payload_too_large';
      throw error;
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, received);
}

export async function fetchLimitedAsset(url, {
  maxBytes = MAX_PORTRAIT_BYTES,
  accept = '',
  timeoutMs = 8000,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        ...(accept ? { Accept: accept } : {}),
      },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const error = new Error('Could not fetch upstream asset.');
      error.status = 502;
      error.code = 'upstream_error';
      throw error;
    }

    const body = await readLimitedBody(upstream, maxBytes, {
      abort: () => controller.abort(),
    });

    return {
      body,
      contentType: upstream.headers.get('content-type') || 'application/octet-stream',
      cacheControl: upstream.headers.get('cache-control') || 'public, max-age=86400, stale-while-revalidate=604800',
    };
  } catch (error) {
    if (error?.status === 413 || error?.code === 'payload_too_large') {
      throw error;
    }
    if (error?.name === 'AbortError') {
      const timeout = new Error('Upstream asset timed out.');
      timeout.status = 502;
      timeout.code = 'upstream_timeout';
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPortraitAsset(source) {
  const parsed = parsePortraitSource(source);
  if (parsed.error) {
    const error = new Error(parsed.error);
    error.status = parsed.status;
    throw error;
  }

  return fetchLimitedAsset(parsed.url, {
    maxBytes: MAX_PORTRAIT_BYTES,
    accept: 'image/*',
  });
}

export async function fetchWikiSummaryAsset(title, lang) {
  const parsed = buildWikiSummaryUrl(title, lang);
  if (parsed.error) {
    const error = new Error(parsed.error);
    error.status = parsed.status;
    throw error;
  }

  return fetchLimitedAsset(parsed.url, {
    maxBytes: MAX_JSON_PROXY_BYTES,
    accept: 'application/json',
  });
}

export async function fetchPhilosophersDirectoryAsset() {
  return fetchLimitedAsset(PHILOSOPHERS_DIRECTORY_URL, {
    maxBytes: MAX_JSON_PROXY_BYTES,
    accept: 'application/json',
  });
}
