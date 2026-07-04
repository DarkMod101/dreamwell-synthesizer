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
let currentResonanceSource = "synth";
let currentEngine = currentResonanceSource; // temporary compatibility bridge
// Piano Engine state
let pianoSustainPedalActive = false;
let pianoAuditionMode = true;
let activePianoNodes = [];
const MAX_PIANO_VOICES = 18;

const pianoVoicing = {
    hammerBrightness: 1.0,
    stringWarmth: 1.0,
    bodyDepth: 1.0,
    cabinetSize: 1.0,
    soundboardBloom: 1.0,
    sympatheticAmount: 1.0,
    duplexShimmer: 1.0,
    mechanicalAmount: 1.0,
    bridgeAmount: 1.0
};


const activeNotes = new Map();
const activeTouchKeys = new Map();
let lastPlayedFrequency = null;
let waveFusionModulationTimer = null;
let lastTouchTime = 0;
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

const openPresetBrowserButton =
  document.getElementById("openPresetBrowser");

const closePresetBrowserButton =
  document.getElementById("closePresetBrowser");

const presetBrowserOverlay =
  document.getElementById("presetBrowserOverlay");

const presetBrowserTabs =
  document.querySelectorAll(".preset-browser-tab");

const presetBrowserList =
  document.getElementById("presetBrowserList");

function openPresetBrowser() {
  if (!presetBrowserOverlay) return;
  presetBrowserOverlay.classList.remove("hidden");
}

function closePresetBrowser() {
  if (!presetBrowserOverlay) return;
  presetBrowserOverlay.classList.add("hidden");
}

function renderPresetBrowser(bankName) {
  if (!presetBrowserList) return;

  presetBrowserList.innerHTML = "";

  const presets = Object.values(presetBanks[bankName] || {});
  const groupedPresets = {};

  presets.forEach((preset) => {
    const collection = preset.collection || "Other";

    if (!groupedPresets[collection]) {
      groupedPresets[collection] = [];
    }

    groupedPresets[collection].push(preset);
  });

  Object.entries(groupedPresets).forEach(([collection, collectionPresets]) => {
    const heading = document.createElement("h3");
    heading.textContent = collection;
    heading.className = "preset-collection-heading";
    presetBrowserList.appendChild(heading);

    collectionPresets.forEach((preset) => {
      const button = document.createElement("button");
      button.textContent = preset.name || preset.label || "Unnamed Preset";
      button.className = "preset-browser-preset";

      button.addEventListener("click", () => {
        applyPresetSettings({
  ...(preset.settings || {}),
  engine: preset.engine
});

        presetBrowserList
          .querySelectorAll(".preset-browser-preset")
          .forEach((presetButton) => {
            presetButton.classList.remove("active-preset");
          });

        button.classList.add("active-preset");
      });

      presetBrowserList.appendChild(button);
    });
  });
}

if (openPresetBrowserButton) {
  openPresetBrowserButton.addEventListener("click", openPresetBrowser);
}

if (closePresetBrowserButton) {
  closePresetBrowserButton.addEventListener("click", closePresetBrowser);
}

presetBrowserTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    presetBrowserTabs.forEach((button) => {
      button.classList.remove("active-bank");
    });

    tab.classList.add("active-bank");

    renderPresetBrowser(tab.dataset.bank);
  });
});

if (presetBrowserOverlay) {
  presetBrowserOverlay.addEventListener("click", (event) => {
    if (event.target === presetBrowserOverlay) {
      closePresetBrowser();
    }
  });
}

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

    const originSettings = getOriginSettings(
  originSelect ? originSelect.value : "pure"
);

const oscBLevel =
  getValue(oscBLevelSlider, 0.35) +
  presenceAmount * 0.35 +
  originSettings.oscBBoost;
  
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


function stopActivePianoNodes() {
  activePianoNodes.forEach((voice) => {
    try {
      if (voice.oscillators) {
        voice.oscillators.forEach((node) => {
          if (node.stop) node.stop();
          if (node.disconnect) node.disconnect();
        });
      }

      if (voice.nodes) {
        voice.nodes.forEach((node) => {
          if (node.disconnect) node.disconnect();
        });
      }
    } catch (error) {
      // Already stopped or disconnected
    }
  });

  activePianoNodes = [];
}

