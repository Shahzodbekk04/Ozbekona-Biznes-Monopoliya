/** Public game clients are hosted on Yandex; room tokens still authorize every mutation. */
export function allowedGameOrigin(req: Request): string | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;
  try {
    const candidate = new URL(origin);
    const site = new URL(req.url);
    if (candidate.origin === site.origin) return null;
    if (candidate.protocol !== 'https:' || candidate.port || candidate.username || candidate.password) return null;
    const host = candidate.hostname.toLowerCase();
    const yandexHosts = ['yandex.com', 'yandex.ru', 'yandex.uz', 'yandex.kz', 'yandex.by', 'yandex.md', 'yandex.net'];
    return yandexHosts.some(domain => host === domain || host.endsWith('.' + domain)) ? candidate.origin : null;
  } catch { return null; }
}

export function gameCorsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}
