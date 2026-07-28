import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_DIR = process.env.LUAS_OUTPUT_DIR || '_site/luas-data';
const STALE_AFTER_SECONDS = 15 * 60;
const CONCURRENCY = 6;

const STOPS = [
  ['The Point','tpt'],['Spencer Dock','sdk'],['Mayor Square - NCI','msq'],["George's Dock",'gdk'],['Connolly','con'],['Busáras','bus'],['Abbey Street','abb'],['Jervis','jer'],['Four Courts','fou'],['Smithfield','smi'],['Museum','mus'],['Heuston','heu'],["James's",'jam'],['Fatima','fat'],['Rialto','ria'],['Suir Road','sui'],['Goldenbridge','gol'],['Drimnagh','dri'],['Blackhorse','bla'],['Bluebell','blu'],['Kylemore','kyl'],['Red Cow','red'],['Kingswood','kin'],['Belgard','bel'],['Cookstown','coo'],['Hospital','hos'],['Tallaght','tal'],['Fettercairn','fet'],['Cheeverstown','che'],['Citywest Campus','cit'],['Fortunestown','for'],['Saggart','sag'],['Broombridge','bro'],['Cabra','cab'],['Phibsborough','phi'],['Grangegorman','gra'],['Broadstone - University','brd'],['Dominick','dom'],['Parnell','par'],["O'Connell - Upper",'ocu'],["O'Connell - GPO",'ocg'],['Marlborough','mar'],['Westmoreland','wes'],['Trinity','tri'],['Dawson','daw'],["St. Stephen's Green",'sti'],['Harcourt','har'],['Charlemont','cha'],['Ranelagh','ran'],['Beechwood','bee'],['Cowper','cow'],['Milltown','mil'],['Windy Arbour','win'],['Dundrum','dun'],['Balally','bal'],['Kilmacud','kil'],['Stillorgan','sti2'],['Sandyford','san'],['Central Park','cen'],['Glencairn','gln'],['The Gallops','gal'],['Leopardstown Valley','leo'],['Ballyogan Wood','bal2'],['Carrickmines','car'],['Laughanstown','lau'],['Cherrywood','che2'],['Brides Glen','bri']
].map(([name, code]) => ({ name, code }));

function decodeXml(value = '') {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function attributes(source = '') {
  const result = {};
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
    result[match[1]] = decodeXml(match[3]);
  }
  return result;
}

function parseForecastXml(xml, stop) {
  const rootMatch = xml.match(/<stopInfo\b([^>]*)>/i);
  if (!rootMatch) throw new Error('XML response did not contain stopInfo.');
  const root = attributes(rootMatch[1]);
  const departures = [];

  for (const directionMatch of xml.matchAll(/<direction\b([^>]*)>([\s\S]*?)<\/direction>/gi)) {
    const direction = attributes(directionMatch[1]);
    for (const tramMatch of directionMatch[2].matchAll(/<tram\b([^>]*)\/?\s*>/gi)) {
      const tram = attributes(tramMatch[1]);
      const rawMinutes = String(tram.dueMins ?? '').trim();
      const minutes = /^due$/i.test(rawMinutes) ? 0 : Number.parseInt(rawMinutes, 10);
      if (!tram.destination || !Number.isFinite(minutes)) continue;
      departures.push({
        destination: tram.destination,
        minutes,
        direction: direction.name || ''
      });
    }
  }

  const updated = root.created && !Number.isNaN(Date.parse(root.created))
    ? new Date(root.created).toISOString()
    : new Date().toISOString();

  return {
    apiVersion: 1,
    provider: 'luas-xml-via-github-actions',
    stop,
    updated,
    collectedAt: new Date().toISOString(),
    staleAfterSeconds: STALE_AFTER_SECONDS,
    message: root.message || 'Luas forecast',
    departures
  };
}

async function fetchStop(stop) {
  const url = new URL('https://luasforecasts.rpa.ie/xml/get.ashx');
  url.searchParams.set('action', 'forecast');
  url.searchParams.set('stop', stop.code);
  url.searchParams.set('encrypt', 'false');

  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'vibecoding-luas-cache/1.0 (+https://github.com/copileo/vibecoding)'
    }
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseForecastXml(body, stop);
}

async function readPrevious(stopCode) {
  try {
    return JSON.parse(await readFile(path.join(OUTPUT_DIR, `${stopCode}.json`), 'utf8'));
  } catch {
    return null;
  }
}

async function collect(stop) {
  try {
    const payload = await fetchStop(stop);
    await writeFile(path.join(OUTPUT_DIR, `${stop.code}.json`), `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`updated ${stop.code}: ${payload.departures.length} departures`);
    return { code: stop.code, ok: true, departures: payload.departures.length };
  } catch (error) {
    const previous = await readPrevious(stop.code);
    if (previous) {
      previous.collectionError = error instanceof Error ? error.message : String(error);
      previous.lastCollectionAttempt = new Date().toISOString();
      await writeFile(path.join(OUTPUT_DIR, `${stop.code}.json`), `${JSON.stringify(previous, null, 2)}\n`);
      console.warn(`kept stale ${stop.code}: ${previous.collectionError}`);
      return { code: stop.code, ok: false, preserved: true };
    }
    console.error(`failed ${stop.code}:`, error);
    return { code: stop.code, ok: false, preserved: false };
  }
}

async function runPool(items, worker, concurrency) {
  const results = [];
  let cursor = 0;
  async function runner() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, runner));
  return results;
}

await mkdir(OUTPUT_DIR, { recursive: true });
const results = await runPool(STOPS, collect, CONCURRENCY);
const summary = {
  generatedAt: new Date().toISOString(),
  staleAfterSeconds: STALE_AFTER_SECONDS,
  totalStops: STOPS.length,
  successfulStops: results.filter(item => item.ok).length,
  preservedStops: results.filter(item => item.preserved).length,
  failedStops: results.filter(item => !item.ok && !item.preserved).map(item => item.code)
};
await writeFile(path.join(OUTPUT_DIR, 'index.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(summary);

if (summary.successfulStops === 0 && summary.preservedStops === 0) {
  throw new Error('No Luas stop data could be collected or preserved.');
}
