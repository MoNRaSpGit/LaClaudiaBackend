export function normalizeBarcode(rawBarcode) {
  return String(rawBarcode || '').trim();
}

export function normalizeLimit(rawLimit) {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed)) {
    return 5;
  }
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

export function escapeId(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}
