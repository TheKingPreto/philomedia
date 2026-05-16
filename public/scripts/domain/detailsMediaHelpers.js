export function getDisplayTitle(details) {
  return details.title || details.name || 'Unknown';
}

export function getDisplayDate(item) {
  return item.release_date || item.first_air_date || '';
}

export function getYear(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
}
