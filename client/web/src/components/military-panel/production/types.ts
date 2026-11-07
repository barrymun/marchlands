/** A batch in a queue, with the barracks (or the walls) it is in. */
export interface QueueBatch {
  positionId: number;
  queueId: number;
  type: number;
  num: number;
  startTime: number;
  endTime: number;
}
