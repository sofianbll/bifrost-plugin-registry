import type { GalleryEntry } from './types';
export function filterEntries(entries: GalleryEntry[], family: string, level: string, origin: string, query: string) {
  const text = query.toLocaleLowerCase();
  return entries.filter(entry => (!family || entry.family === family) && (!level || entry.level === level) && (!origin || entry.origin === origin) && `${entry.title} ${entry.family} ${entry.source} ${entry.version} ${entry.origin}`.toLocaleLowerCase().includes(text));
}
