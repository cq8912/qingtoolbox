// 图片标注 fabric 逻辑（ponytail: 单文件集中，image-merge 页引用）
import { fabric } from 'fabric';

export type AnnotateTool = 'select' | 'rect' | 'arrow' | 'polyline' | 'text';

export class ImageAnnotator {
  canvas: fabric.Canvas;
  private tool: AnnotateTool = 'select';
  private polyPoints: { x: number; y: number }[] = [];
  private polyTemp: fabric.Polyline | null = null;
  private arrowStart: { x: number; y: number } | null = null;
  private arrowTemp: fabric.Line | null = null;
  private history: fabric.Object[] = [];

  constructor(el: HTMLCanvasElement) {
    this.canvas = new fabric.Canvas(el, { selection: true });
    this.bindEvents();
  }

  private bindEvents() {
    this.canvas.on('mouse:down', (opt) => this.onMouseDown(opt));
    this.canvas.on('mouse:move', (opt) => this.onMouseMove(opt));
    this.canvas.on('object:added', (e) => {
      const t = e.target as fabric.Object & { data?: { isTemp?: boolean } };
      if (t && !t.data?.isTemp) this.history.push(t);
    });
  }

  setTool(tool: AnnotateTool) {
    this.tool = tool;
    this.polyPoints = [];
    this.arrowStart = null;
    this.canvas.isDrawingMode = false;
    this.canvas.selection = tool == 'select';
    this.canvas.defaultCursor = tool == 'select' ? 'default' : 'crosshair';
  }

  async setBackground(dataUrl: string) {
    return new Promise<void>((resolve) => {
      fabric.Image.fromURL(dataUrl, (img) => {
        const w = img.width || 800;
        const h = img.height || 600;
        this.canvas.setWidth(w);
        this.canvas.setHeight(h);
        this.canvas.setBackgroundImage(img, () => {
          this.canvas.renderAll();
          resolve();
        }, { scaleX: 1, scaleY: 1 });
      });
    });
  }

  private getPointer(opt: fabric.IEvent<MouseEvent>) {
    return this.canvas.getPointer(opt.e);
  }

  private onMouseDown(opt: fabric.IEvent<MouseEvent>) {
    if (!opt.e || this.tool == 'select') return;
    const p = this.getPointer(opt);

    if (this.tool == 'rect') {
      const rect = new fabric.Rect({
        left: p.x, top: p.y, width: 1, height: 1,
        fill: 'transparent', stroke: '#e11d48', strokeWidth: 2,
      });
      this.canvas.add(rect);
      this.canvas.setActiveObject(rect);
      rect.on('scaling', () => {});
      const onMove = (o: fabric.IEvent<Event>) => {
        const pp = this.getPointer(o as fabric.IEvent<MouseEvent>);
        rect.set({ width: Math.abs(pp.x - p.x), height: Math.abs(pp.y - p.y) });
        rect.set({ left: Math.min(p.x, pp.x), top: Math.min(p.y, pp.y) });
        this.canvas.renderAll();
      };
      const onUp = () => {
        this.canvas.off('mouse:move', onMove);
        this.canvas.off('mouse:up', onUp);
      };
      this.canvas.on('mouse:move', onMove);
      this.canvas.on('mouse:up', onUp);
      return;
    }

    if (this.tool == 'arrow') {
      if (!this.arrowStart) {
        this.arrowStart = { x: p.x, y: p.y };
        this.arrowTemp = new fabric.Line([p.x, p.y, p.x, p.y], {
          stroke: '#e11d48', strokeWidth: 3, selectable: false,
        });
        (this.arrowTemp as fabric.Object & { data: { isTemp: boolean } }).data = { isTemp: true };
        this.canvas.add(this.arrowTemp);
      } else {
        this.finishArrow(p.x, p.y);
      }
      return;
    }

    if (this.tool == 'polyline') {
      this.polyPoints.push({ x: p.x, y: p.y });
      if (this.polyTemp) this.canvas.remove(this.polyTemp);
      this.polyTemp = new fabric.Polyline([...this.polyPoints], {
        fill: 'transparent', stroke: '#e11d48', strokeWidth: 2, selectable: false,
      });
      (this.polyTemp as fabric.Object & { data: { isTemp: boolean } }).data = { isTemp: true };
      this.canvas.add(this.polyTemp);
      return;
    }

    if (this.tool == 'text') {
      const text = new fabric.IText('文字', {
        left: p.x, top: p.y, fontSize: 20, fill: '#e11d48', fontFamily: 'sans-serif',
      });
      this.canvas.add(text);
      this.canvas.setActiveObject(text);
      text.enterEditing();
    }
  }

  private onMouseMove(opt: fabric.IEvent<MouseEvent>) {
    if (!this.arrowStart || !this.arrowTemp) return;
    const p = this.getPointer(opt);
    this.arrowTemp.set({ x2: p.x, y2: p.y });
    this.canvas.renderAll();
  }

  private finishArrow(x2: number, y2: number) {
    if (!this.arrowStart) return;
    const { x: x1, y: y1 } = this.arrowStart;
    if (this.arrowTemp) this.canvas.remove(this.arrowTemp);
    const line = new fabric.Line([x1, y1, x2, y2], { stroke: '#e11d48', strokeWidth: 3 });
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = new fabric.Triangle({
      left: x2, top: y2, width: 14, height: 18, fill: '#e11d48',
      angle: (angle * 180) / Math.PI + 90, originX: 'center', originY: 'center',
    });
    const group = new fabric.Group([line, head], { subTargetCheck: false });
    this.canvas.add(group);
    this.arrowStart = null;
    this.arrowTemp = null;
  }

  finishPolyline() {
    if (this.polyPoints.length < 2) return;
    if (this.polyTemp) this.canvas.remove(this.polyTemp);
    const pl = new fabric.Polyline([...this.polyPoints], {
      fill: 'transparent', stroke: '#e11d48', strokeWidth: 2,
    });
    this.canvas.add(pl);
    this.polyPoints = [];
    this.polyTemp = null;
  }

  deleteSelected() {
    const active = this.canvas.getActiveObject();
    if (active) this.canvas.remove(active);
  }

  undo() {
    const obj = this.history.pop();
    if (obj) this.canvas.remove(obj);
  }

  exportPng(): string {
    return this.canvas.toDataURL({ format: 'png', multiplier: 1 });
  }

  dispose() {
    this.canvas.dispose();
  }
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
  const totalW = isH ? sizes.reduce((s, x) => s + x.w, 0) : Math.max(...sizes.map((x) => x.w));
  const totalH = isH ? Math.max(...sizes.map((x) => x.h)) : sizes.reduce((s, x) => s + x.h, 0);
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
