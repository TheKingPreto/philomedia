const LIBRARY_BASE = '/api/me/library';

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function requestLibrary(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const message = payload.message || payload.error || 'Library request failed';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function buildLibraryItem(details, mediaType) {
  return {
    tmdbId: String(details.id),
    mediaType,
    title: details.title || details.name || 'Untitled',
    posterPath: details.poster_path || '',
    releaseDate: details.release_date || details.first_air_date || '',
    voteAverage: Number(details.vote_average) || 0,
  };
}

export async function getLibrary() {
  return requestLibrary(LIBRARY_BASE);
}

export async function getLibraryStatus(tmdbId, mediaType) {
  return requestLibrary(
    `${LIBRARY_BASE}/status?tmdbId=${encodeURIComponent(tmdbId)}&mediaType=${encodeURIComponent(mediaType)}`
  );
}

export async function saveLibraryItem(collection, item) {
  return requestLibrary(`${LIBRARY_BASE}/${collection}`, {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function removeLibraryItem(collection, tmdbId, mediaType) {
  return requestLibrary(
    `${LIBRARY_BASE}/${collection}/${encodeURIComponent(mediaType)}/${encodeURIComponent(tmdbId)}`,
    {
      method: 'DELETE',
    }
  );
}
