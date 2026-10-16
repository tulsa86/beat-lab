import { DRUMS, notes } from './model.js';

// Instruments accept audio-clock timestamps; a future recorder or arranger can
// call the same voices without depending on the editor or transport UI.
export class AudioEngine {
  constructor(getProject, onStep = () => {}, onState = () => {}) {
    this.getProject = getProject; this.onStep = onStep; this.onState = onState;
    this.context = null; this.playing = false; this.sources = new Set(); this.queue = []; this.generation = 0;
  }
  async unlock() {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) throw new Error('This browser does not support Web Audio. Try a current Safari, Chrome, or Firefox.');
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext();
      const c = this.context;
      this.master = c.createGain(); this.master.gain.value = .68;
      this.compressor = c.createDynamicsCompressor();
      this.master.connect(this.compressor); this.compressor.connect(c.destination);
      this.channels = {};
      for (const name of ['drums','bass','melody']) { this.channels[name] = c.createGain(); this.channels[name].connect(this.master); }
      this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = this.noise.getChannelData(0); for (let i=0;i<data.length;i++) data[i] = Math.random()*2-1;
      c.onstatechange = () => { if (c.state !== 'running' && this.playing) this.stop('Audio paused. Tap Play to resume.'); };
    }
    // resume() is called directly inside the user's tap, including on iOS.
    await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Audio is paused by your browser. Tap Play again to enable sound.');
    this.updateVolumes();
  }
  updateVolumes() {
    if (!this.context) return;
    const p = this.getProject();
    for (const name of ['drums','bass','melody']) this.channels[name].gain.setTargetAtTime(p.muted[name] ? 0 : p.volumes[name], this.context.currentTime, .015);
  }
  track(source, end, nodes = []) {
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); nodes.forEach(n=>n.disconnect()); };
    source.stop(end);
  }
  tone(frequency, time, duration, channel, type='sine', level=.5, slide=null) {
    const c=this.context, osc=c.createOscillator(), gain=c.createGain();
    osc.type=type; osc.frequency.setValueAtTime(frequency,time);
    if(slide) osc.frequency.exponentialRampToValueAtTime(slide,time+duration*.65);
    gain.gain.setValueAtTime(0,time); gain.gain.linearRampToValueAtTime(level,time+.006);
    gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    osc.connect(gain); gain.connect(this.channels[channel]); osc.start(time); this.track(osc,time+duration+.01,[gain]);
  }
  noiseVoice(time, duration, filterType, frequency, level, pulses=false) {
    const c=this.context, source=c.createBufferSource(), filter=c.createBiquadFilter(), gain=c.createGain();
    source.buffer=this.noise; filter.type=filterType; filter.frequency.value=frequency;
    gain.gain.setValueAtTime(.0001,time);
    if(pulses) {
      for(let n=0;n<3;n++) { const t=time+n*.014; gain.gain.setValueAtTime(level,t); gain.gain.exponentialRampToValueAtTime(.001,t+.012); }
      gain.gain.setValueAtTime(level*.7,time+.043);
    } else gain.gain.linearRampToValueAtTime(level,time+.002);
    gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.channels.drums);
    source.start(time); this.track(source,time+duration+.01,[filter,gain]);
  }
  drum(name,time) {
    if(name==='kick') this.tone(150,time,.3,'drums','sine',.95,42);
    if(name==='snare') { this.noiseVoice(time,.18,'highpass',1200,.48); this.tone(185,time,.1,'drums','triangle',.24,100); }
    if(name==='hat') this.noiseVoice(time,.055,'highpass',7200,.24);
    if(name==='clap') this.noiseVoice(time,.19,'bandpass',1700,.65,true);
  }
  note(instrument,index,time,duration) {
    const midi=notes(this.getProject(),instrument)[index]?.midi; if(midi===undefined) return;
    const hz=440*2**((midi-69)/12);
    this.tone(hz,time,duration,instrument,instrument==='bass'?'triangle':'sine',instrument==='bass'?.65:.5);
    if(instrument==='melody') this.tone(hz*2,time,duration*.65,instrument,'sine',.12);
  }
  scheduleStep(step,time) {
    const p=this.getProject(), duration=60/p.bpm/4;
    DRUMS.forEach(name=>{if(p.drums[name][step]) this.drum(name,time);});
    for(const name of ['bass','melody']) if(p[name][step]!==null) this.note(name,p[name][step],time,duration*(name==='bass'?1.6:2.2));
    this.queue.push({step,time});
  }
  scheduler() {
    if(!this.playing) return;
    const now=this.context.currentTime;
    // Recover from a delayed JS callback without playing a burst of old notes.
    if(this.nextTime<now) this.nextTime=now+.025;
    while(this.nextTime<now+.12) {
      this.scheduleStep(this.step,this.nextTime); this.step=(this.step+1)%16;
      this.nextTime+=60/this.getProject().bpm/4;
    }
  }
  async start() {
    const generation=++this.generation;
    await this.unlock();
    if(generation!==this.generation || this.playing) return;
    this.playing=true; this.step=0; this.queue=[]; this.nextTime=this.context.currentTime+.045;
    this.scheduler(); this.timer=setInterval(()=>this.scheduler(),25);
    const draw=()=> { if(!this.playing)return; const now=this.context.currentTime; let current;
      while(this.queue.length && this.queue[0].time<=now) current=this.queue.shift();
      if(current) this.onStep(current.step); this.frame=requestAnimationFrame(draw);
    }; this.frame=requestAnimationFrame(draw); this.onState(true,'Playing · loops every 16 steps');
  }
  stop(message='Stopped · ready when you are') {
    ++this.generation; this.playing=false; clearInterval(this.timer); cancelAnimationFrame(this.frame); this.queue=[];
    for(const source of this.sources) { try { source.stop(); } catch {} }
    this.sources.clear(); this.onStep(-1); this.onState(false,message);
  }
  async preview(instrument,value) {
    await this.unlock(); const time=this.context.currentTime+.01;
    if(instrument==='drums') this.drum(value,time); else this.note(instrument,value,time,.28);
  }
}