function playNote(frequency) {
if (currentResonanceSource === "piano") {
  createPianoNote(frequency);
  return;
}

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

  if (currentResonanceSource !== "piano") {
  stopNote(frequency);
}

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

    pianoTest: {
    name: "Piano Test",
    engine: "piano",
    settings: {
        masterVolume: 0.18,
    },
},
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

  keys: {
  reunited: {
  name: "Reunited",
  collection: "Dream Memories",
  settings: {
      waveform: "triangle",
      waveformB: "sine",
      oscBLevel: 0.18,
      oscBDetune: 2,
      voiceSpread: 22,

      attack: 0.008,
      decay: 1.9,
      sustain: 0.30,
      release: 2.8,

      filterType: "lowpass",
      cutoff: 5600,
      resonance: 0.7,

      lfoRate: 0.02,
      lfoAmount: 4,
      lfoDestination: "filter",

      noiseType: "air",
      noiseAmount: 2,
      drift: 3,
      stereoWidth: 30,

      reverbMix: 0.18,
      reverbDecay: 3.2,

      delayMix: 0.00,
      delayTime: 0.20,
      delayFeedback: 0.00,

      masterVolume: 0.20,
    },
  },
},
 
  
  pads: {
  dreamVeil: {
    name: "Dream Veil",
    collection: "Celestial Dreams",
    settings: {
      waveform: "trapezoid",
      waveformB: "triangle",
      oscBLevel: 0.32,
      oscBDetune: 6,
      voiceSpread: 55,
      attack: 1.6,
      decay: 1.4,
      sustain: 0.78,
      release: 4.2,
      filterType: "lowpass",
      cutoff: 2200,
      resonance: 2.4,
      lfoRate: 0.22,
      lfoAmount: 130,
      lfoDestination: "filter",
      noiseType: "air",
      noiseAmount: 10,
      drift: 8,
      stereoWidth: 35,
      reverbMix: 0.68,
      reverbDecay: 5.8,
      delayMix: 0.28,
      delayTime: 0.52,
      delayFeedback: 0.34,
      masterVolume: 0.18,
    },
  },

    astralChoir: {
  name: "Astral Choir",
  collection: "Celestial Dreams",
  settings: {
    waveform: "sawtooth",
    waveformB: "triangle",
    oscBLevel: 0.46,
    oscBDetune: 18,
    voiceSpread: 82,

    attack: 2.8,
    decay: 1.8,
    sustain: 0.82,
    release: 6.2,

    filterType: "lowpass",
    cutoff: 3400,
    resonance: 1.2,

    lfoRate: 0.11,
    lfoAmount: 180,
    lfoDestination: "filter",

    noiseType: "cosmic",
    noiseAmount: 22,
    drift: 20,
    stereoWidth: 72,

    reverbMix: 0.82,
    reverbDecay: 7.4,

    delayMix: 0.34,
    delayTime: 0.74,
    delayFeedback: 0.36,

    masterVolume: 0.15,
  },
},

  frozenHorizon: {
  name: "Frozen Horizon",
  collection: "Lucid Dreaming",
  settings: {
    waveform: "triangle",
    waveformB: "sawtooth",
    oscBLevel: 0.28,
    oscBDetune: -14,
    voiceSpread: 76,

    attack: 3.4,
    decay: 2.2,
    sustain: 0.72,
    release: 6.8,

    filterType: "lowpass",
    cutoff: 1400,
    resonance: 3.1,

    lfoRate: 0.08,
    lfoAmount: 110,
    lfoDestination: "filter",

    noiseType: "dark",
    noiseAmount: 16,
    drift: 24,
    stereoWidth: 84,

    reverbMix: 0.78,
    reverbDecay: 7.8,

    delayMix: 0.18,
    delayTime: 0.86,
    delayFeedback: 0.24,

    masterVolume: 0.16,
  },
},  

    celestialMist: {
  name: "Celestial Mist",
  collection: "Celestial Dreams",  
  settings: {
    waveform: "trapezoid",
    waveformB: "sine",
    oscBLevel: 0.34,
    oscBDetune: 9,
    voiceSpread: 80,

    attack: 2.4,
    decay: 1.9,
    sustain: 0.84,
    release: 6.4,

    filterType: "lowpass",
    cutoff: 2600,
    resonance: 1.6,

    lfoRate: 0.13,
    lfoAmount: 140,
    lfoDestination: "filter",

    noiseType: "dust",
    noiseAmount: 18,
    drift: 18,
    stereoWidth: 78,

    reverbMix: 0.8,
    reverbDecay: 7.2,

    delayMix: 0.26,
    delayTime: 0.72,
    delayFeedback: 0.3,

    masterVolume: 0.16,
  },
},

starlightPassage: {
  name: "Starlight Passage",
  collection: "Celestial Dreams",
  settings: {
    waveform: "trapezoid",
    waveformB: "triangle",
    oscBLevel: 0.36,
    oscBDetune: 12,
    voiceSpread: 90,

    attack: 3.2,
    decay: 2.1,
    sustain: 0.86,
    release: 7.6,

    filterType: "lowpass",
    cutoff: 3600,
    resonance: 1.2,

    lfoRate: 0.10,
    lfoAmount: 120,
    lfoDestination: "filter",

    noiseType: "cosmic",
    noiseAmount: 20,
    drift: 22,
    stereoWidth: 94,

    reverbMix: 0.88,
    reverbDecay: 8,

    delayMix: 0.34,
    delayTime: 0.72,
    delayFeedback: 0.34,

    masterVolume: 0.15,
  },
},

heavensGate: {
  name: "Heaven's Gate",
  collection: "Celestial Dreams",
  settings: {
    waveform: "sawtooth",
    waveformB: "sine",
    oscBLevel: 0.30,
    oscBDetune: 7,
    voiceSpread: 86,

    attack: 2.6,
    decay: 1.8,
    sustain: 0.84,
    release: 6.8,

    filterType: "lowpass",
    cutoff: 4200,
    resonance: 0.9,

    lfoRate: 0.08,
    lfoAmount: 90,
    lfoDestination: "filter",

    noiseType: "dust",
    noiseAmount: 14,
    drift: 16,
    stereoWidth: 88,

    reverbMix: 0.9,
    reverbDecay: 8,

    delayMix: 0.26,
    delayTime: 0.62,
    delayFeedback: 0.26,

    masterVolume: 0.14,
  },
},

auroraResonance: {
  name: "Aurora Resonance",
  collection: "Celestial Dreams",
  settings: {
    waveform: "triangle",
    waveformB: "trapezoid",
    oscBLevel: 0.40,
    oscBDetune: 16,
    voiceSpread: 92,

    attack: 3.8,
    decay: 2.4,
    sustain: 0.82,
    release: 8,

    filterType: "lowpass",
    cutoff: 3000,
    resonance: 1.6,

    lfoRate: 0.14,
    lfoAmount: 180,
    lfoDestination: "filter",

    noiseType: "cosmic",
    noiseAmount: 18,
    drift: 24,
    stereoWidth: 96,

    reverbMix: 0.86,
    reverbDecay: 8,

    delayMix: 0.30,
    delayTime: 0.78,
    delayFeedback: 0.32,

    masterVolume: 0.15,
  },
},
    
endlessSleep: {
  name: "Endless Sleep",
  collection: "Lucid Dreaming",
  settings: {
    waveform: "sine",
    waveformB: "trapezoid",
    oscBLevel: 0.28,
    oscBDetune: -8,
    voiceSpread: 62,

    attack: 4.2,
    decay: 2.8,
    sustain: 0.76,
    release: 8,

    filterType: "lowpass",
    cutoff: 1100,
    resonance: 2.2,

    lfoRate: 0.06,
    lfoAmount: 90,
    lfoDestination: "filter",

    noiseType: "air",
    noiseAmount: 12,
    drift: 14,
    stereoWidth: 66,

    reverbMix: 0.86,
    reverbDecay: 8,

    delayMix: 0.16,
    delayTime: 0.9,
    delayFeedback: 0.2,

    masterVolume: 0.15,
  },
},

silentCathedral: {
  name: "Silent Cathedral",
  collection: "Ancient Worlds",
  settings: {
    waveform: "triangle",
    waveformB: "trapezoid",
    oscBLevel: 0.42,
    oscBDetune: -18,
    voiceSpread: 88,

    attack: 3.1,
    decay: 2.1,
    sustain: 0.86,
    release: 7.2,

    filterType: "lowpass",
    cutoff: 1900,
    resonance: 3.6,

    lfoRate: 0.09,
    lfoAmount: 160,
    lfoDestination: "filter",

    noiseType: "dark",
    noiseAmount: 18,
    drift: 22,
    stereoWidth: 90,

    reverbMix: 0.9,
    reverbDecay: 8,

    delayMix: 0.2,
    delayTime: 0.82,
    delayFeedback: 0.26,

    masterVolume: 0.14,
  },
},

shadowSanctum: {
  name: "Shadow Sanctum",
  collection: "Forgotten Realms",
  settings: {
    waveform: "trapezoid",
    waveformB: "sawtooth",
    oscBLevel: 0.36,
    oscBDetune: -16,
    voiceSpread: 74,

    attack: 3.6,
    decay: 2.4,
    sustain: 0.78,
    release: 7.5,

    filterType: "lowpass",
    cutoff: 850,
    resonance: 4.2,

    lfoRate: 0.07,
    lfoAmount: 210,
    lfoDestination: "filter",

    noiseType: "dark",
    noiseAmount: 24,
    drift: 28,
    stereoWidth: 86,

    reverbMix: 0.88,
    reverbDecay: 8,

    delayMix: 0.22,
    delayTime: 0.92,
    delayFeedback: 0.32,

    masterVolume: 0.13,
  },
},

forgottenCrypt: {
  name: "Forgotten Crypt",
  collection: "Forgotten Realms",
  settings: {
    waveform: "triangle",
    waveformB: "square",
    oscBLevel: 0.3,
    oscBDetune: -22,
    voiceSpread: 70,

    attack: 2.8,
    decay: 2.6,
    sustain: 0.74,
    release: 7.8,

    filterType: "lowpass",
    cutoff: 700,
    resonance: 5.5,

    lfoRate: 0.05,
    lfoAmount: 260,
    lfoDestination: "filter",

    noiseType: "machine",
    noiseAmount: 18,
    drift: 30,
    stereoWidth: 78,

    reverbMix: 0.9,
    reverbDecay: 8,

    delayMix: 0.18,
    delayTime: 1.05,
    delayFeedback: 0.26,

    masterVolume: 0.12,
  },
},

desolateMemory: {
  name: "Desolate Memory",
  collection: "Forgotten Realms",
  settings: {
    waveform: "sine",
    waveformB: "trapezoid",
    oscBLevel: 0.26,
    oscBDetune: 13,
    voiceSpread: 64,

    attack: 4.6,
    decay: 3,
    sustain: 0.68,
    release: 8,

    filterType: "lowpass",
    cutoff: 620,
    resonance: 3.8,

    lfoRate: 0.04,
    lfoAmount: 180,
    lfoDestination: "filter",

    noiseType: "air",
    noiseAmount: 20,
    drift: 34,
    stereoWidth: 82,

    reverbMix: 0.92,
    reverbDecay: 8,

    delayMix: 0.14,
    delayTime: 1.12,
    delayFeedback: 0.22,

    masterVolume: 0.12,
  },
},

hypnagogia: {
  name: "Hypnagogia",
  collection: "Lucid Dreaming",
  settings: {
    waveform: "trapezoid",
    waveformB: "triangle",
    oscBLevel: 0.31,
    oscBDetune: 7,
    voiceSpread: 72,

    attack: 3.8,
    decay: 2.4,
    sustain: 0.8,
    release: 7.6,

    filterType: "lowpass",
    cutoff: 1700,
    resonance: 2.4,

    lfoRate: 0.075,
    lfoAmount: 140,
    lfoDestination: "filter",

    noiseType: "air",
    noiseAmount: 18,
    drift: 26,
    stereoWidth: 82,

    reverbMix: 0.84,
    reverbDecay: 7.6,

    delayMix: 0.24,
    delayTime: 0.88,
    delayFeedback: 0.28,

    masterVolume: 0.15,
  },
},

dreamRecall: {
  name: "Dream Recall",
  collection: "Lucid Dreaming",
  settings: {
    waveform: "triangle",
    waveformB: "sine",
    oscBLevel: 0.34,
    oscBDetune: 5,
    voiceSpread: 76,

    attack: 2.9,
    decay: 2.2,
    sustain: 0.82,
    release: 6.6,

    filterType: "lowpass",
    cutoff: 2200,
    resonance: 1.8,

    lfoRate: 0.10,
    lfoAmount: 120,
    lfoDestination: "filter",

    noiseType: "air",
    noiseAmount: 14,
    drift: 18,
    stereoWidth: 74,

    reverbMix: 0.78,
    reverbDecay: 6.8,

    delayMix: 0.20,
    delayTime: 0.64,
    delayFeedback: 0.24,

    masterVolume: 0.16,
  },
},

floatingMind: {
  name: "Floating Mind",
  collection: "Lucid Dreaming",
  settings: {
    waveform: "sine",
    waveformB: "triangle",
    oscBLevel: 0.29,
    oscBDetune: 8,
    voiceSpread: 84,

    attack: 4.0,
    decay: 2.6,
    sustain: 0.86,
    release: 7.8,

    filterType: "lowpass",
    cutoff: 1900,
    resonance: 1.5,

    lfoRate: 0.07,
    lfoAmount: 150,
    lfoDestination: "filter",

    noiseType: "air",
    noiseAmount: 20,
    drift: 28,
    stereoWidth: 90,

    reverbMix: 0.86,
    reverbDecay: 7.8,

    delayMix: 0.24,
    delayTime: 0.82,
    delayFeedback: 0.26,

    masterVolume: 0.15,
  },
},

consciousDrift: {
  name: "Conscious Drift",
  collection: "Lucid Dreaming",
  settings: {
    waveform: "triangle",
    waveformB: "trapezoid",
    oscBLevel: 0.36,
    oscBDetune: 10,
    voiceSpread: 80,

    attack: 3.4,
    decay: 2.2,
    sustain: 0.80,
    release: 7.2,

    filterType: "lowpass",
    cutoff: 2100,
    resonance: 2.1,

    lfoRate: 0.09,
    lfoAmount: 170,
    lfoDestination: "filter",

    noiseType: "dust",
    noiseAmount: 18,
    drift: 22,
    stereoWidth: 82,

    reverbMix: 0.82,
    reverbDecay: 7.0,

    delayMix: 0.28,
    delayTime: 0.74,
    delayFeedback: 0.32,

    masterVolume: 0.16,
  },
},

lucidGateway: {
  name: "Lucid Gateway",
  collection: "Lucid Dreaming",
  settings: {
    waveform: "sawtooth",
    waveformB: "triangle",
    oscBLevel: 0.42,
    oscBDetune: 15,
    voiceSpread: 88,

    attack: 2.5,
    decay: 1.9,
    sustain: 0.84,
    release: 6.8,

    filterType: "lowpass",
    cutoff: 3200,
    resonance: 1.3,

    lfoRate: 0.12,
    lfoAmount: 110,
    lfoDestination: "filter",

    noiseType: "cosmic",
    noiseAmount: 16,
    drift: 18,
    stereoWidth: 92,

    reverbMix: 0.88,
    reverbDecay: 7.6,

    delayMix: 0.30,
    delayTime: 0.66,
    delayFeedback: 0.30,

    masterVolume: 0.15,
  },
},

falseAwakening: {
  name: "False Awakening",
  collection: "Lucid Dreaming",
  settings: {
    waveform: "trapezoid",
    waveformB: "square",
    oscBLevel: 0.33,
    oscBDetune: -9,
    voiceSpread: 78,

    attack: 3.2,
    decay: 2.5,
    sustain: 0.76,
    release: 7.4,

    filterType: "lowpass",
    cutoff: 1600,
    resonance: 2.8,

    lfoRate: 0.08,
    lfoAmount: 200,
    lfoDestination: "filter",

    noiseType: "air",
    noiseAmount: 24,
    drift: 30,
    stereoWidth: 86,

    reverbMix: 0.84,
    reverbDecay: 7.8,

    delayMix: 0.18,
    delayTime: 0.94,
    delayFeedback: 0.22,

    masterVolume: 0.15,
  },
},

forgottenTemple: {
  name: "Forgotten Temple",
  collection: "Ancient Worlds",
  settings: {
    waveform: "trapezoid",
    waveformB: "triangle",
    oscBLevel: 0.38,
    oscBDetune: -12,
    voiceSpread: 78,

    attack: 3.2,
    decay: 2.4,
    sustain: 0.78,
    release: 7.2,

    filterType: "lowpass",
    cutoff: 1200,
    resonance: 4.4,

    lfoRate: 0.06,
    lfoAmount: 220,
    lfoDestination: "filter",

    noiseType: "dust",
    noiseAmount: 24,
    drift: 30,
    stereoWidth: 84,

    reverbMix: 0.9,
    reverbDecay: 8,

    delayMix: 0.32,
    delayTime: 0.92,
    delayFeedback: 0.42,

    masterVolume: 0.13,
  },
},

ancientMachinePad: {
  name: "Ancient Machine",
  collection: "Ancient Worlds",
  settings: {
    waveform: "sawtooth",
    waveformB: "square",
    oscBLevel: 0.44,
    oscBDetune: 17,
    voiceSpread: 70,

    attack: 2.4,
    decay: 1.8,
    sustain: 0.74,
    release: 5.8,

    filterType: "lowpass",
    cutoff: 1500,
    resonance: 6.2,

    lfoRate: 0.18,
    lfoAmount: 280,
    lfoDestination: "filter",

    noiseType: "machine",
    noiseAmount: 26,
    drift: 24,
    stereoWidth: 72,

    reverbMix: 0.74,
    reverbDecay: 6.4,

    delayMix: 0.38,
    delayTime: 0.46,
    delayFeedback: 0.54,

    masterVolume: 0.13,
  },
},

 stoneGiants: {
  name: "Stone Giants",
  collection: "Ancient Worlds",
  settings: {
    waveform: "trapezoid",
    waveformB: "sawtooth",
    oscBLevel: 0.4,
    oscBDetune: -20,
    voiceSpread: 64,
    attack: 4.4,
    decay: 2.6,
    sustain: 0.82,
    release: 8,
    filterType: "lowpass",
    cutoff: 900,
    resonance: 5.8,
    lfoRate: 0.045,
    lfoAmount: 240,
    lfoDestination: "filter",
    noiseType: "dark",
    noiseAmount: 20,
    drift: 36,
    stereoWidth: 76,
    reverbMix: 0.88,
    reverbDecay: 8,
    delayMix: 0.2,
    delayTime: 1.1,
    delayFeedback: 0.3,
    masterVolume: 0.12,
  },
},

sunkenKingdom: {
  name: "Sunken Kingdom",
  collection: "Ancient Worlds",
  settings: {
    waveform: "triangle",
    waveformB: "trapezoid",
    oscBLevel: 0.36,
    oscBDetune: 14,
    voiceSpread: 86,
    attack: 3.6,
    decay: 2.3,
    sustain: 0.78,
    release: 7.6,
    filterType: "lowpass",
    cutoff: 1600,
    resonance: 3.2,
    lfoRate: 0.12,
    lfoAmount: 210,
    lfoDestination: "filter",
    noiseType: "air",
    noiseAmount: 22,
    drift: 30,
    stereoWidth: 92,
    reverbMix: 0.92,
    reverbDecay: 8,
    delayMix: 0.34,
    delayTime: 0.78,
    delayFeedback: 0.36,
    masterVolume: 0.13,
  },
},

templeOfEchoes: {
  name: "Temple of Echoes",
  collection: "Ancient Worlds",
  settings: {
    waveform: "sawtooth",
    waveformB: "triangle",
    oscBLevel: 0.34,
    oscBDetune: 9,
    voiceSpread: 82,
    attack: 2.8,
    decay: 2.1,
    sustain: 0.8,
    release: 7.8,
    filterType: "lowpass",
    cutoff: 2100,
    resonance: 4.8,
    lfoRate: 0.08,
    lfoAmount: 190,
    lfoDestination: "filter",
    noiseType: "dust",
    noiseAmount: 18,
    drift: 24,
    stereoWidth: 88,
    reverbMix: 0.9,
    reverbDecay: 8,
    delayMix: 0.48,
    delayTime: 0.96,
    delayFeedback: 0.58,
    masterVolume: 0.12,
  },
},

forgottenKingdom: {
  name: "Forgotten Kingdom",
  collection: "Ancient Worlds",
  settings: {
    waveform: "trapezoid",
    waveformB: "square",
    oscBLevel: 0.32,
    oscBDetune: -11,
    voiceSpread: 78,
    attack: 3.9,
    decay: 2.5,
    sustain: 0.76,
    release: 8,
    filterType: "lowpass",
    cutoff: 1300,
    resonance: 3.7,
    lfoRate: 0.065,
    lfoAmount: 170,
    lfoDestination: "filter",
    noiseType: "dark",
    noiseAmount: 18,
    drift: 28,
    stereoWidth: 84,
    reverbMix: 0.86,
    reverbDecay: 8,
    delayMix: 0.26,
    delayTime: 0.88,
    delayFeedback: 0.32,
    masterVolume: 0.13,
  },
},   

hollowMonastery: {
  name: "Hollow Monastery",
  collection: "Forgotten Realms",
  settings: {
    waveform: "triangle",
    waveformB: "trapezoid",
    oscBLevel: 0.34,
    oscBDetune: -18,
    voiceSpread: 80,

    attack: 4.2,
    decay: 2.6,
    sustain: 0.74,
    release: 8,

    filterType: "lowpass",
    cutoff: 950,
    resonance: 4.6,

    lfoRate: 0.055,
    lfoAmount: 240,
    lfoDestination: "filter",

    noiseType: "air",
    noiseAmount: 22,
    drift: 34,
    stereoWidth: 92,

    reverbMix: 0.94,
    reverbDecay: 8,

    delayMix: 0.26,
    delayTime: 1.02,
    delayFeedback: 0.30,

    masterVolume: 0.12,
  },
},

abandonedThrone: {
  name: "Abandoned Throne",
  collection: "Forgotten Realms",
  settings: {
    waveform: "square",
    waveformB: "triangle",
    oscBLevel: 0.40,
    oscBDetune: -15,
    voiceSpread: 70,

    attack: 3.6,
    decay: 2.4,
    sustain: 0.82,
    release: 7.8,

    filterType: "lowpass",
    cutoff: 820,
    resonance: 5.2,

    lfoRate: 0.05,
    lfoAmount: 280,
    lfoDestination: "filter",

    noiseType: "dark",
    noiseAmount: 20,
    drift: 28,
    stereoWidth: 84,

    reverbMix: 0.90,
    reverbDecay: 8,

    delayMix: 0.22,
    delayTime: 0.94,
    delayFeedback: 0.24,

    masterVolume: 0.12,
  },
},

lastShrine: {
  name: "The Last Shrine",
  collection: "Forgotten Realms",
  settings: {
    waveform: "trapezoid",
    waveformB: "sine",
    oscBLevel: 0.30,
    oscBDetune: 9,
    voiceSpread: 88,

    attack: 5,
    decay: 3,
    sustain: 0.70,
    release: 8,

    filterType: "lowpass",
    cutoff: 1200,
    resonance: 3.4,

    lfoRate: 0.04,
    lfoAmount: 160,
    lfoDestination: "filter",

    noiseType: "dust",
    noiseAmount: 26,
    drift: 36,
    stereoWidth: 94,

    reverbMix: 0.96,
    reverbDecay: 8,

    delayMix: 0.36,
    delayTime: 1.12,
    delayFeedback: 0.42,

    masterVolume: 0.11,
  },
},

echoingRuins: {
  name: "Echoing Ruins",
  collection: "Forgotten Realms",
  settings: {
    waveform: "triangle",
    waveformB: "square",
    oscBLevel: 0.38,
    oscBDetune: -10,
    voiceSpread: 82,

    attack: 3.8,
    decay: 2.4,
    sustain: 0.78,
    release: 7.8,

    filterType: "lowpass",
    cutoff: 1000,
    resonance: 4.2,

    lfoRate: 0.07,
    lfoAmount: 220,
    lfoDestination: "filter",

    noiseType: "dust",
    noiseAmount: 28,
    drift: 30,
    stereoWidth: 90,

    reverbMix: 0.92,
    reverbDecay: 8,

    delayMix: 0.40,
    delayTime: 1.06,
    delayFeedback: 0.50,

    masterVolume: 0.12,
  },
},

forgottenEmpire: {
  name: "Forgotten Empire",
  collection: "Forgotten Realms",
  settings: {
    waveform: "sawtooth",
    waveformB: "triangle",
    oscBLevel: 0.36,
    oscBDetune: 12,
    voiceSpread: 86,

    attack: 4.2,
    decay: 2.6,
    sustain: 0.82,
    release: 8,

    filterType: "lowpass",
    cutoff: 1400,
    resonance: 3.6,

    lfoRate: 0.06,
    lfoAmount: 190,
    lfoDestination: "filter",

    noiseType: "dark",
    noiseAmount: 18,
    drift: 34,
    stereoWidth: 88,

    reverbMix: 0.90,
    reverbDecay: 8,

    delayMix: 0.30,
    delayTime: 0.96,
    delayFeedback: 0.34,

    masterVolume: 0.12,
  },
},
},    

    
  leads: {},
  bass: {},
  textures: {},
};


