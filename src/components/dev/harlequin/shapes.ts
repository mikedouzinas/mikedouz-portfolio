import type { ComponentType } from 'react';
import { CircleFace } from './faces/CircleFace';
import { DiamondFace } from './faces/DiamondFace';
import { WindowFace } from './faces/WindowFace';
import type { FaceProps } from './faces/faceTypes';

export type HarlequinShapeId = 'circle' | 'diamond' | 'window';

export interface HarlequinShape {
  id: HarlequinShapeId;
  Face: ComponentType<FaceProps>;
  /** Window plays hover music; circle/diamond do not. */
  hasMusic: boolean;
}

/**
 * Ordered registry of the three HARLEQUIN portal faces. Drives Stage 1 (render
 * all three as project cards) and Stage 2 (pick ONE at random — see
 * HarlequinPortalCards / the page wiring for the documented seam).
 */
export const HARLEQUIN_SHAPES: readonly HarlequinShape[] = [
  { id: 'circle', Face: CircleFace, hasMusic: false },
  { id: 'diamond', Face: DiamondFace, hasMusic: false },
  { id: 'window', Face: WindowFace, hasMusic: true },
] as const;

export function getShape(id: HarlequinShapeId): HarlequinShape {
  const shape = HARLEQUIN_SHAPES.find((s) => s.id === id);
  if (!shape) throw new Error(`Unknown HARLEQUIN shape: ${id}`);
  return shape;
}
