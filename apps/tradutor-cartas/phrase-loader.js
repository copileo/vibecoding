export const PHRASE_CACHE_KEY='vibecode-card-translator-phrases-v1';
export const DEFAULT_PHRASES=[
  'Liaku, the Dryad',
  'special poison-laden quills',
  'jump 32 feet vertically',
  'I deal with all manner of remedials',
  'leather wrapped eye-patch',
  'sheer cliffs that tower above all',
  'Boskton Market',
  'freshly oiled mechanical lock',
  'I seek out all manner of gemstones',
  'Cabu Glint',
  'outcropping of white stones',
  'scrolls and tomes'
];

export function parsePhrases(text){
  return [...new Set(String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
}

export function readCachedPhrases(storage){
  try{return parsePhrases(storage?.getItem(PHRASE_CACHE_KEY)||'')}catch{return[]}
}

export async function loadPhrases({fetchImpl=globalThis.fetch,storage=globalThis.localStorage,url,fallback=DEFAULT_PHRASES,timeoutMs=5000}={}){
  const cached=readCachedPhrases(storage);
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetchImpl(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const phrases=parsePhrases(await response.text());
      if(!phrases.length)throw Error('empty phrase list');
      try{storage?.setItem(PHRASE_CACHE_KEY,phrases.join('\n'))}catch{}
      return {phrases,source:'remote'};
    }finally{clearTimeout(timer)}
  }catch(error){
    if(cached.length)return {phrases:cached,source:'cache',error};
    return {phrases:[...fallback],source:'bundled',error};
  }
}
