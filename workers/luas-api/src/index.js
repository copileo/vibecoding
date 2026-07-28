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

    if (url.pathname !== '/forecast' && url.pathname !== '/debug') {
      return json({ error: 'Not found.' }, 404);
    }

    const stop = (url.searchParams.get('stop') || '').toLowerCase();
    if (!STOP_CODES.has(stop)) {
      return json({ error: 'A valid Luas stop code is required.' }, 400);
    }

    const attempts = [
      {
        name: 'https-minimal',
        url: buildUpstreamUrl('https:', stop),
        init: { redirect: 'follow' }
      },
      {
        name: 'https-browser',
        url: buildUpstreamUrl('https:', stop),
        init: {
          redirect: 'follow',
          headers: {
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-IE,en;q=0.9',
            Referer: 'https://www.luas.ie/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'
          }
        }
      },
      {
        name: 'http-minimal',
        url: buildUpstreamUrl('http:', stop),
        init: { redirect: 'follow' }
      }
    ];

    const diagnostics = [];

    for (const attempt of attempts) {
      try {
        const upstream = await fetch(attempt.url, attempt.init);
        const body = await upstream.text();
        const valid = upstream.ok && /<stopInfo\b/i.test(body);

        diagnostics.push({
          name: attempt.name,
          status: upstream.status,
          contentType: upstream.headers.get('content-type'),
          preview: body.replace(/\s+/g, ' ').slice(0, 180)
        });

        if (valid) {
          return new Response(body, {
            status: 200,
            headers: {
              ...corsHeaders(),
              'Content-Type': 'application/xml; charset=utf-8',
              'Cache-Control': 'public, max-age=15, s-maxage=15',
              'X-Luas-Upstream-Variant': attempt.name,
              'X-Content-Type-Options': 'nosniff'
            }
          });
        }
      } catch (error) {
        diagnostics.push({
          name: attempt.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return json({
      error: 'All Luas upstream request variants failed.',
      diagnostics
    }, 502);
  }
};

function buildUpstreamUrl(protocol, stop) {
  const url = new URL(`${protocol}//luasforecasts.rpa.ie/xml/get.ashx`);
  url.searchParams.set('action', 'forecast');
  url.searchParams.set('stop', stop);
  url.searchParams.set('encrypt', 'false');
  return url.toString();
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
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
