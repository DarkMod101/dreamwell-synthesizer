let audioContext;
let masterGain;
let reverbNode;
let reverbWetGain;
let dryGain;
let delayNode;
let delayFeedbackGain;
let delayWetGain;
let delayDryGain;

const activeNotes = new Map();
const activeTouchKeys = new Map();

const waveformSelect = document.getElementById("waveform");
const waveformBSelect = document.getElementById("waveformB");
const subWaveformSelect =
document.getElementById("subWaveform");
const oscBLevelSlider = document.getElementById("oscBLevel");
const oscBDetuneSlider = document.getElementById("oscBDetune");
const subLevelSlider =
document.getElementById("subLevel");
const masterVolume = document.getElementById("masterVolume");
const keys = document.querySelectorAll(".key");

const octaveDownButton = document.getElementById("octaveDown");
const octaveUpButton = document.getElementById("octaveUp");
const octaveDisplay = document.getElementById("octaveDisplay");
let octaveShift = 0;

const attackSlider = document.getElementById("attack");
const decaySlider = document.getElementById("decay");
const sustainSlider = document.getElementById("sustain");
const releaseSlider = document.getElementById("release");

const filterTypeSelect = document.getElementById("filterType");
const cutoffSlider = document.getElementById("cutoff");
const resonanceSlider = document.getElementById("resonance");

const lfoRateSlider = document.getElementById("lfoRate");
const lfoAmountSlider = document.getElementById("lfoAmount");
const lfoDestinationSelect = document.getElementById("lfoDestination");

const driftSlider = document.getElementById("drift");
const stereoWidthSlider =
  document.getElementById("stereoWidth");
const voiceSpreadSlider =
    document.getElementById("voiceSpread");
const noiseAmountSlider =
    document.getElementById("noiseAmount");
const driftValue = document.getElementById("driftValue");

const reverbMixSlider = document.getElementById("reverbMix");
const reverbDecaySlider = document.getElementById("reverbDecay");

const delayMixSlider = document.getElementById("delayMix");
const delayTimeSlider = document.getElementById("delayTime");
const delayFeedbackSlider = document.getElementById("delayFeedback");

const saveUserPresetButton = document.getElementById("saveUserPreset");
const loadUserPresetButton = document.getElementById("loadUserPreset");
const presetMessage = document.getElementById("presetMessage");

const presetGrid = document.getElementById("presetGrid");
const bankButtons = document.querySelectorAll(".bank-btn");

const valueDisplays = {
  oscBLevel: document.getElementById("oscBLevelValue"),
  oscBDetune: document.getElementById("oscBDetuneValue"),
  attack: document.getElementById("attackValue"),
  decay: document.getElementById("decayValue"),
  sustain: document.getElementById("sustainValue"),
  release: document.getElementById("releaseValue"),
  cutoff: document.getElementById("cutoffValue"),
  resonance: document.getElementById("resonanceValue"),
  lfoRate: document.getElementById("lfoRateValue"),
  lfoAmount: document.getElementById("lfoAmountValue"),
  drift: document.getElementById("driftValue"),
  stereoWidth:
  document.getElementById("stereoWidthValue"),
  voiceSpread:
    document.getElementById("voiceSpreadValue"),
  noiseAmount:
    document.getElementById("noiseAmountValue"),
  subLevel:
document.getElementById("subLevelValue")
  reverbMix: document.getElementById("reverbMixValue"),
  reverbDecay: document.getElementById("reverbDecayValue"),
  delayMix: document.getElementById("delayMixValue"),
  delayTime: document.getElementById("delayTimeValue"),
  delayFeedback: document.getElementById("delayFeedbackValue"),
  masterVolume: document.getElementById("masterVolumeValue"),
};

