const RATINGS_BASE = '/api/me/ratings';

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function requestRatings(url, options = {}) {
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
    const message = payload.message || payload.error || 'Rating request failed';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export async function listRatings({ targetType, targetId } = {}) {
  const params = new URLSearchParams();
  if (targetType) params.set('targetType', targetType);
  if (targetId) params.set('targetId', targetId);
  const query = params.toString();
  return requestRatings(`${RATINGS_BASE}${query ? `?${query}` : ''}`);
}

export async function getRating(targetType, targetId) {
  const payload = await listRatings({ targetType, targetId });
  return payload.ratings?.[0] || null;
}

export async function upsertRating({ targetType, targetId, value }) {
  return requestRatings(RATINGS_BASE, {
    method: 'PUT',
    body: JSON.stringify({ targetType, targetId, value }),
  });
}

export async function deleteRating({ targetType, targetId }) {
  const params = new URLSearchParams({ targetType, targetId });
  return requestRatings(`${RATINGS_BASE}?${params.toString()}`, {
    method: 'DELETE',
  });
}
