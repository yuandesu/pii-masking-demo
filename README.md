# APM PII Masking Demo

Minimal Node.js + Datadog APM demo that reproduces an error span containing a PII email address.

```
Error: User testpiilusername@gmail.com was not found.
```

## Architecture

Two identical Node.js apps each paired with its own Datadog Agent:

| Service | Port | Agent | Masking |
|---|---|---|---|
| `admin-tool-masked` | 3004 | `pii-agent-masked` | replace_tags ON |
| `admin-tool-raw` | 3005 | `pii-agent-raw` | No masking |

This lets you compare the two traces side by side in Datadog APM without restarting anything.

---

## Quick Start

**Prerequisites:** Docker Desktop, a Datadog API Key

```bash
git clone https://github.com/yuandesu/pii-masking-demo.git
cd pii-masking-demo
cp .env.example .env
# Edit .env and set DD_API_KEY
```

Start all 4 containers:

```bash
env -u DD_API_KEY docker compose up -d --build
```

> `env -u DD_API_KEY` unsets any shell-level `DD_API_KEY` so the `.env` file takes effect.

Send error traces to both services:

```bash
for i in $(seq 1 5); do
  curl -s -X POST http://localhost:3004/api/functions/getUser \
    -H "Content-Type: application/json" \
    -d '{"email":"testpiilusername@gmail.com"}' > /dev/null

  curl -s -X POST http://localhost:3005/api/functions/getUser \
    -H "Content-Type: application/json" \
    -d '{"email":"testpiilusername@gmail.com"}' > /dev/null
done
```

Wait ~1 minute, then open **Datadog APM → Traces** and filter by `admin-tool-masked` or `admin-tool-raw`.

Stop everything:

```bash
docker compose down
```
