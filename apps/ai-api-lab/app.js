const APP_VERSION = '1.2.1';
const SDK_VERSION = '1.2.1';
const $ = id => document.getElementById(id);
const store = 'vibecode-ai-api-lab-v2';
const saved = JSON.parse(localStorage.getItem(store) || '{}');
let selectedImage = null;
let previewUrl = null;

$('app-version').textContent = `v${APP_VERSION}`;
$('url').value = saved.url || 'https://vibecoding-ai-api.copileo.workers.dev';
$('token').value = saved.token || '';
$('model').value = saved.model || 'gpt-5.4-nano';

bindUi();
boot();

function boot() {
  const ready = typeof window.CopileoAI === 'function'
    && typeof window.StaticTokenCredentialsProvider === 'function';
  setInteractive(ready);
  $('status').textContent = ready ? 'Pronto' : 'Falha ao iniciar';
  $('result').textContent = ready
    ? `AI API Lab v${APP_VERSION} inicializado com SDK v${SDK_VERSION}.`
    : JSON.stringify({ error: { code: 'SDK_LOAD_ERROR', message: 'O SDK local não foi carregado.', appVersion: APP_VERSION, sdkVersion: SDK_VERSION } }, null, 2);
}

function bindUi() {
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => execute(button.dataset.action));
  });
  $('image').addEventListener('change', event => {
    try { setImage(event.target.files && event.target.files[0]); }
    catch (error) { showLocalError('INVALID_IMAGE', error.message); }
  });
  $('remove-image').addEventListener('click', clearImage);
  $('send').addEventListener('click', () => execute('chat'));
  window.addEventListener('error', event => showLocalError('APP_ERROR', event.message || 'Erro inesperado na interface.'));
  window.addEventListener('unhandledrejection', event => showLocalError('UNHANDLED_REJECTION', event.reason && event.reason.message ? event.reason.message : String(event.reason || 'Erro assíncrono inesperado.')));
}

function setInteractive(enabled) {
  document.querySelectorAll('button, input, textarea').forEach(element => { element.disabled = !enabled; });
}

function persist() {
  localStorage.setItem(store, JSON.stringify({ url: $('url').value.trim(), token: $('token').value, model: $('model').value.trim() }));
}

function client() {
  persist();
  const gatewayUrl = $('url').value.trim();
  if (!gatewayUrl) throw new Error('Informe a URL do Worker.');
  return new window.CopileoAI({
    gatewayUrl,
    appId: 'ai-api-lab',
    defaultModel: $('model').value.trim() || undefined,
    credentialsProvider: new window.StaticTokenCredentialsProvider($('token').value),
  });
}

async function execute(action) {
  $('status').textContent = 'Carregando…';
  setInteractive(false);
  try {
    const ai = client();
    let data;
    if (action === 'health') data = await ai.health();
    else if (action === 'models') data = await ai.models();
    else if (action === 'chat') {
      const prompt = $('prompt').value;
      data = selectedImage ? await ai.chatWithImage({ prompt, image: selectedImage }) : await ai.chat(prompt);
    } else data = await debugProvider(ai);
    $('status').textContent = 'HTTP 200';
    $('result').textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    $('status').textContent = error.status ? `HTTP ${error.status}` : 'Erro';
    $('result').textContent = JSON.stringify({ error: { code: error.code || 'LAB_ERROR', message: error.message, details: error.details || null }, appVersion: APP_VERSION }, null, 2);
  } finally {
    setInteractive(true);
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
    const error = new Error(payload && payload.error && payload.error.message ? payload.error.message : `HTTP ${response.status}`);
    error.status = response.status;
    error.code = payload && payload.error && payload.error.code ? payload.error.code : 'GATEWAY_ERROR';
    error.details = payload;
    throw error;
  }
  return payload;
}

function setImage(file) {
  clearImage();
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Selecione uma imagem JPEG, PNG ou WebP.');
  if (file.size > 3 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 3 MB.');
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

function showLocalError(code, message) {
  $('status').textContent = 'Erro';
  $('result').textContent = JSON.stringify({ error: { code, message }, appVersion: APP_VERSION }, null, 2);
}
