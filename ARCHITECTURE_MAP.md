# DREAM BINDER — PREMIUM STUDIO / RESONANT DOORWAYS
## Architecture & installation map — first playable visual release

### What is in this package?

- `index.html` — complete, redesigned studio layout; retains the IDs of the previous application so existing DSP and preset handlers continue to work.
- `style.css` — full replacement premium theme; dark glass, gold/chrome highlights, violet/cyan accent, small-screen and Android-landscape breakpoints, accessible focus outlines and reduced-motion support.
- `app.js` — full existing synthesis engine/preset library/MIDI integration, with a new additive UI/Binding/keyboard-zone layer at the end.
- `assets/portal.svg` — self-contained celestial portal illustration used on the Synth home screen.
- `assets/realms/*.svg` — 13 individually themed illustrated Dream Atlas cards. No remote network images, fonts, videos, or JavaScript libraries.

### Install safely

1. Export personal presets with **Presets → My Presets → Export Backup** before replacing any files. Browser storage is local to the website origin.
2. Make a complete backup of your working version, especially `app.js`, `index.html`, `style.css` and `samples/`.
3. Replace **all three files** — `app.js`, `index.html`, and `style.css` — together. The new design requires its own CSS.
4. Copy the entire `assets/` folder into the same website folder as `index.html`.
5. **Keep your original `samples/C3 Ah.m4a` and any other samples unchanged.** This ZIP does not include third-party/user-supplied audio samples.
6. Publish through HTTPS (e.g. your existing GitHub Pages site) and refresh the page without an old cached stylesheet/script.
7. On Android Chrome with USB-C OTG, select MIDI → Enable MIDI → select the connected MPK mini. Web MIDI availability and power requirements depend on your actual phone/browser/controller; this release has not been tested with the physical device.

### Navigation map

```
DREAM BINDER / RESONANT DOORWAYS
│
├── SYNTH             Existing synthesizer controls and DSP
├── PIANO             Switch source to existing Piano engine
├── CHOIR             Switch source to existing Ah Choir engine
├── BINDINGS          Jump to Binding of Dreams A/B performance panel
└── DREAM ATLAS       Opens the preset browser in illustrated Realm View
    ├── 13 illustrated realms
    ├── 104 Dream Atlas factory patches
    ├── Instrument View (same patches; not duplicated as extra DSP)
    └── My Presets    Original local storage key retained

MAIN SCREEN
├── Celestial Gate      Visual home art; no continuous animation
├── Resonance Laboratory   Approximate live FFT spectrum when sound plays
├── Algebraic Geometry    Artistic Spec(R) geometry + valid prime ideal chain
├── Binding of Dreams  Two independently selected patch voices (V1)
├── Sound Modules      Oscillators, Wave Fusion, textures, FM, Rings, Krull,
│                      filters, ADSR, orbit, space, arp, master
├── MIDI Connection   Existing Web MIDI Note On/Off, CC64, panic
└── Keyboard          Existing touch keyboard and octave controls
```

### Mathematical visual language

The main display shows `R = ℝ[x₁,x₂,x₃]`, with the prime-ideal chain

`(0) ⊊ (x₁) ⊊ (x₁,x₂) ⊊ (x₁,x₂,x₃)`.

This is a valid prime ideal chain of length 3 in a polynomial ring over a field, reflecting Krull dimension 3. The elliptical orbits are **artistic representations** of layered algebraic geometry; they are not a literal rendering of the full prime spectrum `Spec(R)`. The existing synthesizer's Chebyshev/multivariate polynomial waveshaping engine is preserved.

### Binding of Dreams V1 — how it actually works

