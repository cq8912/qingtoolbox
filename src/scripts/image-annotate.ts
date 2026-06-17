// 图片标注 fabric 逻辑
import { fabric } from 'fabric';

export type AnnotateTool = 'select' | 'rect' | 'arrow' | 'text';

const MAX_PREVIEW = 1200;
const STROKE = '#e11d48';

export class ImageAnnotator {
  canvas: fabric.Canvas;
  private tool: AnnotateTool = 'select';
  private persistentTool = false;
  private displayScale = 1;
  private arrowStart: { x: number; y: number } | null = null;
  private arrowTemp: fabric.Line | null = null;
  private rectStart: { x: number; y: number } | null = null;
  private rectTemp: fabric.Rect | null = null;
  private history: fabric.Object[] = [];
  private keyHandler: (e: KeyboardEvent) => void;
  onAfterDraw?: () => void;

  constructor(el: HTMLCanvasElement) {
    this.canvas = new fabric.Canvas(el, { selection: true });
    this.keyHandler = (e) => this.onKeyDown(e);
    window.addEventListener('keydown', this.keyHandler);
    this.bindEvents();
    this.setTool('select');
  }

  private bindEvents() {
    this.canvas.on('mouse:down', (opt) => this.onMouseDown(opt));
    this.canvas.on('mouse:move', (opt) => this.onMouseMove(opt));
    this.canvas.on('mouse:up', (opt) => this.onMouseUp(opt));
    this.canvas.on('object:added', (e) => {
      const t = e.target as fabric.Object & { data?: { isTemp?: boolean } };
      if (t && !t.data?.isTemp) this.history.push(t);
    });
  }

  setTool(tool: AnnotateTool, persistent = false) {
    this.tool = tool;
    this.persistentTool = persistent;
    this.arrowStart = null;
    this.rectStart = null;
    const isSelect = tool == 'select';
    // 默认选择模式：可点选、拖动已有标注
    this.canvas.selection = isSelect;
    this.canvas.defaultCursor = isSelect ? 'default' : 'crosshair';
    this.canvas.hoverCursor = isSelect ? 'move' : 'crosshair';
    this.canvas.forEachObject((obj) => {
      obj.selectable = isSelect;
      obj.evented = isSelect;
    });
  }

  async setBackground(dataUrl: string) {
    return new Promise<void>((resolve) => {
      fabric.Image.fromURL(dataUrl, (img) => {
        const w = img.width || 800;
        const h = img.height || 600;
        this.displayScale = Math.min(1, MAX_PREVIEW / Math.max(w, h));
        const dw = Math.round(w * this.displayScale);
        const dh = Math.round(h * this.displayScale);
        this.canvas.setWidth(dw);
        this.canvas.setHeight(dh);
        img.scale(this.displayScale);
        this.canvas.setBackgroundImage(img, () => {
          this.canvas.renderAll();
          resolve();
        });
      });
    });
  }

