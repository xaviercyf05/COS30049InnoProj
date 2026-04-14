const http = require('http');
const { URL } = require('url');

const PORT = process.env.AUTH_PROXY_PORT || 3001;
const TARGET_ORIGIN = process.env.AUTH_PROXY_TARGET || 'https://api.innopappserver.xyz';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', (error) => {
      reject(error);
    });
  });

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Invalid request URL.' }));
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (!req.url.startsWith('/api/')) {
    res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Not found.' }));
    return;
  }

  try {
    const targetUrl = new URL(req.url, TARGET_ORIGIN);
    const body = await readRequestBody(req);

    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        Authorization: req.headers.authorization || '',
      },
      body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : body,
    });

    const responseBody = await upstreamResponse.arrayBuffer();
    const contentType = upstreamResponse.headers.get('content-type') || 'application/json';

    res.writeHead(upstreamResponse.status, {
      ...corsHeaders,
      'Content-Type': contentType,
    });

    res.end(Buffer.from(responseBody));
  } catch (error) {
    res.writeHead(502, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        message: 'Proxy request failed.',
        error: error.message,
      })
    );
  }
});

server.listen(PORT, () => {
  console.log(`Auth proxy running at http://localhost:${PORT}`);
  console.log(`Forwarding /api/* to ${TARGET_ORIGIN}`);
});
