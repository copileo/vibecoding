import test from 'node:test';
import assert from 'node:assert/strict';
import {findPhraseMatches,normalisePhrase} from './phrase-matcher.js';

const result={
  createdAt:'2026-08-28T15:00:00.000Z',
  front:{sections:[
    {original:'I met Liaku, the Dryad near Boskton Market.'},
    {originalSegments:[{text:'He uses special poison-laden quills.'}]}
  ]},
  back:{sections:[
    {original:'You can jump 32 feet vertically.'}
  ]}
};

test('normalisePhrase ignores case, punctuation and accents',()=>{
  assert.equal(normalisePhrase('Liaku, the Dryad'),'liaku the dryad');
  assert.equal(normalisePhrase('  CAFÉ — TEST  '),'cafe test');
});

test('matches phrases in original OCR text from both sections and segments',()=>{
  const matches=findPhraseMatches(result,[
    'Liaku, the Dryad',
    'special poison-laden quills',
    'jump 32 feet vertically'
  ]);
  assert.deepEqual(matches.map(x=>x.phrase),[
    'Liaku, the Dryad',
    'special poison-laden quills',
    'jump 32 feet vertically'
  ]);
});

test('does not match a phrase that is only a substring of another word',()=>{
  const matches=findPhraseMatches({front:{sections:[{original:'The Dryadling was nearby.'}]}},['dryad']);
  assert.deepEqual(matches,[]);
});

test('deduplicates configured phrases',()=>{
  const matches=findPhraseMatches({front:{sections:[{original:'Visit Boskton Market today.'}]}},[
    'Boskton Market','Boskton Market','boskton market'
  ]);
  assert.equal(matches.length,3);
});

test('returns no matches for empty or missing OCR text',()=>{
  assert.deepEqual(findPhraseMatches({front:{sections:[]}},['Liaku']),[]);
  assert.deepEqual(findPhraseMatches(null,['Liaku']),[]);
});
