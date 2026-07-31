import { CopileoAI, StaticTokenCredentialsProvider } from '../../packages/copileo-ai/src/index.js';

const $ = id => document.getElementById(id);
const store = 'vibecode-ai-api-lab-v2';
const saved = JSON.parse(localStorage.getItem(store) || '{}');
let selectedImage = null;
let previewUrl = null;

$('url').value = saved.url || 'https://vibecoding-ai-api.copileo.workers.dev';
$('token').value = saved.token || '';
$('model').value = saved.model || 'gpt-5.4-nano';

function persist() {
  localStorage.setItem(store, JSON.stringify({
    url: $('url').value.trim(),
    token: $('token').value,
    model: $('model').value.trim(),
  }));
}

function client() {
  persist();
  const gatewayUrl = $('url').value.trim();
  if (!gatewayUrl) throw new Error('Informe a URL do Worker.');

  return new CopileoAI({
    gatewayUrl,
    appId: 'ai-api-lab',
    defaultModel: $('model').value.trim() || undefined,
    credentialsProvider: new StaticTokenCredentialsProvider($('token').value),
  });
}

async function execute(action) {
  $('status').textContent = 'Carregando…';
  $('send').disabled = true;

  try {
    const ai = client();
    let data;

    if (action === 'health') data = await ai.health();
    else if (action === 'models') data = await ai.models();
    else if (action === 'chat') {
      const prompt = $('prompt').value;
      data = selectedImage
        ? await ai.chatWithImage({ prompt, image: selectedImage })
        : await ai.chat(prompt);
    } else data = await debugProvider(ai);

    $('status').textContent = 'HTTP 200';
    $('result').textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    $('status').textContent = error.status ? `HTTP ${error.status}` : 'Erro';
    $('result').textContent = JSON.stringify({
      error: {
        code: error.code || 'LAB_ERROR',
        message: error.message,
        details: error.details || null,
      },
    }, null, 2);
  } finally {
    $('send').disabled = false;
  }
}

async function debugProvider(ai) {
  const token = await ai.credentialsProvider.getToken();
  const headers = { Accept: 'application/json', 'X-Copileo-App-ID': 'ai-api-lab' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${ai.gatewayUrl}/debug/provider`, { headers });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

  if (!response.ok) {
    const error = new Error(payload?.error?.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = payload?.error?.code || 'GATEWAY_ERROR';
    error.details = payload;
    throw error;
  }

  return payload;
}

function setImage(file) {
  clearImage();
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    $('image').value = '';
    throw new Error('Selecione uma imagem JPEG, PNG ou WebP.');
  }
  if (file.size > 3 * 1024 * 1024) {
    $('image').value = '';
    throw new Error('A imagem deve ter no máximo 3 MB.');
  }

  selectedImage = file;
  previewUrl = URL.createObjectURL(file);
  $('preview').src = previewUrl;
  $('image-name').textContent = file.name;
  $('image-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;
  $('image-box').hidden = false;
}

function clearImage() {
  selectedImage = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  $('preview').removeAttribute('src');
  $('image-box').hidden = true;
  $('image').value = '';
}

document.querySelectorAll('[data-action]').forEach(button => {
  button.onclick = () => execute(button.dataset.action);
});

$('image').onchange = event => {
  try { setImage(event.target.files?.[0]); }
  catch (error) {
    $('status').textContent = 'Erro';
    $('result').textContent = JSON.stringify({ error: { code: 'INVALID_IMAGE', message: error.message } }, null, 2);
  }
};
$('remove-image').onclick = clearImage;
$('send').onclick = () => execute('chat');
