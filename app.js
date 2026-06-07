let audioContext;
let masterGain;
let reverbNode;
let reverbWetGain;
let dryGain;
let delayNode;
let delayFeedbackGain;
let delayWetGain;
let delayDryGain;

let activeOscillator = null;
let activeOscillatorB = null;
let activeGain = null;
let activeLFO = null;
let activeLFOGain = null;

const waveformSelect = document.getElementById("waveform");
const waveformBSelect = document.getElementById("waveformB");
const oscBLevelSlider = document.getElementById("oscBLevel");
const oscBDetuneSlider = document.getElementById("oscBDetune");
const masterVolume = document.getElementById("masterVolume");
const keys = document.querySelectorAll(".key");

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

const reverbMixSlider = document.getElementById("reverbMix");
const reverbDecaySlider = document.getElementById("reverbDecay");

const delayMixSlider = document.getElementById("delayMix");
const delayTimeSlider = document.getElementById("delayTime");
const delayFeedbackSlider = document.getElementById("delayFeedback");

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

function setDisplay(display, text) {
  if (display) {
    display.textContent = text;
  }
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

function playNote(frequency) {
  const ctx = getAudioContext();

  stopNote();

  const attack = getValue(attackSlider, 0.05);
  const decay = getValue(decaySlider, 0.2);
  const sustain = getValue(sustainSlider, 0.7);

  const oscillator = ctx.createOscillator();
  const oscillatorB = ctx.createOscillator();

  const oscAGain = ctx.createGain();
  const oscBGain = ctx.createGain();

  const filter = ctx.createBiquadFilter();
  const noteGain = ctx.createGain();

  oscillator.type = waveformSelect ? waveformSelect.value : "sine";
  oscillator.frequency.value = frequency;

  oscillatorB.type = waveformBSelect ? waveformBSelect.value : "sawtooth";
  oscillatorB.frequency.value = frequency;
  oscillatorB.detune.value = getValue(oscBDetuneSlider, 7);

  oscAGain.gain.value = 1;
  oscBGain.gain.value = getValue(oscBLevelSlider, 0.35);

  filter.type = filterTypeSelect ? filterTypeSelect.value : "lowpass";
  filter.frequency.value = getValue(cutoffSlider, 4000);
  filter.Q.value = getValue(resonanceSlider, 1);

  noteGain.gain.setValueAtTime(0.001, ctx.currentTime);
  noteGain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + attack);
  noteGain.gain.linearRampToValueAtTime(
    sustain,
    ctx.currentTime + attack + decay
  );

  const lfoAmount = getValue(lfoAmountSlider, 0);

  if (lfoAmount > 0 && lfoRateSlider && lfoDestinationSelect) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    lfo.frequency.value = getValue(lfoRateSlider, 2);

    if (lfoDestinationSelect.value === "filter") {
      lfoGain.gain.value = lfoAmount;
      lfoGain.connect(filter.frequency);
    }

    if (lfoDestinationSelect.value === "pitch") {
      lfoGain.gain.value = lfoAmount;
      lfoGain.connect(oscillator.frequency);
      lfoGain.connect(oscillatorB.frequency);
    }

    if (lfoDestinationSelect.value === "volume") {
      lfoGain.gain.value = lfoAmount / 2000;
      lfoGain.connect(noteGain.gain);
    }

    lfo.connect(lfoGain);
    lfo.start();

    activeLFO = lfo;
    activeLFOGain = lfoGain;
  }

  oscillator.connect(oscAGain);
  oscillatorB.connect(oscBGain);

  oscAGain.connect(filter);
  oscBGain.connect(filter);

  filter.connect(noteGain);

  noteGain.connect(dryGain);
  noteGain.connect(reverbNode);

  noteGain.connect(delayDryGain);
  noteGain.connect(delayNode);

  oscillator.start();
  oscillatorB.start();

  activeOscillator = oscillator;
  activeOscillatorB = oscillatorB;
  activeGain = noteGain;
}

function stopNote() {
  if (activeOscillator && activeGain) {
    const ctx = getAudioContext();
    const release = getValue(releaseSlider, 0.5);

    activeGain.gain.cancelScheduledValues(ctx.currentTime);
    activeGain.gain.setValueAtTime(activeGain.gain.value, ctx.currentTime);
    activeGain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + release
    );

    activeOscillator.stop(ctx.currentTime + release + 0.05);

    if (activeOscillatorB) {
      activeOscillatorB.stop(ctx.currentTime + release + 0.05);
      activeOscillatorB.disconnect();
      activeOscillatorB = null;
    }

    if (activeLFO) {
      activeLFO.stop(ctx.currentTime + release + 0.05);
      activeLFO.disconnect();
      activeLFO = null;
    }

    if (activeLFOGain) {
      activeLFOGain.disconnect();
      activeLFOGain = null;
    }

    activeOscillator = null;
    activeGain = null;
  }
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
  masterGain.gain.setTargetAtTime(
    Number(masterVolume.value),
    ctx.currentTime,
    0.01
  );
});

