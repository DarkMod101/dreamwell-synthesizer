let audioContext;
let masterGain;
let reverbNode;
let reverbWetGain;
let dryGain;
let delayNode;
let delayFeedbackGain;
let delayWetGain;
let delayDryGain;
// Living Environment Systems
let livingTexturesEnabled = true;


const activeNotes = new Map();
const activeTouchKeys = new Map();
let lastPlayedFrequency = null;
let waveFusionModulationTimer = null;
let trapezoidWave = null;

const waveformSelect = document.getElementById("waveform");
const waveformBSelect = document.getElementById("waveformB");
const originSelect = document.getElementById("origin");
const subWaveformSelect = document.getElementById("subWaveform");
const oscBLevelSlider = document.getElementById("oscBLevel");
const oscBDetuneSlider = document.getElementById("oscBDetune");
const subLevelSlider = document.getElementById("subLevel");
const masterVolume = document.getElementById("masterVolume");
const presenceSlider = document.getElementById("presence");

const presenceValue = document.getElementById("presenceValue");

const glideEnabledCheckbox = document.getElementById("glideEnabled");

const glideTimeSlider = document.getElementById("glideTime");

const glideTimeValue = document.getElementById("glideTimeValue");

const waveFusionSlider = document.getElementById("waveFusion");
const waveFusionValue = document.getElementById("waveFusionValue");
const waveFusionCurveSelect = document.getElementById("waveFusionCurve");
const dreamMorphMotionCheckbox = document.getElementById("dreamMorphMotion");

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
const noiseTypeSelect =
  document.getElementById("noiseType");
const noiseAmountSlider =
    document.getElementById("noiseAmount");
const deepDreamOrbitCheckbox =
  document.getElementById("deepDreamOrbit");
const driftValue = document.getElementById("driftValue");

const reverbMixSlider = document.getElementById("reverbMix");
const reverbDecaySlider = document.getElementById("reverbDecay");

const delayMixSlider = document.getElementById("delayMix");
const delayTimeSlider = document.getElementById("delayTime");
const delayFeedbackSlider = document.getElementById("delayFeedback");

const dreamArpEnabledCheckbox =
  document.getElementById("dreamArpEnabled");

const arpRateSlider =
  document.getElementById("arpRate");

const arpRateValue =
  document.getElementById("arpRateValue");

const arpGateSlider =
  document.getElementById("arpGate");

const arpGateValue =
  document.getElementById("arpGateValue");

const arpModeSelect =
  document.getElementById("arpMode");

const arpLatchCheckbox =
  document.getElementById("arpLatch");

let arpLatchEnabled = false;

let dreamArpEnabled = false;
let arpRate = 2;
let arpMode = "up";
let arpGate = 0.7;

const arpHeldNotes = new Set();
let arpTimer = null;
let arpStepIndex = 0;
let arpDirection = 1;
let arpPlayedOrder = [];
let arpActiveNote = null;
let arpGateTimer = null;

const arpRateLabels = {
  1: "1/4",
  2: "1/8",
  3: "1/16",
  4: "1/32"
};

const presetNameInput =
  document.getElementById("presetNameInput");

const saveNamedPresetButton =
  document.getElementById("saveNamedPreset");

const savedPresetSelect =
  document.getElementById("savedPresetSelect");

const prevPresetButton =
  document.getElementById("prevPreset");

const nextPresetButton =
  document.getElementById("nextPreset");

const loadNamedPresetButton =
  document.getElementById("loadNamedPreset");

const deleteNamedPresetButton =
  document.getElementById("deleteNamedPreset");
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
document.getElementById("subLevelValue"),
  reverbMix: document.getElementById("reverbMixValue"),
  reverbDecay: document.getElementById("reverbDecayValue"),
  delayMix: document.getElementById("delayMixValue"),
  delayTime: document.getElementById("delayTimeValue"),
  delayFeedback: document.getElementById("delayFeedbackValue"),
 glideTime: document.getElementById("glideTimeValue"),
  waveFusion: document.getElementById("waveFusionValue"),  
  masterVolume: document.getElementById("masterVolumeValue"),
  presence: document.getElementById("presenceValue"),  
};

