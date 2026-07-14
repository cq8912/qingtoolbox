import { SPEED_PRESETS, TIME_PRESETS, type BodyId } from './constants';
import { formatSpeed, type CameraController, type CamMode } from './camera';
import type { ScaleMode } from './scale';
import type { StarId } from './stars';
import { STAR_BY_ID } from './stars';

export interface HudState {
  simDate: Date;
  timeMult: number;
  mode: CamMode;
  focus: BodyId;
  starFocus: StarId;
  scaleMode: ScaleMode;
  speedMult: number;
  orbits: boolean;
  info: string;
  speedText: string;
  touring: boolean;
}

/** 绑定 index.astro 里已有的静态 HUD（不再 innerHTML 覆盖） */
export class Hud {
  private root: HTMLElement;
  private onGoto: (id: BodyId) => void;
  private onGotoStar: (id: StarId) => void;
  private onReturnSol: () => void;
  private onChange: (patch: Partial<HudState>) => void;
  private onTour: () => void;
  private onFaceSun: () => void;
  private lastScale: ScaleMode = 'solar';

  constructor(
    root: HTMLElement,
    private getState: () => HudState,
    handlers: {
      onGoto: (id: BodyId) => void;
      onGotoStar: (id: StarId) => void;
      onReturnSol: () => void;
      onChange: (patch: Partial<HudState>) => void;
      onTour: () => void;
      onFaceSun: () => void;
    },
  ) {
    this.root = root;
    this.onGoto = handlers.onGoto;
    this.onGotoStar = handlers.onGotoStar;
    this.onReturnSol = handlers.onReturnSol;
    this.onChange = handlers.onChange;
    this.onTour = handlers.onTour;
    this.onFaceSun = handlers.onFaceSun;
    this.bind();
    this.render();
  }