function createPianoHammer(ctx, frequency, now) {
    const hammer = ctx.createOscillator();
    const hammerGain = ctx.createGain();
    const hammerFilter = ctx.createBiquadFilter();

    hammer.type = "triangle";
    hammer.frequency.setValueAtTime(
    frequency * (2.4 * pianoVoicing.hammerBrightness),
    now
);
    hammerFilter.type = "highpass";
    hammerFilter.frequency.setValueAtTime(900, now);

    hammerGain.gain.setValueAtTime(0.001, now);

hammerGain.gain.exponentialRampToValueAtTime(
    0.022 * pianoVoicing.hammerBrightness,
    now + 0.008
);

hammerGain.gain.exponentialRampToValueAtTime(
    0.001,
    now + 0.055
);
    hammer.connect(hammerFilter);
    hammerFilter.connect(hammerGain);
    hammerGain.connect(masterGain);

    hammer.start(now);
    hammer.stop(now + 0.035);
}

function createPianoStrings(ctx, frequency, now) {
    const stringFrequencies = [
    frequency * 0.9997,
    frequency,
    frequency * 1.0003
];

    stringFrequencies.forEach(freq => {
        const string = ctx.createOscillator();
        const stringGain = ctx.createGain();

        string.type = "sine";
        string.frequency.setValueAtTime(freq, now);

        stringGain.gain.setValueAtTime(0.0001, now);

stringGain.gain.linearRampToValueAtTime(
    0.085 * pianoVoicing.stringWarmth,
    now + 0.018
);

        stringGain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 2.8
        );

        string.connect(stringGain);
        stringGain.connect(masterGain);

        string.start(now + 0.002);
        string.stop(now + 2.9);
        activePianoNodes.push(string, stringGain);
    });


