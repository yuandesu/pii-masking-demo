# APM PII Masking Demo

Minimal Node.js + Datadog APM demo that reproduces an error span containing a PII email address, then validates two masking approaches side by side.

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

---

## Method 1: Datadog Agent `replace_tags`

### How it works

The Datadog Agent intercepts all traces **before forwarding them to Datadog**. The `replace_tags` rule applies a regex substitution to matching span tag values on the Agent side — the raw PII never leaves your infrastructure.

```
App → dd-trace → [Datadog Agent: replace_tags scrubs PII here] → Datadog backend
```

### Configuration

`datadog/datadog-masked.yaml`:

```yaml
apm_config:
  enabled: true
  replace_tags:
    - name: "*"
      pattern: "[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+"
      repl: "[EMAIL REDACTED]"
```

| Field | Description |
|---|---|
| `name` | Tag name to apply the rule to. `"*"` matches all tags including `error.message`, `user.email`, etc. |
| `pattern` | Regular expression to match within the tag value |
| `repl` | Replacement string |

### Environment variable alternative

You can set this without a config file by passing `DD_APM_REPLACE_TAGS` to the Agent container:

```yaml
# docker-compose.yml
environment:
  DD_APM_REPLACE_TAGS: '[{"name":"*","pattern":"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+","repl":"[EMAIL REDACTED]"}]'
```

### Expected result in APM

- `admin-tool-raw` → `error.message: User testpiilusername@gmail.com was not found.`
- `admin-tool-masked` → `error.message: User [EMAIL REDACTED] was not found.`

Reference: https://docs.datadoghq.com/tracing/configure_data_security/

---

## Method 2: Sensitive Data Scanner

Sensitive Data Scanner runs inside Datadog at ingestion time. It scans incoming spans, detects PII patterns, and redacts or hashes them before they are stored — no Agent change or restart required.

### Setup (Datadog UI)

1. Go to **Datadog → Security → Sensitive Data Scanner**
2. Click **+ New Scanning Group**
   - Name: e.g. `APM PII`
   - Filter: `source:apm` (targets APM spans)
3. Click **+ Add Scanning Rule** inside the group
   - Use the built-in **Email Address** library rule, or define a custom regex
   - Action: **Redact** (replaces with `[REDACTED]`) or **Hash**
4. Save — rules apply to all new incoming data immediately

### Comparison with Method 1

| | Method 1: replace_tags | Method 2: Sensitive Data Scanner |
|---|---|---|
| When applied | Agent side, before sending to Datadog | Datadog ingestion pipeline |
| Config location | `datadog.yaml` or env var | Datadog UI |
| Agent restart required | Yes | No |
| Applies to existing data | No | No (only new ingested data) |
| Centralized rule management | No | Yes |

**Use Method 1** when you need to guarantee PII never leaves your network.  
**Use Method 2** when you want centralized, no-code rule management inside Datadog.

Reference: https://docs.datadoghq.com/security/sensitive_data_scanner/
