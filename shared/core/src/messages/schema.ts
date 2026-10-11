// Zod schemas for messages (index.ts), for core types that store them and for the API contracts.

import { z } from 'zod';
import { GAME_REF_KINDS, MSG_CODES, type Message, type MsgParam } from './index.ts';

/** A reference to game data the client names in the player's language. */
export const GameRefSchema = z.object({ ref: z.enum(GAME_REF_KINDS), id: z.union([z.number(), z.string()]) }).meta({ id: 'GameRef' });

/** A length of time in real milliseconds, shown by the client as a duration. */
export const MsgDurationSchema = z.object({ duration: z.number() }).meta({ id: 'MsgDuration' });

/** A value inside a message: text the player wrote, a number, game data, a duration, another message, or a list of these. */
export const MsgParamSchema: z.ZodType<MsgParam> = z
  .lazy(() => z.union([z.string(), z.number(), z.boolean(), GameRefSchema, MsgDurationSchema, MessageSchema, z.array(MsgParamSchema)]))
  .meta({ id: 'MsgParam' }) as z.ZodType<MsgParam>;

/** What the server tells a player: a code (`hero.locked`) and its params; the client words it in the player's language. */
export const MessageSchema: z.ZodType<Message> = z
  .object({ code: z.enum(MSG_CODES), params: z.record(z.string(), MsgParamSchema).optional() })
  .meta({ id: 'Message' }) as z.ZodType<Message>;
