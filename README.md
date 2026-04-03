[English](#apm-pii-masking-demo) | [日本語](#apm-pii-マスキング-デモ)

---

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

---

## Masking Method: Datadog Agent `replace_tags`

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

**admin-tool-raw** — PII visible in error message:

![admin-tool-raw](img/admin-tool-raw.png)

**admin-tool-masked** — email replaced by `[EMAIL REDACTED]`:

![admin-tool-masked](img/admin-tool-masked.png?v=2)

Reference: https://docs.datadoghq.com/tracing/configure_data_security/

---
---

# APM PII マスキング デモ

APM エラースパンに PII（メールアドレス）が含まれるケースを再現し、マスキングの効果を比較する最小構成の Node.js + Datadog APM デモです。

```
Error: User testpiilusername@gmail.com was not found.
```

## アーキテクチャ

同一の Node.js アプリを2つ用意し、それぞれ専用の Datadog Agent とペアにしています：

| サービス | ポート | Agent | マスキング |
|---|---|---|---|
| `admin-tool-masked` | 3004 | `pii-agent-masked` | replace_tags 有効 |
| `admin-tool-raw` | 3005 | `pii-agent-raw` | マスキングなし |

再起動なしで2つのトレースを Datadog APM 上で並べて比較できます。

---

## クイックスタート

**前提条件：** Docker Desktop、Datadog API Key

```bash
git clone https://github.com/yuandesu/pii-masking-demo.git
cd pii-masking-demo
cp .env.example .env
# .env を編集して DD_API_KEY を設定
```

4つのコンテナを起動：

```bash
env -u DD_API_KEY docker compose up -d --build
```

> `env -u DD_API_KEY` はシェルの環境変数 `DD_API_KEY` を一時的に除外し、`.env` ファイルの値が使われるようにします。

両サービスにエラートレースを送信：

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

約1分後、**Datadog APM → Traces** を開き `admin-tool-masked` または `admin-tool-raw` でフィルタしてください。

停止：

```bash
docker compose down
```

---

## マスキング方法：Datadog Agent の `replace_tags`

### 仕組み

Datadog Agent はトレースを **Datadog に転送する前に**インターセプトします。`replace_tags` ルールにより、Agent 側でスパンタグの値に正規表現による置換を適用するため、生の PII はインフラ外に送信されません。

```
App → dd-trace → [Datadog Agent: ここで replace_tags が PII をスクラブ] → Datadog バックエンド
```

### 設定

`datadog/datadog-masked.yaml`:

```yaml
apm_config:
  enabled: true
  replace_tags:
    - name: "*"
      pattern: "[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+"
      repl: "[EMAIL REDACTED]"
```

| フィールド | 説明 |
|---|---|
| `name` | ルールを適用するタグ名。`"*"` は `error.message`、`user.email` など全タグに一致 |
| `pattern` | タグ値に対してマッチする正規表現 |
| `repl` | 置換後の文字列 |

### 環境変数での代替設定

設定ファイルなしで Agent コンテナに `DD_APM_REPLACE_TAGS` を渡すことも可能です：

```yaml
# docker-compose.yml
environment:
  DD_APM_REPLACE_TAGS: '[{"name":"*","pattern":"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+","repl":"[EMAIL REDACTED]"}]'
```

### APM での確認結果

**admin-tool-raw** — エラーメッセージに PII がそのまま表示：

![admin-tool-raw](img/admin-tool-raw.png)

**admin-tool-masked** — メールアドレスが `[EMAIL REDACTED]` に置換済み：

![admin-tool-masked](img/admin-tool-masked.png?v=2)

参考ドキュメント：https://docs.datadoghq.com/tracing/configure_data_security/
