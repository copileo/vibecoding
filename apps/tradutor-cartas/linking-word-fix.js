import{CopileoAI}from'./copileo-ai.js';

(() => {
  const normalise = value => String(value || '').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  let pairCalls = 0;
  let frontContext = null;
  const originalChatWithImage = CopileoAI.prototype.chatWithImage;

  CopileoAI.prototype.chatWithImage = async function(options) {
    pairCalls += 1;
    let request = options;
    if (pairCalls === 2 && frontContext) {
      request = {...options, prompt: `${options.prompt || ''}\n\nThis is the BACK side of the same card. Reuse these FRONT choice link keys when matching outcomes. Translate the back text fully; do not return only a heading or linking word. Assign the same linkKey to every section belonging to each outcome. FRONT CONTEXT: ${JSON.stringify(frontContext)}`};
    }
    try {
      const result = await originalChatWithImage.call(this, request);
      if (pairCalls === 1) {
        try {
          const parsed = JSON.parse(String(result?.data?.content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''));
          frontContext = (parsed.sections || []).filter(s => s.type === 'choice').map(s => ({linkKey:s.linkKey || '', original:s.original || '', translated:s.translated || ''}));
        } catch { frontContext = null; }
      }
      if (pairCalls >= 2) { pairCalls = 0; frontContext = null; }
      return result;
    } catch (error) {
      if (pairCalls >= 2) { pairCalls = 0; frontContext = null; }
      throw error;
    }
  };

  function removeRepeatedLinkWord(choice) {
    const summary = choice.querySelector('summary');
    const content = choice.querySelector('.choice-reference-content');
    if (!summary || !content || content.dataset.linkWordFixed === 'true') return;
    const words = normalise(summary.textContent).split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const candidates = [];
    for (let size = Math.min(4, words.length); size >= 1; size--) candidates.push(words.slice(-size).join(' '));
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.nodeValue || '';
      const prefixMatch = text.match(/^(\s*[^A-Za-z0-9À-ÿ]*)/);
      const prefix = prefixMatch ? prefixMatch[0] : '';
      const remainder = text.slice(prefix.length);
      const normalised = normalise(remainder);
      const candidate = candidates.find(value => normalised === value || normalised.startsWith(value + ' '));
      if (candidate) {
        const lower = remainder.toLocaleLowerCase();
        const start = lower.indexOf(candidate.toLocaleLowerCase());
        if (start === 0) {
          node.nodeValue = prefix + remainder.slice(candidate.length).replace(/^\s*[:\-–—,.;]\s*/, '');
          content.dataset.linkWordFixed = 'true';
          return;
        }
      }
      node = walker.nextNode();
    }
  }

  function fixAll() { document.querySelectorAll('#translation .choice-reference').forEach(removeRepeatedLinkWord); }
  function init() {
    const translation = document.getElementById('translation');
    if (!translation) return;
    fixAll();
    new MutationObserver(fixAll).observe(translation, {childList:true, subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
