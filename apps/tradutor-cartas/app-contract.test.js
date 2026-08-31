import test from 'node:test';
import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';

const root=new URL('./',import.meta.url);
const read=async name=>readFile(new URL(name,root),'utf8');

test('capture UI asks for camera or library instead of exposing only gallery',async()=>{
  const html=await read('index.html');
  assert.match(html,/id="front-capture"/);
  assert.match(html,/id="image-source-dialog"/);
  assert.match(html,/id="image-source-camera"/);
  assert.match(html,/id="image-source-gallery"/);
  assert.match(html,/id="camera-input"[^>]*capture="environment"/);
  assert.match(html,/id="gallery-input"/);
});

test('back input accepts camera and library selection',async()=>{
  const html=await read('index.html');
  assert.match(html,/id="back-input"[^>]*accept="image\/\*"/);
  assert.match(html,/src="camera-picker\.js\?v=0\.4\.2"/);
});

test('fragile DOM linking monkey patch is no longer loaded',async()=>{
  const html=await read('index.html');
  assert.doesNotMatch(html,/linking-word-fix\.js/);
  assert.match(html,/translation-context-fix\.js/);
});

test('front-only translation context is reset before the next card',async()=>{
  const source=await read('translation-context-fix.js');
  assert.match(source,/resetTimer=setTimeout/);
  assert.match(source,/clearTimeout\(resetTimer\)/);
  assert.match(source,/BACK-SIDE CONTEXT/);
});

test('phrase loading has a visible failure status in the result UI',async()=>{
  const html=await read('index.html');
  assert.match(html,/id="phrase-list-status"/);
});