  private getPointer(opt: fabric.IEvent<MouseEvent>) {
    return this.canvas.getPointer(opt.e);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key != 'Delete' && e.key != 'Backspace') return;
    const active = this.canvas.getActiveObject();
    if (active instanceof fabric.IText && active.isEditing) return;
    if (!active) return;
    e.preventDefault();
    this.deleteSelected();
  }

  private maybeDone() {
    if (!this.persistentTool) {
      this.setTool('select');
      this.onAfterDraw?.();
    }
  }

  private onMouseDown(opt: fabric.IEvent<MouseEvent>) {
    if (!opt.e || this.tool == 'select') return;
    const p = this.getPointer(opt);

    if (this.tool == 'rect') {
      this.rectStart = { x: p.x, y: p.y };
      this.rectTemp = new fabric.Rect({
        left: p.x, top: p.y, width: 1, height: 1,
        fill: 'transparent', stroke: STROKE, strokeWidth: 2,
        selectable: false, evented: false,
      });
      markTemp(this.rectTemp);
      this.canvas.add(this.rectTemp);
      return;
    }

    // 箭头：按下开始（微信习惯）
    if (this.tool == 'arrow' && !this.arrowStart) {
      this.arrowStart = { x: p.x, y: p.y };
      this.arrowTemp = new fabric.Line([p.x, p.y, p.x, p.y], {
        stroke: STROKE, strokeWidth: 3, selectable: false, evented: false,
      });
      markTemp(this.arrowTemp);
      this.canvas.add(this.arrowTemp);
      return;
    }

    if (this.tool == 'text') {
      const text = new fabric.IText('文字', {
        left: p.x, top: p.y, fontSize: 20, fill: STROKE, fontFamily: 'sans-serif',
      });
      this.canvas.add(text);
      this.canvas.setActiveObject(text);
      text.enterEditing();
      this.maybeDone();
    }
  }

  private onMouseMove(opt: fabric.IEvent<MouseEvent>) {
    const p = this.getPointer(opt);
    if (this.rectStart && this.rectTemp) {
      this.rectTemp.set({
        left: Math.min(this.rectStart.x, p.x),
        top: Math.min(this.rectStart.y, p.y),
        width: Math.abs(p.x - this.rectStart.x),
        height: Math.abs(p.y - this.rectStart.y),
      });
      this.canvas.renderAll();
      return;
    }
    if (this.arrowStart && this.arrowTemp) {
      this.arrowTemp.set({ x2: p.x, y2: p.y });
      this.canvas.renderAll();
    }
  }

  private onMouseUp(opt: fabric.IEvent<MouseEvent>) {
    const p = this.getPointer(opt);
    if (this.tool == 'rect' && this.rectStart && this.rectTemp) {
      const tooSmall = this.rectTemp.width! < 4 && this.rectTemp.height! < 4;
      if (tooSmall) this.canvas.remove(this.rectTemp);
      else {
        clearTemp(this.rectTemp);
        this.rectTemp.set({ selectable: true, evented: true });
        this.history.push(this.rectTemp);
      }
      this.rectStart = null;
      this.rectTemp = null;
      this.maybeDone();
      return;
    }
    if (this.tool == 'arrow' && this.arrowStart) {
      this.finishArrow(p.x, p.y);
      this.maybeDone();
    }
  }

  private finishArrow(x2: number, y2: number) {
    if (!this.arrowStart) return;
    const { x: x1, y: y1 } = this.arrowStart;
    if (this.arrowTemp) this.canvas.remove(this.arrowTemp);
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist > 4) {
      const line = new fabric.Line([x1, y1, x2, y2], { stroke: STROKE, strokeWidth: 3 });
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = new fabric.Triangle({
        left: x2, top: y2, width: 14, height: 18, fill: STROKE,
        angle: (angle * 180) / Math.PI + 90, originX: 'center', originY: 'center',
      });
      this.canvas.add(new fabric.Group([line, head], { subTargetCheck: false }));
    }
    this.arrowStart = null;
    this.arrowTemp = null;
  }

  deleteSelected() {
    const active = this.canvas.getActiveObject();
    if (active) {
      this.history = this.history.filter((o) => o != active);
      this.canvas.remove(active);
    }
  }

  undo() {
    const obj = this.history.pop();
    if (obj) this.canvas.remove(obj);
  }

  exportPng(): string {
    const mul = this.displayScale < 1 ? 1 / this.displayScale : 1;
    return this.canvas.toDataURL({ format: 'png', multiplier: mul });
  }

  dispose() {
    window.removeEventListener('keydown', this.keyHandler);
    this.canvas.dispose();
  }
}

function markTemp(obj: fabric.Object) {
  (obj as fabric.Object & { data: { isTemp: boolean } }).data = { isTemp: true };
}

function clearTemp(obj: fabric.Object) {
  (obj as fabric.Object & { data?: { isTemp?: boolean } }).data = { isTemp: false };
}

// 拼接多张图，返回 dataUrl
export function stitchImages(
  images: HTMLImageElement[],
  isH: boolean,
  alignMode: string,
): string {
  const maxW = Math.max(...images.map((i) => i.width));
  const maxH = Math.max(...images.map((i) => i.height));
  const sizes = images.map((img) => {
    if (alignMode == 'equal-height') {
      const scale = maxH / img.height;
      return { w: Math.round(img.width * scale), h: maxH };
    }
    if (alignMode == 'equal-width') {
      const scale = maxW / img.width;
      return { w: maxW, h: Math.round(img.height * scale) };
    }
    return { w: img.width, h: img.height };
  });
  let totalW = isH ? sizes.reduce((s, x) => s + x.w, 0) : Math.max(...sizes.map((x) => x.w));
  let totalH = isH ? Math.max(...sizes.map((x) => x.h)) : sizes.reduce((s, x) => s + x.h, 0);
  // ponytail: 拼接结果过大时整体缩小，避免预览/标注画布撑爆
  const maxDim = 2400;
  const shrink = Math.min(1, maxDim / Math.max(totalW, totalH));
  if (shrink < 1) {
    totalW = Math.round(totalW * shrink);
    totalH = Math.round(totalH * shrink);
    sizes.forEach((s) => {
      s.w = Math.round(s.w * shrink);
      s.h = Math.round(s.h * shrink);
    });
  }
  const c = document.createElement('canvas');
  c.width = totalW;
  c.height = totalH;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalW, totalH);
  let offset = 0;
  images.forEach((img, i) => {
    const { w, h } = sizes[i];
    const yOff = isH ? Math.floor((totalH - h) / 2) : offset;
    const xOff = isH ? offset : Math.floor((totalW - w) / 2);
    ctx.drawImage(img, xOff, yOff, w, h);
    offset += isH ? w : h;
  });
  return c.toDataURL('image/png');
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}
