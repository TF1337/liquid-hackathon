// Session-scoped store of object URLs for uploaded images, keyed by fact id.
// The backend doesn't persist images, so we keep them in memory for the demo.

const STORE = new Map<string, string>();

export function setImage(factId: string, file: File | Blob): string {
  const existing = STORE.get(factId);
  if (existing) URL.revokeObjectURL(existing);
  const url = URL.createObjectURL(file);
  STORE.set(factId, url);
  return url;
}

export function getImage(factId: string): string | undefined {
  return STORE.get(factId);
}