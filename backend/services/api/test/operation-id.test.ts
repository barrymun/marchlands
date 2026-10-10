import { describe, expect, it } from 'vitest';
import { operationIdOf } from '../src/operation-id.ts';

describe(operationIdOf.name, () => {
  it('joins the method and the path segments, without the /api/v1 prefix', () => {
    expect(operationIdOf('GET', '/api/v1/player')).toBe('getPlayer');
    expect(operationIdOf('POST', '/api/v1/player/title/promote')).toBe('postPlayerTitlePromote');
  });
  it('turns kebab-case segments into PascalCase', () => {
    expect(operationIdOf('GET', '/api/v1/player/army-presets')).toBe('getPlayerArmyPresets');
    expect(operationIdOf('POST', '/api/v1/cities/{cityId}/troops/train-many')).toBe('postCitiesTroopsTrainMany');
  });
  it('names a trailing parameter By<Param> and drops inner ones', () => {
    expect(operationIdOf('GET', '/api/v1/map/tiles/{tileId}')).toBe('getMapTilesByTileId');
    expect(operationIdOf('GET', '/api/v1/cities/{cityId}')).toBe('getCitiesByCityId');
    expect(operationIdOf('POST', '/api/v1/player/items/{itemId}/use')).toBe('postPlayerItemsUse');
  });
  it('accepts Fastify-style :param segments', () => {
    expect(operationIdOf('DELETE', '/api/v1/market/orders/:orderId')).toBe('deleteMarketOrdersByOrderId');
  });
});
