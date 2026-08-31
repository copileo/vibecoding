import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('./',import.meta.url);
const read=async name=>readFile(new URL(name,root),'utf8');

test('phrase loader preserves exact shared phrases for small visible text',async()=>{
  const source=await read('phrase-loader-fix.js');
  assert.match(source,/PHRASE DETECTION/);
  assert.match(source,/small text, footer text, instruction boxes/);
  assert.match(source,/preserve the exact English phrase/);
  assert.match(source,/original\/originalSegments/);
});

test('phrase loader uses the same shared phrase list for matching and AI extraction',async()=>{
  const source=await read('phrase-loader-fix.js');
  assert.match(source,/raw\.githubusercontent\.com\/fernandosivelli\/ArydiaPhrases\/main\/Phrases/);
  assert.match(source,/phraseListPromise/);
  assert.match(source,/result\.phrases\.map/);
});
