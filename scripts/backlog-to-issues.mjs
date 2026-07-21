#!/usr/bin/env node
// Parse VECK_Feature_Backlog_Progress_List.md into GitHub issue rows (JSONL),
// or map already-created issue numbers back into the backlog file.
// Usage: node scripts/backlog-to-issues.mjs [--dry-run | --map] [--out FILE]

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const SRC = 'VECK_Feature_Backlog_Progress_List.md'
const EXPECTED_ITEMS = 109

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const mapMode = args.includes('--map')
const outIdx = args.indexOf('--out')
const outFile = outIdx === -1 ? null : args[outIdx + 1]

// ponytail: keyword heuristic for bug-vs-enhancement. Reviewed in the dry-run
// table, not tuned up front — move to explicit per-item tags only if it misfires.
const BUG_RE = /\b(bug|fix|not working|glitch|incorrectly|duplicated|missing|resets|negative)\b/i

// Sentence split that doesn't break on "e.g." / "vs." / "no." inside an item.
const ABBREV = /\b(e\.g|i\.e|vs|no|nos|etc|approx|ref)\.$/i
function firstSentenceOf(text) {
  const parts = text.split(/(?<=\.)\s+/)
  let out = parts[0]
  for (let i = 1; i < parts.length && ABBREV.test(out); i++) out += ' ' + parts[i]
  return out.replace(/[.`*\s]+$/, '')
}

const lines = readFileSync(SRC, 'utf8').split('\n')
const rows = []
let phase = null

for (const [lineIndex, line] of lines.entries()) {
  const head = line.match(/^## Phase (\d) — (.+)$/)
  if (head) {
    phase = { num: Number(head[1]), title: `Phase ${head[1]} — ${head[2]}` }
    continue
  }
  if (line.startsWith('## ')) { phase = null; continue }

  const item = line.match(/^(\d+)\. \[(DONE|PARTIAL|NOT STARTED)\] (.*)$/)
  if (!item || !phase) continue

  const [, n, status, text] = item
  const firstSentence = firstSentenceOf(text)
  const short = firstSentence.length > 90 ? firstSentence.slice(0, 87) + '…' : firstSentence

  const labels = [phase.num === 1 || BUG_RE.test(text) ? 'bug' : 'enhancement']
  if (status === 'PARTIAL') labels.push('partial')

  rows.push({
    title: `[P${phase.num}.${n}] ${short}`,
    body: `${text}\n\n---\nStatus at import: **${status}**\nSource: \`${SRC}\` — ${phase.title}, item ${n}\n`,
    milestone: phase.title,
    labels,
    state: status === 'DONE' ? 'closed' : 'open',
    // Only real backlog lines get a lineIndex — --map uses it to write the
    // issue number back onto the exact source line. The synthetic [Clarify]
    // row pushed below has no source line and is skipped by --map.
    lineIndex,
  })
}

if (rows.length !== EXPECTED_ITEMS) {
  console.error(`FAIL: parsed ${rows.length} items, expected ${EXPECTED_ITEMS}. Regex dropped lines.`)
  process.exit(1)
}

// The "Needs your clarification" section, as one question issue.
const clarify = lines
  .slice(lines.findIndex((l) => l.startsWith('## Needs your clarification')))
  .filter((l) => l.startsWith('- **'))
if (clarify.length !== 4) {
  console.error(`FAIL: expected 4 clarification bullets, found ${clarify.length}.`)
  process.exit(1)
}
rows.push({
  title: '[Clarify] 4 ambiguous backlog items need scoping input',
  body:
    'These backlog items are too ambiguous to sequence or estimate as written. ' +
    'Each needs an answer before it can be scoped.\n\n' +
    clarify.map((b) => b.replace(/^- /, '- [ ] ')).join('\n') +
    `\n\n---\nSource: \`${SRC}\` — "Needs your clarification before scoping"\n`,
  milestone: null,
  labels: ['question'],
  state: 'open',
})

const counts = rows.reduce((a, r) => {
  const k = r.state === 'closed' ? 'DONE' : r.labels.includes('partial') ? 'PARTIAL' : r.labels.includes('question') ? 'CLARIFY' : 'NOT STARTED'
  a[k] = (a[k] || 0) + 1
  return a
}, {})

if (mapMode) {
  // Reuses the exact same `rows` built above — the title this script would
  // generate for an item is the same title post-backlog-issues.sh used to
  // create the GitHub issue, so matching on title needs no separate ID store.
  const issueList = JSON.parse(
    execFileSync(
      'gh',
      ['issue', 'list', '--state', 'all', '--limit', '500', '--json', 'number,title'],
      { encoding: 'utf8' }
    )
  )
  const numberByTitle = new Map(issueList.map((i) => [i.title, i.number]))

  const ISSUE_SUFFIX_RE = /\s\(#\d+\)\s*$/
  let mapped = 0
  let alreadyMapped = 0
  let notFound = 0

  for (const r of rows) {
    if (r.lineIndex === undefined) continue // the synthetic [Clarify] row
    const line = lines[r.lineIndex]
    if (ISSUE_SUFFIX_RE.test(line)) {
      alreadyMapped++
      continue
    }
    const issueNumber = numberByTitle.get(r.title)
    if (issueNumber === undefined) {
      notFound++
      continue
    }
    lines[r.lineIndex] = `${line} (#${issueNumber})`
    mapped++
  }

  if (mapped > 0) {
    writeFileSync(SRC, lines.join('\n'))
  }
  console.error(`mapped ${mapped}, already-mapped ${alreadyMapped}, no matching issue ${notFound}`)
} else if (dryRun) {
  for (const r of rows) {
    console.log([r.title, r.milestone ?? '(none)', r.labels.join(','), r.state].join(' | '))
  }
  console.error(`\n${rows.length} rows: ${JSON.stringify(counts)}`)
} else {
  const path = outFile ?? 'issues.jsonl'
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  console.error(`wrote ${rows.length} rows to ${path}: ${JSON.stringify(counts)}`)
}
