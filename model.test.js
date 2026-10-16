import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, notes, surprise, validateProject, SCALES } from '../model.js';

test('starter project survives serialization with audible patterns on all instruments',()=>{
  const p=validateProject(JSON.parse(JSON.stringify(newProject())));
  assert.ok(Object.values(p.drums).every(row=>row.some(Boolean)));
  assert.ok(p.bass.some(n=>n!==null));assert.ok(p.melody.some(n=>n!==null));
  assert.equal(notes(p,'bass')[0].midi,36);assert.equal(notes(p,'melody')[0].midi,60);
});
test('generated patterns stay valid in every scale and keep user settings',()=>{
  for(const scale of Object.keys(SCALES))for(let run=0;run<100;run++){
    const p=newProject();p.scale=scale;p.bpm=180;p.root=11;p.volumes.bass=.1;
    const generated=validateProject(surprise(p));
    assert.equal(generated.bpm,180);assert.equal(generated.root,11);assert.equal(generated.volumes.bass,.1);
    assert.equal(generated.bass[0],0);assert.equal(generated.drums.snare[4],1);assert.equal(generated.drums.snare[12],1);
  }
});
test('invalid imported projects are rejected before they reach the audio engine',()=>{
  const mutations=[p=>p.bpm=0,p=>p.root=12,p=>p.scale='__proto__',p=>p.bass[0]=100,p=>p.drums.kick.pop(),p=>p.volumes.drums=-1,p=>p.muted.melody='false',p=>p.version=2,p=>p.bass[0]=1.5];
  for(const mutate of mutations){const p=newProject();mutate(p);assert.throws(()=>validateProject(p));}
});
test('validation returns an independent copy',()=>{const p=newProject();const copy=validateProject(p);copy.drums.kick[0]=0;assert.equal(p.drums.kick[0],1);});
