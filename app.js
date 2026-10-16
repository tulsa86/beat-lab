import { AudioEngine } from './audio.js';
import { DRUMS, SCALES, ROOTS, newProject, notes, surprise, validateProject } from './model.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'beat-lab.projects.v1';
let project = newProject(), projectId = null, dirty = true, starting = false;
const selected = { bass: 0, melody: 4 };
let toastTimer;
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200); }
function fail(error) { toast(error.message || 'Something went wrong. Please try again.'); }
function markDirty() { dirty=true; $('#save-status').textContent='Unsaved changes'; }
function setPlaying(playing,message) {
  $('#play-label').textContent=playing?'Stop beat':'Play beat'; $('#play-icon').textContent=playing?'■':'▶︎';
  $('#play-button').classList.toggle('playing',playing); $('#play-button').setAttribute('aria-pressed',String(playing));
  $('#audio-status').textContent=message;
}
function drawStep(step) {
  $$('.current').forEach(el=>el.classList.remove('current'));
  if(step>=0) $$(`[data-step="${step}"]`).forEach(el=>el.classList.add('current'));
  $('#step-position').textContent=`STEP ${step<0?'—':String(step+1).padStart(2,'0')} / 16`;
}
const engine = new AudioEngine(()=>project,drawStep,setPlaying);
function button(className,text) { const el=document.createElement('button');el.type='button';el.className=className;el.textContent=text;return el; }
function stepClass(index,active) { return `step ${Math.floor(index/4)%2===0?'group-even ':''}${active?'active':''}`; }
function stepNumbers(grid) {
  grid.append(document.createElement('span'));
  for(let i=0;i<16;i++) { const number=document.createElement('span');number.className=`step-number ${i%4===0?'downbeat':''}`;number.dataset.step=i;number.textContent=String(i+1).padStart(2,'0');grid.append(number); }
}
function renderDrums() {
  const grid=$('#drum-grid');grid.replaceChildren(); stepNumbers(grid);
  const names={kick:['◉','Kick'],snare:['▰','Snare'],hat:['╪','Hi-hat'],clap:['⋈','Clap']};
  for(const drum of DRUMS) {
    const label=button('row-label','');const icon=document.createElement('span');icon.textContent=names[drum][0];icon.setAttribute('aria-hidden','true');label.append(icon,document.createTextNode(names[drum][1]));label.setAttribute('aria-label',`Preview ${names[drum][1]}`);
    label.onclick=()=>engine.preview('drums',drum).catch(fail);grid.append(label);
    project.drums[drum].forEach((active,i)=>{
      const el=button(stepClass(i,active),'');el.dataset.step=i;el.setAttribute('aria-label',`${names[drum][1]}, step ${i+1}`);el.setAttribute('aria-pressed',String(!!active));
      el.onclick=()=>{project.drums[drum][i]=+!project.drums[drum][i];const on=!!project.drums[drum][i];el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));markDirty();if(on&&!engine.playing)engine.preview('drums',drum).catch(fail);};
      grid.append(el);
    });
  }
}
function renderNotes(instrument) {
  const choices=notes(project,instrument);selected[instrument]=Math.min(selected[instrument],choices.length-1);
  const picker=$(`#${instrument}-notes`);picker.replaceChildren();const title=document.createElement('span');title.textContent='CHOOSE A NOTE';picker.append(title);
  choices.forEach((note,index)=>{
    const el=button('note-option',note.label);el.setAttribute('aria-label',`Choose ${note.label} for ${instrument}`);el.setAttribute('aria-pressed',String(index===selected[instrument]));
    el.onclick=()=>{selected[instrument]=index;picker.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));engine.preview(instrument,index).catch(fail);};picker.append(el);
  });
  const grid=$(`#${instrument}-grid`);grid.replaceChildren();stepNumbers(grid);
  const label=document.createElement('span');label.className='row-label';label.textContent=instrument==='bass'?'Deep & warm':'Soft & bright';grid.append(label);
  project[instrument].forEach((note,i)=>{
    const el=button(stepClass(i,note!==null),note===null?'—':choices[note].label);el.dataset.step=i;
    const describe=()=>{const value=project[instrument][i];el.setAttribute('aria-label',`${instrument}, step ${i+1}, ${value===null?'empty':choices[value].label}`);el.setAttribute('aria-pressed',String(value!==null));};describe();
    el.onclick=()=>{const next=project[instrument][i]===selected[instrument]?null:selected[instrument];project[instrument][i]=next;el.textContent=next===null?'—':choices[next].label;el.classList.toggle('active',next!==null);describe();markDirty();if(next!==null&&!engine.playing)engine.preview(instrument,next).catch(fail);};grid.append(el);
  });
}
function render() {
  $('#project-name').value=project.name;$('#bpm').value=project.bpm;$('#root').value=project.root;$('#scale').value=project.scale;
  renderDrums();renderNotes('bass');renderNotes('melody');
  for(const name of ['drums','bass','melody']) {
    const slider=$(`[data-volume="${name}"]`);slider.value=Math.round(project.volumes[name]*100);slider.nextElementSibling.value=`${slider.value}%`;
    const mute=$(`[data-mute="${name}"]`);mute.setAttribute('aria-pressed',String(project.muted[name]));mute.setAttribute('aria-label',`${project.muted[name]?'Unmute':'Mute'} ${name}`);
    $(`[data-instrument="${name}"]`).classList.toggle('is-muted',project.muted[name]);
  }
  engine.updateVolumes();
}
ROOTS.forEach((root,i)=>{const option=document.createElement('option');option.value=i;option.textContent=root;$('#root').append(option);});
$('#play-button').onclick=async()=>{
  if(engine.playing||starting){starting=false;engine.stop();return;}
  starting=true;$('#play-label').textContent='Starting…';
  try {await engine.start();}catch(error){engine.stop('Audio needs a tap to start');fail(error);}finally{starting=false;}
};
$('#stop-button').onclick=()=>{starting=false;engine.stop();};
function changeTempo(value) { const number=Number(value);project.bpm=Math.max(60,Math.min(180,Number.isFinite(number)&&value!==''?Math.round(number):project.bpm));$('#bpm').value=project.bpm;markDirty(); }
$('#bpm').onchange=e=>changeTempo(e.target.value);
$('#tempo-up').onclick=()=>changeTempo(project.bpm+1);$('#tempo-down').onclick=()=>changeTempo(project.bpm-1);
$('#project-name').oninput=e=>{project.name=e.target.value;markDirty();};
$$('[data-volume]').forEach(el=>el.oninput=()=>{project.volumes[el.dataset.volume]=Number(el.value)/100;el.nextElementSibling.value=`${el.value}%`;engine.updateVolumes();markDirty();});
$$('[data-mute]').forEach(el=>el.onclick=()=>{const name=el.dataset.mute;project.muted[name]=!project.muted[name];el.setAttribute('aria-pressed',String(project.muted[name]));el.setAttribute('aria-label',`${project.muted[name]?'Unmute':'Mute'} ${name}`);$(`[data-instrument="${name}"]`).classList.toggle('is-muted',project.muted[name]);engine.updateVolumes();markDirty();});
$$('[data-clear]').forEach(el=>el.onclick=()=>{const name=el.dataset.clear;if(name==='drums'){DRUMS.forEach(d=>project.drums[d].fill(0));renderDrums();}else{project[name].fill(null);renderNotes(name);}markDirty();toast(`${name[0].toUpperCase()+name.slice(1)} cleared`);});
$('#root').onchange=e=>{project.root=Number(e.target.value);renderNotes('bass');renderNotes('melody');markDirty();};
$('#scale').onchange=e=>{project.scale=e.target.value;for(const name of ['bass','melody']){project[name]=project[name].map(n=>n===null?null:Math.min(n,SCALES[project.scale].length));renderNotes(name);}markDirty();};
$('#surprise-button').onclick=()=>{project=surprise(project);render();markDirty();toast('A fresh idea. Every step is yours to edit.');};