bindSlider(reverbMixSlider, () => {
  const ctx = getAudioContext();
  const mix = Number(reverbMixSlider.value);

  dryGain.gain.setTargetAtTime(1 - mix, ctx.currentTime, 0.01);
  reverbWetGain.gain.setTargetAtTime(mix, ctx.currentTime, 0.01);
});

bindSlider(reverbDecaySlider, () => {
  const ctx = getAudioContext();
  reverbNode.buffer = createReverbImpulse(
    ctx,
    Number(reverbDecaySlider.value)
  );
});

bindSlider(delayMixSlider, () => {
  const ctx = getAudioContext();
  const mix = Number(delayMixSlider.value);

  delayDryGain.gain.setTargetAtTime(1 - mix, ctx.currentTime, 0.01);
  delayWetGain.gain.setTargetAtTime(mix, ctx.currentTime, 0.01);
});

bindSlider(delayTimeSlider, () => {
  const ctx = getAudioContext();

  delayNode.delayTime.setTargetAtTime(
    Number(delayTimeSlider.value),
    ctx.currentTime,
    0.01
  );
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
].forEach((slider) => bindSlider(slider));

keys.forEach((key) => {
  key.addEventListener("mousedown", () => {
    playNote(Number(key.dataset.note));
  });

  key.addEventListener("mouseup", stopNote);
  key.addEventListener("mouseleave", stopNote);

  key.addEventListener("touchstart", (event) => {
    event.preventDefault();
    playNote(Number(key.dataset.note));
  });

  key.addEventListener("touchend", stopNote);
});

const presetButtons = document.querySelectorAll(".preset-btn");

const presets = {

  dreamPad: {
    waveform: "sine",
    attack: 1.8,
    decay: 1.2,
    sustain: 0.8,
    release: 3.5,
    cutoff: 1800,
    resonance: 2,
    lfoRate: 0.4,
    lfoAmount: 150,
    reverbMix: 0.65,
    delayMix: 0.25
  },

  theWell: {
    waveform: "triangle",
    attack: 0.8,
    decay: 1,
    sustain: 0.7,
    release: 4,
    cutoff: 1200,
    resonance: 4,
    lfoRate: 0.3,
    lfoAmount: 250,
    reverbMix: 0.8,
    delayMix: 0.4
  },

  abyss: {
    waveform: "sawtooth",
    attack: 0.05,
    decay: 0.5,
    sustain: 0.6,
    release: 2.5,
    cutoff: 700,
    resonance: 7,
    lfoRate: 0.2,
    lfoAmount: 400,
    reverbMix: 0.7,
    delayMix: 0.5
  },

  resonantDoorway: {
    waveform: "triangle",
    attack: 0.2,
    decay: 0.8,
    sustain: 0.8,
    release: 2,
    cutoff: 2500,
    resonance: 5,
    lfoRate: 2,
    lfoAmount: 200,
    reverbMix: 0.55,
    delayMix: 0.3
  },

  falling: {
    waveform: "sine",
    attack: 3,
    decay: 2,
    sustain: 0.5,
    release: 5,
    cutoff: 900,
    resonance: 3,
    lfoRate: 0.1,
    lfoAmount: 500,
    reverbMix: 0.9,
    delayMix: 0.45
  }
};

presetButtons.forEach((button) => {

  button.addEventListener("click", () => {

    const preset = presets[button.dataset.preset];

    waveformSelect.value = preset.waveform;

    attackSlider.value = preset.attack;
    decaySlider.value = preset.decay;
    sustainSlider.value = preset.sustain;
    releaseSlider.value = preset.release;

    cutoffSlider.value = preset.cutoff;
    resonanceSlider.value = preset.resonance;

    lfoRateSlider.value = preset.lfoRate;
    lfoAmountSlider.value = preset.lfoAmount;

    reverbMixSlider.value = preset.reverbMix;
    delayMixSlider.value = preset.delayMix;

    updateValueDisplays();

  });

});

updateValueDisplays();