function getValue(element, fallback) {
  return element ? Number(element.value) : fallback;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function seconds(value) {
  return `${Number(value).toFixed(2)} s`;
}

function hz(value) {
  return `${Math.round(value)} Hz`;
}

function qValue(value) {
  return `Q ${Number(value).toFixed(1)}`;
}

function cents(value) {
  const number = Number(value);
  return `${number >= 0 ? "+" : ""}${number} cents`;
}

function milliseconds(value) {
  return `${Math.round(value * 1000)} ms`;
}

function createNoiseBuffer(ctx) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

function setDisplay(display, text) {
  if (display) display.textContent = text;
}

function updateValueDisplays() {
  setDisplay(valueDisplays.oscBLevel, percent(getValue(oscBLevelSlider, 0.35)));
  setDisplay(valueDisplays.oscBDetune, cents(getValue(oscBDetuneSlider, 7)));
  setDisplay(valueDisplays.attack, seconds(getValue(attackSlider, 0.05)));
  setDisplay(valueDisplays.decay, seconds(getValue(decaySlider, 0.2)));
  setDisplay(valueDisplays.sustain, percent(getValue(sustainSlider, 0.7)));
  setDisplay(valueDisplays.release, seconds(getValue(releaseSlider, 0.5)));
  setDisplay(valueDisplays.cutoff, hz(getValue(cutoffSlider, 4000)));
  setDisplay(valueDisplays.resonance, qValue(getValue(resonanceSlider, 1)));
  setDisplay(valueDisplays.lfoRate, `${getValue(lfoRateSlider, 2).toFixed(1)} Hz`);
  setDisplay(valueDisplays.lfoAmount, `${Math.round(getValue(lfoAmountSlider, 0))}`);
  setDisplay(valueDisplays.drift, `${getValue(driftSlider, 0).toFixed(1)}`);
  setDisplay(
  valueDisplays.stereoWidth,
  `${Math.round(getValue(stereoWidthSlider, 0))}%`
);
  setDisplay(
    valueDisplays.voiceSpread,
    `${Math.round(getValue(voiceSpreadSlider, 0))}%`
);
  setDisplay(
    valueDisplays.noiseAmount,
    `${Math.round(getValue(noiseAmountSlider, 0))}%`
);
  setDisplay(valueDisplays.reverbMix, percent(getValue(reverbMixSlider, 0.25)));
  setDisplay(valueDisplays.reverbDecay, seconds(getValue(reverbDecaySlider, 3)));
  setDisplay(valueDisplays.delayMix, percent(getValue(delayMixSlider, 0.55)));
  setDisplay(valueDisplays.delayTime, milliseconds(getValue(delayTimeSlider, 0.55)));
  setDisplay(valueDisplays.delayFeedback, percent(getValue(delayFeedbackSlider, 0.55)));
  setDisplay(valueDisplays.masterVolume, percent(getValue(masterVolume, 0.25)));
}

function createReverbImpulse(ctx, decayTime) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * decayTime;
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const fade = Math.pow(1 - i / length, 2);
      data[i] = (Math.random() * 2 - 1) * fade;
    }
  }

  return impulse;
}

function setupReverb(ctx) {
  reverbNode = ctx.createConvolver();
  reverbWetGain = ctx.createGain();
  dryGain = ctx.createGain();

  const mix = getValue(reverbMixSlider, 0.25);
  const decay = getValue(reverbDecaySlider, 3);

  reverbNode.buffer = createReverbImpulse(ctx, decay);
  dryGain.gain.value = 1 - mix;
  reverbWetGain.gain.value = mix;

  reverbNode.connect(reverbWetGain);
  reverbWetGain.connect(masterGain);
  dryGain.connect(masterGain);
}

