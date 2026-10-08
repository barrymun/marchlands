import { setGameSpeed } from '@marchlands/core';
import { connect } from '@marchlands/db';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { PushGateway } from './ws/gateway.ts';

const config = loadConfig();
setGameSpeed(Number(process.env.GAME_SPEED ?? 1));
const { db, close } = connect(config.databaseUrl);

const logger =
  process.env.NODE_ENV === 'production' ? { level: config.logLevel } : { level: config.logLevel, transport: { target: 'pino-pretty', options: { singleLine: true } } };

const gateway = new PushGateway(config.databaseUrl, db);
const app = await buildApp({ db, config, gateway, logger });
gateway.setLogger(app.log);

await gateway.start();
await app.listen({ port: config.port, host: config.host });

async function shutdown(signal: string) {
  app.log.info(`received ${signal}, shutting down`);
  setTimeout(() => process.exit(0), 5000).unref();
  await gateway.stop();
  await app.close();
  await close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