const attackHarmonic = ctx.createOscillator();
const attackHarmonicGain = ctx.createGain();
const attackHarmonicFilter = ctx.createBiquadFilter();

attackHarmonic.type = "sine";
attackHarmonic.frequency.setValueAtTime(frequency * 2.01, now);

attackHarmonicFilter.type = "highpass";
attackHarmonicFilter.frequency.setValueAtTime(1200, now);

attackHarmonicGain.gain.setValueAtTime(0.0001, now);
attackHarmonicGain.gain.linearRampToValueAtTime(0.008, now + 0.014);
attackHarmonicGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

attackHarmonic.connect(attackHarmonicFilter);
attackHarmonicFilter.connect(attackHarmonicGain);
attackHarmonicGain.connect(masterGain);

attackHarmonic.start(now + 0.002);
attackHarmonic.stop(now + 0.2);

activePianoNodes.push(
    attackHarmonic,
    attackHarmonicGain,
    attackHarmonicFilter
);

    
    const harmonic = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    const harmonicFilter = ctx.createBiquadFilter();

    harmonic.type = "sine";
    harmonic.frequency.setValueAtTime(frequency * 2.01, now);

    harmonicFilter.type = "bandpass";
harmonicFilter.frequency.setValueAtTime(4200, now);
harmonicFilter.Q.setValueAtTime(0.28, now);

    harmonicGain.gain.setValueAtTime(
    0.0001,
    now
);

