export const meta = {
  name: 'pr-review',
  description: 'Read-only adversarial review of pull-request diffs; the plan size is capped before any agent starts',
  phases: [
    { title: 'Review', detail: 'three lenses per unit' },
    { title: 'Verify', detail: 'skeptics try to refute the highest-severity findings that fit the budget' },
    { title: 'Synthesize', detail: 'one ranked report' },
  ],
}
// Run:  Workflow({ name: 'pr-review', args: { repo: '/abs/path', maxAgents: 60, units: [
//         { key: 'qualify', label: 'PR #30', base: '60e859f', head: 'ec1adbb', issues: '#21', what: 'one line' } ] } })
// The first review of this repo used 148 agents (~10.6M tokens) and hit the session limit. The cap lives here, in
// code: reviewers + skeptics + 1 never exceed maxAgents, and every finding that does not fit is logged, not dropped silently.
const { repo, units, maxAgents = 60 } = args || {}
if (!repo || !Array.isArray(units) || units.length === 0) throw new Error('args needs { repo, units: [{ key, label, base, head, what }] }')

const LENSES = [
  ['correctness', 'real defects only: logic errors, wrong tool semantics, broken references, ordering or race problems, behavior that contradicts the description. Ignore style.'],
  ['security-and-supply-chain', 'permissions, injection from untrusted input, secret exposure, unpinned dependencies, destructive or irreversible operations, unsafe shell and file handling.'],
  ['spec-and-simplicity', 'unmet acceptance criteria of the listed issues (gh issue view), then anything over-engineered that could be deleted without losing a criterion.'],
]
const reviewers = units.length * LENSES.length
const verifyBudget = maxAgents - reviewers - 1
if (verifyBudget < 1) throw new Error(`plan needs ${reviewers} reviewers + 1 synthesizer: raise maxAgents (now ${maxAgents}) or pass fewer units`)
log(`plan: ${reviewers} reviewers, up to ${verifyBudget} skeptic runs, 1 synthesizer (cap ${maxAgents})`)

const FINDINGS = { type: 'object', required: ['findings'], properties: { findings: { type: 'array', items: { type: 'object',
  required: ['title', 'file', 'severity', 'claim', 'evidence'], properties: {
    title: { type: 'string' }, file: { type: 'string' }, line: { type: 'integer' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] },
    claim: { type: 'string' }, evidence: { type: 'string' }, suggested_fix: { type: 'string' } } } } } }
const VERDICT = { type: 'object', required: ['refuted', 'reason'], properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } } }
const READ_ONLY = `READ-ONLY on ${repo}: never edit, switch branches, reset, stash, commit or push; no gh write command. Use git diff, git show <rev>:<path>, git log, grep, gh issue view.`
const RANK = { high: 0, medium: 1, low: 2 }

const found = (await parallel(units.flatMap((u) => LENSES.map(([lens, text]) => () =>
  agent(`${READ_ONLY}\nReview ${u.label}: ${u.what}\nDiff: git -C ${repo} diff ${u.base} ${u.head} (--stat first, then read changed files at ${u.head}). Issues: ${u.issues || 'none'}.\nLENS ${lens}: ${text}\nEach finding needs file, line when known, a claim and quoted evidence. An empty list is a valid answer.`,
    { label: `review:${u.key}:${lens}`, phase: 'Review', schema: FINDINGS })
    .then((r) => (r ? r.findings.map((f) => ({ ...f, unit: u.key, label: u.label, head: u.head, lens })) : []))))))
  .flat()
  .sort((a, b) => RANK[a.severity] - RANK[b.severity])

let left = verifyBudget
const planned = []
for (const f of found) {
  const cost = f.severity === 'high' ? 2 : 1
  if (cost > left) continue
  left -= cost
  planned.push({ f, cost })
}
log(`${found.length} findings raised; ${planned.length} fit the budget; ${found.length - planned.length} not verified (lowest severity first), listed below as unverified`)

const checked = (await parallel(planned.map(({ f, cost }) => async () => {
  const votes = (await parallel(Array.from({ length: cost }, () => () =>
    agent(`You are a SKEPTIC. ${READ_ONLY}\nTry to REFUTE this finding about ${f.label} (head ${f.head}).\n(${f.severity}) ${f.title}\nFile: ${f.file}${f.line ? ':' + f.line : ''}\nClaim: ${f.claim}\nEvidence given: ${f.evidence}\nOpen the real code. refuted=true if the claim is wrong, already handled, unreachable or not reproducible from the code; refuted=false only if you verified it yourself.`,
      { label: `verify:${f.unit}:${f.title.slice(0, 36)}`, phase: 'Verify', schema: VERDICT })))).filter(Boolean)
  const upheld = votes.filter((v) => !v.refuted).length
  return { ...f, upheld, votes: votes.length, confirmed: votes.length > 0 && upheld > votes.length / 2 }
}))).filter(Boolean)

const unverified = found.filter((f) => !planned.some((p) => p.f === f))
phase('Synthesize')
const report = await agent(
  `Write the review report from these skeptic-confirmed findings (JSON), grouped by unit, ordered by severity: severity, file:line, one-sentence claim, fix. Start each unit with a verdict: MERGE-READY, FIX-FIRST (list blockers) or NEEDS-DECISION. Invent nothing. End with a section "Not verified" listing the ${unverified.length} unverified finding titles below as claims, not facts.\nCONFIRMED: ${JSON.stringify(checked.filter((c) => c.confirmed).map(({ unit, severity, file, line, title, claim, suggested_fix }) => ({ unit, severity, file, line, title, claim, suggested_fix })))}\nUNVERIFIED: ${JSON.stringify(unverified.map(({ unit, severity, title }) => ({ unit, severity, title })))}`,
  { label: 'synthesize', phase: 'Synthesize' })
return { report, confirmed: checked.filter((c) => c.confirmed), refuted: checked.filter((c) => !c.confirmed).length, unverified: unverified.length }
