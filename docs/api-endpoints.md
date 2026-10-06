# API endpoints

Generated from the OpenAPI document by `npm run gen:api` (`tools/docs/gen-api-md.mjs`). Interactive docs: `/docs`.

All paths are relative to the server root. Names in parentheses are the original client commands (`module.command`) each endpoint replaces.

## auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Log in (orig `login`) *(public)* |
| GET | `/api/v1/auth/me` | Current account and its lord |
| POST | `/api/v1/auth/refresh` | Issue a fresh token |
| POST | `/api/v1/auth/register` | Create an account *(public)* |

## player

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/player` | Create the lord and first city (common.createNewPlayer) |
| GET | `/api/v1/player` | Full lord state: cities, items, buffs, armies, counters (login bean) |
| GET | `/api/v1/player/bookmarks` | Map bookmarks (castleSignBean) |
| POST | `/api/v1/player/bookmarks` | Bookmark a castle (castle.saveCastleSignList) |
| DELETE | `/api/v1/player/bookmarks/{tileId}` | Remove a bookmark |
| PATCH | `/api/v1/player/face` | Set portrait and sex once (common.changeUserFace) |
| POST | `/api/v1/player/flag` | Change flag with a National Flag (city.modifyFlag) |
| POST | `/api/v1/player/furlough` | Holiday mode, 10 cents/day (furlough.isFurlought) |
| DELETE | `/api/v1/player/furlough` | End holiday mode (furlough.cancelFurlought) |
| POST | `/api/v1/player/items/{itemId}/use` | Use an item (shop.useGoods / shop.useCastleGoods) |
| POST | `/api/v1/player/rename` | Rename the lord with a New ID (city.modifyUserName) |
| POST | `/api/v1/player/restart` | Delete everything and start over (common.deleteUserAndRestart) |
| POST | `/api/v1/player/title/promote` | Promote to the next nobility title |
| POST | `/api/v1/player/truce` | Truce Agreement (city.setStopWarState) |
| POST | `/api/v1/player/tutorial` | Store tutorial progress (common.step) |
| GET | `/api/v1/players/{name}` | Public profile of a lord |

## city

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/cities/{cityId}` | City detail (castleBean) |
| PATCH | `/api/v1/cities/{cityId}` | Rename / logo / defence settings (city.modifyCastleName, army.setArmyGoOut) |
| POST | `/api/v1/cities/{cityId}/comfort` | Comfort: 1 relief, 2 prayer, 3 blessing, 4 population raising (interior.pacifyPeople) |
| POST | `/api/v1/cities/{cityId}/levy` | Levy: 1 gold, 2 food, 3 wood, 4 stone, 5 iron (interior.taxation) |
| POST | `/api/v1/cities/{cityId}/move` | Teleport: zoneId = City Teleporter, targetTileId = Adv City Teleporter |
| GET | `/api/v1/cities/{cityId}/production` | Production breakdown (interior.getResourceProduceData) |
| PUT | `/api/v1/cities/{cityId}/store-percent` | Warehouse protection split, % (city.modifyStorePercent) |
| PUT | `/api/v1/cities/{cityId}/tax` | Tax rate (interior.modifyTaxRate) |
| PUT | `/api/v1/cities/{cityId}/work-rates` | Labour per resource, % (interior.modifyCommenceRate) |

## buildings

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/cities/{cityId}/buildings` | Construct (castle.newBuilding) |
| GET | `/api/v1/cities/{cityId}/buildings/{positionId}` | Next-level cost (castle.checkOutUpgrade) |
| POST | `/api/v1/cities/{cityId}/buildings/{positionId}/cancel` | Cancel construction (castle.cancleBuildCommand) |
| POST | `/api/v1/cities/{cityId}/buildings/{positionId}/demolish` | Demolish one level (castle.destructBuilding) |
| GET | `/api/v1/cities/{cityId}/buildings/{positionId}/speedup` | Coins to finish now (castle.getCoinsNeed) |
| POST | `/api/v1/cities/{cityId}/buildings/{positionId}/speedup` | Speed up (castle.speedUpBuildCommand) |
| POST | `/api/v1/cities/{cityId}/buildings/{positionId}/upgrade` | Upgrade (castle.upgradeBuilding) |
| GET | `/api/v1/cities/{cityId}/buildings/available` | Buildable types (castle.getAvailableBuildingList*) |

## research

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/cities/{cityId}/research` | Technologies (tech.getResearchList) |
| POST | `/api/v1/cities/{cityId}/research` | Start research (tech.research) |
| DELETE | `/api/v1/cities/{cityId}/research` | Cancel research (tech.cancelResearch) |
| GET | `/api/v1/cities/{cityId}/research/speedup` | Coins to finish now (tech.getCoinsNeed) |
| POST | `/api/v1/cities/{cityId}/research/speedup` | Speed up (tech.speedUpResearch) |

