# WebSocket pushes

Connect to `ws://<host>/ws?token=<JWT>` after the lord exists, i.e. after `POST /api/v1/player`.

Every frame is `{ "cmd": string, "data": object }`, following the original `server.*` messages. Send `{"cmd":"ping"}` to get a `pong` back.

The authoritative types are `PushMessage` (a union discriminated on `cmd`), `PushSchemas` (cmd → zod schema of `data`) and `PushMessageSchema` (runtime validator) in `@evony/contracts` (`shared/contracts/src/push.ts`); the server's `ctx.push` / `ctx.broadcast` are typed against them. The table below is a summary.

| cmd | data | when |
|---|---|---|
| `server.Connected` | `{ playerId, serverTime }` | right after connecting |
| `server.ConnectionLost` | `{ reasonCode, msg }` | bad or expired token, or no lord (socket closes) |
| `pong` | `{ serverTime }` | reply to `{"cmd":"ping"}` |
| `server.BuildComplate` (sic) | `{ castleId, buildingBean }` | construction started, sped up, cancelled or finished (a `typeId: 0` bean means the slot is now empty) |
| `server.ResourceUpdate` | `{ castleId, resource }` | resources or rates changed (resource bean as in `GET /cities/:id`) |
| `server.CastleUpdate` | `{ updateType: 2, castleBean }` or `{ updateType: 1, castleBean: { id } }` | city changed broadly (teleport, conquest, items; full city bean as in `GET /cities/:id`); `updateType: 1` = city lost |
| `server.TroopUpdate` | `{ castleId, troop }` | troops trained, sent, returned, lost or deserted (`troop` lists every type, 0 when absent) |
| `server.InjuredTroopUpdate` | `{ castleId, troop }` | injured troops changed |
| `server.FortificationsUpdate` | `{ castleId, fortification }` | fortifications built, destroyed or lost |
| `server.TroopQueueUpdate` / `server.FortificationsQueueUpdate` | `{ castleId, positionId, allProduceQueue }` | production queue changed |
| `server.ResearchUpdate` | `{ castleId, typeId, endTime }` | research sped up |
| `server.ResearchCompleteUpdate` | `{ castleId, typeId, level }` | research finished |
| `server.FlowUpdate` | `{ flowId, status }` | (evony-re) a flow started, waited, was held, finished or stopped; refetch `GET /player/flows` |
| `server.HeroUpdate` | `{ castleId, hero, updateType }` | 0 = hero added, 1 = removed, 2 = changed |
| `server.PlayerInfoUpdate` | `{ playerInfo }` | prestige, title, alliance or profile changed |
| `server.CentsUpdate` | `{ cents }` | premium currency changed |
| `server.ItemUpdate` | `{ items: [{ id, count }] }` | one item's count changed |
| `server.PlayerBuffUpdate` | `{ buffBean: { typeId, descName, endTime }, updateType }` | 0 = buff added or extended, 1 = expired or removed |
| `server.PlayerBuffsUpdate` | `{ buffs: [{ id, desc, endTime, param?, cityId? }] }` | full list of active buffs (helper exists, currently not sent) |
| `server.SelfArmysUpdate` / `server.FriendArmysUpdate` / `server.EnemyArmysUpdate` | `{ armys: [...] }` | any army involving the lord changed (enemy troop details need a Beacon Tower) |
| `server.NewMail` | `{ count, count_inbox, count_system }` | unread mail counts |
| `server.NewReport` | `{ count, army_count, trade_count, other_count }` | unread report counts |
| `server.TradesUpdate` | `{ resType, amount, price }` | one of the lord's market orders was filled |
| `server.TransingTradeUpdate` | `{ id, delivered, resType, amount, castleId }` | a market shipment arrived |
| `server.ChannelChatMsg` | `{ msg, languageType, fromUser, fromId, channel, ownitemid, time }` | world or beginner chat (`channel`: `world` / `beginner`) |
| `server.AllianceChatMsg` | same, `channel: "alliance"` | alliance chat |
| `server.PrivateChatMessage` | `{ msg, chatType, ownitemid, fromUser, fromId, time }` | whisper (`chatType` and `ownitemid` are always 0) |
| `server.SystemInfoMsg` | `{ msg, alliance, tV, noSenderSystemInfo, sender? }` | system and alliance announcements, war declarations, amulet jackpots |
| `server.AllianceInvite` | `{ allianceName, invitePerson }` | you were invited to an alliance |
