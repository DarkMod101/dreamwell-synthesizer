let audioContext;
let masterGain;

let activeOscillator = null;
let activeGain = null;
let activeLFO = null;
let activeLFOGain = null;

const waveformSelect = document.getElementById("waveform");
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

function getValue(element, fallback) {
  return element ? Number(element.value) : fallback;
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();

    masterGain = audioContext.createGain();
    masterGain.gain.value = getValue(masterVolume, 0.25);
    masterGain.connect(audioContext.destination);
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
  const filter = ctx.createBiquadFilter();
  const noteGain = ctx.createGain();

  oscillator.type = waveformSelect ? waveformSelect.value : "sine";
  oscillator.frequency.value = frequency;

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

  oscillator.connect(filter);
  filter.connect(noteGain);
  noteGain.connect(masterGain);

  oscillator.start();

  activeOscillator = oscillator;
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