function setupDelay(ctx) {
  delayNode = ctx.createDelay(2.0);
  delayFeedbackGain = ctx.createGain();
  delayWetGain = ctx.createGain();
  delayDryGain = ctx.createGain();

  const mix = getValue(delayMixSlider, 0.55);

  delayNode.delayTime.value = getValue(delayTimeSlider, 0.55);
  delayFeedbackGain.gain.value = getValue(delayFeedbackSlider, 0.55);

  delayDryGain.gain.value = 1 - mix;
  delayWetGain.gain.value = mix;

  delayNode.connect(delayFeedbackGain);
  delayFeedbackGain.connect(delayNode);
  delayNode.connect(delayWetGain);
  delayWetGain.connect(masterGain);
  delayDryGain.connect(masterGain);
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();

    masterGain = audioContext.createGain();
    masterGain.gain.value = getValue(masterVolume, 0.25);
    masterGain.connect(audioContext.destination);

    setupReverb(audioContext);
    setupDelay(audioContext);
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function createLFO(ctx, oscillatorA, oscillatorB, filter, noteGain) {
  const lfoAmount = getValue(lfoAmountSlider, 0);

  if (lfoAmount <= 0 || !lfoRateSlider || !lfoDestinationSelect) return null;

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  lfo.frequency.value = getValue(lfoRateSlider, 2);

  if (lfoDestinationSelect.value === "filter") {
    lfoGain.gain.value = lfoAmount;
    lfoGain.connect(filter.frequency);
  }

  if (lfoDestinationSelect.value === "pitch") {
    lfoGain.gain.value = lfoAmount;
    lfoGain.connect(oscillatorA.frequency);
    lfoGain.connect(oscillatorB.frequency);
  }

  if (lfoDestinationSelect.value === "volume") {
    lfoGain.gain.value = lfoAmount / 2000;
    lfoGain.connect(noteGain.gain);
  }

  lfo.connect(lfoGain);
  lfo.start();

  return { lfo, lfoGain };
}

function createNote(frequency) {
  const ctx = getAudioContext();

  const attack = getValue(attackSlider, 0.05);
  const decay = getValue(decaySlider, 0.2);
  const sustain = getValue(sustainSlider, 0.7);

  const oscillatorA = ctx.createOscillator();
const oscillatorB = ctx.createOscillator();
const oscAGain = ctx.createGain();
const oscBGain = ctx.createGain();
const filter = ctx.createBiquadFilter();
const noteGain = ctx.createGain();
const stereoPanner = ctx.createStereoPanner();
  const noiseSource = ctx.createBufferSource();
const noiseGain = ctx.createGain();
stereoPanner.pan.value = (Math.random() * 2 - 1) * (getValue(stereoWidthSlider, 0) / 100);
  
const driftAmount = getValue(driftSlider, 0);
const driftCents = (Math.random() * 2 - 1) * driftAmount * 0.6;

const voiceSpread = getValue(voiceSpreadSlider, 0);
const spreadCents = voiceSpread * 0.35;
const unisonOscillators = [];
  
  oscillatorA.type = waveformSelect ? waveformSelect.value : "sine";
  oscillatorA.frequency.value = frequency;
oscillatorA.detune.value = driftCents;
  oscillatorB.type = waveformBSelect ? waveformBSelect.value : "sawtooth";
  oscillatorB.frequency.value = frequency;
oscillatorB.detune.value =
  getValue(oscBDetuneSlider, 7) - driftCents;

  oscAGain.gain.value = 0.65;
  oscBGain.gain.value = getValue(oscBLevelSlider, 0.35);

  filter.type = filterTypeSelect ? filterTypeSelect.value : "lowpass";
  filter.frequency.value = getValue(cutoffSlider, 4000);
  filter.Q.value = getValue(resonanceSlider, 1);

  const noiseAmount = getValue(noiseAmountSlider, 0);

noiseSource.buffer = createNoiseBuffer(ctx);
noiseSource.loop = true;

noiseGain.gain.value =
  (noiseAmount / 100) * 0.25;
  
if (voiceSpread > 0) {
  const unisonLevel = (voiceSpread / 100) * 0.08;

  function addUnisonOscillator(type, detune) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    gain.gain.value = unisonLevel;

    osc.connect(gain);
    gain.connect(filter);
    osc.start();

    unisonOscillators.push({ osc, gain });
  }

  addUnisonOscillator(oscillatorA.type, driftCents - spreadCents);
  addUnisonOscillator(oscillatorA.type, driftCents + spreadCents);

  addUnisonOscillator(
    oscillatorB.type,
    getValue(oscBDetuneSlider, 7) - driftCents - spreadCents
  );

  addUnisonOscillator(
    oscillatorB.type,
    getValue(oscBDetuneSlider, 7) - driftCents + spreadCents
  );
}
  
  noteGain.gain.setValueAtTime(0.001, ctx.currentTime);
  noteGain.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + attack);
  noteGain.gain.linearRampToValueAtTime(
    sustain * 0.8,
    ctx.currentTime + attack + decay
  );

  const lfoNodes = createLFO(ctx, oscillatorA, oscillatorB, filter, noteGain);

  oscillatorA.connect(oscAGain);
  oscillatorB.connect(oscBGain);
  oscAGain.connect(filter);
  oscBGain.connect(filter);
  noiseSource.connect(noiseGain);