  private bind() {
    this.root.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.onChange({ mode: (btn as HTMLElement).dataset.mode as CamMode });
      });
    });

    this.q('#sp-time')?.addEventListener('change', (e) => {
      this.onChange({ timeMult: Number((e.target as HTMLSelectElement).value) });
    });
    this.q('#sp-speed')?.addEventListener('change', (e) => {
      this.onChange({ speedMult: Number((e.target as HTMLSelectElement).value) });
    });
    this.q('#sp-orbits')?.addEventListener('change', (e) => {
      this.onChange({ orbits: (e.target as HTMLInputElement).checked });
    });
    this.q('#sp-date')?.addEventListener('change', (e) => {
      const v = (e.target as HTMLInputElement).value;
      if (v) this.onChange({ simDate: new Date(v) });
    });

    this.root.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.onGoto((btn as HTMLElement).dataset.goto as BodyId);
      });
    });

    this.root.querySelectorAll('[data-goto-star]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.onGotoStar((btn as HTMLElement).dataset.gotoStar as StarId);
      });
    });

    this.q('#sp-tour')?.addEventListener('click', () => this.onTour());
    this.q('#sp-face-sun')?.addEventListener('click', () => this.onFaceSun());
    this.q('#sp-return-sol')?.addEventListener('click', () => this.onReturnSol());

    // 侧栏：默认展开，点标签折叠/展开
    this.q('#sp-tab-left')?.addEventListener('click', () => {
      this.q('#sp-drawer-left')?.classList.toggle('is-collapsed');
    });
    this.q('#sp-tab-bottom')?.addEventListener('click', () => {
      this.q('#sp-drawer-bottom')?.classList.toggle('is-collapsed');
    });

    // 左侧：天体 / 星域切换
    this.root.querySelectorAll('[data-rail-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.railMode;
        if (mode != 'bodies' && mode != 'stars') return;
        this.root.dataset.rail = mode;
        this.root.querySelectorAll('[data-rail-mode]').forEach((b) => {
          b.classList.toggle('is-on', (b as HTMLElement).dataset.railMode == mode);
        });
        const tabLeft = this.q('#sp-tab-left');
        if (tabLeft) tabLeft.textContent = mode == 'stars' ? '星域' : '天体';
        // 在星域尺度点回「天体」→ 返回太阳系
        if (mode == 'bodies' && this.getState().scaleMode == 'stellar') {
          this.onReturnSol();
        }
      });
    });
  }

  private q<T extends HTMLElement>(sel: string) {
    return this.root.querySelector(sel) as T | null;
  }

  render() {
    const s = this.getState();
    const meta = this.q('#sp-meta');
    const info = this.q('#sp-info');
    const speedEl = this.q('#sp-speed-read');
    const scaleTag = s.scaleMode == 'stellar' ? '星域' : '太阳系';
    if (meta) meta.textContent = `${fmtDate(s.simDate)}  ·  ${scaleTag}  ·  ${modeLabel(s.mode)}`;
    if (info) info.textContent = s.info;
    if (speedEl) speedEl.textContent = s.speedText ? `航速 ${s.speedText}` : '';

    const tourBtn = this.q<HTMLButtonElement>('#sp-tour');
    if (tourBtn) {
      tourBtn.textContent = s.touring ? '停止游览' : '自动游览';
      tourBtn.classList.toggle('is-on', s.touring);
      tourBtn.style.display = s.scaleMode == 'stellar' ? 'none' : '';
    }

    const returnBtn = this.q<HTMLButtonElement>('#sp-return-sol');
    if (returnBtn) returnBtn.style.display = s.scaleMode == 'stellar' ? '' : 'none';

    const faceSun = this.q<HTMLButtonElement>('#sp-face-sun');
    if (faceSun) faceSun.style.display = s.scaleMode == 'stellar' ? 'none' : '';

    // 跨尺度时同步左侧轨
    if (s.scaleMode == 'stellar') {
      this.root.dataset.rail = 'stars';
    } else if (this.lastScale == 'stellar') {
      this.root.dataset.rail = 'bodies';
    }
    this.lastScale = s.scaleMode;
    this.root.querySelectorAll('[data-rail-mode]').forEach((b) => {
      b.classList.toggle('is-on', (b as HTMLElement).dataset.railMode == (this.root.dataset.rail || 'bodies'));
    });

    const tabLeft = this.q('#sp-tab-left');
    if (tabLeft) tabLeft.textContent = this.root.dataset.rail == 'stars' ? '星域' : '天体';

    this.root.dataset.scale = s.scaleMode;

    this.root.querySelectorAll('[data-mode]').forEach((btn) => {
      const m = (btn as HTMLElement).dataset.mode;
      const active = s.mode == 'tour' || s.mode == 'travel' || s.mode == 'facesun' ? 'observe' : s.mode;
      btn.classList.toggle('is-on', m == active);
    });
    // 选中态：整格高亮（含卫星）
    this.root.querySelectorAll('.sp-pick, .sp-moon-chip').forEach((btn) => {
      btn.classList.toggle('is-on', (btn as HTMLElement).dataset.id == s.focus);
    });
    this.root.querySelectorAll('.sp-star-pick').forEach((btn) => {
      btn.classList.toggle('is-on', (btn as HTMLElement).dataset.star == s.starFocus);
    });
    this.root.querySelectorAll('.sp-cell').forEach((cell) => {
      const parent = (cell as HTMLElement).dataset.parent;
      const hasOn = !!cell.querySelector('.sp-pick.is-on, .sp-moon-chip.is-on');
      cell.classList.toggle('is-hot', hasOn || parent == s.focus);
    });

    const timeSel = this.q<HTMLSelectElement>('#sp-time');
    const speedSel = this.q<HTMLSelectElement>('#sp-speed');
    if (timeSel && document.activeElement != timeSel) timeSel.value = String(s.timeMult);
    if (speedSel && document.activeElement != speedSel) speedSel.value = String(s.speedMult);
    const orbits = this.q<HTMLInputElement>('#sp-orbits');
    if (orbits) orbits.checked = s.orbits;
    const dateInput = this.q<HTMLInputElement>('#sp-date');
    if (dateInput && document.activeElement != dateInput) dateInput.value = toLocalInput(s.simDate);
  }
}

function modeLabel(m: CamMode) {
  if (m == 'fly') return '巡航';
  if (m == 'travel') return '跃迁';
  if (m == 'tour') return '游览';
  if (m == 'facesun') return '对齐太阳';
  return '观察';
}

function fmtDate(d: Date) {
  return d.toLocaleString('zh-CN', { hour12: false });
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function describeFocus(_cam: CameraController, distAu: number, name: string): string {
  const km = distAu * 149597870.7;
  const lightMin = distAu / 0.002004 / 60;
  const distText =
    distAu < 0.01
      ? `${(km / 1000).toFixed(0)} 千km`
      : `${distAu.toFixed(3)} AU · ${lightMin < 60 ? lightMin.toFixed(1) + ' 光分' : (lightMin / 60).toFixed(2) + ' 光时'}`;
  return `${name}  ·  ${distText}`;
}

export function describeStarFocus(distLy: number, id: StarId): string {
  const def = STAR_BY_ID[id];
  const fromSol = def.distLy;
  if (id == 'sol') return `${def.nameZh}  ·  原点 · 参考环 5 / 10 / 25 ly`;
  return `${def.nameZh}  ·  近距 ${distLy.toFixed(2)} ly  ·  距太阳 ${fromSol.toFixed(2)} ly · ${def.spectral}`;
}

export { formatSpeed, TIME_PRESETS, SPEED_PRESETS };
