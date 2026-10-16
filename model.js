export const STEPS = 16;
export const DRUMS = ['kick', 'snare', 'hat', 'clap'];
export const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], pentatonic: [0, 3, 5, 7, 10] };
export const ROOTS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function notes(project, instrument) {
  const base = (instrument === 'bass' ? 36 : 60) + project.root;
  return [...SCALES[project.scale], 12].map(offset => ({ midi: base + offset, label: ROOTS[(base + offset) % 12] + (Math.floor((base + offset) / 12) - 1) }));
}
export function newProject() {
  return { version: 1, name: 'Midnight sketch', bpm: 108, root: 0, scale: 'minor', volumes: { drums: .8, bass: .65, melody: .5 }, muted: { drums: false, bass: false, melody: false },
    drums: { kick: [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat: Array.from({length:16}, (_,i)=>i%2===0?1:0), clap: [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0] },
    bass: [0,null,null,0,null,null,4,null,0,null,null,2,null,null,4,null], melody: [null,null,7,null,null,4,null,null,null,null,2,null,null,4,null,1] };
}
export function surprise(project, random = Math.random) {
  const p = structuredClone(project);
  p.drums.kick = Array.from({length:16},(_,i)=>+(i%8===0 || (i%2===0 && random()<.3)));
  p.drums.snare = Array.from({length:16},(_,i)=>+(i===4 || i===12));
  p.drums.hat = Array.from({length:16},(_,i)=>+(i%2===0 || random()<.25));
  p.drums.clap = Array.from({length:16},(_,i)=>+(i===12 || (i===4 && random()<.5)));
  const max = SCALES[p.scale].length;
  p.bass = Array.from({length:16},(_,i)=>i%4===0 ? 0 : (i%2===0 && random()<.65 ? Math.floor(random()*max) : null));
  p.melody = Array.from({length:16},(_,i)=>i%2===0 || random()<.2 ? Math.floor(random()*(max+1)) : null);
  return p;
}
export function validateProject(value) {
  if (!value || value.version !== 1 || typeof value.name !== 'string' || value.name.length > 60 || !Number.isFinite(value.bpm) || value.bpm<60 || value.bpm>180 || !Number.isInteger(value.root) || value.root<0 || value.root>11 || !Object.hasOwn(SCALES,value.scale)) throw new Error('This project is not a supported Beat Lab file.');
  for (const key of DRUMS) if (!Array.isArray(value.drums?.[key]) || value.drums[key].length!==16 || value.drums[key].some(x=>x!==0 && x!==1)) throw new Error('The drum pattern is incomplete.');
  for (const key of ['bass','melody']) if (!Array.isArray(value[key]) || value[key].length!==16 || value[key].some(x=>x!==null && (!Number.isInteger(x) || x<0 || x>SCALES[value.scale].length))) throw new Error('The note pattern is incomplete.');
  for (const key of ['drums','bass','melody']) if (!Number.isFinite(value.volumes?.[key]) || value.volumes[key]<0 || value.volumes[key]>1 || typeof value.muted?.[key]!=='boolean') throw new Error('The instrument levels are invalid.');
  return structuredClone(value);
}