noiseGain.connect(noteGain);
  filter.connect(noteGain);

noteGain.connect(stereoPanner);

stereoPanner.connect(dryGain);
stereoPanner.connect(reverbNode);
stereoPanner.connect(delayDryGain);
stereoPanner.connect(delayNode);

  oscillatorA.start();
  oscillatorB.start();
  noiseSource.start();
  return { oscillatorA, oscillatorB, noteGain, lfoNodes,
  noiseSource,
  noiseGain, };
}

function playNote(frequency) {
  if (activeNotes.size >= 6) return;
  const noteId = String(frequency);
  if (activeNotes.has(noteId)) return;

  const note = createNote(frequency);
  activeNotes.set(noteId, note);
}

function stopNote(frequency) {
  const noteId = String(frequency);
  const note = activeNotes.get(noteId);

  if (!note) return;

  const ctx = getAudioContext();
  const release = getValue(releaseSlider, 0.5);

  note.noteGain.gain.cancelScheduledValues(ctx.currentTime);
  note.noteGain.gain.setValueAtTime(note.noteGain.gain.value, ctx.currentTime);
  note.noteGain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + release
  );

  note.oscillatorA.stop(ctx.currentTime + release + 0.05);
  note.oscillatorB.stop(ctx.currentTime + release + 0.05);

if (note.noiseSource) {
  note.noiseSource.stop(ctx.currentTime + release + 0.05);
  note.noiseSource.disconnect();
  note.noiseGain.disconnect();
}
  
  if (note.lfoNodes) {
    note.lfoNodes.lfo.stop(ctx.currentTime + release + 0.05);
    note.lfoNodes.lfo.disconnect();
    note.lfoNodes.lfoGain.disconnect();
  }

  activeNotes.delete(noteId);
}

function stopAllNotes() {
  activeNotes.forEach((note, noteId) => {
    stopNote(Number(noteId));
  });
}

function updateKeyboardOctave() {
  keys.forEach((key) => {
    const baseFrequency = Number(key.dataset.note);
    const shiftedFrequency = baseFrequency * Math.pow(2, octaveShift);
    key.dataset.currentNote = shiftedFrequency.toFixed(2);
  });

  if (octaveDisplay) {
    octaveDisplay.textContent =
      `Shift: ${octaveShift > 0 ? "+" : ""}${octaveShift}`;
  }

  stopAllNotes();
}

function getKeyFrequency(key) {
  return Number(key.dataset.currentNote || key.dataset.note);
}

function getKeyFromPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  return element && element.classList.contains("key") ? element : null;
}

function startTouchNote(touch) {
  const key = getKeyFromPoint(touch.clientX, touch.clientY);
  if (!key) return;

  activeTouchKeys.set(touch.identifier, key);
  playNote(getKeyFrequency(key));
}