## troops

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/cities/{cityId}/fortifications/destroy` | Destroy fortifications (fortifications.destructWallProtect) |
| GET | `/api/v1/cities/{cityId}/fortifications/queues` | Production queues (forti.getProduceQueue) |
| DELETE | `/api/v1/cities/{cityId}/fortifications/queues/{positionId}/{queueId}` | Cancel a batch |
| POST | `/api/v1/cities/{cityId}/fortifications/queues/{positionId}/{queueId}/speedup` | Archimedes' Note: -30% (fortifications.accTroopProduce) |
| POST | `/api/v1/cities/{cityId}/fortifications/train` | Build fortifications (fortifications.produceWallProtect) |
| GET | `/api/v1/cities/{cityId}/fortifications/trainable` | Trainable fortifications (fortifications.getFortificationsProduceList) |
| POST | `/api/v1/cities/{cityId}/troops/disband` | Dismiss troops (troop.disbandTroop) |
| POST | `/api/v1/cities/{cityId}/troops/injured/cure` | Heal injured troops (army.cureInjuredTroop) |
| POST | `/api/v1/cities/{cityId}/troops/injured/disband` | Dismiss injured troops (army.disbandInjuredTroop) |
| GET | `/api/v1/cities/{cityId}/troops/queues` | Production queues (troop.getProduceQueue) |
| DELETE | `/api/v1/cities/{cityId}/troops/queues/{positionId}/{queueId}` | Cancel a batch |
| POST | `/api/v1/cities/{cityId}/troops/queues/{positionId}/{queueId}/speedup` | Napoleon's Diary: -30% (troop.accTroopProduce) |
| POST | `/api/v1/cities/{cityId}/troops/train` | Train troops at a barracks (troop.produceTroop) |
| POST | `/api/v1/cities/{cityId}/troops/train-split` | Train one order split over all barracks so the batches finish together |
| GET | `/api/v1/cities/{cityId}/troops/trainable` | Trainable troops (troop.getTroopProduceList) |

## heroes

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/cities/{cityId}/heroes` | Heroes living in the city |
| DELETE | `/api/v1/cities/{cityId}/mayor` | Dismiss the mayor (hero.dischargeChief) |
| GET | `/api/v1/cities/{cityId}/tavern` | Inn offers (hero.getHerosListFromTavern) |
| POST | `/api/v1/cities/{cityId}/tavern/{heroId}/hire` | Hire (hero.hireHero) |
| POST | `/api/v1/cities/{cityId}/tavern/refresh` | New offers for gold or a Hero Hunting item (hero.refreshHerosListFromTavern) |
| PATCH | `/api/v1/heroes/{heroId}` | Rename (hero.changeName) |
| POST | `/api/v1/heroes/{heroId}/fire` | Fire (hero.fireHero) |
| POST | `/api/v1/heroes/{heroId}/items` | Use a hero item (hero.useItem) |
| POST | `/api/v1/heroes/{heroId}/level-up` | Level up (hero.levelUp) |
| POST | `/api/v1/heroes/{heroId}/mayor` | Appoint mayor (hero.promoteToChief) |
| POST | `/api/v1/heroes/{heroId}/persuade` | Recruit a captive whose loyalty is 0 |
| POST | `/api/v1/heroes/{heroId}/points` | Assign points: new totals (hero.addPoint) |
| POST | `/api/v1/heroes/{heroId}/release` | Free a captured enemy hero (hero.releaseHero) |
| POST | `/api/v1/heroes/{heroId}/reset` | Reset attribute points with Holy Water (hero.resetPoint) |
| POST | `/api/v1/heroes/{heroId}/reward` | +5 loyalty for gold (hero.awardGold) |