function getValue(element, fallback) {
  return element ? Number(element.value) : fallback;
}

function applyWaveform(oscillator, waveform, ctx) {
  if (waveform === "trapezoid") {
    if (!trapezoidWave) {
      const real = new Float32Array([
        0,
        1.0,
        0,
        0.35,
        0,
        0.18,
        0,
        0.08
      ]);

      const imag = new Float32Array(real.length);

      trapezoidWave =
        ctx.createPeriodicWave(real, imag);
    }

    oscillator.setPeriodicWave(trapezoidWave);
    return;
  }

  oscillator.type = waveform;
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

function createNoiseBuffer(ctx, type = "white") {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let last = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    let sample = white;

    switch (type) {
      case "air":
        sample = white * 0.3;
        break;

      case "dark":
        last = last * 0.96 + white * 0.04;
        sample = last * 0.75;
        break;

      case "dust": {
        const sparkleChance = 0.992;
        const softBed = white * 0.015;

        if (Math.random() > sparkleChance) {
          sample = white * (0.45 + Math.random() * 0.45);
        } else {
          sample = softBed;
        }

        break;
      }

      case "machine": {
        last = last * 0.985 + white * 0.015;

        const rumble =
          Math.sin(i * 0.00055) * 0.12 +
          Math.sin(i * 0.00110) * 0.05;

        const ticks =
          Math.random() > 0.9985
            ? (Math.random() * 2 - 1) * 0.18
            : 0;

        sample = last * 0.45 + rumble + ticks;
        break;
      }

      case "cosmic": {
        last = last * 0.992 + white * 0.008;

        const deepDrift =
          Math.sin(i * 0.00018) * 0.12 +
          Math.sin(i * 0.00007) * 0.08;

        const distantSpark =
          Math.random() > 0.9975 ? white * 0.12 : 0;

        sample = last * 0.55 + deepDrift + distantSpark;
        break;
      }

      case "white":
      default:
        sample = white;
        break;
    }

    data[i] = sample;
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
  setDisplay(
  valueDisplays.subLevel,
  `${Math.round(getValue(subLevelSlider, 0))}%`
);
  setDisplay(valueDisplays.reverbMix, percent(getValue(reverbMixSlider, 0.25)));
  setDisplay(valueDisplays.reverbDecay, seconds(getValue(reverbDecaySlider, 3)));
  setDisplay(valueDisplays.delayMix, percent(getValue(delayMixSlider, 0.55)));
  setDisplay(valueDisplays.delayTime, milliseconds(getValue(delayTimeSlider, 0.55)));
  setDisplay(valueDisplays.delayFeedback, percent(getValue(delayFeedbackSlider, 0.55)));
 setDisplay(
    valueDisplays.glideTime,
    seconds(getValue(glideTimeSlider, 0.12))
);

setDisplay(
    valueDisplays.waveFusion,
    `${Math.round(getValue(waveFusionSlider, 50))}%`
);
    
setDisplay(
    valueDisplays.masterVolume,
    percent(getValue(masterVolume, 0.25))
);

setDisplay(
    valueDisplays.presence,
    `${Math.round(getValue(presenceSlider, 0))}%`
);
    
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
    // DreamWell Audio Protection
const masterLimiter = audioContext.createDynamicsCompressor();

masterLimiter.threshold.value = -8;
masterLimiter.knee.value = 12;
masterLimiter.ratio.value = 8;
masterLimiter.attack.value = 0.003;
masterLimiter.release.value = 0.25;

masterGain.connect(masterLimiter);
masterLimiter.connect(audioContext.destination);

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

function getOriginSettings(origin) {
  const settings = {
    driftBoost: 0,
    filterShift: 0,
    resonanceBoost: 0,
    oscBBoost: 0
  };

  if (origin === "vintage") {
    settings.driftBoost = 2;
    settings.filterShift = -300;
    settings.resonanceBoost = 0.5;
    settings.oscBBoost = 0.05;
  }

if (origin === "dream") {
  settings.driftBoost = 5;
  settings.filterShift = 250;
  settings.resonanceBoost = 0.2;
  settings.oscBBoost = 0.08;
}

if (origin === "glass") {
    settings.driftBoost = 0;
    settings.filterShift = 600;
    settings.resonanceBoost = 0.8;
    settings.oscBBoost = 0.12;
}

if (origin === "hollow") {
    settings.driftBoost = 2;
    settings.filterShift = -50;
    settings.resonanceBoost = 1.4;
    settings.oscBBoost = -0.05;
}

if (origin === "ancient") {
    settings.driftBoost = 3;
    settings.filterShift = -450;
    settings.resonanceBoost = 0.4;
    settings.oscBBoost = 0.10;
}

if (origin === "cosmic") {
    settings.driftBoost = 8;
    settings.filterShift = 500;
    settings.resonanceBoost = 0.15;
    settings.oscBBoost = 0.20;
}
  
  return settings;
}

function createLivingTextureMotion(ctx, textureType, noiseGain, filter, stereoPanner) {
  const motionNodes = [];

  function addLFO(rate, amount, destination, type = "sine") {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    lfo.type = type;
    lfo.frequency.value = rate;
    lfoGain.gain.value = amount;

    lfo.connect(lfoGain);
    lfoGain.connect(destination);
    lfo.start();

    motionNodes.push(lfo, lfoGain);
  }

function addOrbit(rate, amount, type = "sine") {
  if (!stereoPanner) return;

  const orbitLFO = ctx.createOscillator();
  const orbitGain = ctx.createGain();

  orbitLFO.type = type;
  orbitLFO.frequency.value = rate;
  orbitGain.gain.value = amount;

  orbitLFO.connect(orbitGain);
  orbitGain.connect(stereoPanner.pan);
  orbitLFO.start();

  motionNodes.push(orbitLFO, orbitGain);
}
  
  const baseNoiseGain = noiseGain.gain.value;

  if (baseNoiseGain <= 0) {
    return motionNodes;
  }

  if (textureType === "dust") {
    addLFO(0.18, baseNoiseGain * 0.35, noiseGain.gain);
    // Stardust orbit
 if (deepDreamOrbitCheckbox?.checked) {
  // Primary drift
addOrbit(0.035, 0.11);

// Secondary, slower drift
addOrbit(0.012, 0.05);
 }
    
}
  
  if (textureType === "cosmic") {
  // Slow breathing distance
  addLFO(0.05, baseNoiseGain * 0.45, noiseGain.gain);

  // Ultra-slow horizon drift
  addLFO(0.018, 180, filter.frequency);

  // Very subtle second movement so it feels less looped
  addLFO(0.011, baseNoiseGain * 0.18, noiseGain.gain);

    // Deep Dream Orbit
    if (deepDreamOrbitCheckbox?.checked) {
  // Cosmic Presence Drift
addOrbit(0.018, 0.11);
addOrbit(0.006, 0.055);
addOrbit(0.0025, 0.035);
    }
    
}
  
  if (textureType === "machine") {
  // Slow hidden mechanism pulse
  addLFO(0.09, baseNoiseGain * 0.38, noiseGain.gain, "triangle");

  // Resonant chamber movement
  addLFO(0.12, 140, filter.frequency, "triangle");

  // Second slower gear, slightly offset
  addLFO(0.037, baseNoiseGain * 0.25, noiseGain.gain, "sine");

  // Subtle ancient harmonic shift
  addLFO(0.021, 90, filter.frequency, "sine");

  // Deep Dream Orbit
  if (deepDreamOrbitCheckbox?.checked) {
  // Slow chamber rotation
addOrbit(0.012, 0.045);

// Deeper hidden mechanism drift
addOrbit(0.004, 0.02);
  }
    
}
  
  if (textureType === "air") {
  // Gentle breathing
  addLFO(0.11, baseNoiseGain * 0.25, noiseGain.gain);

  // Slow drifting current
  addLFO(0.065, 110, filter.frequency);

  // Secondary movement at a different speed
  addLFO(0.031, baseNoiseGain * 0.12, noiseGain.gain);

  // Almost imperceptible long swell
  addLFO(0.017, 45, filter.frequency);

    // Deep Dream Orbit
if (deepDreamOrbitCheckbox?.checked) {
  // Primary wind drift
addOrbit(0.028, 0.08);

// Secondary slow current
addOrbit(0.009, 0.035);
  
}
    
}
  
  if (textureType === "dark") {
    addLFO(0.045, baseNoiseGain * 0.3, noiseGain.gain);
    addLFO(0.035, 60, filter.frequency);
    // Deep Dream Orbit
if (deepDreamOrbitCheckbox?.checked) {
  // Subtle gravitational pull
addOrbit(0.009, 0.032);

// Almost imperceptible abyss drift
addOrbit(0.003, 0.014);
}
    
}
  return motionNodes;
}

function shapeWaveFusion(value, curve) {
    if (curve === "smooth") {
        return value * value * (3 - 2 * value);
    }

    if (curve === "deep") {
        return value * value;
    }

    if (curve === "bright") {
        return Math.sqrt(value);
    }

    return value;
}

function updateWaveFusionGains(
  ctx,
  oscAGain,
  oscBGain,
  presenceAmount = 0
) {
    const rawWaveFusion =
        getValue(waveFusionSlider, 50) / 100;

    const morphMotion =
        dreamMorphMotionCheckbox &&
        dreamMorphMotionCheckbox.checked;

    const morphDrift =
        morphMotion
            ? Math.sin(ctx.currentTime * 0.12) * 0.08
            : 0;

    const morphCurve =
        waveFusionCurveSelect
            ? waveFusionCurveSelect.value
            : "smooth";

    let waveFusion =
        Math.min(
            1,
            Math.max(
                0,
                rawWaveFusion + morphDrift
            )
        );
    
    waveFusion = shapeWaveFusion(waveFusion, morphCurve);

    const oscBLevel =
  getValue(oscBLevelSlider, 0.35) +
  presenceAmount * 0.35;
  
    const fusionA =
        Math.cos(waveFusion * Math.PI * 0.5);

    const fusionB =
        Math.sin(waveFusion * Math.PI * 0.5);

    oscAGain.gain.setTargetAtTime(
        0.65 * fusionA,
        ctx.currentTime,
        0.05
    );

    oscBGain.gain.setTargetAtTime(
        oscBLevel * fusionB,
        ctx.currentTime,
        0.05
    );
}

function startWaveFusionModulation() {
    if (waveFusionModulationTimer !== null) return;

    waveFusionModulationTimer = setInterval(() => {
        const ctx = getAudioContext();

        activeNotes.forEach((note) => {
            if (note.oscAGain && note.oscBGain) {
                updateWaveFusionGains(
                    ctx,
                    note.oscAGain,
                    note.oscBGain
                );
            }
        });

        if (activeNotes.size === 0) {
            clearInterval(waveFusionModulationTimer);
            waveFusionModulationTimer = null;
        }
    }, 80);
}

function createNote(frequency) {
  const ctx = getAudioContext();

  const attack = getValue(attackSlider, 0.05);
  const decay = getValue(decaySlider, 0.2);
  const sustain = getValue(sustainSlider, 0.7);

  const oscillatorA = ctx.createOscillator();
const oscillatorB = ctx.createOscillator();
  const subOscillator = ctx.createOscillator();

const subGain = ctx.createGain();  
const oscAGain = ctx.createGain();
const oscBGain = ctx.createGain();
  
const filter = ctx.createBiquadFilter();
const noteGain = ctx.createGain();
const stereoPanner = ctx.createStereoPanner();
  
  const noiseSource = ctx.createBufferSource();
const noiseGain = ctx.createGain();
stereoPanner.pan.value = (Math.random() * 2 - 1) * (getValue(stereoWidthSlider, 0) / 100);
  
const presenceAmount =
  getValue(presenceSlider, 0) / 100;

const originSettings = getOriginSettings(
  originSelect ? originSelect.value : "pure"
);

const driftAmount = getValue(driftSlider, 0) + originSettings.driftBoost;
const driftCents = (Math.random() * 2 - 1) * driftAmount * 0.6;
  
const voiceSpread =
  getValue(voiceSpreadSlider, 0) + presenceAmount * 70;

const spreadCents = voiceSpread * 0.35;
const unisonOscillators = [];
  
  const waveformA =
  waveformSelect ? waveformSelect.value : "sine";

const waveformB =
  waveformBSelect ? waveformBSelect.value : "sawtooth";

applyWaveform(oscillatorA, waveformA, ctx);
applyWaveform(oscillatorB, waveformB, ctx);

const glideEnabled =
  glideEnabledCheckbox && glideEnabledCheckbox.checked;

const glideTime =
  getValue(glideTimeSlider, 0.12);

const startFrequency =
  glideEnabled && lastPlayedFrequency
    ? lastPlayedFrequency
    : frequency;

oscillatorA.frequency.setValueAtTime(startFrequency, ctx.currentTime);
oscillatorA.frequency.exponentialRampToValueAtTime(
  frequency,
  ctx.currentTime + glideTime
);

oscillatorB.frequency.setValueAtTime(startFrequency, ctx.currentTime);
oscillatorB.frequency.exponentialRampToValueAtTime(
  frequency,
  ctx.currentTime + glideTime
);

oscillatorA.detune.value = driftCents;

oscillatorB.detune.value =
  getValue(oscBDetuneSlider, 7) - driftCents;

subOscillator.type =
    subWaveformSelect
        ? subWaveformSelect.value
        : "sine";

subOscillator.frequency.setValueAtTime(
    startFrequency / 2,
    ctx.currentTime
);

subOscillator.frequency.exponentialRampToValueAtTime(
    frequency / 2,
    ctx.currentTime + glideTime
);
  
  updateWaveFusionGains(ctx, oscAGain, oscBGain, presenceAmount);
    
subGain.gain.value =
  getValue(subLevelSlider, 0) / 100 * 0.35;
  
  filter.type = filterTypeSelect ? filterTypeSelect.value : "lowpass";
  const baseCutoff =
  getValue(cutoffSlider, 4000) +
  originSettings.filterShift;

filter.frequency.value =
  Math.max(0, baseCutoff) +
  (presenceAmount * 400);
  filter.Q.value =
  getValue(resonanceSlider, 1) +
  originSettings.resonanceBoost;

  const noiseAmount =
    getValue(noiseAmountSlider, 0) +
    presenceAmount * 0.05;

noiseSource.buffer = createNoiseBuffer(ctx, noiseTypeSelect ? noiseTypeSelect.value : "white");
noiseSource.loop = true;

noiseGain.gain.value =
  (noiseAmount / 100) * 0.08;
  
if (voiceSpread > 0) {
  const unisonLevel = (voiceSpread / 100) * 0.08;

  function addUnisonOscillator(type, detune) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    applyWaveform(osc, type, ctx);
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    gain.gain.value = unisonLevel;

    osc.connect(gain);
    gain.connect(filter);
    osc.start();

    unisonOscillators.push({ osc, gain });
  }

  addUnisonOscillator(waveformA, driftCents - spreadCents);
addUnisonOscillator(waveformA, driftCents + spreadCents);

addUnisonOscillator(
  waveformB,
  getValue(oscBDetuneSlider, 7) - driftCents - spreadCents
);

addUnisonOscillator(
  waveformB,
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
  subOscillator.connect(subGain);
  
  oscAGain.connect(filter);
  oscBGain.connect(filter);
  subGain.connect(filter);
  
  noiseSource.connect(noiseGain);
noiseGain.connect(filter);

// Living Texture Engine - Stardust Motion
const textureType =
  noiseTypeSelect ? noiseTypeSelect.value : "white";

const livingTextureNodes =
  createLivingTextureMotion(
    ctx,
    textureType,
    noiseGain,
    filter,
    stereoPanner
  );
  
filter.connect(noteGain);
noteGain.connect(stereoPanner);


stereoPanner.connect(dryGain);
stereoPanner.connect(reverbNode);
stereoPanner.connect(delayDryGain);
stereoPanner.connect(delayNode);

  oscillatorA.start();
  oscillatorB.start();
  subOscillator.start();
  noiseSource.start();
  return {
  oscillatorA,
  oscillatorB,
  oscAGain,
  oscBGain,
  noteGain,
  lfoNodes,
  noiseSource,
  noiseGain,
  subOscillator,
  subGain,
  livingTextureNodes,
  unisonOscillators,
};
}
    
function playNote(frequency) {
  const noteId = String(frequency);

  if (activeNotes.has(noteId)) {
    stopNote(frequency);
  }

  if (activeNotes.size >= 3) {
    const oldestNoteId = activeNotes.keys().next().value;
    stopNote(Number(oldestNoteId));
  }

  const note = createNote(frequency);
  activeNotes.set(noteId, note);
  lastPlayedFrequency = frequency;
  startWaveFusionModulation();  
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

if (note.subOscillator) {
  note.subOscillator.stop(ctx.currentTime + release + 0.05);
  note.subOscillator.disconnect();
  note.subGain.disconnect();
}
  
if (note.noiseSource) {
  if (note.noiseSource.textureLFO) {
    note.noiseSource.textureLFO.stop(ctx.currentTime + release + 0.05);
    note.noiseSource.textureLFO.disconnect();
    note.noiseSource.textureLFOGain.disconnect();
  }

  note.noiseSource.stop(ctx.currentTime + release + 0.05);
  note.noiseSource.disconnect();
  note.noiseGain.disconnect();
}
  
  if (note.lfoNodes) {
    note.lfoNodes.lfo.stop(ctx.currentTime + release + 0.05);
    note.lfoNodes.lfo.disconnect();
    note.lfoNodes.lfoGain.disconnect();
  }

if (note.livingTextureNodes) {
  note.livingTextureNodes.forEach((node) => {
    try {
      if (node.stop) {
        node.stop(ctx.currentTime + release + 0.05);
      }
      node.disconnect();
    } catch (error) {
      // Safe cleanup
    }
  });
}

if (note.unisonOscillators) {
  note.unisonOscillators.forEach(({ osc, gain }) => {
    try {
      osc.stop(ctx.currentTime + release + 0.05);
      osc.disconnect();
      gain.disconnect();
    } catch (error) {
      // Safe cleanup
    }
  });
}
  
  activeNotes.delete(noteId);
}

function stopAllNotes() {
  activeNotes.forEach((note, noteId) => {
    stopNote(Number(noteId));
  });
}

function getArpIntervalMs() {
  const rates = {
    1: 600,
    2: 300,
    3: 150,
    4: 75
  };

  return rates[arpRate] || 300;
}

function getArpNotes() {
  const notes = Array.from(arpHeldNotes).map(Number);

  if (arpMode === "asPlayed") {
    return arpPlayedOrder.filter((note) =>
      arpHeldNotes.has(String(note))
    );
  }

  return notes.sort((a, b) => a - b);
}

function playArpStep() {
  const notes = getArpNotes();

  if (!dreamArpEnabled || notes.length === 0) {
    stopDreamArp();
    return;
  }

  if (arpGateTimer) {
    clearTimeout(arpGateTimer);
    arpGateTimer = null;
  }

  if (arpActiveNote !== null) {
    stopNote(arpActiveNote);
    arpActiveNote = null;
  }

  let note;

if (arpMode === "down") {
  note = notes[(notes.length - 1) - (arpStepIndex % notes.length)];
  arpStepIndex++;
} else if (arpMode === "updown") {
  note = notes[arpStepIndex];

  arpStepIndex += arpDirection;

  if (arpStepIndex >= notes.length - 1) {
    arpDirection = -1;
  }

  if (arpStepIndex <= 0) {
    arpDirection = 1;
  }
} else if (arpMode === "random") {
  note = notes[Math.floor(Math.random() * notes.length)];
} else {
  note = notes[arpStepIndex % notes.length];
  arpStepIndex++;
}
  playNote(note);

  arpActiveNote = note;

  const gateDuration =
    getArpIntervalMs() * arpGate;

  arpGateTimer = setTimeout(() => {
    if (arpActiveNote !== null) {
      stopNote(arpActiveNote);
      arpActiveNote = null;
    }
  }, gateDuration);
}

  
function startDreamArp() {
  if (arpTimer) return;

  arpStepIndex = 0;
  playArpStep();

  arpTimer = setInterval(playArpStep, getArpIntervalMs());
}

function stopDreamArp() {
  if (arpTimer) {
    clearInterval(arpTimer);
    arpTimer = null;
  }

if (arpGateTimer) {
    clearTimeout(arpGateTimer);
    arpGateTimer = null;
}
  
  if (arpActiveNote !== null) {
    stopNote(arpActiveNote);
    arpActiveNote = null;
  }

  arpStepIndex = 0;
}

function setKeyActive(frequency, active) {
  keys.forEach((key) => {
    if (Number(key.dataset.currentNote) === Number(frequency)) {
      key.classList.toggle("key-active", active);
    }
  });
}

function setKeyLatched(frequency, latched) {
  keys.forEach((key) => {
    if (Number(key.dataset.currentNote) === Number(frequency)) {
      key.classList.toggle("key-latched", latched);
    }
  });
}

function clearKeyHighlights() {
  keys.forEach((key) => {
    key.classList.remove("key-active");
    key.classList.remove("key-latched");
  });
}

function beginInputNote(frequency) {
  if (dreamArpEnabled) {
    const noteId = String(frequency);

    if (arpLatchEnabled && arpHeldNotes.has(noteId)) {
      arpHeldNotes.delete(noteId);

arpPlayedOrder =
    arpPlayedOrder.filter(
        (note) => note !== Number(frequency)
    );
      
  setKeyLatched(frequency, false);

      if (arpHeldNotes.size === 0) {
        stopDreamArp();
      }

      return;
    }

    arpHeldNotes.add(noteId);

if (!arpPlayedOrder.includes(Number(frequency))) {
  arpPlayedOrder.push(Number(frequency));
}
    
    setKeyLatched(frequency, true);
    startDreamArp();
    return;
  }

  playNote(frequency);
  setKeyActive(frequency, true);
}

function endInputNote(frequency) {
  setKeyActive(frequency, false);
  
  if (dreamArpEnabled) {
    if (arpLatchEnabled) {
      return;
    }

    arpHeldNotes.delete(String(frequency));
setKeyLatched(frequency, false);
    
    if (arpHeldNotes.size === 0) {
      stopDreamArp();
    }

    return;
  }

  stopNote(frequency);
  setKeyActive(frequency, false);
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
  beginInputNote(getKeyFrequency(key));
}

function moveTouchNote(touch) {
  const oldKey = activeTouchKeys.get(touch.identifier);
  const newKey = getKeyFromPoint(touch.clientX, touch.clientY);

  if (!newKey || newKey === oldKey) return;

  if (oldKey) endInputNote(getKeyFrequency(oldKey));

  activeTouchKeys.set(touch.identifier, newKey);
  beginInputNote(getKeyFrequency(newKey));
}

function stopTouchNote(touch) {
  const key = activeTouchKeys.get(touch.identifier);
  if (!key) return;

  endInputNote(getKeyFrequency(key));
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
  glideTimeSlider,
  waveFusionSlider,
  presenceSlider,
  subLevelSlider,
].forEach((slider) => bindSlider(slider));

if (voiceSpreadSlider) {
  voiceSpreadSlider.addEventListener("input", updateValueDisplays);
}

if (waveFusionCurveSelect) {
    waveFusionCurveSelect.addEventListener(
        "change",
        updateValueDisplays
    );
}

if (originSelect) {
    originSelect.addEventListener(
        "change",
        () => {
            // Placeholder for future Origin engine
        }
    );
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

  noiseTypeSelect.value = preset.noiseType ?? "white";
noiseAmountSlider.value = preset.noiseAmount ?? 0;
driftSlider.value = preset.drift ?? 0;
stereoWidthSlider.value = preset.stereoWidth ?? 0;
  
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
    voiceSpread: voiceSpreadSlider.value,
noiseType: noiseTypeSelect.value,
noiseAmount: noiseAmountSlider.value,
drift: driftSlider.value,
stereoWidth: stereoWidthSlider.value,
    reverbMix: reverbMixSlider.value,
    reverbDecay: reverbDecaySlider.value,
    delayMix: delayMixSlider.value,
    delayTime: delayTimeSlider.value,
    delayFeedback: delayFeedbackSlider.value,
    masterVolume: masterVolume.value,
  };
}

const USER_PRESETS_KEY = "dreamwellNamedPresets";

function getSavedPresets() {
  return JSON.parse(localStorage.getItem(USER_PRESETS_KEY)) || {};
}

function saveSavedPresets(presets) {
  localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
}

function refreshSavedPresetList() {
  const presets = getSavedPresets();
  const names = Object.keys(presets);

  savedPresetSelect.innerHTML = "";

  if (names.length === 0) {
    savedPresetSelect.innerHTML = `<option value="">No Saved Presets</option>`;
    return;
  }

  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    savedPresetSelect.appendChild(option);
  });
}

