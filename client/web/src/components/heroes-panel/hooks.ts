import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type DragEvent, useState } from 'react';
import { toast } from 'sonner';

import { type CityBean, getCitiesByCityIdQueryKey, putCitiesHeroesOrder } from '@marchlands/api-client';

import { errorMessage } from '@/lib/api';
import { moved } from '@/lib/arrays';

/**
 * The player's order of the city's heroes (shown at once, saved on the server), for the List's cards and the Sheet's
 * roster: `move` a hero, or drag a row to a new place. A row drags only from its handle (`handle`), since the rest of
 * it has buttons and fields.
 */
export function useHeroOrder(city: CityBean) {
  const cityPath = { path: { cityId: city.id } };
  const qc = useQueryClient();
  const reorder = useMutation({
    mutationFn: async (heroIds: number[]) => (await putCitiesHeroesOrder({ ...cityPath, body: { heroIds }, throwOnError: true })).data,
    onMutate: (heroIds) =>
      qc.setQueryData<CityBean>(getCitiesByCityIdQueryKey(cityPath), (c) =>
        c ? { ...c, heros: [...c.heros].sort((a, b) => heroIds.indexOf(a.id) - heroIds.indexOf(b.id)) } : c,
      ),
    onError: (err) => {
      toast.error(errorMessage(err));
      void qc.invalidateQueries({ queryKey: getCitiesByCityIdQueryKey(cityPath) });
    },
  });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= city.heros.length || from === to) return;
    reorder.mutate(moved(city.heros, from, to).map((h) => h.id));
  };
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const end = () => (setArmed(null), setDragging(null), setOver(null));
  return {
    move,
    /** What the row of hero `id`, at `i`, needs to be dragged and dropped on. */
    row: (id: number, i: number) => ({
      draggable: armed === id,
      onDragStart: (e: DragEvent) => {
        setDragging(i);
        e.dataTransfer.effectAllowed = 'move';
      },
      onDragOver: (e: DragEvent) => {
        if (dragging == null) return;
        e.preventDefault();
        setOver(i);
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (dragging != null) move(dragging, i);
        end();
      },
      onDragEnd: end,
    }),
    /** What the drag handle of hero `id` needs. */
    handle: (id: number) => ({ onPointerDown: () => setArmed(id), onPointerUp: () => setArmed(null) }),
    /** The row at `i` is being dragged. */
    dragged: (i: number) => dragging === i,
    /** A row is being dragged over the row at `i`. */
    target: (i: number) => over === i && dragging != null && dragging !== i,
  };
}
