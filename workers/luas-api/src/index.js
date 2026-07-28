const LUAS_API = 'https://luasforecasts.rpa.ie/xml/get.ashx';
const ALLOWED_ORIGIN = 'https://copileo.github.io';
const STOP_CODES = new Set(['tpt','sdk','msq','gdk','con','bus','abb','jer','fou','smi','mus','heu','jam','fat','ria','sui','gol','dri','bla','blu','kyl','red','kin','bel','coo','hos','tal','fet','che','cit','for','sag','bro','cab','phi','gra','brd','dom','par','ocu','ocg','mar','wes','tri','daw','sti','har','cha','ran','bee','cow','mil','win','dun','bal','kil','sti2','san','cen','gln','gal','leo','bal2','car','lau','che2','bri']);

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed.' }, 405);
    }

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'vibecode-luas-api' });
    }

    if (url.pathname !== '/forecast') {
      return json({ error: 'Not found.' }, 404);
    }

    const stop = (url.searchParams.get('stop') || '').toLowerCase();
    if (!STOP_CODES.has(stop)) {
      return json({ error: 'A valid Luas stop code is required.' }, 400);
    }

    const upstreamUrl = new URL(LUAS_API);
    upstreamUrl.searchParams.set('action', 'forecast');
    upstreamUrl.searchParams.set('stop', stop);
    upstreamUrl.searchParams.set('encrypt', 'false');

    try {
      const upstream = await fetch(upstreamUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': '*/*',
          'User-Agent': 'curl/8.0',
          'Cache-Control': 'no-cache'
        },
        cf: { cacheTtl: 15, cacheEverything: true }
      });

      const body = await upstream.text();

      if (!upstream.ok) {
        return json({
          error: `Luas API returned ${upstream.status}.`,
          upstream: body.slice(0, 240)
        }, 502);
      }

      return new Response(body, {
        status: 200,
        headers: {
          ...corsHeaders(),
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=15, s-maxage=15',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    } catch (error) {
      return json({ error: 'The Luas API could not be reached.' }, 502);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
