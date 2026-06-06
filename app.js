let audioContext;
let masterGain;
let activeOscillator = null;
let activeGain = null;
const attackSlider = document.getElementById("attack");
const decaySlider = document.getElementById("decay");
const sustainSlider = document.getElementById("sustain");
const releaseSlider = document.getElementById("release");
const waveformSelect = document.getElementById("waveform");
const masterVolume = document.getElementById("masterVolume");
const keys = document.querySelectorAll(".key");
const filterTypeSelect = document.getElementById("filterType");
const cutoffSlider = document.getElementById("cutoff");
const resonanceSlider = document.getElementById("resonance");

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();

    masterGain = audioContext.createGain();
    masterGain.gain.value = Number(masterVolume.value);
    masterGain.connect(audioContext.destination);
  }

  return audioContext;
}

function playNote(frequency) {
  const ctx = getAudioContext();

  stopNote();

  const attack = Number(attackSlider.value);
  const decay = Number(decaySlider.value);
  const sustain = Number(sustainSlider.value);

  const oscillator = ctx.createOscillator();
  const noteGain = ctx.createGain();

  oscillator.type = waveformSelect.value;
  oscillator.frequency.value = frequency;

  noteGain.gain.setValueAtTime(0.001, ctx.currentTime);

  noteGain.gain.exponentialRampToValueAtTime(
    1,
    ctx.currentTime + attack
  );

  noteGain.gain.linearRampToValueAtTime(
    sustain,
    ctx.currentTime + attack + decay
  );

  oscillator.connect(noteGain);
  noteGain.connect(masterGain);

  oscillator.start();

  activeOscillator = oscillator;
  activeGain = noteGain;
}

function stopNote() {
  if (activeOscillator && activeGain) {

    const ctx = getAudioContext();
    const release = Number(releaseSlider.value);

    activeGain.gain.cancelScheduledValues(ctx.currentTime);

    activeGain.gain.setValueAtTime(
      activeGain.gain.value,
      ctx.currentTime
    );

    activeGain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + release
    );

    activeOscillator.stop(
      ctx.currentTime + release + 0.05
    );

    activeOscillator = null;
    activeGain = null;
  }
}

masterVolume.addEventListener("input", () => {
  const ctx = getAudioContext();
  masterGain.gain.setTargetAtTime(Number(masterVolume.value), ctx.currentTime, 0.01);
});

keys.forEach((key) => {
  key.addEventListener("mousedown", () => playNote(Number(key.dataset.note)));
  key.addEventListener("mouseup", stopNote);
  key.addEventListener("mouseleave", stopNote);

  key.addEventListener("touchstart", (event) => {
    event.preventDefault();
    playNote(Number(key.dataset.note));
  });

  key.addEventListener("touchend", stopNote);
});
function stopNote() {
  if (activeOscillator && activeGain) {
    const ctx = getAudioContext();

    activeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    activeOscillator.stop(ctx.currentTime + 0.06);

    activeOscillator = null;
    activeGain = null;
  }
}

keys.forEach((key) => {
  key.addEventListener("mousedown", () => playNote(Number(key.dataset.note)));
  key.addEventListener("mouseup", stopNote);
  key.addEventListener("mouseleave", stopNote);

  key.addEventListener("touchstart", (event) => {
    event.preventDefault();
    playNote(Number(key.dataset.note));
  });

  key.addEventListener("touchend", stopNote);
});playBtn.addEventListener("click", startAudio);
stopBtn.addEventListener("click", stopAudio);
