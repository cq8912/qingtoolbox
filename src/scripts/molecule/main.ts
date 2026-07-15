import { buildDna } from './dna';
import { caffeine, water, type Molecule } from './presets';
import { createMolScene } from './scene';

function $(id: string) {
  return document.getElementById(id)!;
}

export function bootMolecule() {
  const canvas = $('mol-canvas') as HTMLCanvasElement;
  const scene = createMolScene(canvas);
  const dna = buildDna(16);
  const catalog: Record<string, Molecule> = {
    water,
    caffeine,
    dna,
  };

  let current = 'dna';
  let showPairs = true;

  const apply = () => {
    scene.setMolecule(catalog[current], showPairs);
    $('mol-name').textContent = catalog[current].name;
    $('mol-count').textContent = String(catalog[current].atoms.length);
    const pairBtn = $('mol-pairs') as HTMLButtonElement;
    pairBtn.style.display = current == 'dna' ? '' : 'none';
  };

  $('mol-select').addEventListener('change', (e) => {
    current = (e.target as HTMLSelectElement).value;
    apply();
  });
  $('mol-pairs').addEventListener('click', () => {
    showPairs = !showPairs;
    $('mol-pairs').textContent = showPairs ? '隐藏碱基对' : '显示碱基对';
    apply();
  });

  apply();
}
