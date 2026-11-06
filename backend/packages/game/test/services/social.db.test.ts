import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { ChatChannel, msg, PlayerRelationKind } from '@marchlands/core';

import { refreshRankings } from '#/engine/rankings.ts';
import { addPrestige } from '#/helpers.ts';
import { admin, social } from '#/index.ts';
import { getPlayer, savePlayer } from '#/repo.ts';
import { foundAlliance, joinAlliance } from '#test/support/alliance.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer, reloadPlayer, type TestPlayer } from '#test/support/factories.ts';
import { game, T0, type TestGame } from '#test/support/game.ts';

const MINUTE = 60_000;

/** The texts of the world / beginner chat pushes so far. */
const chatPushes = (g: TestGame) => g.pushes(PushCmd.CHANNEL_CHAT_MESSAGE).map((p) => (p.data as { msg: string }).msg);

async function givePrestige(g: TestGame, p: TestPlayer, amount: number) {
  const row = await getPlayer(g, p.id);
  addPrestige(row, amount);
  await savePlayer(g, row);
}

describe(social.listRelations.name, () => {
  it('is empty for a new player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      expect(await social.listRelations(g, a.id)).toEqual({ friends: [], blocked: [] });
    }));

  it('splits friends from blocked players, with prestige rounded down and last seen', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const c = await createTestPlayer(g);
      await givePrestige(g, b, 123.9);
      await social.addRelation(g, a.id, b.name, PlayerRelationKind.FRIEND);
      await social.addRelation(g, a.id, c.name, PlayerRelationKind.BLOCK);
      const seen = (await reloadPlayer(g, b)).lastSeenAt;
      expect(await social.listRelations(g, a.id)).toEqual({
        friends: [{ id: b.id, name: b.name, prestige: 123, lastSeen: seen }],
        blocked: [{ id: c.id, name: c.name, prestige: 0, lastSeen: (await reloadPlayer(g, c)).lastSeenAt }],
      });
      // relations are one-sided
      expect(await social.listRelations(g, b.id)).toEqual({ friends: [], blocked: [] });
    }));
});

describe(social.addRelation.name, () => {
  it('finds the player by name whatever the case and returns their id and stored name', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g, { name: 'Gareth' });
      expect(await social.addRelation(g, a.id, 'gARETH', PlayerRelationKind.FRIEND)).toEqual({ id: b.id, name: 'Gareth' });
      expect((await social.listRelations(g, a.id)).friends.map((f) => f.id)).toEqual([b.id]);
    }));

  it('adding the same relation twice keeps one; a player can be both friend and blocked', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await social.addRelation(g, a.id, b.name, PlayerRelationKind.FRIEND);
      await social.addRelation(g, a.id, b.name, PlayerRelationKind.FRIEND);
      await social.addRelation(g, a.id, b.name, PlayerRelationKind.BLOCK);
      const list = await social.listRelations(g, a.id);
      expect(list.friends).toHaveLength(1);
      expect(list.blocked).toHaveLength(1);
    }));

  it('rejects an unknown player and yourself', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await expectRefused(social.addRelation(g, a.id, 'Nobody Here', PlayerRelationKind.FRIEND), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
      await expectRefused(social.addRelation(g, a.id, a.name.toUpperCase(), PlayerRelationKind.BLOCK), msg('social.selfTarget'));
      expect(await social.listRelations(g, a.id)).toEqual({ friends: [], blocked: [] });
    }));
});

describe(social.removeRelation.name, () => {
  it('removes only that kind of relation', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await social.addRelation(g, a.id, b.name, PlayerRelationKind.FRIEND);
      await social.addRelation(g, a.id, b.name, PlayerRelationKind.BLOCK);
      await social.removeRelation(g, a.id, b.id, PlayerRelationKind.BLOCK);
      expect(await social.listRelations(g, a.id)).toMatchObject({ friends: [{ id: b.id }], blocked: [] });
      await social.removeRelation(g, a.id, b.id, PlayerRelationKind.FRIEND);
      expect(await social.listRelations(g, a.id)).toEqual({ friends: [], blocked: [] });
    }));

  it("does nothing for a relation that does not exist or is another player's", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await social.addRelation(g, a.id, b.name, PlayerRelationKind.FRIEND);
      await social.removeRelation(g, b.id, a.id, PlayerRelationKind.FRIEND);
      await social.removeRelation(g, a.id, 2_000_000_000, PlayerRelationKind.FRIEND);
      expect((await social.listRelations(g, a.id)).friends).toHaveLength(1);
    }));
});