function moveTouchNote(touch) {
  const oldKey = activeTouchKeys.get(touch.identifier);
  const newKey = getKeyFromPoint(touch.clientX, touch.clientY);

  if (!newKey || newKey === oldKey) return;

  if (oldKey) stopNote(getKeyFrequency(oldKey));

  activeTouchKeys.set(touch.identifier, newKey);
  playNote(getKeyFrequency(newKey));
}

function stopTouchNote(touch) {
  const key = activeTouchKeys.get(touch.identifier);
  if (!key) return;

  stopNote(getKeyFrequency(key));
  activeTouchKeys.delete(touch.identifier);
}

function bindSlider(slider, callback) {
  if (!slider) return;

  slider.addEventListener("input", () => {
    updateValueDisplays();
    if (callback) callback();
  });
}

bindSlider(masterVolume, () => {
  const ctx = getAudioContext();
  masterGain.gain.setTargetAtTime(Number(masterVolume.value), ctx.currentTime, 0.01);
});

bindSlider(reverbMixSlider, () => {
  const ctx = getAudioContext();
  const mix = Number(reverbMixSlider.value);
  dryGain.gain.setTargetAtTime(1 - mix, ctx.currentTime, 0.01);
  reverbWetGain.gain.setTargetAtTime(mix, ctx.currentTime, 0.01);
});

bindSlider(reverbDecaySlider, () => {
  const ctx = getAudioContext();
  reverbNode.buffer = createReverbImpulse(ctx, Number(reverbDecaySlider.value));
});

bindSlider(delayMixSlider, () => {
  const ctx = getAudioContext();
  const mix = Number(delayMixSlider.value);
  delayDryGain.gain.setTargetAtTime(1 - mix, ctx.currentTime, 0.01);
  delayWetGain.gain.setTargetAtTime(mix, ctx.currentTime, 0.01);
});

bindSlider(delayTimeSlider, () => {
  const ctx = getAudioContext();
  delayNode.delayTime.setTargetAtTime(Number(delayTimeSlider.value), ctx.currentTime, 0.01);
});

bindSlider(delayFeedbackSlider, () => {
  const ctx = getAudioContext();
  delayFeedbackGain.gain.setTargetAtTime(
    Number(delayFeedbackSlider.value),
    ctx.currentTime,
    0.01
  );
});

[
  oscBLevelSlider,
  oscBDetuneSlider,
  attackSlider,
  decaySlider,
  sustainSlider,
  releaseSlider,
  cutoffSlider,
  resonanceSlider,
  lfoRateSlider,
  lfoAmountSlider,
  driftSlider,
  stereoWidthSlider,
  voiceSpreadSlider,
  noiseAmountSlider,
].forEach((slider) => bindSlider(slider));

if (voiceSpreadSlider) {
  voiceSpreadSlider.addEventListener("input", updateValueDisplays);
}

