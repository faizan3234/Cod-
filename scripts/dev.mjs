import { startServer } from './server.mjs';
const server = await startServer({
  dataDir: process.env.LEAGUE_DATA_DIR || '.local-data',
  host: process.env.HOST || '0.0.0.0',
});
console.log('Local:   ', server.url);
if (server.networkUrl) {
  console.log('Network: ', server.networkUrl);
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
