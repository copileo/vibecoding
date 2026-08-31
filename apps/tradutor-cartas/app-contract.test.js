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
  assert.match(html, /src="camera-picker\.js\?v=0\.4\.3"/);
});

test('camera picker keeps front and back photos separate', async () => {
  const source = await read('camera-picker.js');
  assert.match(source, /camera-input/);
  assert.match(source, /back-input/);
  assert.match(source, /back/);
});

test('fragile DOM linking monkey patch is no longer loaded', async () => {
  const html = await read('index.html');
  assert.doesNotMatch(html, /linking-word-fix\.js/);
  assert.match(html, /translation-context-fix\.js/);
});

test('front-only translation context is reset before the next card', async () => {
  const source = await read('translation-context-fix.js');
  assert.match(source, /resetTimer=setTimeout/);
  assert.match(source, /clearTimeout\(resetTimer\)/);
  assert.match(source, /BACK-SIDE CONTEXT/);
});

test('phrase loading has a visible failure status in the result UI', async () => {
  const html = await read('index.html');
  assert.match(html, /id="phrase-list-status"/);
});

test('back choice headings are not rendered as their own expanded result', async () => {
  const source = await read('app.js');
  assert.match(source, /expandBackChoiceSections\(sections,linked\)/);
  assert.match(source, /section\.type!=='choice'/);
  assert.match(source, /for\(let i=index\+1;i<sections\.length&&sections\[i\]\.type!=='choice';i\+\+\)/);
});

test('expanded choice results remove a duplicated choice label', async () => {
  const source = await read('choice-render-fix.js');
  assert.match(source, /choice-reference-content/);
  assert.match(source, /normalise\(first\.textContent\)===choiceText/);
  assert.match(source, /first\.remove\(\)/);
  const html = await read('index.html');
  assert.match(html, /choice-render-fix\.js\?v=0\.4\.4/);
});