const presetBanks = {
  signature: {
    dreamPad: {
      name: "Dream Pad",
      settings: {
        waveform: "sine",
        waveformB: "triangle",
        oscBLevel: 0.3,
        oscBDetune: 5,
        voiceSpread: 40,
        attack: 1.8,
        decay: 1.2,
        sustain: 0.8,
        release: 3.5,
        filterType: "lowpass",
        cutoff: 1800,
        resonance: 2,
        lfoRate: 0.4,
        lfoAmount: 150,
        lfoDestination: "filter",
        reverbMix: 0.65,
        reverbDecay: 5,
        delayMix: 0.25,
        delayTime: 0.45,
        delayFeedback: 0.35,
        masterVolume: 0.2,
      },
    },
   
    theWell: {
      name: "The Well",
      settings: {
        waveform: "triangle",
        waveformB: "sine",
        oscBLevel: 0.4,
        oscBDetune: -7,
        voiceSpread: 40,
        attack: 0.8,
        decay: 1,
        sustain: 0.7,
        release: 4,
        filterType: "lowpass",
        cutoff: 1200,
        resonance: 4,
        lfoRate: 0.3,
        lfoAmount: 250,
        lfoDestination: "filter",
        reverbMix: 0.8,
        reverbDecay: 6,
        delayMix: 0.4,
        delayTime: 0.55,
        delayFeedback: 0.4,
        masterVolume: 0.18,
      },
    },
   
    abyss: {
      name: "Abyss",
      settings: {
        waveform: "sawtooth",
        waveformB: "sawtooth",
        oscBLevel: 0.25,
        oscBDetune: 12,
        voiceSpread: 40,
        attack: 0.05,
        decay: 0.5,
        sustain: 0.6,
        release: 2.5,
        filterType: "lowpass",
        cutoff: 700,
        resonance: 7,
        lfoRate: 0.2,
        lfoAmount: 400,
        lfoDestination: "filter",
        reverbMix: 0.7,
        reverbDecay: 5.5,
        delayMix: 0.5,
        delayTime: 0.65,
        delayFeedback: 0.5,
        masterVolume: 0.16,
      },
    },
   
    resonantDoorway: {
      name: "Resonant Doorway",
      settings: {
        waveform: "triangle",
        waveformB: "sawtooth",
        oscBLevel: 0.35,
        oscBDetune: 7,
        voiceSpread: 40,
        attack: 0.2,
        decay: 0.8,
        sustain: 0.8,
        release: 2,
        filterType: "lowpass",
        cutoff: 2500,
        resonance: 5,
        lfoRate: 2,
        lfoAmount: 200,
        lfoDestination: "filter",
        reverbMix: 0.55,
        reverbDecay: 4,
        delayMix: 0.3,
        delayTime: 0.38,
        delayFeedback: 0.35,
        masterVolume: 0.2,
      },
    },
  
    falling: {
      name: "Falling",
      settings: {
        waveform: "sine",
        waveformB: "triangle",
        oscBLevel: 0.45,
        oscBDetune: -12,
        voiceSpread: 40,
        attack: 3,
        decay: 2,
        sustain: 0.5,
        release: 5,
        filterType: "lowpass",
        cutoff: 900,
        resonance: 3,
        lfoRate: 0.1,
        lfoAmount: 500,
        lfoDestination: "filter",
        reverbMix: 0.9,
        reverbDecay: 7,
        delayMix: 0.45,
        delayTime: 0.75,
        delayFeedback: 0.45,
        masterVolume: 0.15,
      },
    },

    voidGate: {
      name: "Void Gate",
      settings: {
        waveform: "sawtooth",
        waveformB: "triangle",
        oscBLevel: 0.28,
        oscBDetune: -9,
        voiceSpread: 40,
        attack: 2.5,
        decay: 1.8,
        sustain: 0.75,
        release: 5.5,
        filterType: "lowpass",
        cutoff: 650,
        resonance: 6,
        lfoRate: 0.15,
        lfoAmount: 450,
        lfoDestination: "filter",
        reverbMix: 0.88,
        reverbDecay: 7,
        delayMix: 0.42,
        delayTime: 0.68,
        delayFeedback: 0.48,
        masterVolume: 0.16,
      },
    },

    astralPiano: {
      name: "Astral Piano",
      settings: {
        waveform: "triangle",
        waveformB: "sine",
        oscBLevel: 0.22,
        oscBDetune: 4,
        voiceSpread: 40,
        attack: 0.03,
        decay: 1.4,
        sustain: 0.35,
        release: 2.8,
        filterType: "lowpass",
        cutoff: 3200,
        resonance: 2,
        lfoRate: 0.25,
        lfoAmount: 80,
        lfoDestination: "filter",
        reverbMix: 0.7,
        reverbDecay: 5,
        delayMix: 0.32,
        delayTime: 0.42,
        delayFeedback: 0.28,
        masterVolume: 0.2,
      },
    },

    portalKey: {
      name: "Portal Key",
      settings: {
        waveform: "square",
        waveformB: "triangle",
        oscBLevel: 0.3,
        oscBDetune: 7,
        voiceSpread: 40,
        attack: 0.08,
        decay: 0.9,
        sustain: 0.55,
        release: 2.2,
        filterType: "lowpass",
        cutoff: 2100,
        resonance: 5,
        lfoRate: 1.2,
        lfoAmount: 180,
        lfoDestination: "filter",
        reverbMix: 0.62,
        reverbDecay: 4.5,
        delayMix: 0.45,
        delayTime: 0.5,
        delayFeedback: 0.4,
        masterVolume: 0.18,
      },
    },

    cathedral: {
      name: "Cathedral",
      settings: {
        waveform: "sine",
        waveformB: "triangle",
        oscBLevel: 0.35,
        oscBDetune: -5,
        voiceSpread: 40,
        attack: 2.2,
        decay: 2,
        sustain: 0.85,
        release: 6,
        filterType: "lowpass",
        cutoff: 1400,
        resonance: 3,
        lfoRate: 0.18,
        lfoAmount: 220,
        lfoDestination: "filter",
        reverbMix: 0.95,
        reverbDecay: 8,
        delayMix: 0.28,
        delayTime: 0.6,
        delayFeedback: 0.32,
        masterVolume: 0.17,
      },
    },

    ancientMachine: {
      name: "Ancient Machine",
      settings: {
        waveform: "sawtooth",
        waveformB: "square",
        oscBLevel: 0.32,
        oscBDetune: 11,
        voiceSpread: 40,
        attack: 0.12,
        decay: 0.7,
        sustain: 0.65,
        release: 1.8,
        filterType: "lowpass",
        cutoff: 1800,
        resonance: 8,
        lfoRate: 3.5,
        lfoAmount: 260,
        lfoDestination: "filter",
        reverbMix: 0.55,
        reverbDecay: 4,
        delayMix: 0.5,
        delayTime: 0.33,
        delayFeedback: 0.55,
        masterVolume: 0.18,
      },
    },
  },

  keys: {},
  pads: {},
  leads: {},
  bass: {},
  textures: {},
};