describe(social.worldChat.name, () => {
  it('stores the message and broadcasts it to everyone', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await social.worldChat(g, a.id, '  Hello world  ');
      expect(g.pushes(PushCmd.CHANNEL_CHAT_MESSAGE)).toEqual([
        {
          playerIds: [],
          cmd: PushCmd.CHANNEL_CHAT_MESSAGE,
          data: { msg: 'Hello world', languageType: 0, fromUser: a.name, fromId: a.id, channel: ChatChannel.WORLD, time: T0 },
        },
      ]);
      expect(await social.chatHistory(g, a.id, ChatChannel.WORLD)).toEqual([
        { id: expect.any(Number), channel: ChatChannel.WORLD, fromUser: a.name, fromId: a.id, toId: null, msg: 'Hello world', time: T0 },
      ]);
    }));

  it('posts to the beginner channel', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await social.worldChat(g, a.id, 'Hi', ChatChannel.BEGINNER);
      expect(g.pushes(PushCmd.CHANNEL_CHAT_MESSAGE)[0]!.data).toMatchObject({ channel: ChatChannel.BEGINNER });
      expect(await social.chatHistory(g, a.id, ChatChannel.WORLD)).toEqual([]);
      expect((await social.chatHistory(g, a.id, ChatChannel.BEGINNER)).map((m) => m.msg)).toEqual(['Hi']);
    }));

  it('escapes HTML', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await social.worldChat(g, a.id, `<b>"Tom" & 'Jerry'</b>`);
      const escaped = '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;';
      expect(g.pushes(PushCmd.CHANNEL_CHAT_MESSAGE)[0]!.data).toMatchObject({ msg: escaped });
      expect((await social.chatHistory(g, a.id, ChatChannel.WORLD))[0]!.msg).toBe(escaped);
    }));

  it('accepts 300 characters and rejects more, and rejects an empty message', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await social.worldChat(g, a.id, 'x'.repeat(300));
      await expectRefused(social.worldChat(g, a.id, 'x'.repeat(301)), msg('social.messageTooLong', { count: 300 }));
      await expectRefused(social.worldChat(g, a.id, '   '), msg('social.emptyMessage'));
      expect(await social.chatHistory(g, a.id, ChatChannel.WORLD)).toHaveLength(1);
      expect(g.pushes(PushCmd.CHANNEL_CHAT_MESSAGE)).toHaveLength(1);
    }));

  it('refuses a muted player until the mute runs out', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.mute(g, a.name, 10);
      await expectRefused(social.worldChat(g, a.id, 'Hi'), msg('social.muted'));
      await expectRefused(social.worldChat(g, a.id, ''), msg('social.muted')); // muted is checked first
      g.advance(10 * MINUTE);
      await social.worldChat(g, a.id, 'Hi');
      expect(g.pushes(PushCmd.CHANNEL_CHAT_MESSAGE)).toHaveLength(1);
    }));

  it('colours the top lord red in the push, but stores the plain text', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await givePrestige(g, a, 1000);
      await refreshRankings(g);
      await social.worldChat(g, a.id, 'First');
      await social.worldChat(g, b.id, 'Second');
      expect(chatPushes(g)).toEqual(['<font color="#FF0000">First</font>', 'Second']);
      expect((await social.chatHistory(g, a.id, ChatChannel.WORLD)).map((m) => m.msg)).toEqual(['First', 'Second']);
    }));

  it('colours members of the top alliance blue', () =>
    game(async (g) => {
      const top = await createTestPlayer(g);
      const member = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      await givePrestige(g, top, 5000);
      await givePrestige(g, member, 1000);
      await givePrestige(g, other, 2000);
      await foundAlliance(g, top, 'Order');
      await joinAlliance(g, top, member, 'Order');
      await foundAlliance(g, other, 'Chaos');
      await refreshRankings(g);
      // member: 3rd player but in the 1st alliance; other: 2nd player in the 2nd alliance
      await social.worldChat(g, member.id, 'Blue');
      await social.worldChat(g, other.id, 'Plain');
      expect(chatPushes(g)).toEqual(['<font color="#0066FF">Blue</font>', 'Plain']);
    }));
});

