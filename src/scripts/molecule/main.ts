import { buildDna } from './dna';
import { caffeine, dopamine, serotonin, water, type Molecule } from './presets';
import { createMolScene } from './scene';

function $(id: string) {
  return document.getElementById(id)!;
}

const TOUR_ORDER = ['dna', 'dopamine', 'serotonin', 'caffeine', 'water'] as const;
const TOUR_SEC = 9;

export function bootMolecule() {
  const canvas = $('mol-canvas') as HTMLCanvasElement;
  const scene = createMolScene(canvas);
  const dna = buildDna(16);
  const catalog: Record<string, Molecule> = { water, caffeine, dopamine, serotonin, dna };

  let current = 'dna';
  let showPairs = true;
  let tourTimer = 0;
  let tourIdx = 0;

  const apply = () => {
    scene.setMolecule(catalog[current], showPairs);
    $('mol-name').textContent = catalog[current].name;
    $('mol-count').textContent = String(catalog[current].atoms.length);
    const sel = $('mol-select') as HTMLSelectElement;
    sel.value = current;
    const pairBtn = $('mol-pairs') as HTMLButtonElement;
    pairBtn.style.display = current == 'dna' ? '' : 'none';
    $('mol-tour-note').textContent = `自动巡游中 · ${TOUR_SEC}s 切换`;
  };

  const nextTour = () => {
    tourIdx = (tourIdx + 1) % TOUR_ORDER.length;
    current = TOUR_ORDER[tourIdx];
    apply();
  };

  $('mol-select').addEventListener('change', (e) => {
    current = (e.target as HTMLSelectElement).value;
    tourIdx = TOUR_ORDER.indexOf(current as typeof TOUR_ORDER[number]);
    if (tourIdx < 0) tourIdx = 0;
    apply();
  });
  $('mol-pairs').addEventListener('click', () => {
    showPairs = !showPairs;
    $('mol-pairs').textContent = showPairs ? '隐藏碱基对' : '显示碱基对';
    apply();
  });
  $('mol-tour').addEventListener('click', () => {
    const on = $('mol-tour').dataset.on != '1';
    $('mol-tour').dataset.on = on ? '1' : '0';
    $('mol-tour').textContent = on ? '暂停巡游' : '继续巡游';
    scene.setAutoSpin(on);
    if (on) {
      $('mol-tour-note').textContent = `自动巡游中 · ${TOUR_SEC}s 切换`;
      tourTimer = window.setInterval(nextTour, TOUR_SEC * 1000);
    } else {
      $('mol-tour-note').textContent = '已暂停自动切换';
      clearInterval(tourTimer);
    }
  });

  apply();
  // 进入即自动巡游
  $('mol-tour').dataset.on = '1';
  $('mol-tour').textContent = '暂停巡游';
  tourTimer = window.setInterval(nextTour, TOUR_SEC * 1000);
}
