import { itemConfig, medalId } from '@marchlands/core';

export const medalName = (level: number) => (itemConfig(medalId(level))?.name ?? `Medal ${level}`).replace(/ Medal$/, '');