if (saveNamedPresetButton) {
  saveNamedPresetButton.addEventListener("click", () => {
    const name = presetNameInput.value.trim();
    const confirmed = confirm(`Save preset "${name}"?`);

if (!confirmed) return;

    if (!name) {
      if (presetMessage) presetMessage.textContent = "Enter a preset name.";
      return;
    }

    const presets = getSavedPresets();
    presets[name] = getCurrentPresetSettings();
    saveSavedPresets(presets);
    refreshSavedPresetList();

    savedPresetSelect.value = name;

    if (presetMessage) presetMessage.textContent = `"${name}" saved.`;
  });
}

if (loadNamedPresetButton) {
  loadNamedPresetButton.addEventListener("click", () => {
    const name = savedPresetSelect.value;
    const presets = getSavedPresets();

    if (!name || !presets[name]) {
      if (presetMessage) presetMessage.textContent = "No preset selected.";
      return;
    }

    applyPresetSettings(presets[name]);
    presetNameInput.value = name;

    if (presetMessage) presetMessage.textContent = `"${name}" loaded.`;
  });
}

if (deleteNamedPresetButton) {
  deleteNamedPresetButton.addEventListener("click", () => {
    const name = savedPresetSelect.value;
    const confirmed = confirm(`Delete preset "${name}"? This cannot be undone.`);

if (!confirmed) return;
    const presets = getSavedPresets();

    if (!name || !presets[name]) {
      if (presetMessage) presetMessage.textContent = "No preset selected.";
      return;
    }

    delete presets[name];
    saveSavedPresets(presets);
    refreshSavedPresetList();

    if (presetMessage) presetMessage.textContent = `"${name}" deleted.`;
  });
}

