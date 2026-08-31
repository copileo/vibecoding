import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const read = async name => readFile(new URL(name, root), 'utf8');

test('capture UI is camera-only for the front', async () => {
  const html = await read('index.html');
  assert.match(html, /id="front-capture"/);
  assert.match(html, /id="camera-input"[^>]*accept="image\/\*"[^>]*capture="environment"/);
  assert.doesNotMatch(html, /image-source-dialog|gallery-input|image-source-gallery/);
});

test('back capture is camera-only and uses a separate input', async () => {
  const html = await read('index.html');
  assert.match(html, /id="camera-input"[^>]*capture="environment"/);
  assert.match(html, /id="back-input"[^>]*accept="image\/\*"[^>]*capture="environment"/);
  assert.doesNotMatch(html, /id="gallery-input"/);
  assert.match(html, /src="camera-picker\.js\?v=0\.4\.5"/);
});

test('camera picker keeps front and back photos separate', async () => {
  const source = await read('camera-picker.js');
  assert.match(source, /camera-input/);
  assert.match(source, /back-input/);
  assert.match(source, /back/);
});

test('result UI uses independent front and back tabs', async () => {
  const html = await read('index.html');
  const source = await read('result-tabs.js');
  assert.match(html, /result-tabs\.js\?v=0\.4\.5/);
  assert.doesNotMatch(html, /choice-render-fix\.js|translation-context-fix\.js/);
  assert.match(source, /data-result-side/);
  assert.match(source, /Frente/);
  assert.match(source, /Verso/);
  assert.match(source, /renderCard\(card\)/);
  assert.doesNotMatch(source, /details|choice-reference/);
});

test('front and back use the same independent prompt', async () => {
  const source = await read('result-tabs.js');
  assert.match(source, /INDEPENDENT_PROMPT/);
  assert.match(source, /image:backImage/);
  assert.match(source, /pendingBack=original\.call/);
  assert.match(source, /callNumber===2&&pendingBack/);
  assert.doesNotMatch(source, /BACK-SIDE CONTEXT|FRONT TRANSLATION/);
});

test('phrase loading has a visible failure status in the result UI', async () => {
  const html = await read('index.html');
  assert.match(html, /id="phrase-list-status"/);
});
