# Nobility titles

What players recorded about the original game's nobility titles: what each one needed, and how many cities it allowed. The original server's code (docs/spec/) kept a `title` on each player but never changed it, so these accounts are the only source for the requirements. Searched 2026-11-02.

**Version:** the full table is from an Age 2 guide; an Age 1 guide (2009) agrees where it gives numbers. Marchlands follows these numbers (`shared/core/src/titles.ts`).

## The table

Each title raised the city limit by one: a Civilian holds 1 city, a Knight 2, up to 10 at the top title. A promotion was a quest that needed a military rank, prestige and gold, and used up medals: 10 of one kind and 5 of the next, rising a kind a title (source 1).

| Title | Cities | Military rank | Prestige | Gold | Medals |
|---|---|---|---|---|---|
| Knight | 2 | Lieutenant | 1,000 | 20,000 | 10 Cross, 5 Rose |
| Baronet | 3 | Captain | 2,000 | 40,000 | 10 Rose, 5 Lion |
| Baron | 4 | Major | 4,000 | 60,000 | 10 Lion, 5 Honour |
| Viscount | 5 | Colonel | 8,000 | 80,000 | 10 Honour, 5 Courage |
| Earl | 6 | General | 16,000 | 100,000 | 10 Courage, 5 Wisdom |
| Marquis | 7 | General | 32,000 | 200,000 | 10 Wisdom, 5 Freedom |
| Duke | 8 | General | 64,000 | 300,000 | 10 Freedom, 5 Justice |
| Furstin | 9 | General | 128,000 | 400,000 | 10 Justice, 5 Nation |
| Prinzessin (our Prince) | 10 | General | 256,000 | 500,000 | 20 Cross, 15 Rose, 10 Lion, 5 Nation |

- **Prestige doubles each title,** from 1,000 to 256,000, and is only required, not spent.
- **Military ranks** (Lieutenant, Captain, Major, Colonel, General) were a ladder of their own, earned by quests, and gated the titles; General, the last, was needed from Earl up (source 1). Marchlands has no military ranks.

## How the sources agree

- **Source 1** (Age 2, 2015) gives the whole table above.
- **Source 2** (Age 1, 2009), a step-by-step guide: a player following it is a Lieutenant at about 1,400 prestige and a Knight at about 2,100, and a Knight is needed to build a second city; Justice and Nation medals are needed for the high titles, 5 Justice for Duke and 10 for Furstin. All of this fits source 1's table.
- **Source 3**, a community answer, gives the top title (Prinzessin) the same rank, prestige and gold as source 1 (General, 256,000, 500,000) but other medals: 20 Cross, 30 Justice and 15 Nation. Marchlands follows source 1, the fuller and more consistent of the two.
- **Source 4**, a Japanese fan wiki, lists the medals (Cross, Rose, Lion, Honour, Courage, Wisdom, Freedom, Justice, Nation), dropped by attacking valleys and NPC cities, and what titles each is for; it refused automated reading, so only search summaries of it were seen. They agree that Knight takes Cross medals.
- Nothing found gives the requirements in millions of prestige, as Marchlands's first table did (3,000 for Knight up to 8,000,000 for Prince, with 1 to 5 medals and no gold), which matched no source; it was set on 2026-10-05 and replaced on 2026-11-02.
- Later Evony games (*The King's Return*) have a different ladder of prestige ranks (Knight at 5,000 up to Regent at 3 million); that is another system, not these titles.

## Sources

1. *Ranks & Titles – Beginners Guide*, Evony Age II blog, 18 May 2015: <https://evony-age2.blogspot.com/search/label/Title>
2. *In-depth Evony guide*, 2009 (Age 1): <https://indepth-evonyguide.blogspot.com/2009>
3. *How to get prestige up on Evony*, community Q&A: <https://qahtbprolanswershtbprolcom-s.evpn.library.nenu.edu.cn/games-qa/How_to_get_prestige_up_on_evony>
4. Evony wiki (Japanese, atwiki), medals and titles: <https://w.atwiki.jp/evony/pages/18.html>
5. *Evony prestige rank guide* (The King's Return, a different system): <https://onechilledgamer.com/evony-prestige-rank-guide>
