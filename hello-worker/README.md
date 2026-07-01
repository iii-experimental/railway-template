# hello-worker

Tiny companion service for the [Railway starter template](../README.md). Deploy
it as a second Railway service alongside the engine so the verify step in the
main README returns real content instead of a 404.

## What it does

Connects to the engine over Railway's private network and registers a single
HTTP trigger. Sending `POST /hello` through the engine's public domain routes
to `hello::greet` in this worker, which returns a 200 response body.

## Deploy

1. In the same Railway project as the engine, add a second service.
2. Point it at this directory (`hello-worker/`) so Railway builds from the
   Dockerfile here.
3. Set the variable `III_URL=ws://engine.railway.internal:49134`. Replace
   `engine` with the actual name of your engine service if you renamed it.
4. Do not attach a public domain -- this service dials out to the engine and
   receives its inbound requests through the engine's public URL.

## Verify

Once both services are `Online`:

```bash
curl -X POST "https://<engine-domain>/hello" \
  -H "Content-Type: application/json" \
  -d '{"name":"iii"}'
```

Returns:

```json
{"message":"hello, iii","from":"hello-worker"}
```

## Delete when you don't need it

The hello-worker exists purely to give the readme a working verify step. Once
you have your own worker deployed with real HTTP triggers, delete this service.
