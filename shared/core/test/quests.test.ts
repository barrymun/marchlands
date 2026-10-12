import { describe, expect, it } from 'vitest';
import { QUEST_CATALOGUE, questGroups, questGroupsWithQuests } from '#/index.ts';

describe('QUEST_CATALOGUE', () => {
  it('puts every quest in a quest group, by the group row id', () => {
    const ids = new Set(questGroups().map((g) => g.id));
    for (const q of QUEST_CATALOGUE) expect(ids.has(q.groupId), `quest ${q.id} group ${q.groupId}`).toBe(true);
  });

  it('files Rising Star under Prestige Building and Commodity Gathering by its row id', () => {
    const groupOf = (questId: number) => QUEST_CATALOGUE.find((q) => q.id === questId)!.groupId;
    expect(groupOf(1030)).toBe(23);
    expect(questGroups().find((g) => g.id === 23)?.description).toBe('Prestiage Building');
    expect(questGroups().find((g) => g.id === 3)?.description).toBe('Commodity Gathering');
  });
});

describe(questGroupsWithQuests.name, () => {
  it('lists each group with quests once, and only those', () => {
    const groups = questGroupsWithQuests().map((g) => g.id);
    expect(new Set(groups).size).toBe(groups.length);
    expect(new Set(groups)).toEqual(new Set(QUEST_CATALOGUE.map((q) => q.groupId)));
  });

  it('does not list groups that only share a typeId with a group that has quests', () => {
    // The Medals (21) and Wealthy Society (22) share Rebuild's typeId 1 but have no quests
    const groups = questGroupsWithQuests().map((g) => g.id);
    expect(groups).toContain(1);
    expect(groups).not.toContain(21);
    expect(groups).not.toContain(22);
  });
});
