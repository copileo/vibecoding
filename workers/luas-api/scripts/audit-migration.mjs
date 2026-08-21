import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = (process.env.LUAS_AUDIT_BASE_URL || 'https://vibecoding.copileo.workers.dev').replace(/\/$/, '');
const batchSize = clampNumber(process.env.LUAS_AUDIT_BATCH_SIZE, 8, 1, 10);
const retries = clampNumber(process.env.LUAS_AUDIT_RETRIES, 3, 1, 6);
const retryDelayMs = clampNumber(process.env.LUAS_AUDIT_RETRY_DELAY_MS, 1500, 100, 30000);
const outputDir = process.env.LUAS_AUDIT_OUTPUT_DIR || 'migration-audit-output';

await mkdir(outputDir, { recursive: true });

const batches = [];
let offset = 0;
let expectedTotal = null;

while (expectedTotal === null || offset < expectedTotal) {
  const url = `${baseUrl}/debug/migration?offset=${offset}&limit=${batchSize}`;
  const batch = await fetchJsonWithRetry(url);

  validateBatch(batch, offset);
  batches.push(batch);

  expectedTotal = Number(batch.pagination.total);
  const nextOffset = batch.pagination.nextOffset;
  if (nextOffset === null || nextOffset === undefined) break;
  if (!Number.isInteger(nextOffset) || nextOffset <= offset) {
    throw new Error(`Invalid nextOffset ${String(nextOffset)} returned for offset ${offset}.`);
  }
  offset = nextOffset;
}

const report = aggregateBatches(batches, expectedTotal ?? 0);
const markdown = renderMarkdown(report);
const html = renderHtml(report);

await Promise.all([
  writeFile(`${outputDir}/migration-report.json`, `${JSON.stringify(report, null, 2)}\n`),
  writeFile(`${outputDir}/migration-summary.md`, markdown),
  writeFile(`${outputDir}/migration-report.html`, html),
]);

if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, markdown, { flag: 'a' });
}

console.log(markdown);

if (!report.summary.complete) {
  process.exitCode = 1;
}

function aggregateBatches(items, total) {
  const stops = items.flatMap((batch) => batch.stops || []);
  const failures = stops.filter((stop) => stop.status === 'failed');
  const warnings = stops.filter((stop) => stop.status === 'warning');
  const passed = stops.filter((stop) => stop.status === 'passed');
  const catalogue = items[0]?.catalogue || null;
  const durations = stops.map((stop) => Number(stop.durationMs)).filter(Number.isFinite);
  const departureCount = stops.reduce((sum, stop) => sum + Number(stop.departureCount || 0), 0);
  const uniqueCodes = new Set(stops.map((stop) => stop.appCode));
  const missingRows = Math.max(0, total - uniqueCodes.size);
  const duplicateRows = Math.max(0, stops.length - uniqueCodes.size);
  const catalogueMissing = catalogue?.missing?.length || 0;

  return {
    generatedAt: new Date().toISOString(),
    baseUrl,
    validation: {
      batchSize,
      batches: items.length,
      retries,
      expectedTotal: total,
      uniqueStops: uniqueCodes.size,
      missingRows,
      duplicateRows,
    },
    summary: {
      total,
      tested: stops.length,
      passed: passed.length,
      warnings: warnings.length,
      failed: failures.length,
      catalogueMissing,
      complete: failures.length === 0 && catalogueMissing === 0 && missingRows === 0 && duplicateRows === 0 && uniqueCodes.size === total,
    },
    metrics: {
      totalDepartures: departureCount,
      averageDurationMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      maximumDurationMs: durations.length ? Math.max(...durations) : null,
    },
    catalogue,
    failures,
    warnings,
    stops,
    batches: items.map((batch) => ({ generatedAt: batch.generatedAt, durationMs: batch.durationMs, pagination: batch.pagination, summary: batch.summary })),
  };
}

