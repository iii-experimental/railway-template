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

A starter template for running the iii engine on Railway. It deploys a clean
engine and the worker daemon. You add workers either by declaring them in
`config.yaml` or by running them as their own Railway service that connects to
the engine.

## What this deploys

One service built from the `Dockerfile` in this repo:

- the iii engine
- the `iii-worker` daemon, so the engine can run any binary worker from the registry
- the workers declared in `config.yaml`: `iii-http` (REST, port 3111),
  `iii-stream` (port 3112), `iii-state`, `iii-queue`, `iii-cron`, `iii-pubsub`,
  `configuration`, and `iii-observability`

The image is the same for everyone; your `config.yaml` is the only part specific
to your deployment. Run more workers in this service or as separate ones.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Clean engine base. Installs `iii` and `iii-worker`, copies `config.yaml`. |
| `config.yaml` | Declares the workers to run. Edit this to add workers. |
| `railway.json` | Config as code: Dockerfile builder and restart policy. |

## Deploy

### One click

1. Click the **Deploy on Railway** button above, or open the Railway dashboard,
   choose **New Project**, then **Deploy a template**, and select this template.
2. Add a [volume](https://docs.railway.com/volumes) and mount it at `/data`.
   The engine writes state, queue, stream, and configuration data there.
3. Set the service variable `RAILWAY_RUN_UID=0` so the non-root container can
   write to the volume.
4. Add a [public domain](https://docs.railway.com/public-networking) and set its
   target port to `3111` (the `iii-http` listener). Railway terminates TLS and
   routes HTTPS traffic to that port.

### From this repo

1. Fork this repo.
2. In Railway, choose **New Project**, then **Deploy from GitHub repo**, and pick
   your fork.
3. Railway detects the `Dockerfile` and `railway.json` and builds the service.
4. Apply the volume, variable, and public domain steps above.

### With an AI agent

Railway ships [agent skills](https://docs.railway.com/ai/agent-skills) that let a
coding assistant create projects, deploy, and manage variables for you. Install
them, then ask your assistant to deploy this repo:

```bash
curl -fsSL agents.railway.com | sh
```

Supported assistants include Claude Code, OpenAI Codex, OpenCode, and Cursor.

## Add workers

Every capability in iii is a worker. There are two ways to add one.

### As a separate service

Run the worker as its own Railway service so it scales on its own. It connects to
the engine over private networking, which is IPv6 only, so point it at the engine
internal address on the worker-manager port `49134`:

```bash
III_URL=ws://engine.railway.internal:49134
```

where `engine` is the engine service name. The worker registers its functions and
HTTP triggers with the engine; requests still arrive through the engine public
domain on port 3111. Workers in any language connect this way (Node, Python, Rust
SDKs). A minimal Node worker:

```js
import { registerWorker } from "iii-sdk";

const worker = registerWorker(process.env.III_URL);
worker.registerFunction("orders::create", async (input) => ({ ok: true, item: input?.item }));
worker.registerTrigger({
  type: "http",
  function_id: "orders::create",
  config: { api_path: "/orders", http_method: "POST" },
});
```

### Inside the engine

For a registry worker that runs as a child process of the engine, declare it in
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

If a declared worker is not present in the image, the engine fetches it from the
registry on boot. To pin a version and skip the cold-start download, install it at
build time by adding a line to the `Dockerfile`:

```dockerfile
RUN iii worker add database
```

Write all worker state under `/data` so it persists on the volume.

### What cannot run on Railway

Workers that boot a micro-VM use [libkrun](https://github.com/containers/libkrun)
and need hardware virtualization (`/dev/kvm`), which Railway containers do not
expose. This includes `iii-sandbox`, the bundle build of `harness`, and any
OCI image worker. Workers that run as a process (for example `database` and
`shell`) work on Railway.

## Secrets and environment

Store credentials as Railway
[service variables](https://docs.railway.com/variables) and reference them in
`config.yaml` with `${VAR}` placeholders:

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

## Verify the deployment

The engine exposes only the HTTP routes your workers register through `http`
triggers. With no workers added there are no function routes yet, but you can
confirm the engine is live: any request returns the iii JSON error envelope.

```bash
curl -i "https://<your-domain>/"
```

Once a worker registers an HTTP trigger (for example `POST /orders`), call its
path:

```bash
curl -X POST "https://<your-domain>/orders" \
  -H "Content-Type: application/json" \
  --data-binary '{"item":"widget"}'
```

## Publish a shareable template

To turn your configured project into a one-click template, create it from the
Railway dashboard ([template docs](https://docs.railway.com/templates)):

1. Deploy this repo once and configure it (volume, variable, public domain).
2. Open the project **Settings** and choose **Generate Template from Project**.
3. In the Template Composer, confirm the `/data` volume and any variables you
   want to prompt for, then publish.
4. You get a share URL of the form `https://railway.com/template/<id>`. Put that
   id in the **Deploy on Railway** button above.

## License

Apache-2.0. See [LICENSE](./LICENSE).