function applyPresetSettings(preset) {
  if (!preset) return;

  waveformSelect.value = preset.waveform;
  waveformBSelect.value = preset.waveformB;
  oscBLevelSlider.value = preset.oscBLevel;
  oscBDetuneSlider.value = preset.oscBDetune;

  attackSlider.value = preset.attack;
  decaySlider.value = preset.decay;
  sustainSlider.value = preset.sustain;
  releaseSlider.value = preset.release;

  filterTypeSelect.value = preset.filterType;
  cutoffSlider.value = preset.cutoff;
  resonanceSlider.value = preset.resonance;

  lfoRateSlider.value = preset.lfoRate;
  lfoAmountSlider.value = preset.lfoAmount;
  lfoDestinationSelect.value = preset.lfoDestination;

voiceSpreadSlider.value = preset.voiceSpread || 0;
  
  reverbMixSlider.value = preset.reverbMix;
  reverbDecaySlider.value = preset.reverbDecay;

  delayMixSlider.value = preset.delayMix;
  delayTimeSlider.value = preset.delayTime;
  delayFeedbackSlider.value = preset.delayFeedback;

  masterVolume.value = preset.masterVolume;

  updateValueDisplays();
  stopAllNotes();
}

function renderPresetBank(bankName) {
  if (!presetGrid) return;

  const bank = presetBanks[bankName] || {};
  presetGrid.innerHTML = "";

  const presetEntries = Object.entries(bank);

  if (presetEntries.length === 0) {
    presetGrid.innerHTML = `<p class="preset-message">No presets in this bank yet.</p>`;
    return;
  }

  presetEntries.forEach(([presetId, presetData]) => {
    const button = document.createElement("button");
    button.className = "preset-btn";
    button.dataset.preset = presetId;
    button.textContent = presetData.name;

    button.addEventListener("click", () => {
      applyPresetSettings(presetData.settings);
    });

    presetGrid.appendChild(button);
  });
}

