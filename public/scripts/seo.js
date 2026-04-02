function ensureMeta(attribute, key) {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  return element;
}

function ensureLink(rel) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }

  return element;
}

function buildAbsoluteUrl(value) {
  if (!value) return window.location.href;

  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return window.location.href;
  }
}

export function updatePageSeo({
  title,
  description,
  path = window.location.pathname + window.location.search,
  image = '',
  type = 'website',
  robots = '',
} = {}) {
  const resolvedTitle = String(title || document.title || 'PhiloMedia').trim();
  const resolvedDescription = String(description || '').trim();
  const resolvedUrl = buildAbsoluteUrl(path);
  const resolvedImage = image ? buildAbsoluteUrl(image) : '';

  document.title = resolvedTitle;

  if (resolvedDescription) {
    ensureMeta('name', 'description').setAttribute('content', resolvedDescription);
    ensureMeta('property', 'og:description').setAttribute('content', resolvedDescription);
    ensureMeta('name', 'twitter:description').setAttribute('content', resolvedDescription);
  }

  ensureMeta('property', 'og:title').setAttribute('content', resolvedTitle);
  ensureMeta('property', 'og:type').setAttribute('content', type);
  ensureMeta('property', 'og:url').setAttribute('content', resolvedUrl);
  ensureMeta('property', 'og:site_name').setAttribute('content', 'PhiloMedia');
  ensureMeta('name', 'twitter:title').setAttribute('content', resolvedTitle);
  ensureMeta('name', 'twitter:card').setAttribute('content', resolvedImage ? 'summary_large_image' : 'summary');

  if (robots) {
    ensureMeta('name', 'robots').setAttribute('content', robots);
  }

  if (resolvedImage) {
    ensureMeta('property', 'og:image').setAttribute('content', resolvedImage);
    ensureMeta('name', 'twitter:image').setAttribute('content', resolvedImage);
  }

  ensureLink('canonical').setAttribute('href', resolvedUrl);
}
