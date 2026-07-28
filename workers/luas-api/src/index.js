const ALLOWED_ORIGIN = 'https://copileo.github.io';
const LUAS_ORIGIN = 'https://www.luas.ie';
const CACHE_SECONDS = 20;

const STOP_NAMES = {
  tpt:'The Point',sdk:'Spencer Dock',msq:'Mayor Square - NCI',gdk:"George's Dock",con:'Connolly',bus:'Busáras',abb:'Abbey Street',jer:'Jervis',fou:'Four Courts',smi:'Smithfield',mus:'Museum',heu:'Heuston',jam:"James's",fat:'Fatima',ria:'Rialto',sui:'Suir Road',gol:'Goldenbridge',dri:'Drimnagh',bla:'Blackhorse',blu:'Bluebell',kyl:'Kylemore',red:'Red Cow',kin:'Kingswood',bel:'Belgard',coo:'Cookstown',hos:'Hospital',tal:'Tallaght',fet:'Fettercairn',che:'Cheeverstown',cit:'Citywest Campus',for:'Fortunestown',sag:'Saggart',bro:'Broombridge',cab:'Cabra',phi:'Phibsborough',gra:'Grangegorman',brd:'Broadstone - University',dom:'Dominick',par:'Parnell',ocu:"O'Connell - Upper",ocg:"O'Connell - GPO",mar:'Marlborough',wes:'Westmoreland',tri:'Trinity',daw:'Dawson',sti:"St. Stephen's Green",har:'Harcourt',cha:'Charlemont',ran:'Ranelagh',bee:'Beechwood',cow:'Cowper',mil:'Milltown',win:'Windy Arbour',dun:'Dundrum',bal:'Balally',kil:'Kilmacud',sti2:'Stillorgan',san:'Sandyford',cen:'Central Park',gln:'Glencairn',gal:'The Gallops',leo:'Leopardstown Valley',bal2:'Ballyogan Wood',car:'Carrickmines',lau:'Laughanstown',che2:'Cherrywood',bri:'Brides Glen'
};

const STOP_SLUGS = {
  gdk:'georges-dock',jam:'james',ocu:'oconnell-upper',ocg:'oconnell-gpo',sti:'st-stephens-green'
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'vibecode-luas-api', provider: 'luas-website-scraper', apiVersion: 1 });
    }

    if (url.pathname !== '/forecast' && url.pathname !== '/v1/forecast') {
      return json({ error: 'Not found.' }, 404);
    }

    const stopCode = (url.searchParams.get('stop') || '').toLowerCase();
    const stopName = STOP_NAMES[stopCode];
    if (!stopName) return json({ error: 'A valid Luas stop code is required.' }, 400);

    try {
      const forecast = await getForecast(stopCode, stopName);
      return json(forecast, 200, {
        'Cache-Control': `public, max-age=5, s-maxage=${CACHE_SECONDS}`,
        'X-Luas-Provider': 'website-scraper'
      });
    } catch (error) {
      return json({
        error: 'The Luas stop page could not be parsed.',
        detail: error instanceof Error ? error.message : String(error)
      }, 502);
    }
  }
};

async function getForecast(stopCode, stopName) {
  const slug = STOP_SLUGS[stopCode] || slugify(stopName);
  const pageUrl = `${LUAS_ORIGIN}/stops/${slug}/`;
  const response = await fetch(pageUrl, {
    redirect: 'follow',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-IE,en;q=0.9'
    },
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
  });

  const html = await response.text();
  if (!response.ok) throw new Error(`Stop page returned HTTP ${response.status}.`);
  if (!/<html\b/i.test(html)) throw new Error('Stop page did not return HTML.');

  const parsed = parseStopPage(html);
  if (!parsed.boards.length) {
    const title = extractTitle(html);
    throw new Error(`No departure boards found${title ? ` on “${title}”` : ''}.`);
  }

  const departures = parsed.boards.flatMap((board, index) => {
    const direction = index === 0 ? 'Inbound' : 'Outbound';
    return board.departures.map(item => ({ ...item, direction }));
  });

  return {
    apiVersion: 1,
    provider: 'luas-website-scraper',
    stop: { code: stopCode, name: stopName, slug },
    updated: new Date().toISOString(),
    message: parsed.message || 'Live Luas forecast',
    departures,
    directions: parsed.boards.map((board, index) => ({
      name: index === 0 ? 'Inbound' : 'Outbound',
      message: board.message || parsed.message || '',
      departures: board.departures
    }))
  };
}

function parseStopPage(html) {
  const boards = [];
  const tablePattern = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tablePattern.exec(html))) {
    const tableHtml = tableMatch[1];
    const tableText = cleanText(tableHtml);
    if (!/destination/i.test(tableText) || !/mins?/i.test(tableText)) continue;

    const departures = [];
    const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowPattern.exec(tableHtml))) {
      const cells = [];
      const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;
      while ((cellMatch = cellPattern.exec(rowMatch[1]))) cells.push(cleanText(cellMatch[1]));
      if (cells.length < 2 || /destination/i.test(cells[0])) continue;

      const destination = cells[0];
      const minutes = normaliseMinutes(cells[1]);
      if (!destination || /^no\s+(trams?|northbound|southbound|eastbound|westbound)/i.test(destination)) continue;
      if (minutes !== null) departures.push({ destination, minutes });
    }

    const afterTable = html.slice(tablePattern.lastIndex, tablePattern.lastIndex + 1200);
    const message = extractServiceMessage(afterTable);
    boards.push({ departures, message });
  }

  const message = boards.map(board => board.message).find(Boolean) || extractServiceMessage(html);
  return { boards: boards.slice(0, 2), message };
}

function extractServiceMessage(html) {
  const text = cleanText(html);
  const patterns = [
    /((?:Red|Green) Line Services? [^.\n<]{3,100})/i,
    /(Services? Operating Normally)/i,
    /((?:Red|Green) Line [^.\n<]{3,100}(?:disruption|delay|suspended|operating)[^.\n<]*)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

function normaliseMinutes(value) {
  const clean = String(value || '').trim();
  if (/^due$/i.test(clean)) return 0;
  const match = clean.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function extractTitle(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? cleanText(match[1]) : '';
}

function cleanText(value) {
  return decodeEntities(String(value || '').replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeEntities(value) {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return value.replace(/&(#x?[0-9a-f]+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    }
    return entities[entity.toLowerCase()] ?? _;
  });
}

function slugify(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };
}

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  });
}