function renderMarkdown(report) {
  const icon = report.summary.complete ? '✅' : '❌';
  const lines = [
    `# ${icon} Luas migration audit`,
    '',
    `- Endpoint: \`${report.baseUrl}\``,
    `- Generated: ${report.generatedAt}`,
    `- Stops tested: **${report.summary.tested}/${report.summary.total}**`,
    `- Passed: **${report.summary.passed}**`,
    `- Warnings: **${report.summary.warnings}**`,
    `- Failed: **${report.summary.failed}**`,
    `- Missing catalogue entries: **${report.summary.catalogueMissing}**`,
    `- Average latency: **${report.metrics.averageDurationMs ?? 'n/a'} ms**`,
    `- Maximum latency: **${report.metrics.maximumDurationMs ?? 'n/a'} ms**`,
    `- Departures observed: **${report.metrics.totalDepartures}**`,
    '',
  ];

  if (report.failures.length) {
    lines.push('## Failures', '', '| Stop | Official code | Issues |', '|---|---|---|');
    for (const stop of report.failures) lines.push(`| ${escapeMd(stop.expectedName || stop.appCode)} | ${escapeMd(stop.officialCode || '—')} | ${escapeMd((stop.issues || []).join('; '))} |`);
    lines.push('');
  }

  if (report.warnings.length) {
    lines.push('## Warnings', '', '| Stop | Official code | Issues |', '|---|---|---|');
    for (const stop of report.warnings) lines.push(`| ${escapeMd(stop.expectedName || stop.appCode)} | ${escapeMd(stop.officialCode || '—')} | ${escapeMd((stop.issues || []).join('; '))} |`);
    lines.push('');
  }

  if (!report.summary.complete && !report.failures.length) {
    lines.push('## Structural problems', '');
    if (report.validation.missingRows) lines.push(`- ${report.validation.missingRows} stop result(s) were not returned.`);
    if (report.validation.duplicateRows) lines.push(`- ${report.validation.duplicateRows} duplicate stop result(s) were returned.`);
    if (report.summary.catalogueMissing) lines.push(`- ${report.summary.catalogueMissing} app stop(s) are absent from the official catalogue.`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function renderHtml(report) {
  const rows = report.stops.map((stop) => `<tr><td>${htmlEscape(stop.expectedName || stop.appCode)}</td><td>${htmlEscape(stop.appCode)}</td><td>${htmlEscape(stop.officialCode || '—')}</td><td>${htmlEscape(stop.status)}</td><td>${Number(stop.departureCount || 0)}</td><td>${Number(stop.durationMs || 0)} ms</td><td>${htmlEscape((stop.issues || []).join('; '))}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Luas migration audit</title><style>body{font:14px system-ui,sans-serif;margin:32px;color:#1f2328}h1{margin-bottom:8px}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:24px 0}.card{border:1px solid #d0d7de;border-radius:8px;padding:14px}.value{font-size:24px;font-weight:700}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0d7de;padding:8px;text-align:left;vertical-align:top}th{background:#f6f8fa}tr:has(td:nth-child(4):not(:empty)){}</style></head><body><h1>${report.summary.complete ? '✅' : '❌'} Luas migration audit</h1><p>${htmlEscape(report.generatedAt)} · ${htmlEscape(report.baseUrl)}</p><div class="summary"><div class="card"><div class="value">${report.summary.tested}/${report.summary.total}</div><div>Stops tested</div></div><div class="card"><div class="value">${report.summary.passed}</div><div>Passed</div></div><div class="card"><div class="value">${report.summary.warnings}</div><div>Warnings</div></div><div class="card"><div class="value">${report.summary.failed}</div><div>Failed</div></div><div class="card"><div class="value">${report.metrics.averageDurationMs ?? 'n/a'} ms</div><div>Average latency</div></div></div><table><thead><tr><th>Stop</th><th>App code</th><th>Official code</th><th>Status</th><th>Departures</th><th>Latency</th><th>Issues</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`;
}

async function fetchJsonWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'vibecoding-luas-audit/1.0' }, signal: AbortSignal.timeout(30000) });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
      try { return JSON.parse(text); } catch { throw new Error(`Endpoint returned invalid JSON: ${text.slice(0, 500)}`); }
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
  }
  throw new Error(`Unable to fetch ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function validateBatch(batch, requestedOffset) {
  if (!batch || typeof batch !== 'object') throw new Error(`Batch ${requestedOffset} did not return an object.`);
  if (!batch.pagination || Number(batch.pagination.offset) !== requestedOffset) throw new Error(`Batch ${requestedOffset} returned invalid pagination.`);
  if (!Array.isArray(batch.stops)) throw new Error(`Batch ${requestedOffset} did not return a stops array.`);
  if (Number(batch.pagination.returned) !== batch.stops.length) throw new Error(`Batch ${requestedOffset} returned inconsistent row counts.`);
}

function clampNumber(value, fallback, min, max) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback; }
function escapeMd(value) { return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' '); }
function htmlEscape(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
