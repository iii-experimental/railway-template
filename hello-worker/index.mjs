// Minimal companion worker for the Railway starter template.
//
// Connects to the engine over Railway's private network, registers a real
// `POST /hello` HTTP trigger, and returns 200 with a JSON body so the
// verify step in the README actually succeeds (instead of curling a route
// nobody ever created).
//
// Deploy this as its own Railway service alongside the engine, set
// III_URL=ws://engine.railway.internal:49134 as a service variable, and
// leave it with no public domain -- traffic reaches it through the engine
// service's public URL on port 3111.
import { registerWorker } from 'iii-sdk';

const url = process.env.III_URL;
if (!url) {
  console.error('III_URL not set. Point it at the engine service, e.g.');
  console.error('  III_URL=ws://engine.railway.internal:49134');
  process.exit(1);
}

const worker = registerWorker(url, { workerName: 'hello-worker' });

worker.registerFunction('hello::greet', async (input) => {
  const name = input?.body?.name ?? 'world';
  return {
    status_code: 200,
    headers: { 'content-type': 'application/json' },
    body: { message: `hello, ${name}`, from: 'hello-worker' },
  };
});

worker.registerTrigger({
  type: 'http',
  function_id: 'hello::greet',
  config: { api_path: '/hello', http_method: 'POST' },
});

console.log('hello-worker connected to', url);