bankButtons.forEach((button) => {
  button.addEventListener("click", () => {
    bankButtons.forEach((btn) => btn.classList.remove("active-bank"));
    button.classList.add("active-bank");
    renderPresetBank(button.dataset.bank);
  });
});

function getCurrentPresetSettings() {
  return {
    waveform: waveformSelect.value,
    waveformB: waveformBSelect.value,
    oscBLevel: oscBLevelSlider.value,
    oscBDetune: oscBDetuneSlider.value,
    attack: attackSlider.value,
    decay: decaySlider.value,
    sustain: sustainSlider.value,
    release: releaseSlider.value,
    filterType: filterTypeSelect.value,
    cutoff: cutoffSlider.value,
    resonance: resonanceSlider.value,
    lfoRate: lfoRateSlider.value,
    lfoAmount: lfoAmountSlider.value,
    lfoDestination: lfoDestinationSelect.value,
    reverbMix: reverbMixSlider.value,
    reverbDecay: reverbDecaySlider.value,
    delayMix: delayMixSlider.value,
    delayTime: delayTimeSlider.value,
    delayFeedback: delayFeedbackSlider.value,
    masterVolume: masterVolume.value,
  };
}

if (saveUserPresetButton) {
  saveUserPresetButton.addEventListener("click", () => {
    localStorage.setItem(
      "dreamwellUserPreset",
      JSON.stringify(getCurrentPresetSettings())
    );

    if (presetMessage) presetMessage.textContent = "Preset saved.";
  });
}

if (loadUserPresetButton) {
  loadUserPresetButton.addEventListener("click", () => {
    const savedPreset = localStorage.getItem("dreamwellUserPreset");

    if (!savedPreset) {
      if (presetMessage) presetMessage.textContent = "No saved preset found.";
      return;
    }

    applyPresetSettings(JSON.parse(savedPreset));

    if (presetMessage) presetMessage.textContent = "Preset loaded.";
  });
}

keys.forEach((key) => {
  key.addEventListener("mousedown", () => {
    playNote(getKeyFrequency(key));
  });

  key.addEventListener("mouseup", () => {
    stopNote(getKeyFrequency(key));
  });

  key.addEventListener("mouseleave", () => {
    stopNote(getKeyFrequency(key));
  });
});

document.addEventListener(
  "touchstart",
  (event) => {
    let touchedKeyboard = false;

    Array.from(event.changedTouches).forEach((touch) => {
      const key = getKeyFromPoint(touch.clientX, touch.clientY);

      if (key) {
        touchedKeyboard = true;
        startTouchNote(touch);
      }
    });

    if (touchedKeyboard) event.preventDefault();
  },
  { passive: false }
);

document.addEventListener(
  "touchmove",
  (event) => {
    let movedOnKeyboard = false;

    Array.from(event.changedTouches).forEach((touch) => {
      if (activeTouchKeys.has(touch.identifier)) {
        movedOnKeyboard = true;
        moveTouchNote(touch);
      }
    });

    if (movedOnKeyboard) event.preventDefault();
  },
  { passive: false }
);

document.addEventListener(
  "touchend",
  (event) => {
    Array.from(event.changedTouches).forEach((touch) => {
      stopTouchNote(touch);
    });
  },
  { passive: false }
);

document.addEventListener(
  "touchcancel",
  (event) => {
    Array.from(event.changedTouches).forEach((touch) => {
      stopTouchNote(touch);
    });
  },
  { passive: false }
);

if (octaveDownButton) {
  octaveDownButton.addEventListener("click", () => {
    octaveShift = Math.max(octaveShift - 1, -2);
    updateKeyboardOctave();
  });
}

if (octaveUpButton) {
  octaveUpButton.addEventListener("click", () => {
    octaveShift = Math.min(octaveShift + 1, 2);
    updateKeyboardOctave();
  });
}

renderPresetBank("signature");
updateKeyboardOctave();
updateValueDisplays();
