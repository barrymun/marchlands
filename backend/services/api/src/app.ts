import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import { operationIdOf } from '#/operation-id.ts';
import { jsonSchemaTransform, jsonSchemaTransformObject, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { msg } from '@marchlands/core';
import type { Db } from '@marchlands/db';
import { verifyToken } from '#/auth/jwt.ts';
import type { ApiConfig } from '#/config.ts';
import { accountRefusal, installErrorHandler, playerIdOf } from '#/http.ts';
import authRoutes from '#/routes/auth.ts';
import cityRoutes from '#/routes/cities.ts';
import economyRoutes from '#/routes/economy.ts';
import militaryRoutes from '#/routes/military.ts';
import playerRoutes from '#/routes/player.ts';
import socialRoutes from '#/routes/social.ts';
import { sendPush, type PushGateway } from '#/ws/gateway.ts';
import { PushCmd } from '@marchlands/contracts';

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

  // a command sent with no body at all is read as an empty one too
  app.addHook('preValidation', async (req) => {
    if (req.body == null && req.method !== 'GET' && req.method !== 'HEAD') req.body = {};
  });

  await app.register(cors, { origin: config.corsOrigin, credentials: true });
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Marchlands API',
        version: '0.1.0',
        description:
          'Marchlands game server, based on Evony Age 1. Successful calls answer `{ ok: 1, data }`; failures `{ ok: <negative code>, error: { code, params } }` with a 4xx status: a message code the client words in the language the player chose. ' +
          'Live updates (`server.*` pushes of the original protocol) arrive on the WebSocket at `/ws?token=...` as `{ cmd, data }`.',
      },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    },
    // every operation gets an operationId (the generated client's function names): method + path
    transform: (input) => {
      const out = jsonSchemaTransform(input);
      const method = [input.route.method].flat()[0];
      return { ...out, schema: { operationId: operationIdOf(String(method), input.url), ...out.schema } };
    },
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
      sendPush(socket, { cmd: PushCmd.CONNECTION_LOST, data: { reasonCode: 5, msg: msg('auth.notLoggedIn') } });
      socket.close(4001, 'unauthorized');
      return;
    }
    const refusal = await accountRefusal(db, claims.sub);
    if (refusal) {
      sendPush(socket, { cmd: PushCmd.CONNECTION_LOST, data: { reasonCode: 5, msg: refusal.error } });
      socket.close(4001, 'unauthorized');
      return;
    }
    req.claims = claims;
    let playerId: number;
    try {
      playerId = await playerIdOf(db, req);
    } catch {
      sendPush(socket, { cmd: PushCmd.CONNECTION_LOST, data: { reasonCode: 5, msg: msg('auth.needPlayer') } });
      socket.close(4004, 'no player');
      return;
    }
    gateway.add(playerId, socket);
    sendPush(socket, { cmd: PushCmd.CONNECTED, data: { playerId, serverTime: Date.now() } });
    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as { cmd?: string };
        if (msg.cmd === 'ping') sendPush(socket, { cmd: PushCmd.PONG, data: { serverTime: Date.now() } });
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
