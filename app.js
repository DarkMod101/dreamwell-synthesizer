let audioContext;
let oscillator;
let gainNode;

const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const waveformSelect = document.getElementById("waveform");

function startAudio() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  stopAudio();

  oscillator = audioContext.createOscillator();
  gainNode = audioContext.createGain();

  oscillator.type = waveformSelect.value;
  oscillator.frequency.value = 220; // A3 note
  gainNode.gain.value = 0.25;

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
}

function stopAudio() {
  if (oscillator) {
    oscillator.stop();
    oscillator.disconnect();
    oscillator = null;
  }
}

playBtn.addEventListener("click", startAudio);
stopBtn.addEventListener("click", stopAudio);