if (prevPresetButton) {
  prevPresetButton.addEventListener("click", () => {
    const options = Array.from(savedPresetSelect.options);

    if (options.length <= 1 && !savedPresetSelect.value) return;

    savedPresetSelect.selectedIndex =
      (savedPresetSelect.selectedIndex - 1 + options.length) % options.length;
  });
}

if (nextPresetButton) {
  nextPresetButton.addEventListener("click", () => {
    const options = Array.from(savedPresetSelect.options);

    if (options.length <= 1 && !savedPresetSelect.value) return;

    savedPresetSelect.selectedIndex =
      (savedPresetSelect.selectedIndex + 1) % options.length;
  });
}

refreshSavedPresetList();    

dreamArpEnabledCheckbox.addEventListener("change", () => {
  dreamArpEnabled = dreamArpEnabledCheckbox.checked;
});

arpLatchCheckbox.addEventListener("change", () => {
  arpLatchEnabled = arpLatchCheckbox.checked;

  if (!arpLatchEnabled) {
    arpHeldNotes.clear();
    stopDreamArp();
    stopAllNotes();
    clearKeyHighlights();
  }
});

arpRateSlider.addEventListener("input", () => {
  arpRate = Number(arpRateSlider.value);
  arpRateValue.textContent = arpRateLabels[arpRate];
});

arpGateSlider.addEventListener("input", () => {
  arpGate = Number(arpGateSlider.value) / 100;
  arpGateValue.textContent =
    `${arpGateSlider.value}%`;
});

arpModeSelect.addEventListener("change", () => {
  arpMode = arpModeSelect.value;
  arpStepIndex = 0;
  arpDirection = 1;
});

arpRateValue.textContent = arpRateLabels[arpRate];

keys.forEach((key) => {
  key.addEventListener("mousedown", () => {
    beginInputNote(getKeyFrequency(key));
  });

  key.addEventListener("mouseup", () => {
    endInputNote(getKeyFrequency(key));
  });

  key.addEventListener("mouseleave", () => {
    endInputNote(getKeyFrequency(key));
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
