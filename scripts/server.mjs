import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import path from 'node:path';
import { createServer as createVite } from 'vite';
import { createService } from '../server/service.mjs';
import { fileStore } from '../server/local-store.mjs';
import { extractScoreboard } from '../server/ocr.mjs';
export async function startServer({
  dataDir = '.local-data',
  port = 5173,
  apiPort = 8788,
  host = process.env.HOST || '0.0.0.0',
} = {}) {
  const handler = createService({
      store: fileStore(path.resolve(dataDir)),
      extract: extractScoreboard,
      mode: 'local',
    }),
    backend = createServer(async (req, res) => {
      try {
        const request = new Request('http://' + req.headers.host + req.url, {
            method: req.method,
            headers: req.headers,
            ...(!['GET', 'HEAD'].includes(req.method)
              ? { body: Readable.toWeb(req), duplex: 'half' }
              : {}),
          }),
          response = await handler(request, { ip: req.socket.remoteAddress });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) Readable.fromWeb(response.body).pipe(res);
        else res.end();
      } catch (e) {
        console.error(e.message);
        res.writeHead(500).end();
      }
    });
  await new Promise((resolve) => backend.listen(apiPort, '127.0.0.1', resolve));
  const vite = await createVite({
    server: {
      host,
      port,
      strictPort: true,
      proxy: {
        '/.netlify/functions': {
          target: 'http://127.0.0.1:' + backend.address().port,
          changeOrigin: false,
        },
      },
    },
  });
  await vite.listen();
  const networkUrl =
    vite.resolvedUrls?.network?.[0]?.replace(/\/$/, '') || null;
  const localUrl =
    vite.resolvedUrls?.local?.[0]?.replace(/\/$/, '') ||
    'http://127.0.0.1:' + port;
  return {
    url: localUrl,
    networkUrl,
    vite,
    close: async () => {
      await vite.close();
      backend.closeAllConnections();
      await new Promise((r) => backend.close(r));
    },
  };
}
