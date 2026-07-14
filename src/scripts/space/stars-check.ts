/**
 * 邻近恒星星表自检（可被 self-check / boot 共用）
 */
import { DEST_STARS, STAR_BY_ID, starLogicalXYZ, starDistLy } from './starCatalog';

export function selfCheckStars(): boolean {
  const prox = STAR_BY_ID.proxima;
  const sirius = STAR_BY_ID.sirius;
  if (!prox || !sirius) return false;

  // 比邻星 ≈ 4.24–4.3 ly
  if (prox.distLy < 4.2 || prox.distLy > 4.4) return false;
  // 天狼 ≈ 8.6 ly 量级
  if (sirius.distLy < 8.0 || sirius.distLy > 9.2) return false;

  const p = starLogicalXYZ(prox);
  const d = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  if (Math.abs(d - prox.distLy) > 0.02) return false;

  if (DEST_STARS.length < 15) return false;
  if (starDistLy('vega') < 20 || starDistLy('vega') > 30) return false;
  if (starDistLy('sol') != 0) return false;
  return true;
}
