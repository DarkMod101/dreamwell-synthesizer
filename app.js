let audioContext;
let activeOscillator = null;
let activeGain = null;

const waveformSelect = document.getElementById("waveform");
const keys = document.querySelectorAll(".key");

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playNote(frequency) {
  const ctx = getAudioContext();

  stopNote();

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = waveformSelect.value;
  oscillator.frequency.value = frequency;

  gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.03);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start();

  activeOscillator = oscillator;
  activeGain = gainNode;
}

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
