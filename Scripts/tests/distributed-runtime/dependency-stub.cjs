const http = require('http');

const state = {
  mode: 'ok',
  delayMs: 0,
  statusCode: 200,
  failRatio: 0,
  recentRequests: [],
};

function writeJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString('utf8');
      if (Buffer.byteLength(raw, 'utf8') > 64 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sanitizeRequests() {
  if (state.recentRequests.length > 200) {
    state.recentRequests = state.recentRequests.slice(-200);
  }
}

function recordRequest(req) {
  const baggage = String(req.headers.baggage || '');
  state.recentRequests.push({
    at: new Date().toISOString(),
    method: req.method,
    path: req.url,
    traceparent: String(req.headers.traceparent || ''),
    baggage,
    baggageBytes: Buffer.byteLength(baggage, 'utf8'),
    requestId: String(req.headers['x-request-id'] || ''),
    traceId: String(req.headers['x-trace-id'] || ''),
  });
  sanitizeRequests();
}

function shouldFail() {
  if (state.mode === 'error') {
    return true;
  }
  if (state.mode === 'flaky') {
    return Math.random() < state.failRatio;
  }
  return false;
}

async function maybeDelay() {
  if (state.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, state.delayMs));
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/health') {
      writeJson(res, 200, {
        ok: true,
        state: {
          mode: state.mode,
          delayMs: state.delayMs,
          statusCode: state.statusCode,
          failRatio: state.failRatio,
          recentRequests: state.recentRequests.length,
        },
      });
      return;
    }

    if (req.url === '/admin/reset' && req.method === 'POST') {
      state.mode = 'ok';
      state.delayMs = 0;
      state.statusCode = 200;
      state.failRatio = 0;
      state.recentRequests = [];
      writeJson(res, 200, { ok: true, reset: true });
      return;
    }

    if (req.url === '/admin/config' && req.method === 'POST') {
      const body = await readJson(req);
      state.mode = ['ok', 'error', 'flaky'].includes(body.mode) ? body.mode : state.mode;
      state.delayMs = Number.isFinite(body.delayMs) ? Math.max(0, Number(body.delayMs)) : state.delayMs;
      state.statusCode = Number.isFinite(body.statusCode)
        ? Math.max(100, Math.min(599, Number(body.statusCode)))
        : state.statusCode;
      state.failRatio = Number.isFinite(body.failRatio)
        ? Math.max(0, Math.min(1, Number(body.failRatio)))
        : state.failRatio;
      writeJson(res, 200, { ok: true, state });
      return;
    }

    if (req.url === '/admin/requests' && req.method === 'GET') {
      writeJson(res, 200, {
        ok: true,
        count: state.recentRequests.length,
        recentRequests: state.recentRequests,
      });
      return;
    }

    if (req.url === '/dependency' && req.method === 'GET') {
      recordRequest(req);
      await maybeDelay();

      if (shouldFail()) {
        writeJson(res, state.statusCode || 503, {
          ok: false,
          mode: state.mode,
          failed: true,
        });
        return;
      }

      writeJson(res, state.statusCode || 200, {
        ok: true,
        mode: state.mode,
        delayedMs: state.delayMs,
      });
      return;
    }

    writeJson(res, 404, { ok: false, message: 'Not found' });
  } catch (error) {
    writeJson(res, 500, {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(4600, '127.0.0.1', () => {
  process.stdout.write('[dependency-stub] listening on 127.0.0.1:4600\n');
});
