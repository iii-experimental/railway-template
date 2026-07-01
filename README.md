<p align="center">
  <img src="https://iii.dev/favicon.svg" alt="iii" height="72" />
</p>

<h1 align="center">iii</h1>

<p align="center">
  Deploy the <a href="https://iii.dev">iii</a> engine on <a href="https://railway.com">Railway</a>.
</p>

<p align="center">
  <a href="https://railway.com/deploy/8CuY4-?referralCode=lz2OFn"><img src="https://railway.com/button.svg" alt="Deploy on Railway" /></a>
</p>

A starter template for running the [iii](https://iii.dev) engine on Railway. It
deploys a clean engine plus the worker daemon, and an optional companion
`hello-worker/` service that gives you a real HTTP endpoint to verify against.
You extend it by declaring more workers in `config.yaml` or by running them as
their own Railway services that connect to the engine.

## What this deploys

The main Railway service is built from the top-level `Dockerfile`:

- the iii engine
- the `iii-worker` daemon, so the engine can run any binary worker from the registry
- the workers declared in `config.yaml`: `iii-worker-manager` (worker WebSocket,
  port 49134), `iii-http` (REST, port 3111), `iii-stream` (port 3112),
  `iii-state`, `iii-queue`, `iii-cron`, `iii-pubsub`, `configuration`, and
  `iii-observability`

Optionally, `hello-worker/` deploys as a second Railway service and registers
`POST /hello` so [Verify the deployment](#verify-the-deployment) returns a real
200 response instead of the JSON error envelope.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Clean engine base. Installs `iii` and `iii-worker`, copies `config.yaml`. |
| `config.yaml` | Declares the workers to run. Edit this to add workers. |
| `railway.json` | Config as code: Dockerfile builder, `restartPolicyType: ALWAYS`. |
| `hello-worker/` | Optional companion Node worker that registers `POST /hello`. |

## Deploy

### One click

1. Click the **Deploy on Railway** button above, or open the Railway dashboard,
   choose **New Project**, then **Deploy a template**, and select this template.
2. Add a [volume](https://docs.railway.com/reference/volumes) and mount it at
   `/data`. The engine writes state, queue, stream, cron, and configuration data
   there.
3. Add a Railway [service variable](https://docs.railway.com/reference/variables)
   `PORT=3111`. Railway's edge auto-detects the container's port from the first
   `EXPOSE` line in the Dockerfile, which is `49134` (the worker WebSocket
   port). Setting `PORT=3111` targets the `iii-http` listener instead, so the
   domain returns HTTP responses rather than a 502.
4. Add a
   [public domain](https://docs.railway.com/reference/public-networking) on the
   engine service. Railway terminates TLS and routes HTTPS traffic to `PORT`.

<details>
<summary>Do I need <code>RAILWAY_RUN_UID=0</code>?</summary>

Only if you replace the Dockerfile with a non-root image. This template uses
`debian:bookworm-slim`, which runs as root by default and can write the
root-owned Railway volume with no extra config. Set `RAILWAY_RUN_UID=0` only
when you switch to a distroless / non-root base image.

</details>

### From this repo

If you'd rather see the source and iterate:

1. Fork this repo.
2. In Railway, choose **New Project** -> **Deploy from GitHub repo**, and pick
   your fork.
3. Railway detects the `Dockerfile` and `railway.json` and builds the engine
   service.
4. Apply the volume, `PORT`, and public domain steps above.

### From the CLI

For a scripted deploy path:

```bash
railway login                           # opens browser OAuth
railway init --name my-iii              # creates the project
railway add --service engine            # picks "Empty Service"
railway up --ci --service engine        # builds + deploys from cwd
railway variables --set PORT=3111 --service engine
railway domain --service engine         # provisions a public *.up.railway.app URL
railway logs --service engine           # tail deploy logs
```

Optionally add the hello-worker as a second service (see below).

### With an AI agent (MCP)

Railway's [MCP server](https://docs.railway.com/ai/mcp-server) lets a coding
assistant create the project, add services, set variables, and provision domains
through natural language rather than a CLI script:

```bash
railway setup agent           # local MCP (uses your CLI auth)
# or
railway setup agent --remote  # remote MCP via OAuth to mcp.railway.com
```

Once installed, a supported host (Cursor, VS Code, Claude Code, Codex,
Windsurf, etc.) can act on a prompt like:

> Create a Railway project named `my-iii`, add an engine service from this
> repo, set `PORT=3111`, add a volume mounted at `/data`, provision a public
> domain, and tail the logs.

## Deploy the optional hello-worker

The engine only responds to routes registered by workers. Without one, verify
just hits the engine's JSON error envelope. Deploy the bundled
[`hello-worker/`](./hello-worker/README.md) alongside the engine so `POST /hello`
returns real content:

1. In the same Railway project, add a second service pointing at `hello-worker/`.
2. Set the service variable
   `III_URL=ws://engine.railway.internal:49134`. Replace `engine` with the
   actual name of your engine service if you renamed it.
3. Do not attach a public domain to the hello-worker. It connects out to the
   engine and receives inbound requests through the engine's public URL.

## Add your own workers

Every capability in iii is a worker. There are two ways to add one to this
template.

### As a separate service (any language)

Deploy your worker as its own Railway service so it scales on its own. Point
`III_URL` at the engine over Railway's IPv6 private network:

```bash
III_URL=ws://engine.railway.internal:49134
```

A minimal Node worker (same shape as `hello-worker/`):

```js
import { registerWorker } from 'iii-sdk';

const worker = registerWorker(process.env.III_URL);
worker.registerFunction('orders::create', async (input) => ({
  ok: true,
  item: input?.item,
}));
worker.registerTrigger({
  type: 'http',
  function_id: 'orders::create',
  config: { api_path: '/orders', http_method: 'POST' },
});
```

Requests arrive on the engine service's public domain on port 3111 and route
through to your worker over the private network. Workers in Python and Rust
connect the same way; see the [SDK reference](https://iii.dev/docs/next/sdk-reference).

### Inside the engine (registry worker)

For a worker that runs as a child process of the engine, declare it in
`config.yaml` and redeploy:

```yaml
  - name: database
    config:
      databases:
        primary:
          url: sqlite:/data/iii.db
          pool:
            max: 5
            idle_timeout_ms: 30000
```

If the worker isn't in the image, the engine downloads it from the registry on
first boot. To pin the version and skip the cold-start download, add it at
build time by extending the Dockerfile:

```dockerfile
RUN iii worker add database
```

Write all worker state under `/data` so it persists on the Railway volume.

### What runs on Railway (and what doesn't)

Every registry worker that resolves to `deploy: binary` runs as a plain host
process on Railway. Check a worker's `iii.worker.yaml` `deploy` field before
adding it:

- `deploy: binary` -> runs on Railway.
- `deploy: image` or `deploy: bundle` -> the worker registers its functions on
  boot, but per-invocation execution boots a libkrun micro-VM that needs
  `/dev/kvm`. Railway containers don't expose `/dev/kvm`, so those invocations
  fail. `iii-sandbox` and the bundle `harness` are the two current examples.

## Secrets and environment

Store credentials as Railway
[service variables](https://docs.railway.com/reference/variables) and reference
them in `config.yaml` with `${VAR}` placeholders (single colon, no dash):

```yaml
  - name: storage
    config:
      buckets:
        uploads:
          provider: r2
          bucket: uploads
          account_id: ${R2_ACCOUNT_ID}
          access_key_id: ${R2_ACCESS_KEY_ID}
          secret_access_key: ${R2_SECRET_ACCESS_KEY}
```

The engine substitutes `${VAR}` at boot. If a placeholder is unset and has no
default, the engine panics on first boot -- set required secrets **before** the
first `railway up` / template deploy.

## Verify the deployment

Any request to the engine's public URL returns iii's JSON envelope, so a bare
`curl` proves the engine is reachable:

```bash
curl -i "https://<your-engine-domain>/"
```

```http
HTTP/1.1 404 Not Found
content-type: application/json

{"error":{"code":"NOT_FOUND","message":"Not Found"}}
```

Once you deploy the [hello-worker](#deploy-the-optional-hello-worker), a real
route responds:

```bash
curl -X POST "https://<your-engine-domain>/hello" \
  -H "Content-Type: application/json" \
  -d '{"name":"iii"}'
```

```json
{"message":"hello, iii","from":"hello-worker"}
```

## Publish your own template

To turn your configured project into a one-click template with your own share
URL, use the Railway dashboard
([template docs](https://docs.railway.com/reference/templates)):

1. Deploy this repo once and configure it (volume, `PORT`, public domain).
2. Open the project **Settings** and choose **Generate Template from Project**.
3. In the Template Composer, confirm the `/data` volume and any variables you
   want to prompt for, then publish.
4. You get a share URL of the form `https://railway.com/template/<id>`.
5. If you want deploy referral credit for your template, apply to the
   [Railway Open Source program](https://railway.com/open-source).

## License

Apache-2.0. See [LICENSE](./LICENSE).
