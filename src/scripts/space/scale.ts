import type { BodySystem } from './bodies';
import type { StarSystem } from './stars';

export type ScaleMode = 'solar' | 'stellar';

/** 1 ly ≈ 63241 AU（仅作说明；星域场景单位直接用 ly） */
export const LY_IN_AU = 63241.077;

/**
 * 切换太阳系 / 星域可见性。
 * solar：行星根可见，恒星根隐藏
 * stellar：反之（太阳系缩成星域里的 Sol 标记）
 */
export function applyScaleVisibility(
  mode: ScaleMode,
  bodies: BodySystem,
  stars: StarSystem,
): void {
  const stellar = mode == 'stellar';
  bodies.setRootVisible(!stellar);
  stars.setVisible(stellar);
}