harmonicGain.gain.linearRampToValueAtTime(
    0.0045 * pianoVoicing.stringWarmth,
    now + 0.045
);

    harmonicGain.gain.exponentialRampToValueAtTime(
        0.001,
        now + 2.7
    );

    harmonic.connect(harmonicFilter);
    harmonicFilter.connect(harmonicGain);
    harmonicGain.connect(masterGain);

    harmonic.start(now);
harmonic.stop(now + 2.8);
    

    /*
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();

    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(frequency * 3.02, now);

    shimmerGain.gain.setValueAtTime(
        0.006 / pianoVoicing.stringWarmth,
        now
    );

    shimmerGain.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.45
    );

    shimmer.connect(shimmerGain);
    shimmerGain.connect(masterGain);

    shimmer.start(now);
    shimmer.stop(now + 1.2);
    */
}
function createPianoBody(ctx, frequency, now, bodyExcitation) {
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    const bodyFilter = ctx.createBiquadFilter();

    body.type = "sine";
    body.frequency.setValueAtTime(frequency * 0.5, now);

    bodyFilter.type = "lowpass";
    bodyFilter.frequency.setValueAtTime(
    850 / pianoVoicing.bodyDepth,
    now
);
    bodyFilter.Q.setValueAtTime(0.45, now);

    bodyGain.gain.setValueAtTime(
    0.018 * bodyExcitation,
    now
);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    body.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(masterGain);

    body.start(now);
    body.stop(now + 2.3);
    activePianoNodes.push(body, bodyGain, bodyFilter);
}

