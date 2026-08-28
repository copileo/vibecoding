export function normalisePhrase(value){
  return String(value||'')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}

function collectOriginalText(result){
  return [result?.front,result?.back]
    .flatMap(card=>card?.sections||[])
    .flatMap(section=>[
      section.original,
      ...(section.originalSegments||[]).map(segment=>segment.text)
    ])
    .filter(Boolean)
    .join('\n');
}

export function findPhraseMatches(result, phrases){
  const source=normalisePhrase(collectOriginalText(result));
  if(!source)return [];

  const seen=new Set();
  return (phrases||[])
    .map(String)
    .map(phrase=>phrase.trim())
    .filter(Boolean)
    .filter(phrase=>{
      const candidate=normalisePhrase(phrase);
      if(!candidate||seen.has(candidate))return false;
      seen.add(candidate);
      return ` ${source} `.includes(` ${candidate} `);
    })
    .map(phrase=>({phrase,detectedAt:result?.createdAt}));
}