describe(social.allianceChat.name, () => {
  it('stores the message for the alliance and pushes it to every member', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const outsider = await createTestPlayer(g);
      await foundAlliance(g, a, 'Order');
      await joinAlliance(g, a, b, 'Order');
      await social.allianceChat(g, b.id, 'For the <Order>');
      expect(g.pushes(PushCmd.ALLIANCE_CHAT_MESSAGE)).toEqual([
        {
          playerIds: expect.arrayContaining([a.id, b.id]),
          cmd: PushCmd.ALLIANCE_CHAT_MESSAGE,
          data: { msg: 'For the &lt;Order&gt;', languageType: 0, fromUser: b.name, fromId: b.id, channel: ChatChannel.ALLIANCE, time: T0 },
        },
      ]);
      expect(g.pushes(PushCmd.ALLIANCE_CHAT_MESSAGE)[0]!.playerIds).toHaveLength(2);
      expect((await social.chatHistory(g, a.id, ChatChannel.ALLIANCE)).map((m) => m.msg)).toEqual(['For the &lt;Order&gt;']);
      expect(await social.chatHistory(g, outsider.id, ChatChannel.ALLIANCE)).toEqual([]);
    }));

  it('rejects a player without an alliance, a muted player and an empty message', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(social.allianceChat(g, a.id, 'Hi'), msg('social.notInAlliance'));
      await foundAlliance(g, a, 'Order');
      await expectRefused(social.allianceChat(g, a.id, ' '), msg('social.emptyMessage'));
      await expectRefused(social.allianceChat(g, a.id, 'x'.repeat(301)), msg('social.messageTooLong', { count: 300 }));
      await joinAlliance(g, a, b, 'Order');
      await admin.mute(g, b.name, 5);
      await expectRefused(social.allianceChat(g, b.id, 'Hi'), msg('social.muted'));
      expect(g.pushes(PushCmd.ALLIANCE_CHAT_MESSAGE)).toEqual([]);
    }));
});

describe(social.privateChat.name, () => {
  it('stores the message and pushes it to the target only', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await social.privateChat(g, a.id, b.name.toLowerCase(), 'psst & hi');
      expect(g.pushes(PushCmd.PRIVATE_CHAT_MESSAGE)).toEqual([
        { playerIds: [b.id], cmd: PushCmd.PRIVATE_CHAT_MESSAGE, data: { msg: 'psst &amp; hi', chatType: 0, fromUser: a.name, fromId: a.id, time: T0 } },
      ]);
      expect(await social.chatHistory(g, b.id, ChatChannel.PRIVATE)).toEqual([
        { id: expect.any(Number), channel: ChatChannel.PRIVATE, fromUser: a.name, fromId: a.id, toId: b.id, msg: 'psst &amp; hi', time: T0 },
      ]);
    }));

  it('is silently dropped when the target blocks the sender', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await social.addRelation(g, b.id, a.name, PlayerRelationKind.BLOCK);
      await social.privateChat(g, a.id, b.name, 'Hi');
      expect(g.pushes(PushCmd.PRIVATE_CHAT_MESSAGE)).toEqual([]);
      expect(await social.chatHistory(g, a.id, ChatChannel.PRIVATE)).toEqual([]);
      // the other way round still works
      await social.privateChat(g, b.id, a.name, 'Hi back');
      expect(g.pushes(PushCmd.PRIVATE_CHAT_MESSAGE)).toHaveLength(1);
    }));

  it('rejects an unknown player, yourself, a muted sender and a bad message', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(social.privateChat(g, a.id, 'Nobody Here', 'Hi'), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
      await expectRefused(social.privateChat(g, a.id, a.name, 'Hi'), msg('social.selfTarget'));
      await expectRefused(social.privateChat(g, a.id, b.name, ''), msg('social.emptyMessage'));
      await expectRefused(social.privateChat(g, a.id, b.name, 'x'.repeat(301)), msg('social.messageTooLong', { count: 300 }));
      await admin.mute(g, a.name, 1);
      await expectRefused(social.privateChat(g, a.id, b.name, 'Hi'), msg('social.muted'));
      expect(g.pushes(PushCmd.PRIVATE_CHAT_MESSAGE)).toEqual([]);
    }));
});

