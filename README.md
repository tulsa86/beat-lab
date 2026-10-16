# Beat Lab 1.0

A working, browser-only beat maker built with HTML, CSS, JavaScript, and Web Audio. No account, backend, sample library, API key, install, or build is needed. The starter project contains a playable drum, bass, and melody loop.

## Run locally

From this folder, run:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000**. Alternatively, with Node and Python installed, `npm start` runs the same server. Do not open `index.html` with a `file://` URL: JavaScript modules need an HTTP server.

To try it on an iPhone on your local Wi-Fi, open `http://YOUR-COMPUTER-LAN-IP:8000` in Safari. Allow your computer's firewall to accept the local server if necessary. On a hosted site, use HTTPS.

## Make your first beat

1. Tap **Play beat**. This tap also enables browser audio. Start with your device volume low, then adjust it comfortably.
2. Tap drum squares to add or remove hits. Tap a drum's name to hear that drum on its own. Each group of four steps is one beat; all 16 steps make one bar.
3. Pick a bass or melody note, then tap a step to put the note there. Tapping the same selected note on that step removes it; selecting another note and tapping replaces it. Note names include their octave, so C2 is lower than C4.
4. Change the tempo with + / − or type a number between 60 and 180. Change the key and scale to change the mood. Minor is moody, major is bright, and pentatonic has fewer notes to choose from. Bass and melody always use the same scale.
5. Use each instrument's slider to change its volume. The ♪ button mutes or unmutes that instrument. Clear empties only that instrument.
6. **Surprise me** creates another editable pattern while keeping your name, key, scale, tempo, volume, and mute settings. It replaces the current patterns, so save a favorite first.
7. Name your idea and **Save project**. **Load** lists saved projects. Saving a loaded project updates that saved project; a new project creates a separate entry. New project starts with empty patterns. Loading, importing, or starting a new project asks before replacing unsaved work.

Playback loops until stopped. Both transport buttons stop and return to step 1. Space starts or stops playback when you are not typing or using a dialog. Drum and note edits take effect as playback reaches them; notes already queued within the next 120 milliseconds can still sound.

On narrow screens, swipe each sequencer sideways to reach all 16 steps. The sound names stay visible. Note choices, playback controls, and instrument levels fit the screen.

## Saving and backups

Projects are saved to `localStorage` on the current browser and origin. They are **not** uploaded or shared across devices. Private browsing, storage restrictions, or clearing browser data can remove or prevent saves. The app reports storage errors instead of pretending a save succeeded.

In **Load**, use **Download project** to keep a JSON backup of the current pattern, or **Import project** to open one. Downloads contain editable musical data, not an audio recording. Invalid files are rejected before loading. Deleting an entry removes the saved copy after confirmation.

## Deploy to GitHub Pages

1. Create a GitHub repository, then upload the contents of this folder to its root. At minimum include `index.html`, `styles.css`, `app.js`, `audio.js`, `model.js`, and `.nojekyll`.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select your branch (usually `main`) and **/ (root)**, then Save.
4. Wait for GitHub's Pages deployment to finish, then open the URL shown in Settings. It usually looks like `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.
5. Tap Play on the published site and save a test project. Local-server projects and published-site projects have separate storage; use project download/import to transfer them.

All application paths are relative, so repository subpaths work without configuration. There is no build output to generate. GitHub hosting is not configured by this source bundle; these steps publish it under your own account.

## How the audio works

**The browser makes the sounds.** A kick is a low tone that quickly drops in pitch. A snare combines a short tone with filtered noise. The hi-hat is a very short burst of bright noise. The clap uses three tiny noise bursts with a fading tail. Bass uses a warm triangle wave, while melody combines a main sine tone and a quieter higher tone. Every sound fades in and out quickly to avoid abrupt clicks. No audio samples are fetched.

**One clock keeps everything together.** `AudioContext.currentTime` is the audio system's clock. The scheduler checks about every 25 milliseconds and places upcoming notes on that clock up to 120 milliseconds ahead. JavaScript wakes up to fill the queue; Web Audio plays the notes at their scheduled timestamps. A slow screen redraw therefore does not move each drum hit. At 108 BPM a quarter beat (one step) is `60 / 108 / 4` seconds. All instruments receive exactly the same timestamp for each step. Screen highlights follow that same clock using `requestAnimationFrame`.

**Sound starts with your tap.** The app creates or resumes its AudioContext from Play or a sound-preview interaction. This follows mobile browser autoplay rules. A generation counter prevents a slow audio startup from restarting playback after you have pressed Stop. If the browser suspends or interrupts audio, playback stops and tells you to tap Play again. Hiding the page also stops it, preventing background timer throttling from causing a burst of stale notes. Returning and tapping Play starts a clean loop from step 1. This version intentionally does not promise background playback.

**Each instrument has its own level.** Drums, bass, and melody connect through separate gain nodes, then through a master level and compressor to your speakers. Slider changes are smoothed to reduce clicks. Stopping cancels queued sound sources and clears both the scheduler and the visual queue. Finished voices disconnect themselves.

## Code structure and future features

- `model.js`: versioned project data, scale-safe note mapping, pattern generation, and strict import validation. It has no DOM or audio dependency.
- `audio.js`: synthesized voices, instrument channels, transport scheduling, lifecycle cleanup, and browser audio initialization. Voice methods accept audio-clock timestamps.
- `app.js`: editor interaction, project storage and backups, dialogs, mobile lifecycle, and playback display.
- `styles.css` and `index.html`: responsive, keyboard-accessible interface with semantic controls and explicit labels.

The voice methods can be reused by a future arrangement scheduler or an `OfflineAudioContext` WAV renderer. A recorder can tap the master bus; effects can be inserted between instrument gains and the master bus. Project `version: 1` allows future data migrations. Recording, effects, multi-bar arrangements, undo, and WAV export are not implemented in this release.

The optional Google Fonts stylesheet enhances typography; system fonts keep the app usable without it. There are no runtime JavaScript dependencies or external audio assets.

## Verification

With Node installed:

```sh
npm test
```

This validates starter projects, generated patterns in every scale, project round trips, and rejection of invalid imported data. No dependency installation is needed.

For browser integration checks, start the local server, then run:

```sh
python3 tests/browser_test.py
```

The browser test requires the Python `playwright` package and Chromium. Set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`; set `BEAT_LAB_URL` for another server. It checks real Web Audio offline rendering, shared-clock interval spacing and loop wrap, stop cleanup, drum and note edits, mute and volume, scale changes, tempo clamping, saving/reloading, and a 390px touch viewport. It writes desktop and mobile screenshots.

Manual iPhone Safari check:

- Open the page and confirm it stays silent before an interaction. Tap Play and hear all three instruments.
- Try 60, 108, and 180 BPM. Verify that the instruments loop together. Try wired headphones or the phone speaker; Bluetooth output can delay what you hear relative to the display.
- Swipe to step 16, change drum hits, choose notes, adjust volumes, and mute each track.
- Save a named beat, reload, and load it. Download and import a project backup.
- Switch apps, lock the phone, or take a call. Return to Safari and tap Play; confirm playback restarts cleanly.

Automated mobile viewport tests are not a substitute for testing on physical iPhone Safari. Browser audio policies and device output routing can differ. Use a current Safari, Chrome, Firefox, or Edge with Web Audio and native dialog support.
