import { createApp } from './app.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`SMART LIFE backend listening`, {
    port: env.port,
    mode: env.providerMode,
    env: env.nodeEnv,
  });
});

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