describe(social.chatHistory.name, () => {
  it('keeps messages sent in the same millisecond in the order they were sent', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      for (const text of ['One', 'Two', 'Three', 'Four']) await social.worldChat(g, a.id, text);
      expect((await social.chatHistory(g, a.id, ChatChannel.WORLD)).map((m) => m.msg)).toEqual(['One', 'Two', 'Three', 'Four']);
    }));

  it('lists a channel oldest first, only messages after `since`', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      for (let i = 1; i <= 3; i++) {
        await social.worldChat(g, a.id, `Message ${i}`);
        g.advance(1000);
      }
      expect((await social.chatHistory(g, a.id, ChatChannel.WORLD)).map((m) => m.msg)).toEqual(['Message 1', 'Message 2', 'Message 3']);
      expect((await social.chatHistory(g, a.id, ChatChannel.WORLD, T0 + 1000)).map((m) => m.msg)).toEqual(['Message 3']);
      expect(await social.chatHistory(g, a.id, ChatChannel.WORLD, T0 + 2000)).toEqual([]);
    }));

  it('keeps the latest 100 messages', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      for (let i = 1; i <= 102; i++) {
        await social.worldChat(g, a.id, `M${i}`);
        g.advance(1);
      }
      const list = await social.chatHistory(g, a.id, ChatChannel.WORLD);
      expect(list).toHaveLength(100);
      expect(list[0]!.msg).toBe('M3');
      expect(list.at(-1)!.msg).toBe('M102');
    }));

  it('shows a player only the private messages they sent or received', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const c = await createTestPlayer(g);
      await social.privateChat(g, a.id, b.name, 'a to b');
      g.advance(1);
      await social.privateChat(g, b.id, c.name, 'b to c');
      g.advance(1);
      await social.privateChat(g, c.id, a.name, 'c to a');
      expect((await social.chatHistory(g, a.id, ChatChannel.PRIVATE)).map((m) => m.msg)).toEqual(['a to b', 'c to a']);
      expect((await social.chatHistory(g, b.id, ChatChannel.PRIVATE)).map((m) => m.msg)).toEqual(['a to b', 'b to c']);
    }));

  it("shows only the player's own alliance's messages, and nothing without an alliance", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const c = await createTestPlayer(g);
      await foundAlliance(g, a, 'Order');
      await foundAlliance(g, b, 'Chaos');
      await social.allianceChat(g, a.id, 'Order only');
      await social.allianceChat(g, b.id, 'Chaos only');
      expect((await social.chatHistory(g, a.id, ChatChannel.ALLIANCE)).map((m) => m.msg)).toEqual(['Order only']);
      expect((await social.chatHistory(g, b.id, ChatChannel.ALLIANCE)).map((m) => m.msg)).toEqual(['Chaos only']);
      expect(await social.chatHistory(g, c.id, ChatChannel.ALLIANCE)).toEqual([]);
    }));

  it('an unknown channel is simply empty; an unknown player is refused', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await social.worldChat(g, a.id, 'Hi');
      expect(await social.chatHistory(g, a.id, 'nowhere' as ChatChannel)).toEqual([]);
      await expectRefused(social.chatHistory(g, 2_000_000_000, ChatChannel.WORLD), msg('common.playerNotFound'));
    }));
});
