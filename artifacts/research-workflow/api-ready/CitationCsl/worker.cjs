'use strict';
// Metadata arrives only on stdin. No shell, network lookup or dynamically evaluated input.
const fs = require('node:fs');
const path = require('node:path');
const CSL = require('./citeproc.cjs');
const presets = {
  apa7: 'apa.csl', harvard: 'harvard-cite-them-right.csl', ieee: 'ieee.csl',
  mla: 'modern-language-association.csl', chicago: 'chicago-author-date.csl', vancouver: 'nlm-citation-sequence.csl',
};
const types = { journal: 'article-journal', journalarticle: 'article-journal', articlejournal: 'article-journal',
  article: 'article-journal', book: 'book', bookchapter: 'chapter', chapter: 'chapter', thesis: 'thesis',
  dissertation: 'thesis', conference: 'paper-conference', conferencepaper: 'paper-conference', paperconference: 'paper-conference',
  report: 'report', webpage: 'webpage', website: 'webpage' };
const text = value => typeof value === 'string' ? value.trim() : '';
function item(record, index) {
  if (!text(record.title)) throw new Error('Missing title');
  const kind = text(record.item_type).toLowerCase().replace(/[\s_-]/g, '');
  const result = { id: String(index), title: text(record.title), type: Object.hasOwn(types, kind) ? types[kind]
    : text(record.journal_name) ? 'article-journal' : 'document' };
  const authors = (record.authors || []).map(author => text(author.literal) ? { literal: text(author.literal) } : text(author.last_name)
    ? { family: text(author.last_name), given: [text(author.first_name), text(author.middle_initial)].filter(Boolean).join(' ') }
    : { literal: [text(author.first_name), text(author.middle_initial)].filter(Boolean).join(' ') })
    .filter(author => author.family || author.literal);
  if (authors.length) result.author = authors;
  if (Number.isInteger(record.publication_year) && record.publication_year > 0)
    result.issued = { 'date-parts': [[record.publication_year]] };
  for (const [field, cslField] of Object.entries({ journal_name: 'container-title', publisher: 'publisher',
    volume: 'volume', issue: 'issue', pages: 'page', url: 'URL' })) {
    if (text(record[field])) result[cslField] = text(record[field]);
  }
  if (text(record.doi)) result.DOI = text(record.doi).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
  return result;
}
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
  if (Buffer.byteLength(input, 'utf8') > 2 * 1024 * 1024) process.exit(2);
});
process.stdin.on('end', () => {
  try {
    const request = JSON.parse(input);
    if (!Array.isArray(request.citations) || request.citations.length > 500 ||
        !Array.isArray(request.styles) || !request.styles.length || request.styles.length > 6 ||
        new Set(request.styles).size !== request.styles.length || request.styles.some(style => !Object.hasOwn(presets, style)))
      throw new Error('Invalid request');
    const items = request.citations.map(item);
    const registry = new Map(items.map(entry => [entry.id, entry]));
    const locale = fs.readFileSync(path.join(__dirname, 'csl/locales-en-US.xml'), 'utf8');
    const result = {};
    let documentResult;
    if (request.clusters !== undefined && (!Array.isArray(request.clusters) || request.clusters.length > 1000 || request.styles.length !== 1))
      throw new Error('Invalid document');
    for (const style of request.styles) {
      const engine = new CSL.Engine({ retrieveLocale: lang => lang === 'en' || lang === 'en-US' ? locale : false,
        retrieveItem: id => structuredClone(registry.get(id)) }, fs.readFileSync(path.join(__dirname, 'csl', presets[style]), 'utf8'), 'en-US');
      engine.setOutputFormat('text');
      let citationLabels;
      if (request.clusters !== undefined) {
        const seen = new Set();
        const plan = new Map();
        const prepared = request.clusters.flatMap((cluster, index) => {
          if (typeof cluster.id !== 'string' || !cluster.id || seen.has(cluster.id) || !Array.isArray(cluster.indices) ||
              !cluster.indices.length || cluster.indices.length > 20 || cluster.indices.some(i => !Number.isInteger(i) || !registry.has(String(i))))
            throw new Error('Invalid cluster');
          seen.add(cluster.id);
          const narrative = cluster.narrative && style !== 'ieee' && style !== 'vancouver';
          const citationItems = cluster.indices.map(i => ({ id: String(i) }));
          const parts = narrative ? citationItems.map(cite => [cite]) : [citationItems];
          const ids = parts.map((_, part) => `csl-${index}-${part}`);
          plan.set(cluster.id, ids);
          return parts.map((part, n) => ({ citationID: ids[n], citationItems: part,
            properties: { noteIndex: 0, ...(narrative ? { mode: 'composite' } : {}) } }));
        });
        engine.updateItems([...new Set(prepared.flatMap(cluster => cluster.citationItems.map(cite => cite.id)))]);
        const labels = new Map();
        const before = [];
        for (const cluster of prepared) {
          const [, changes] = engine.processCitationCluster(cluster, before, []);
          for (const [index, label, id] of changes) {
            const key = id ?? prepared[index]?.citationID;
            if (!key || !label.trim() || label.includes('[NO_PRINTED_FORM]')) throw new Error('Invalid citation');
            labels.set(key, label);
          }
          before.push([cluster.citationID, 0]);
        }
        if (prepared.some(cluster => !labels.has(cluster.citationID))) throw new Error('Missing citation');
        citationLabels = Object.fromEntries([...plan].map(([id, parts]) => {
          const text = parts.map(part => labels.get(part));
          return [id, text.length === 1 ? text[0] : `${text.slice(0, -1).join(', ')} and ${text.at(-1)}`];
        }));
      } else engine.updateUncitedItems(items.map(entry => entry.id));
      const bibliography = engine.makeBibliography();
      if (!bibliography && (request.clusters === undefined ? items.length : request.clusters.length)) throw new Error('Missing bibliography');
      if (bibliography && bibliography[0].bibliography_errors?.length) throw new Error('Invalid bibliography');
      result[style] = bibliography ? bibliography[1].map((label, index) => {
        const ids = bibliography[0].entry_ids[index];
        if (ids.length !== 1 || !registry.has(ids[0]) || !label.trim() || label.includes('[NO_PRINTED_FORM]'))
          throw new Error('Invalid entry');
        return { index: Number(ids[0]), text: label.trim() };
      }) : [];
      if (request.clusters !== undefined) documentResult = { citations: citationLabels, bibliography: result[style] };
    }
    const output = JSON.stringify(documentResult ?? result);
    if (Buffer.byteLength(output, 'utf8') > 4 * 1024 * 1024) throw new Error('Output too large');
    process.stdout.write(output);
  } catch {
    // Never leak document metadata or parser excerpts into server logs.
    process.stderr.write('CSL formatting failed.');
    process.exitCode = 1;
  }
});
