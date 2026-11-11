// Site-wide settings live in /data/site.json so leads can change them from GitHub
// without touching code. JSON files are revalidated on every load (cheap 304s).

const cache = new Map();

export function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path, { cache: 'no-cache' }).then((res) => {
      if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
      return res.json();
    }));
  }
  return cache.get(path);
}

const DEFAULTS = {
  academicYear: '2026-27',
  slackUrl: '',
  lumaCalendarUrl: '',
  lumaEmbedUrl: '',
  contactEmail: '',
};

export async function getConfig() {
  try {
    return { ...DEFAULTS, ...(await getJSON('/data/site.json')) };
  } catch (err) {
    console.error(err);
    return { ...DEFAULTS };
  }
}

/** "2026-27" -> "2026–27" for display. */
export function yearLabel(year) {
  return String(year || '').replace('-', '–');
}
