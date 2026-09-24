// Record real Newman output against a loopback stub, never a provider.
// Usage: node scripts/record-harness-demo.mjs SOURCE.json /tmp/newman/node_modules/newman/index.js
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const source = await readFile(process.argv[2], 'utf8');
const sha256 = createHash('sha256').update(source).digest('hex');
const upstream = JSON.parse(source);
const newman = createRequire(import.meta.url)(process.argv[3]);
const native = upstream.item[0];
const streaming = upstream.item.find(folder => folder.name.startsWith('8. Criss-Cross')).item
  .find(folder => folder.name.startsWith('8.2 Text Chat')).item[0].item[0];
const collection = {
  info: { name: 'Bifrost official requests — recorded loopback demo', schema: upstream.info.schema },
  event: upstream.event,
  item: [native, { name: '8.2 Text Chat (streaming)', item: [streaming] }],
};
// The three known requests and inherited scripts were reviewed; keep this recorder pinned.
if (sha256 !== '3330c41792b3ec93dd70c50f12c6547803a57ee76869b639bff70a096ad719b0') throw new Error('Unexpected source revision; review requests and scripts before recording.');
const server = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const identity = {
    'x-bifrost-request-type': body.stream ? 'chat_completion_stream' : 'chat_completion',
    'x-bifrost-provider': 'openai', 'x-bifrost-original-model': body.model,
    'x-bifrost-resolved-model': 'gpt-4o-mini', 'x-bifrost-routing-info-provider': 'openai',
    'x-bifrost-routing-info-model': 'gpt-4o-mini', 'x-bifrost-upstream-latency-ms': '0',
    'x-demo-source': 'loopback-stub-not-bifrost-or-provider',
  };
  if (req.url === '/v1/responses') {
    res.writeHead(503, { 'content-type': 'application/json', 'x-demo-source': identity['x-demo-source'] });
    res.end(JSON.stringify({ error: { message: 'Intentional local mock failure for the report viewer.', type: 'demo_error' } }));
  } else if (body.stream) {
    res.writeHead(200, { ...identity, 'content-type': 'text/event-stream' });
    for (const content of ['1, ', '2, ', '3, ', '4, ', '5.']) {
      res.write(`data: ${JSON.stringify({ id: 'local-demo', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content } }] })}\n\n`);
    }
    res.end('data: [DONE]\n\n');
  } else {
    res.writeHead(200, { ...identity, 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'local-demo', object: 'chat.completion', model: 'gpt-4o-mini', choices: [{ index: 0, message: { role: 'assistant', content: 'Hello from the local demo server.' }, finish_reason: 'stop' }] }));
  }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const output = new URL('../public/harness-demo-report.json', import.meta.url);
const recordedEvents = [];
try {
  await new Promise((resolve, reject) => {
    const runner = newman.run({
      collection, envVar: [{ key: 'baseUrl', value: `http://127.0.0.1:${server.address().port}` }],
      reporters: ['json'], reporter: { json: { export: output.pathname } },
      timeoutRequest: 3000, ignoreRedirects: true,
    }, error => error ? reject(error) : resolve());
    for (const event of ['beforeRequest', 'request', 'assertion', 'item']) runner.on(event, (error, args) => {
      recordedEvents.push({ event, at: new Date().toISOString(), executionIndex: args.cursor.position,
        ...(args.assertion ? { assertion: args.assertion } : {}), ...(error ? { failed: true } : {}) });
    });
  });
  const report = JSON.parse(await readFile(output, 'utf8'));
  report.recordedEvents = recordedEvents;
  report.demoProvenance = {
    kind: 'recorded-loopback', runner: 'newman@6.2.1', sourceCommit: '6493abd3d1422c9bfde95f242fd57b38e73ce881', sourceSha256: sha256,
    description: 'Three official requests and inherited assertions, recorded against an isolated stub. Responses are synthetic; no Bifrost gateway or provider was tested. The /responses failure is deliberate.',
  };
  await writeFile(output, JSON.stringify(report));
  if (report.run.executions.length !== 3 || !report.run.failures.length) throw new Error('Expected three executions including intentional failure.');
  console.log(`Recorded ${report.run.executions.length} executions, ${report.run.failures.length} intentional failure(s).`);
} finally { server.close(); }
