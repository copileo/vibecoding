(() => {
  const normalise = value => String(value || '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function removeRepeatedLinkWord(choice) {
    const summary = choice.querySelector('summary');
    const content = choice.querySelector('.choice-reference-content');
    if (!summary || !content || content.dataset.linkWordFixed === 'true') return;

    const words = normalise(summary.textContent).split(/\s+/).filter(Boolean);
    if (!words.length) return;

    // The linking word is normally the last meaningful word of the front choice.
    // Try the longest suffixes first so labels such as "the medicine" also work.
    const candidates = [];
    for (let size = Math.min(4, words.length); size >= 1; size--) {
      candidates.push(words.slice(-size).join(' '));
    }

    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.nodeValue.trim()) node = walker.nextNode();
    if (!node) return;

    const original = node.nodeValue;
    const leading = original.match(/^\s*/)?.[0] || '';
    const text = original.slice(leading.length);
    const normalisedText = normalise(text);

    const match = candidates.find(candidate => {
      if (!normalisedText.startsWith(candidate)) return false;
      const next = text.slice(candidate.length, candidate.length + 1);
      return !next || /[:\-–—,.;]/.test(next);
    });

    if (!match) return;

    const removeLength = match.length;
    const remainder = text.slice(removeLength).replace(/^\s*[:\-–—,.;]\s*/, '');
    node.nodeValue = `${leading}${remainder}`;
    content.dataset.linkWordFixed = 'true';
  }

  function fixAll() {
    document.querySelectorAll('#translation .choice-reference').forEach(removeRepeatedLinkWord);
  }

  function init() {
    const translation = document.getElementById('translation');
    if (!translation) return;
    fixAll();
    new MutationObserver(fixAll).observe(translation, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