## armies

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/armies` | Own, friendly and hostile armies (Self/Friend/EnemyArmysUpdate) |
| POST | `/api/v1/armies/{armyId}/dismiss` | Send allied troops stationed with you home |
| POST | `/api/v1/armies/{armyId}/recall` | Recall (army.callBackArmy) |
| POST | `/api/v1/cities/{cityId}/armies` | Send an army: mission 1 transport, 2 reinforce, 3 scout, 4 build city, 5 attack (army.newArmy) |
| POST | `/api/v1/cities/{cityId}/armies/estimate` | March time and carry capacity preview |
| GET | `/api/v1/cities/{cityId}/armies/params` | March/load bonuses and army cap (army.getTroopParam) |
| GET | `/api/v1/cities/{cityId}/stationed` | Allied troops stationed here (army.getStayAllianceArmys) |

## map

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/map` | Up to 21x21 tiles with castles (common.mapInfoSimple) |
| GET | `/api/v1/map/search` | Find tiles of a type near a point |
| GET | `/api/v1/map/tiles/{tileId}` | Tile details (field.getOtherFieldInfo) |
| DELETE | `/api/v1/valleys/{tileId}` | Give up an occupied valley (field.giveUpField) |
| POST | `/api/v1/valleys/{tileId}/upgrade` | Raise an unowned valley one level for gold (instant) |
| GET | `/api/v1/world` | World info |
| GET | `/api/v1/world/zones` | States with population stats (common.zoneInfo) |

## mail

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/mail` | Folder 1 inbox, 2 system, 3 sent (mail.receiveMailList) |
| POST | `/api/v1/mail` | Send (mail.sendMail) |
| GET | `/api/v1/mail/{mailId}` | Read (mail.readMail) |
| POST | `/api/v1/mail/delete` | Delete (mail.deleteMail) |
| POST | `/api/v1/mail/read` | Mark read (mail.readOverMailList) |
| GET | `/api/v1/mail/unread` | Unread counters (server.NewMail) |

## reports

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/reports` | Type 0 trade, 1 army, 2 other (report.receiveReportList) |
| GET | `/api/v1/reports/{reportId}` | Open a report (report.markAsRead) |
| POST | `/api/v1/reports/delete` | Delete (report.deleteReport) |
| POST | `/api/v1/reports/read` | Mark read (report.readOverReport); omit ids for all |
| GET | `/api/v1/reports/unread` | Unread counters (server.NewReport) |

## chat

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/chat/{channel}` | Recent messages |
| POST | `/api/v1/chat/alliance` | Alliance channel (common.allianceChat) |
| POST | `/api/v1/chat/beginner` | Beginner channel (common.channelChat) |
| POST | `/api/v1/chat/private` | Whisper (common.privateChat) |
| POST | `/api/v1/chat/world` | World channel, costs 1 Speaker (common.worldChat) |

## friends

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/blocks` | Add (friend.addBlock) |
| DELETE | `/api/v1/blocks/{playerId}` | Remove (friend.deleteBlock) |
| GET | `/api/v1/friends` | Friends and blocked lords |
| POST | `/api/v1/friends` | Add (friend.addFriend) |
| DELETE | `/api/v1/friends/{playerId}` | Remove (friend.deleteFriend) |

