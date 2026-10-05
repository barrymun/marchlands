import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import { jsonSchemaTransform, jsonSchemaTransformObject, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import type { Db } from '@evony/db';
import { verifyToken } from './auth/jwt.ts';
import type { ApiConfig } from './config.ts';
import { installErrorHandler, playerIdOf } from './http.ts';
import authRoutes from './routes/auth.ts';
import cityRoutes from './routes/cities.ts';
import economyRoutes from './routes/economy.ts';
import militaryRoutes from './routes/military.ts';
import playerRoutes from './routes/player.ts';
import socialRoutes from './routes/social.ts';
import { sendPush, type PushGateway } from './ws/gateway.ts';

export interface BuildOptions {
  db: Db;
  config: ApiConfig;
  gateway: PushGateway | null;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp({ db, config, gateway, logger }: BuildOptions) {
  const app = Fastify({ logger: logger ?? { level: config.logLevel }, trustProxy: true, bodyLimit: 256 * 1024 }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('deps', { db, config, online: () => gateway?.online() ?? 0 });
  installErrorHandler(app);
  // accept an empty body on JSON requests (many commands take no parameters)
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body) return done(null, {});
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      (err as { statusCode?: number }).statusCode = 400;
      done(err as Error, undefined);
    }
  });

  await app.register(cors, { origin: config.corsOrigin, credentials: true });
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'evony-re API',
        version: '0.1.0',
        description:
          'Evony Age 1 game server. Successful calls answer `{ ok: 1, data }`; failures `{ ok: <negative code>, errorMsg }` with a 4xx status. ' +
          'Live updates (`server.*` pushes of the original protocol) arrive on the WebSocket at `/ws?token=...` as `{ cmd, data }`.',
      },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

  app.get('/health', { schema: { hide: true } }, async () => {
    await db.execute(sql`select 1`);
    return { ok: 1, status: 'up', online: app.deps.online() };
  });

  // WebSocket: authenticate with ?token=, then receive pushes. Clients may send {cmd:"ping"}.
  app.get('/ws', { websocket: true, schema: { hide: true } }, async (socket, req) => {
    const token = (req.query as Record<string, string>).token;
    const claims = token ? verifyToken(token, config.jwtSecret) : null;
    if (!claims || !gateway) {
      sendPush(socket, { cmd: 'server.ConnectionLost', data: { reasonCode: 5, msg: 'Not logged in.' } });
      socket.close(4001, 'unauthorized');
      return;
    }
    req.claims = claims;
    let playerId: number;
    try {
      playerId = await playerIdOf(db, req);
    } catch {
      sendPush(socket, { cmd: 'server.ConnectionLost', data: { reasonCode: 5, msg: 'need create player' } });
      socket.close(4004, 'no player');
      return;
    }
    gateway.add(playerId, socket);
    sendPush(socket, { cmd: 'server.Connected', data: { playerId, serverTime: Date.now() } });
    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as { cmd?: string };
        if (msg.cmd === 'ping') sendPush(socket, { cmd: 'pong', data: { serverTime: Date.now() } });
      } catch {
        /* ignore malformed frames */
      }
    });
    socket.on('close', () => gateway.remove(playerId, socket));
  });

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(playerRoutes);
      await api.register(cityRoutes);
      await api.register(militaryRoutes);
      await api.register(socialRoutes);
      await api.register(economyRoutes);
    },
    { prefix: '/api/v1' },
  );
  return app;
}
