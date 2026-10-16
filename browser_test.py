"""Run against npm start. Requires Python Playwright and Chromium.
BEAT_LAB_URL can select another server; CHROMIUM_PATH can select another binary.
"""
import os, json
from playwright.sync_api import sync_playwright

URL = os.environ.get('BEAT_LAB_URL', 'http://127.0.0.1:8000')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440,'height':1100})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(URL)
    page.locator('#play-button').click()
    page.wait_for_function("document.querySelector('#play-button').classList.contains('playing')")
    page.wait_for_timeout(700)
    assert 'STEP —' not in page.locator('#step-position').inner_text()
    page.locator('#stop-button').click()
    assert not page.locator('.current').count()
    # Editable drums, note placement, mute, volumes, scale changes, and tempo clamp.
    kick=page.get_by_role('button',name='Kick, step 2',exact=True)
    kick.click();assert kick.get_attribute('aria-pressed')=='true'
    kick.click();assert kick.get_attribute('aria-pressed')=='false'
    page.get_by_role('button',name='Choose D2 for bass',exact=True).click()
    bass=page.locator('#bass-grid .step').nth(1);bass.click();assert bass.inner_text()=='D2'
    bass.click();assert bass.inner_text()=='—'
    page.locator('[data-mute=bass]').click();assert page.locator('[data-instrument=bass]').get_attribute('class').endswith('is-muted')
    page.locator('[data-mute=bass]').click()
    page.locator('[data-volume=drums]').fill('35');page.locator('[data-volume=drums]').dispatch_event('input')
    page.locator('#bpm').fill('999');page.locator('#bpm').dispatch_event('change');assert page.locator('#bpm').input_value()=='180'
    page.locator('#scale').select_option('pentatonic');assert page.locator('#melody-notes button').count()==6
    page.locator('#surprise-button').click()
    page.locator('#project-name').fill('Browser test beat');page.locator('#save-button').click()
    assert page.locator('#save-status').inner_text()=='Saved on this device'
    snapshot=page.evaluate("JSON.parse(localStorage.getItem('beat-lab.projects.v1'))[0].project")
    assert snapshot['volumes']['drums']==.35 and snapshot['bpm']==180
    page.reload();page.locator('#load-button').click();page.get_by_role('button',name='Browser test beat 180 BPM',exact=False).click();page.locator('#confirm-yes').click()
    assert page.locator('#project-name').input_value()=='Browser test beat'
    assert page.locator('#scale').input_value()=='pentatonic'
    # Render every voice with real Web Audio, then test a complete mixed loop.
    audio=page.evaluate('''async () => {
      const {AudioEngine}=await import('./audio.js');const {newProject}=await import('./model.js');
      const project=newProject(), engine=new AudioEngine(()=>project);await engine.unlock();const live=engine.context;
      const offline=new OfflineAudioContext(1,44100*4,44100);engine.context=offline;engine.channels={};
      for(const name of ['drums','bass','melody']){engine.channels[name]=offline.createGain();engine.channels[name].gain.value=.25;engine.channels[name].connect(offline.destination);}
      for(let step=0;step<16;step++)engine.scheduleStep(step,.05+step*60/project.bpm/4);
      const result=await offline.startRendering();const data=result.getChannelData(0);
      const mixed={peak:Math.max(...data.slice(0,44000).map(Math.abs)),finite:data.every(Number.isFinite),energy:data.reduce((sum,n)=>sum+n*n,0)};
      engine.context=live;engine.channels={};for(const name of ['drums','bass','melody']){engine.channels[name]=live.createGain();engine.channels[name].connect(live.destination);}
      engine.sources.clear();const events=[];const original=engine.scheduleStep.bind(engine);engine.scheduleStep=(step,time)=>{events.push({step,time,now:live.currentTime});original(step,time);};
      await engine.start();await new Promise(resolve=>setTimeout(resolve,2600));engine.stop();
      const stopped=engine.sources.size===0&&!engine.playing&&!engine.queue.length;
      const spacing=events.slice(1).every((event,i)=>Math.abs(event.time-events[i].time-60/project.bpm/4)<.00001);
      await live.close();return {mixed,events:events.length,spacing,looped:events.some((e,i)=>i>0&&e.step===0),stopped};
    }''')
    assert audio['mixed']['peak']>0 and audio['mixed']['finite'] and audio['mixed']['energy']>0
    assert audio['events']>=17 and audio['spacing'] and audio['looped'] and audio['stopped'],audio
    # Dialogs, fresh projects, JSON backups, deletion and interruptions.
    page.locator('#help-button').click();assert page.locator('#help-dialog').is_visible();page.locator('.close-guide').click()
    page.locator('#load-button').click()
    with page.expect_download() as download_info:
        page.locator('#export-button').click()
    backup=download_info.value.path()
    page.locator('#load-dialog .close-dialog').click()
    page.locator('#new-button').click()
    assert page.locator('#project-name').input_value()=='Untitled beat'
    assert page.locator('.step.active').count()==0
    page.locator('#load-button').click();page.locator('#import-file').set_input_files(backup);page.locator('#confirm-yes').click()
    assert page.locator('#project-name').input_value()=='Browser test beat'
    page.locator('#play-button').click();page.wait_for_function("document.querySelector('#play-button').classList.contains('playing')")
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false})")
    assert 'Paused while away' in page.locator('#audio-status').inner_text()
    assert not page.locator('.current').count()
    page.locator('#load-button').click();page.locator('.delete-project').click();page.locator('#confirm-yes').click()
    assert page.locator('.saved-row').count()==0
    page.locator('#load-dialog .close-dialog').click()
    # Storage errors are visible and must not be reported as a successful save.
    page.evaluate("() => { Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')}; }")
    page.locator('#save-button').click();assert 'Could not save' in page.locator('#toast').inner_text()
    page.reload();page.screenshot(path='/workspace/beat-lab/desktop.png',full_page=True)
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
    phone=mobile.new_page();phone.goto(URL)
    assert phone.evaluate('document.documentElement.scrollWidth<=innerWidth')
    phone.locator('#play-button').tap();phone.wait_for_function("document.querySelector('#play-button').classList.contains('playing')")
    phone.wait_for_timeout(200);phone.locator('#stop-button').tap()
    phone.locator('#drum-grid').evaluate('(el)=>el.parentElement.scrollLeft=el.scrollWidth')
    assert phone.locator('#drum-grid').evaluate('(el)=>el.parentElement.scrollLeft')>0
    phone.get_by_role('button',name='Kick, step 16',exact=True).tap()
    assert phone.get_by_role('button',name='Kick, step 16',exact=True).get_attribute('aria-pressed')=='true'
    phone.screenshot(path='/workspace/beat-lab/mobile.png',full_page=True)
    assert not errors,errors
    print(json.dumps({'desktop_and_mobile':'passed','real_audio_and_timing':audio,'console_errors':errors},indent=2))
    browser.close()
