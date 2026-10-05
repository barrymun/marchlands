# WebSocket pushes

Connect to `ws://<host>/ws?token=<JWT>` after the lord exists, i.e. after `POST /api/v1/player`.

Every frame is `{ "cmd": string, "data": object }`, following the original `server.*` messages. Send `{"cmd":"ping"}` to get a `pong` back.

| cmd | data | when |
|---|---|---|
| `server.Connected` | `{ playerId, serverTime }` | right after connecting |
| `server.ConnectionLost` | `{ reasonCode, msg }` | bad or expired token, or no lord (socket closes) |
| `server.BuildComplate` (sic) | `{ castleId, buildingBean }` | construction started, sped up, cancelled or finished (a `typeId: 0` bean means the slot is now empty) |
| `server.ResourceUpdate` | `{ castleId, resource }` | resources or rates changed (resource bean as in `GET /cities/:id`) |
| `server.CastleUpdate` | `{ updateType, castleBean }` | city changed broadly (teleport, conquest, items); `updateType: 1` = city lost |
| `server.TroopUpdate` | `{ castleId, troop }` | troops trained, sent, returned, lost or deserted |
| `server.InjuredTroopUpdate` | `{ castleId, troop }` | injured troops changed |
| `server.FortificationsUpdate` | `{ castleId, fortification }` | fortifications built, destroyed or lost |
| `server.TroopQueueUpdate` / `server.FortificationsQueueUpdate` | `{ castleId, positionId, allProduceQueue }` | production queue changed |
| `server.ResearchUpdate` | `{ castleId, typeId, endTime }` | research sped up |
| `server.ResearchCompleteUpdate` | `{ castleId, typeId, level }` | research finished |
| `server.HeroUpdate` | `{ castleId, hero, updateType }` | 0 = hero added, 1 = removed, 2 = changed |
| `server.PlayerInfoUpdate` | `{ playerInfo }` | prestige, title, alliance or profile changed |
| `server.CentsUpdate` | `{ cents }` | premium currency changed |
| `server.ItemUpdate` | `{ items: [{ id, count }] }` | one item's count changed |
| `server.PlayerBuffUpdate` | `{ buffBean: { typeId, descName, endTime }, updateType }` | 0 = buff added or extended, 1 = expired or removed |
| `server.SelfArmysUpdate` / `server.FriendArmysUpdate` / `server.EnemyArmysUpdate` | `{ armys: [...] }` | any army involving the lord changed (enemy troop details need a Beacon Tower) |
| `server.NewMail` | `{ count, count_inbox, count_system }` | unread mail counts |
| `server.NewReport` | `{ count, army_count, trade_count, other_count }` | unread report counts |
| `server.TradesUpdate` | `{ resType, amount, price }` | one of the lord's market orders was filled |
| `server.TransingTradeUpdate` | `{ id, delivered, resType, amount, castleId }` | a market shipment arrived |
| `server.ChannelChatMsg` | `{ msg, fromUser, fromId, channel, ownitemid, time }` | world or beginner chat |
| `server.AllianceChatMsg` | same | alliance chat |
| `server.PrivateChatMessage` | `{ msg, fromUser, fromId, time }` | whisper |
| `server.SystemInfoMsg` | `{ msg, alliance, tV, noSenderSystemInfo, sender? }` | system and alliance announcements, war declarations, amulet jackpots |
| `server.AllianceInvite` | `{ allianceName, invitePerson }` | you were invited to an alliance |
