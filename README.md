# PII Masking Demo

Side-by-side comparison of two identical Node.js apps — one with PII masking enabled, one without. Use this to see how the Datadog Agent's `replace_tags` feature redacts sensitive data (email addresses) from APM traces before they ever leave your infrastructure.

## What You'll See in Datadog

Two sets of traces in [Datadog APM → Traces](https://app.datadoghq.com/apm/traces):

- **`admin-tool-masked`** — email addresses replaced with `[EMAIL REDACTED]`
- **`admin-tool-raw`** — email addresses visible in the error message

## Prerequisites

- Docker & Docker Compose
- [Datadog](https://app.datadoghq.com) account and API key

## Quick Start

```bash
cp .env.example .env
# Edit .env and set DD_API_KEY=<your-api-key>
```

Start all 4 containers (2 apps + 2 agents):

```bash
env -u DD_API_KEY docker compose up -d --build
```

> `env -u DD_API_KEY` unsets any shell-level `DD_API_KEY` so the `.env` file value is used instead.

Send error traces to both apps:

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

## Architecture

```
Port 3004 → admin-tool-masked → pii-agent-masked  (replace_tags: email → [EMAIL REDACTED])
Port 3005 → admin-tool-raw    → pii-agent-raw     (no masking)
```

## How PII Masking Works

The masked agent intercepts all traces **before forwarding them to Datadog** and applies a regex substitution via `replace_tags`. The raw PII never leaves your infrastructure.

```
App → dd-trace → [Datadog Agent applies replace_tags here] → Datadog backend
```

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
| `name` | Tag to apply the rule to. `"*"` matches all tags including `error.message`, `user.email`, etc. |
| `pattern` | Regex to match within the tag value |
| `repl` | Replacement string |

You can also configure this without a file by passing `DD_APM_REPLACE_TAGS` as an environment variable to the Agent container.

## Expected Result in Datadog APM

**`admin-tool-raw`** — the raw email address appears in the error message span:

![admin-tool-raw trace showing PII in error message](img/admin-tool-raw.png)

**`admin-tool-masked`** — the email is replaced with `[EMAIL REDACTED]` before the trace reaches Datadog:

![admin-tool-masked trace showing redacted email](img/admin-tool-masked.png)

## Cleanup

```bash
docker compose down
```

## Reference

https://docs.datadoghq.com/tracing/configure_data_security/