## alliance

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/alliance` | My alliance with relations (alliance.isHasAlliance); null when not in one |
| POST | `/api/v1/alliance` | Found an alliance for 10,000 gold (alliance.createAlliance) |
| PATCH | `/api/v1/alliance` | Note / intro / motd (alliance.setAllInfoForAlliance) |
| GET | `/api/v1/alliance/applications` | Applications to review (alliance.agreeComeinAllianceList) |
| POST | `/api/v1/alliance/applications/accept` | Accept (alliance.agreeComeinAllianceByLeader) |
| POST | `/api/v1/alliance/applications/decline` | Decline (alliance.cancelagreeComeinAlliance) |
| POST | `/api/v1/alliance/apply` | Apply (alliance.userWantInAlliance) |
| DELETE | `/api/v1/alliance/apply` | Withdraw application (alliance.cancelUserWantInAlliance) |
| GET | `/api/v1/alliance/apply` | My pending application (alliance.getAllianceWanted) |
| GET | `/api/v1/alliance/events` | Event log (alliance.getAllianceEventList) |
| POST | `/api/v1/alliance/invites` | Invite (alliance.addUsertoAlliance) |
| GET | `/api/v1/alliance/invites` | Invitations sent (alliance.addUsertoAllianceList) |
| POST | `/api/v1/alliance/invites/cancel` | Withdraw (alliance.canceladdUsertoAlliance) |
| POST | `/api/v1/alliance/items` | Use Ritual of Pact |
| POST | `/api/v1/alliance/leave` | Leave (alliance.sayByetoAlliance / resignForAlliance) |
| POST | `/api/v1/alliance/mail` | Circular to all members (alliance.messagesForAllianceMember) |
| GET | `/api/v1/alliance/members` | Members (alliance.getAllianceMembers) |
| POST | `/api/v1/alliance/members/host` | Hand over the Host title (alliance.resetTopPowerForAlliance) |
| POST | `/api/v1/alliance/members/kick` | Expel (alliance.kickOutMemberfromAlliance) |
| POST | `/api/v1/alliance/members/rank` | Set rank 5-8 (alliance.setPowerForUserByAlliance) |
| GET | `/api/v1/alliance/military` | Members’ armies (alliance.getMilitarySituationList) |
| GET | `/api/v1/alliance/my-invites` | Invitations received (alliance.leaderWantUserInAllianceList) |
| POST | `/api/v1/alliance/my-invites/accept` | Accept (alliance.agreeComeinAllianceByUser) |
| POST | `/api/v1/alliance/my-invites/reject` | Reject (alliance.rejectComeinAlliance) |
| PUT | `/api/v1/alliance/relations` | Diplomacy: 1 ally, 2 neutral, 3 enemy (alliance.setAllianceFriendship) |
| DELETE | `/api/v1/alliance/relations/{name}` | Drop a relation (alliance.dropAllianceFriendshipRelation) |
| GET | `/api/v1/alliances` | Browse / search alliances (alliance.getAllianceList) |
| GET | `/api/v1/alliances/{name}` | Public info (alliance.getAllianceInfo) |

## market

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/cities/{cityId}/market/orders` | Place an order: side 0 buy, 1 sell; limit or market; settles instantly (trade.newTrade) |
| GET | `/api/v1/market/{resType}` | Order book: 0 food, 1 wood, 2 stone, 3 iron (trade.searchTrades) |
| GET | `/api/v1/market/{resType}/history` | Recent trades and hourly (game time) price candles |
| GET | `/api/v1/market/{resType}/quote` | Preview an order: what would trade now, at what average price, and what would rest |
| DELETE | `/api/v1/market/orders/{orderId}` | Cancel (trade.cancelTrade) |
| GET | `/api/v1/market/orders/mine` | My open orders (trade.getMyTradeList) |
| GET | `/api/v1/market/shipments` | Goods in transit (trade.getTransingTradeList) |
| POST | `/api/v1/market/shipments/{shipmentId}/speedup` | Instant delivery for cents (trade.speedUpTrans) |

## shop

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/cities/{cityId}/shop/resources` | Spend cents on resources (shop.buyResource) |
| GET | `/api/v1/shop` | Items for sale (saleTypeBeans) |
| POST | `/api/v1/shop/buy` | Buy items with cents (shop.buy) |
| GET | `/api/v1/shop/resources` | Resources per cent (shop.getBuyResourceInfo) |

## quests

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/quests` | Quests with progress (quest.getQuestList) |
| POST | `/api/v1/quests/{questId}/claim` | Claim the award into a city (quest.award) |
| POST | `/api/v1/quests/daily-gift` | Daily gift |
| GET | `/api/v1/quests/groups` | Quest groups (quest.getQuestType) |

## rankings

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/rankings/alliances` | sortType 1 members, 2 prestige, 3 honor (rank.getAllianceRank) |
| GET | `/api/v1/rankings/castles` | sortType 1 population, 2 level (rank.getCastleRank) |
| GET | `/api/v1/rankings/heroes` | sortType 1 level, 2 management, 3 power, 4 stratagem (rank.getHeroRank) |
| GET | `/api/v1/rankings/players` | sortType 1 title, 2 prestige, 3 honor, 4 cities, 5 population (rank.getPlayerRank) |

## config

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/config/static` | Buildings, research, troops, items, titles and balance constants *(public)* |

## admin

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/admin/accounts/{accountId}/ban` | Ban / unban an account |
| POST | `/api/v1/admin/broadcast` | System message to everyone (\massmsg) |
| POST | `/api/v1/admin/cents` | Grant cents |
| PUT | `/api/v1/admin/cities/{cityId}/buildings` | Set a building level, 0 removes (gamemaster.addBuilding / removeBuilding) |
| POST | `/api/v1/admin/cities/{cityId}/heroes` | Add a random hero (gamemaster.addHero) |
| PUT | `/api/v1/admin/cities/{cityId}/resources` | Set resources (gamemaster.setResources) |
| PUT | `/api/v1/admin/cities/{cityId}/stats` | Population / loyalty / troops |
| POST | `/api/v1/admin/items` | Grant items (gamemaster.addItems) |
| POST | `/api/v1/admin/mail` | System mail to a lord |
| POST | `/api/v1/admin/mute` | Mute a lord in chat (common.denyPlayerSpeak) |
| GET | `/api/v1/admin/online` | Connected lords |
| PUT | `/api/v1/admin/players/flags` | Beginner protection / title |
| PUT | `/api/v1/admin/research` | Set a technology level (gamemaster.setTechnology) |