function createPianoCabinet(ctx, frequency, now) {
    const cabinet = ctx.createOscillator();
    const cabinetGain = ctx.createGain();
    const cabinetFilter = ctx.createBiquadFilter();

    cabinet.type = "sine";
    cabinet.frequency.setValueAtTime(
    Math.max(45, frequency * (0.25 / pianoVoicing.cabinetSize)),
    now
);

    cabinetFilter.type = "lowpass";
    cabinetFilter.frequency.setValueAtTime(
    420 / pianoVoicing.cabinetSize,
    now
);
    cabinetFilter.Q.setValueAtTime(0.8, now);

    cabinetGain.gain.setValueAtTime(
    0.035 * pianoVoicing.cabinetSize,
    now
);
    cabinetGain.gain.exponentialRampToValueAtTime(0.001, now + 2.6);

    cabinet.connect(cabinetFilter);
    cabinetFilter.connect(cabinetGain);
    cabinetGain.connect(masterGain);

    cabinet.start(now);
    cabinet.stop(now + 2.7);
}

function createPianoSoundboard(ctx, frequency, now) {
    const soundboardGain = ctx.createGain();
    const soundboardFilter = ctx.createBiquadFilter();

    soundboardFilter.type = "bandpass";
    soundboardFilter.frequency.setValueAtTime(
        Math.min(900, Math.max(180, frequency * 1.4)),
        now
    );
    soundboardFilter.Q.setValueAtTime(0.7, now);

    soundboardGain.gain.setValueAtTime(
    0.028 * pianoVoicing.soundboardBloom,
    now + 0.015
);
    soundboardGain.gain.exponentialRampToValueAtTime(
    0.001,
    now + (3.4 * pianoVoicing.soundboardBloom)
);

    const resonances = [
        { ratio: 0.75, gain: 0.018 },
        { ratio: 1.00, gain: 0.014 },
        { ratio: 1.50, gain: 0.010 }
    ];

    resonances.forEach((res) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency * res.ratio, now);

        gain.gain.setValueAtTime(
    res.gain * pianoVoicing.soundboardBloom,
    now + 0.015
);
        gain.gain.exponentialRampToValueAtTime(
    0.001,
    now + (3.2 * pianoVoicing.soundboardBloom)
);

        osc.connect(gain);
        gain.connect(soundboardFilter);

        osc.start(now);
        osc.stop(now + 3.4);
        activePianoNodes.push(osc, gain);
    });

    soundboardFilter.connect(soundboardGain);
    soundboardGain.connect(masterGain);