- **Single:** Entirely original play behavior. The A/B layer system is bypassed.
- **Bind:** Each played note creates a patch voice from Source A and a second patch voice from Source B. The two audio signals are mixed; the balance slider is an equal-power crossfade with headroom reduction. This is **audio layering**, not true spectral cross-synthesis or a new oscillator formed by multiplying two instruments.
- **Split:** The note number determines which source responds. Notes *below* the split point play A; notes **at and above** the split point play B. Both touch and incoming standard MIDI notes use the same routing. Default split: C4 (MIDI 60).
- Both A and B can load any existing factory/Atlas/user preset, or a captured snapshot of the currently selected sound. Their selections, mode, split point, balance, and captured snapshots are kept in a new local storage entry (`dreamBinderBindingsV1`). Existing personal preset storage (`dreamwellNamedPresets`) is untouched.
- `Low Bass Lead · Performance` and `Echo Drops Piano · Performance` are new **optional** A/B starting concepts, not modifications to any approved patches. Echo Drops includes its own small auxiliary repeating delay; the original Piano engine is not altered.
- New synth voices are constructed through the existing `createNote()` engine. Piano through `createPianoNote()`. Choir through `createChoirNote()` after the existing sample loads. Binding voices run through level control and the original master limiter.
- The custom layer engine adopts *note-on* patch parameters. Common global effects remain shared. Live modulation UI is not fully independent for the two layers in this first version.
- Existing Piano envelopes/tails and Choir release rules remain unchanged. When Piano notes are released, the natural tail plays; when switching mode, the existing cleanup methods stop active voices.
- Mobile conservatively limits Binding polyphony: Android 3 held keys when layered, 5 in split; desktop 5 when layered, 8 in split. This protects the phone from unnecessary CPU load while each Synth note can allocate many oscillators and modulation nodes.
- Existing MIDI and arpeggiator paths remain available in Single mode. **Binding/Split deliberately bypass the current arpeggiator/latch behavior** when they are active; per-layer arpeggiator sequencing is a later integration stage.

### Realistic limitations of this release

- No full independent engine instance per layer, no per-layer FX rack (apart from the optional Echo Drops delay), no true spectral fusion/cross-synthesis, no split transition smoothing, no saved 'hybrid preset' inside the personal preset browser, no on-device per-layer DSP profiling.
- Keyboard velocity, programmable MIDI Learn, pitch bend joystick, aftertouch and per-pad custom mapping are *not* introduced in this styling/binding release. The previous note/sustain MIDI foundation is preserved.
- Dream Atlas illustrations are static lightweight SVG files. Card hover transitions exist; continuous 2-second video loops are not introduced in this release. This protects the Android audio thread and battery. Future two-second motion assets can be loaded on demand for the selected realm.
- The gallery's presets are factory parameters. Only listening tests on your audio hardware can determine whether the combinations sound artistically right; mathematical frequency components alone do not establish timbral quality.

### Development test record

- JavaScript source passes `node --check`.
- Chromium smoke test using inlined project files found no JavaScript runtime errors while opening Atlas, selecting a realm, loading 104 patches, selecting modes, and starting/releasing simulated notes.
- Browser test confirms 13 realm cards, 104 Atlas patches, 8 patches when filtering House of Memories, and no document-level horizontal overflow at 1440×900, 920×440, 420×860 test viewports.
- Additional playback test: in Split mode low A2 (110 Hz) routes to Synth and A4 (440 Hz) routes to Piano; Bind mode triggers both on the same key. This was a programmatic signal-path test, **not** an auditory review.
- USB MIDI handshake, actual Android OTG performance, audio quality at high polyphony and sample loading on the user's published website remain unverified.

### Development roadmap after your audition

1. Refine premium look, spacing, typography, animation amount, and mobile navigation.
2. Validate Binding/Split on the REDMAGIC + first-generation MPK mini over USB-C OTG.
3. Extract independent parameter state/FX buses for A/B so all live controls can act on each layer without temporary parameter swapping.
4. Add project-level hybrid bindings, one-click save/recall, and more advanced spectral blend modes.
5. Add MIDI Learn, velocity, knob mapping, pitch bend, modulation thumbstick and pads — one tested MIDI feature at a time.
6. Make selected Realm cards animate for a *single* two-second transition (lazy-loaded, low-frame-count or CSS; obey reduced motion).

### Suggested Git commit message

`feat(ui): premium Dream Binder studio with illustrated Dream Atlas and Binding/Split v1`
