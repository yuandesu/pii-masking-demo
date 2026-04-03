// Must be the very first line - dd-trace init
require('dd-trace').init();

const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Reproduce the trace pattern: POST /api/functions/:functionName
// Always throws "User <email> was not found." to generate error spans with PII
app.post('/api/functions/:functionName', (req, res) => {
  const { email } = req.body;
  const err = new Error(`User ${email} was not found.`);

  const tracer = require('dd-trace');
  const span = tracer.scope().active();
  if (span) {
    span.setTag('error', err);
    span.setTag('error.message', err.message);
    span.setTag('user.email', email);
    span.setTag('http.status_code', 404);
  }

  res.status(404).json({ error: err.message });
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`admin-tool listening on port ${PORT}`);
});
