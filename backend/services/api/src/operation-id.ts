// OpenAPI operationIds, derived from the method and path so every endpoint gets a stable, predictable
// name without one being written on each route. The client generator (@hey-api/openapi-ts) names its
// SDK functions and TanStack Query options after them:
//   GET /api/v1/cities/{cityId}/buildings   -> getCitiesBuildings
//   GET /api/v1/map/tiles/{tileId}          -> getMapTilesByTileId   (a trailing parameter becomes By<Param>)
//   POST /api/v1/player/items/{itemId}/use  -> postPlayerItemsUse    (inner parameters are dropped)

const pascal = (s: string) =>
  s
    .split(/[-_.]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');

export function operationIdOf(method: string, url: string): string {
  const segments = url.split('/').filter((s) => s && s !== 'api' && s !== 'v1');
  const parts = segments.map((s, i) => {
    const param = /^[{:](\w+)}?$/.exec(s);
    if (!param) return pascal(s);
    return i === segments.length - 1 ? `By${pascal(param[1])}` : '';
  });
  return method.toLowerCase() + parts.join('');
}