function readLibrary() {
  let raw;try{raw=localStorage.getItem(STORAGE_KEY);}catch{throw new Error('Browser storage is unavailable. Use Download project to keep your work.');}
  if(!raw)return [];
  let data;try{data=JSON.parse(raw);}catch{throw new Error('Saved project data could not be read. Download your current project as a backup.');}
  if(!Array.isArray(data) || data.some(r=>!r || typeof r.id!=='string' || !Number.isFinite(r.savedAt) || !r.project))throw new Error('Saved project data could not be read. Use Download project for a backup.');
  return data;
}
function writeLibrary(records) {try{localStorage.setItem(STORAGE_KEY,JSON.stringify(records));}catch{throw new Error('Could not save on this browser. Storage may be full or disabled. Download your project instead.');}}
$('#save-button').onclick=()=>{
  try {
    project.name=project.name.trim()||'Untitled beat';$('#project-name').value=project.name;
    const library=readLibrary(), id=projectId||(globalThis.crypto?.randomUUID?.()||`beat-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const record={id,savedAt:Date.now(),project:validateProject(project)};const index=library.findIndex(r=>r.id===id);if(index>=0)library[index]=record;else library.push(record);
    writeLibrary(library);projectId=id;dirty=false;$('#save-status').textContent='Saved on this device';toast('Project saved on this device.');
  }catch(error){fail(error);}
};
function confirmAction(title,message,action) {
  $('#confirm-title').textContent=title;$('#confirm-text').textContent=message;
  $('#confirm-yes').onclick=()=>{$('#confirm-dialog').close();action();};$('#confirm-dialog').showModal();
}
$('#confirm-cancel').onclick=()=>$('#confirm-dialog').close();
function replaceProject(next,id=null) {
  engine.stop();project=validateProject(next);projectId=id;dirty=!id;render();$('#save-status').textContent=id?'Saved on this device':'Unsaved project';
}
function loadRecord(record) {
  let valid;try{valid=validateProject(record.project);}catch(error){fail(error);return;}
  const action=()=>{replaceProject(valid,record.id);$('#load-dialog').close();toast(`Loaded “${project.name}”`);};
  if(dirty) confirmAction('Load this project?','Your unsaved changes will be replaced. Cancel and save first if you want to keep them.',action);else action();
}
function renderLibrary() {
  const list=$('#saved-projects');list.replaceChildren();
  try {
    const library=readLibrary().sort((a,b)=>b.savedAt-a.savedAt);
    if(!library.length){const empty=document.createElement('p');empty.className='dialog-note';empty.textContent='Your next great idea belongs here. Save a project to get started.';list.append(empty);}
    for(const record of library){
      const row=document.createElement('div');row.className='saved-row';const load=button('','');const title=document.createElement('strong');title.textContent=record.project.name||'Untitled beat';const detail=document.createElement('small');detail.textContent=`${record.project.bpm} BPM · ${new Date(record.savedAt).toLocaleDateString()}`;load.append(title,detail);load.onclick=()=>loadRecord(record);
      const remove=button('delete-project','Delete');remove.setAttribute('aria-label',`Delete ${record.project.name}`);remove.onclick=()=>confirmAction('Delete saved project?','This removes the saved copy from this browser.',()=>{try{writeLibrary(readLibrary().filter(r=>r.id!==record.id));if(projectId===record.id){projectId=null;markDirty();}renderLibrary();toast('Saved project deleted.');}catch(error){fail(error);}});row.append(load,remove);list.append(row);
    }
  }catch(error){const message=document.createElement('p');message.className='dialog-note';message.textContent=error.message;list.append(message);}
}
$('#load-button').onclick=()=>{renderLibrary();$('#load-dialog').showModal();};
$('#new-button').onclick=()=>{
  const action=()=>{const next=newProject();next.name='Untitled beat';DRUMS.forEach(d=>next.drums[d].fill(0));next.bass.fill(null);next.melody.fill(null);replaceProject(next);toast('A blank canvas. Start with a kick.');};
  if(dirty)confirmAction('Start a new project?','Your unsaved changes will be replaced. Cancel and save first to keep this beat.',action);else action();
};
$('#export-button').onclick=()=>{
  const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${project.name.replace(/[^a-z0-9_-]/gi,'-')||'beat-lab'}.beatlab.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Project downloaded. This file stores your pattern and settings.');
};
$('#import-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>100000)throw new Error('That file is too large for a Beat Lab project.');let next;try{next=validateProject(JSON.parse(await file.text()));}catch{throw new Error('Choose a valid Beat Lab project JSON file.');}
    const action=()=>{replaceProject(next);$('#load-dialog').close();toast('Project imported. Save it to keep it in this browser.');};
    if(dirty)confirmAction('Import this project?','Your unsaved changes will be replaced. Cancel and save first if you want to keep them.',action);else action();
  }catch(error){fail(error);}finally{e.target.value='';}
};
$('#help-button').onclick=()=>$('#help-dialog').showModal();
$$('.close-dialog').forEach(el=>el.onclick=()=>el.closest('dialog').close());$('.close-guide').onclick=()=>$('#help-dialog').close();
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('#play-button').click();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(engine.playing||starting)){starting=false;engine.stop('Paused while away · tap Play to restart');}});
window.addEventListener('pagehide',()=>engine.stop());
render();setPlaying(false,'Ready · tap Play to enable audio');
