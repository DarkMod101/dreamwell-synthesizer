let audioContext;
let masterGain;
let reverbNode;
let reverbWetGain;
let dryGain;

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

function getValue(element, fallback) {
  return element ? Number(element.value) : fallback;
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

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();

    masterGain = audioContext.createGain();
    masterGain.gain.value = getValue(masterVolume, 0.25);
    masterGain.connect(audioContext.destination);

    setupReverb(audioContext);
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

if (masterVolume) {
  masterVolume.addEventListener("input", () => {
    const ctx = getAudioContext();
    masterGain.gain.setTargetAtTime(
      Number(masterVolume.value),
      ctx.currentTime,
      0.01
    );
  });
}

if (reverbMixSlider) {
  reverbMixSlider.addEventListener("input", () => {
    const ctx = getAudioContext();
    const mix = Number(reverbMixSlider.value);

    dryGain.gain.setTargetAtTime(1 - mix, ctx.currentTime, 0.01);
    reverbWetGain.gain.setTargetAtTime(mix, ctx.currentTime, 0.01);
  });
}

if (reverbDecaySlider) {
  reverbDecaySlider.addEventListener("change", () => {
    const ctx = getAudioContext();
    const decay = Number(reverbDecaySlider.value);

    reverbNode.buffer = createReverbImpulse(ctx, decay);
  });
}

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