activePianoNodes.push(soundboardGain, soundboardFilter);
    
}

function createPianoSympatheticResonance(ctx, frequency, now) {
    const resonanceOut = ctx.createGain();
    const resonanceFilter = ctx.createBiquadFilter();

    resonanceOut.gain.setValueAtTime(
    0.018 * pianoVoicing.sympatheticAmount,
    now + 0.025
);
    resonanceOut.gain.exponentialRampToValueAtTime(
    0.001,
    now + (4.2 * pianoVoicing.sympatheticAmount)
);

    resonanceFilter.type = "bandpass";
    resonanceFilter.frequency.setValueAtTime(
        Math.min(5000, frequency * 2),
        now
    );
    resonanceFilter.Q.setValueAtTime(1.1, now);

    const relatedStrings = [
        { ratio: 2.0, gain: 0.010, detune: -3 },
        { ratio: 3.0, gain: 0.006, detune: 2 },
        { ratio: 1.5, gain: 0.005, detune: -2 },
        { ratio: 0.5, gain: 0.004, detune: 1 }
    ];

    relatedStrings.forEach((string) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(
            Math.max(45, Math.min(6000, frequency * string.ratio)),
            now
        );
        osc.detune.setValueAtTime(string.detune, now);

        gain.gain.setValueAtTime(
    string.gain * pianoVoicing.sympatheticAmount,
    now + 0.025
);
        gain.gain.exponentialRampToValueAtTime(
    0.001,
    now + (4.0 * pianoVoicing.sympatheticAmount)
);
        osc.connect(gain);
        gain.connect(resonanceFilter);

        osc.start(now);
        osc.stop(now + 4.2);
    });

    resonanceFilter.connect(resonanceOut);
    resonanceOut.connect(masterGain);
}

function createPianoDuplexScale(ctx, frequency, now) {
    const duplexGain = ctx.createGain();
    const duplexFilter = ctx.createBiquadFilter();

    duplexFilter.type = "highpass";
    duplexFilter.frequency.setValueAtTime(1800, now);
    duplexFilter.Q.setValueAtTime(0.8, now);

    duplexGain.gain.setValueAtTime(
    0.004 * pianoVoicing.duplexShimmer,
    now + 0.012
);
    duplexGain.gain.exponentialRampToValueAtTime(
    0.001,
    now + (2.8 * pianoVoicing.duplexShimmer)
);

    const partials = [
    { ratio: 2.0, gain: 0.004, detune: 4 },
    { ratio: 2.5, gain: 0.003, detune: -3 },
    { ratio: 3.0, gain: 0.002, detune: 2 }
];

    partials.forEach(partial => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(
            Math.min(8000, frequency * partial.ratio),
            now
        );
        osc.detune.setValueAtTime(partial.detune, now);

        gain.gain.setValueAtTime(
    partial.gain * pianoVoicing.duplexShimmer,
    now + 0.012
);
        gain.gain.exponentialRampToValueAtTime(
    0.001,
    now + (2.6 * pianoVoicing.duplexShimmer)
);

        osc.connect(gain);
        gain.connect(duplexFilter);

        osc.start(now);
        osc.stop(now + 2.8);
    });

    duplexFilter.connect(duplexGain);
    duplexGain.connect(masterGain);
}

function createPianoMechanicalNoise(ctx, frequency, now) {
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
        const fade = 1 - i / data.length;
        data[i] = (Math.random() * 2 - 1) * fade;
    }

    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();

    noise.buffer = noiseBuffer;

    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(
        Math.min(3500, Math.max(900, frequency * 3)),
        now
    );
    noiseFilter.Q.setValueAtTime(0.9, now);

    noiseGain.gain.setValueAtTime(
    0.012 * pianoVoicing.mechanicalAmount,
    now
);
    noiseGain.gain.exponentialRampToValueAtTime(
    0.001,
    now + (0.16 * pianoVoicing.mechanicalAmount)
);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    noise.start(now);
    noise.stop(now + 0.18);
}

function createPianoDamperRelease(ctx, frequency, now) {
    const damper = ctx.createOscillator();
    const damperGain = ctx.createGain();
    const damperFilter = ctx.createBiquadFilter();

    damper.type = "sine";
    damper.frequency.setValueAtTime(
        Math.min(2800, Math.max(160, frequency * 1.25)),
        now
    );

    damperFilter.type = "bandpass";
    damperFilter.frequency.setValueAtTime(
        Math.min(2400, Math.max(300, frequency * 1.8)),
        now
    );
    damperFilter.Q.setValueAtTime(0.6, now);

    damperGain.gain.setValueAtTime(0.009, now + 0.03);
    damperGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    damper.connect(damperFilter);
    damperFilter.connect(damperGain);
    damperGain.connect(masterGain);

    damper.start(now);
    damper.stop(now + 0.45);
}

function createPianoStringInteraction(ctx, frequency, now) {
    const interactionOut = ctx.createGain();
    const interactionFilter = ctx.createBiquadFilter();

    interactionOut.gain.setValueAtTime(0.016, now + 0.01);
    interactionOut.gain.exponentialRampToValueAtTime(0.001, now + 3.6);

    interactionFilter.type = "bandpass";
    interactionFilter.frequency.setValueAtTime(
        Math.min(4200, Math.max(220, frequency * 1.2)),
        now
    );
    interactionFilter.Q.setValueAtTime(1.4, now);

    const beatingPairs = [
        { detune: -2.5, gain: 0.010 },
        { detune: 2.5, gain: 0.010 },
        { detune: 4.5, gain: 0.006 }
    ];

    beatingPairs.forEach((string) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, now);
        osc.detune.setValueAtTime(string.detune, now);

        gain.gain.setValueAtTime(string.gain, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);

        osc.connect(gain);
        gain.connect(interactionFilter);

        osc.start(now);
        osc.stop(now + 3.6);
    });

    interactionFilter.connect(interactionOut);
    interactionOut.connect(masterGain);
}

