import test from 'node:test';
import assert from 'node:assert/strict';
import{loadPhrases,parsePhrases,PHRASE_CACHE_KEY,DEFAULT_PHRASES}from'./phrase-loader.js';

function storage(initial=''){
  const data=new Map(initial?[ [PHRASE_CACHE_KEY,initial] ]:[]);
  return{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
}

test('parsePhrases trims, removes blanks and deduplicates',()=>{
  assert.deepEqual(parsePhrases(' Alpha \n\nBeta\n Alpha '),['Alpha','Beta']);
});

test('loads phrases remotely and caches them',async()=>{
  const store=storage();
  const result=await loadPhrases({url:'https://example.test/Phrases',storage:store,fetchImpl:async()=>new Response(' Alpha\nBeta\n')});
  assert.equal(result.source,'remote');
  assert.deepEqual(result.phrases,['Alpha','Beta']);
  assert.equal(store.getItem(PHRASE_CACHE_KEY),'Alpha\nBeta');
});

test('uses cached phrases when remote loading fails',async()=>{
  const store=storage('Cached One\nCached Two');
  const result=await loadPhrases({url:'https://example.test/Phrases',storage:store,fetchImpl:async()=>{throw Error('network');}});
  assert.equal(result.source,'cache');
  assert.deepEqual(result.phrases,['Cached One','Cached Two']);
});

test('uses bundled phrases when remote and cache are unavailable',async()=>{
  const result=await loadPhrases({url:'https://example.test/Phrases',storage:storage(),fetchImpl:async()=>new Response('',{status:503}),fallback:['Fallback']});
  assert.equal(result.source,'bundled');
  assert.deepEqual(result.phrases,['Fallback']);
  assert.notEqual(result.phrases,DEFAULT_PHRASES);
});