function createPianoPedalResonance(ctx, frequency, now) {
    if (!pianoSustainPedalActive) return;

    const pedalOut = ctx.createGain();
    const pedalFilter = ctx.createBiquadFilter();

    pedalOut.gain.setValueAtTime(0.022, now + 0.02);
    pedalOut.gain.exponentialRampToValueAtTime(0.001, now + 5.5);

    pedalFilter.type = "bandpass";
    pedalFilter.frequency.setValueAtTime(
        Math.min(4200, Math.max(160, frequency * 1.6)),
        now
    );
    pedalFilter.Q.setValueAtTime(0.9, now);

    const resonances = [
        { ratio: 1.0, gain: 0.010, detune: -2 },
        { ratio: 2.0, gain: 0.008, detune: 2 },
        { ratio: 3.0, gain: 0.004, detune: -3 }
    ];

    resonances.forEach((res) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(
            Math.min(6500, Math.max(40, frequency * res.ratio)),
            now
        );
        osc.detune.setValueAtTime(res.detune, now);

        gain.gain.setValueAtTime(res.gain, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 5.2);

        osc.connect(gain);
        gain.connect(pedalFilter);

        osc.start(now);
        osc.stop(now + 5.5);
    });

    pedalFilter.connect(pedalOut);
    pedalOut.connect(masterGain);
}

function createPianoBridge(ctx, frequency, now, bridgeExcitation) {
    return;
    const bridgeOut = ctx.createGain();
    const bridgeFilter = ctx.createBiquadFilter();

    bridgeFilter.type = "bandpass";
    bridgeFilter.frequency.setValueAtTime(
        Math.min(1400, Math.max(180, frequency * 1.15)),
        now
    );

    bridgeFilter.Q.setValueAtTime(0.18, now);

    bridgeOut.gain.setValueAtTime(
        0.00075 * bridgeExcitation,
        now + 0.018
    );

    bridgeOut.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.22
    );

    const bridgeNoiseBuffer = ctx.createBuffer(
        1,
        Math.floor(ctx.sampleRate * 0.08),
        ctx.sampleRate
    );

    const data = bridgeNoiseBuffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
        const fade = 1 - i / data.length;
        data[i] = (Math.random() * 2 - 1) * fade * 0.08;
    }

    const bridgeNoise = ctx.createBufferSource();
    bridgeNoise.buffer = bridgeNoiseBuffer;

    bridgeNoise.connect(bridgeFilter);
    bridgeFilter.connect(bridgeOut);
    bridgeOut.connect(masterGain);

    bridgeNoise.start(now);
    bridgeNoise.stop(now + 0.08);

    activePianoNodes.push(
        bridgeNoise,
        bridgeFilter,
        bridgeOut
    );
}

// ========================================
// Acoustic Interaction System
// ========================================

function calculateBridgeExcitation(voicing) {
    const hammerEnergy =
        0.75 +
        (voicing.hammerBrightness * 0.25);

    return hammerEnergy * voicing.bridgeAmount;
}

function calculateBodyExcitation(voicing, bridgeExcitation) {
    const bodyCoupling =
        0.80 +
        (voicing.bodyDepth * 0.20);

    return bridgeExcitation * bodyCoupling;
}

function createPianoNote(frequency) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

while (activePianoNodes.length >= MAX_PIANO_VOICES) {
    const oldVoice = activePianoNodes.shift();

    try {
        oldVoice.oscillators.forEach(node => {
            if (node.stop) node.stop();
        });

        oldVoice.nodes.forEach(node => {
            if (node.disconnect) node.disconnect();
        });
    } catch (e) {
        // Safe cleanup
    }
}
    
const presence =
    getValue(presenceSlider, 0) / 100;

pianoVoicing.stringWarmth =
    1.0 + (presence * 0.45);

pianoVoicing.bodyDepth =
    1.0 + (presence * 0.35);

pianoVoicing.soundboardBloom =
    1.0 + (presence * 0.50);

pianoVoicing.cabinetSize =
    1.0 + (presence * 0.25);

pianoVoicing.duplexShimmer =
    1.0 + (presence * 0.30);
    
console.log("NEW CLEAN PIANO CORE ACTIVE");
    
  const voiceOut = ctx.createGain();
  voiceOut.gain.setValueAtTime(0.0001, now);
  voiceOut.gain.linearRampToValueAtTime(0.30, now + 0.008);
  voiceOut.gain.exponentialRampToValueAtTime(0.001, now + 2.8);

  const stringA = ctx.createOscillator();
  const stringB = ctx.createOscillator();

  const stringAGain = ctx.createGain();
  const stringBGain = ctx.createGain();

  stringA.type = "sine";
  stringB.type = "sine";

  stringA.frequency.setValueAtTime(frequency, now);
  stringB.frequency.setValueAtTime(frequency * 2.002, now);

  stringAGain.gain.setValueAtTime(0.72, now);
  stringBGain.gain.setValueAtTime(0.18, now);

  const pianoFilter = ctx.createBiquadFilter();
  pianoFilter.type = "lowpass";
  pianoFilter.frequency.setValueAtTime(5200, now);
  pianoFilter.Q.setValueAtTime(0.45, now);

  stringA.connect(stringAGain);
  stringB.connect(stringBGain);

  stringAGain.connect(pianoFilter);
  stringBGain.connect(pianoFilter);

  pianoFilter.connect(voiceOut);

  voiceOut.connect(dryGain);
  voiceOut.connect(reverbNode);
  voiceOut.connect(delayDryGain);
  voiceOut.connect(delayNode);

  stringA.start(now + 0.002);
  stringB.start(now + 0.002);

  stringA.stop(now + 2.9);
  stringB.stop(now + 2.9);

  activePianoNodes.push({
    oscillators: [stringA, stringB],
    nodes: [
        stringAGain,
        stringBGain,
        pianoFilter,
        voiceOut
    ]
});
    }
function applyPresetSettings(preset) {
  if (!preset) return;

  currentResonanceSource = preset.engine || "synth";
currentEngine = currentResonanceSource; // temporary compatibility bridge
    
  if (currentResonanceSource === "piano") {
    if (preset.masterVolume !== undefined) {
      masterVolume.value = preset.masterVolume;
    }

    updateValueDisplays();
    stopAllNotes();
    return;
  }

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
      applyPresetSettings({
        ...(presetData.settings || {}),
        engine: presetData.engine
      });
    });

    presetGrid.appendChild(button);
  });
}
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
  if (!savedPresetSelect) return;
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
  if (Date.now() - lastTouchTime < 500) return;

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

    lastTouchTime = Date.now();

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
