/**
 * Dreamwell Synthesizer - Master Audio Application File
 * Fully Integrated Presets Database, Web Audio Graph Engine & Performance Controls
 */

// ============================================================================
// 1. GLOBAL STATE & SYSTEM ARCHITECTURE
// ============================================================================
const synthState = {
  audioContext: null,
  masterGain: null,
  
  // Audio FX Routing Nodes
  delayNode: null,
  delayFeedbackNode: null,
  delayWetGain: null,
  reverbNode: null,
  reverbWetGain: null,
  dryGainNode: null,
  
  // Tracking Maps & Registries
  activeVoices: new Map(),      // Tracks active notes: key = base frequency string, value = voice object
  heldKeys: [],                 // Ordered array of user notes held down (for Arp)
  
  // Parameter State Modifiers
  octaveShift: 0,
  moduleMode: 'synth',          // Modes: 'synth' or 'grand_piano'
  
  // Dream Arpeggiator Engine Variables
  arpIntervalId: null,
  arpIndex: 0,
  arpCurrentNote: null,
  arpDirectionUp: true,         
  
  // Custom Waves (Computed Tables)
  trapezoidWave: null
};

// Built-in Instrument Patch Presets Bank Library (Original Sound Math Fully Preserved)
const presetLibrary = {
  signature: [
    { 
      name: "Piano Test", 
      moduleMode: "grand_piano",
      waveform: "triangle", waveformB: "sine", waveFusion: 50, subWaveform: "sine", subLevel: 0, oscBLevel: 0.35, oscBDetune: 6, voiceSpread: 0, noiseAmount: 0, drift: 5, stereoWidth: 40, attack: 0.002, decay: 1.60, sustain: 3, release: 0.45, filterType: "lowpass", cutoff: 6200, resonance: 1.0, lfoRate: 2.0, lfoAmount: 0, lfoDestination: "pitch", reverbMix: 35, reverbDecay: 3.5, delayMix: 0, delayTime: 300, delayFeedback: 20, masterVolume: 0.30, presence: 40 
    },
    { name: "Dream Pad", moduleMode: "synth", waveform: "triangle", waveformB: "sine", waveFusion: 30, subWaveform: "sine", subLevel: 30, oscBLevel: 0.25, oscBDetune: 12, voiceSpread: 80, noiseAmount: 20, drift: 45, stereoWidth: 90, attack: 1.50, decay: 2.00, sustain: 90, release: 2.50, filterType: "lowpass", cutoff: 950, resonance: 1.5, lfoRate: 0.4, lfoAmount: 350, lfoDestination: "filter", reverbMix: 65, reverbDecay: 6.5, delayMix: 50, delayTime: 680, delayFeedback: 60, masterVolume: 0.22, presence: 10 },
    { name: "The Well", moduleMode: "synth", waveform: "sine", waveformB: "triangle", waveFusion: 45, subWaveform: "sine", subLevel: 25, oscBLevel: 0.40, oscBDetune: 5, voiceSpread: 30, noiseAmount: 15, drift: 15, stereoWidth: 60, attack: 0.10, decay: 1.00, sustain: 60, release: 0.80, filterType: "lowpass", cutoff: 1400, resonance: 2.0, lfoRate: 1.2, lfoAmount: 200, lfoDestination: "filter", reverbMix: 40, reverbDecay: 4.0, delayMix: 30, delayTime: 400, delayFeedback: 40, masterVolume: 0.25, presence: 20 },
    { name: "Abyss", moduleMode: "synth", waveform: "square", waveformB: "sawtooth", waveFusion: 20, subWaveform: "square", subLevel: 70, oscBLevel: 0.50, oscBDetune: 8, voiceSpread: 10, noiseAmount: 30, drift: 8, stereoWidth: 15, attack: 0.01, decay: 0.45, sustain: 80, release: 0.35, filterType: "lowpass", cutoff: 450, resonance: 4.0, lfoRate: 0.8, lfoAmount: 150, lfoDestination: "filter", reverbMix: 20, reverbDecay: 2.0, delayMix: 15, delayTime: 250, delayFeedback: 30, masterVolume: 0.28, presence: 5 },
    { name: "Resonant Doorway", moduleMode: "synth", waveform: "sine", waveformB: "sawtooth", waveFusion: 40, subWaveform: "sine", subLevel: 20, oscBLevel: 0.40, oscBDetune: 8, voiceSpread: 35, noiseAmount: 15, drift: 20, stereoWidth: 60, attack: 0.25, decay: 0.60, sustain: 75, release: 1.20, filterType: "lowpass", cutoff: 1800, resonance: 2.5, lfoRate: 1.5, lfoAmount: 400, lfoDestination: "filter", reverbMix: 45, reverbDecay: 4.5, delayMix: 35, delayTime: 450, delayFeedback: 50, masterVolume: 0.25, presence: 30 },
    { name: "Falling", moduleMode: "synth", waveform: "sawtooth", waveformB: "sine", waveFusion: 20, subWaveform: "sine", subLevel: 10, oscBLevel: 0.30, oscBDetune: 15, voiceSpread: 50, noiseAmount: 5, drift: 30, stereoWidth: 70, attack: 0.60, decay: 1.20, sustain: 50, release: 1.80, filterType: "lowpass", cutoff: 1200, resonance: 1.8, lfoRate: 2.5, lfoAmount: 250, lfoDestination: "filter", reverbMix: 50, reverbDecay: 5.0, delayMix: 40, delayTime: 600, delayFeedback: 45, masterVolume: 0.25, presence: 15 },
    { name: "Void Gate", moduleMode: "synth", waveform: "square", waveformB: "square", waveFusion: 50, subWaveform: "triangle", subLevel: 40, oscBLevel: 0.50, oscBDetune: 5, voiceSpread: 15, noiseAmount: 25, drift: 10, stereoWidth: 20, attack: 0.02, decay: 0.40, sustain: 60, release: 0.40, filterType: "lowpass", cutoff: 850, resonance: 3.5, lfoRate: 1.0, lfoAmount: 600, lfoDestination: "filter", reverbMix: 30, reverbDecay: 2.5, delayMix: 20, delayTime: 250, delayFeedback: 35, masterVolume: 0.25, presence: 5 },
    { name: "Astral Piano", moduleMode: "synth", waveform: "triangle", waveformB: "sine", waveFusion: 60, subWaveform: "sine", subLevel: 15, oscBLevel: 0.35, oscBDetune: 10, voiceSpread: 45, noiseAmount: 8, drift: 18, stereoWidth: 65, attack: 0.05, decay: 1.40, sustain: 40, release: 0.80, filterType: "lowpass", cutoff: 2500, resonance: 1.5, lfoRate: 3.2, lfoAmount: 180, lfoDestination: "pitch", reverbMix: 45, reverbDecay: 4.0, delayMix: 25, delayTime: 350, delayFeedback: 30, masterVolume: 0.26, presence: 35 },
    { name: "Portal Key", moduleMode: "synth", waveform: "sine", waveformB: "triangle", waveFusion: 65, subWaveform: "sine", subLevel: 15, oscBLevel: 0.45, oscBDetune: 4, voiceSpread: 25, noiseAmount: 8, drift: 12, stereoWidth: 50, attack: 0.01, decay: 0.70, sustain: 45, release: 0.55, filterType: "lowpass", cutoff: 2800, resonance: 1.2, lfoRate: 3.8, lfoAmount: 120, lfoDestination: "pitch", reverbMix: 30, reverbDecay: 3.0, delayMix: 35, delayTime: 330, delayFeedback: 40, masterVolume: 0.25, presence: 35 },
    { name: "Cathedral", moduleMode: "synth", waveform: "sawtooth", waveformB: "sawtooth", waveFusion: 50, subWaveform: "sine", subLevel: 50, oscBLevel: 0.60, oscBDetune: 10, voiceSpread: 60, noiseAmount: 10, drift: 20, stereoWidth: 80, attack: 0.40, decay: 1.50, sustain: 80, release: 2.00, filterType: "lowpass", cutoff: 2100, resonance: 2.0, lfoRate: 0.8, lfoAmount: 150, lfoDestination: "filter", reverbMix: 70, reverbDecay: 6.0, delayMix: 30, delayTime: 500, delayFeedback: 50, masterVolume: 0.22, presence: 45 },
    { name: "Ancient Machine", moduleMode: "synth", waveform: "triangle", waveformB: "trapezoid", waveFusion: 70, subWaveform: "square", subLevel: 20, oscBLevel: 0.40, oscBDetune: 18, voiceSpread: 85, noiseAmount: 40, drift: 50, stereoWidth: 90, attack: 0.15, decay: 0.90, sustain: 50, release: 1.40, filterType: "highpass", cutoff: 1500, resonance: 2.2, lfoRate: 1.2, lfoAmount: 400, lfoDestination: "filter", reverbMix: 40, reverbDecay: 4.0, delayMix: 50, delayTime: 650, delayFeedback: 60, masterVolume: 0.20, presence: 25 }
  ],
  keys: [
    { name: "Dream Well Piano", moduleMode: "synth", waveform: "sine", waveformB: "triangle", waveFusion: 30, subWaveform: "sine", subLevel: 10, oscBLevel: 0.40, oscBDetune: 5, voiceSpread: 20, noiseAmount: 5, drift: 10, stereoWidth: 50, attack: 0.01, decay: 0.80, sustain: 30, release: 0.50, filterType: "lowpass", cutoff: 2000, resonance: 1.5, lfoRate: 1.0, lfoAmount: 50, lfoDestination: "filter", reverbMix: 30, reverbDecay: 3.0, delayMix: 20, delayTime: 300, delayFeedback: 30, masterVolume: 0.25, presence: 30 },
    { name: "Celestial Rhodes", moduleMode: "synth", waveform: "sine", waveformB: "sine", waveFusion: 50, subWaveform: "sine", subLevel: 0, oscBLevel: 0.30, oscBDetune: 8, voiceSpread: 40, noiseAmount: 0, drift: 15, stereoWidth: 70, attack: 0.01, decay: 1.20, sustain: 20, release: 0.80, filterType: "lowpass", cutoff: 1500, resonance: 1.0, lfoRate: 4.0, lfoAmount: 80, lfoDestination: "pitch", reverbMix: 40, reverbDecay: 4.5, delayMix: 25, delayTime: 400, delayFeedback: 35, masterVolume: 0.25, presence: 20 }
  ],
  pads: [
    { name: "Ethereal Whispers", moduleMode: "synth", waveform: "triangle", waveformB: "sine", waveFusion: 40, subWaveform: "sine", subLevel: 30, oscBLevel: 0.30, oscBDetune: 15, voiceSpread: 85, noiseAmount: 25, drift: 40, stereoWidth: 95, attack: 2.00, decay: 2.50, sustain: 85, release: 3.00, filterType: "lowpass", cutoff: 800, resonance: 1.2, lfoRate: 0.3, lfoAmount: 400, lfoDestination: "filter", reverbMix: 70, reverbDecay: 7.0, delayMix: 45, delayTime: 700, delayFeedback: 55, masterVolume: 0.20, presence: 15 },
    { name: "Cosmic Horizon", moduleMode: "synth", waveform: "sawtooth", waveformB: "triangle", waveFusion: 50, subWaveform: "sine", subLevel: 40, oscBLevel: 0.40, oscBDetune: 10, voiceSpread: 75, noiseAmount: 10, drift: 25, stereoWidth: 85, attack: 1.20, decay: 2.00, sustain: 75, release: 2.20, filterType: "lowpass", cutoff: 1100, resonance: 1.6, lfoRate: 0.6, lfoAmount: 200, lfoDestination: "filter", reverbMix: 55, reverbDecay: 5.5, delayMix: 35, delayTime: 550, delayFeedback: 45, masterVolume: 0.22, presence: 25 },
    { name: "Deep Meditation", moduleMode: "synth", waveform: "sine", waveformB: "sine", waveFusion: 50, subWaveform: "sine", subLevel: 50, oscBLevel: 0.20, oscBDetune: 4, voiceSpread: 60, noiseAmount: 5, drift: 12, stereoWidth: 75, attack: 2.50, decay: 3.00, sustain: 90, release: 3.50, filterType: "lowpass", cutoff: 500, resonance: 1.0, lfoRate: 0.2, lfoAmount: 100, lfoDestination: "volume", reverbMix: 60, reverbDecay: 8.0, delayMix: 30, delayTime: 600, delayFeedback: 40, masterVolume: 0.25, presence: 5 }
  ],
  leads: [
    { name: "Hyperdrive Lead", moduleMode: "synth", waveform: "sawtooth", waveformB: "square", waveFusion: 60, subWaveform: "sawtooth", subLevel: 25, oscBLevel: 0.50, oscBDetune: 14, voiceSpread: 40, noiseAmount: 12, drift: 35, stereoWidth: 60, attack: 0.02, decay: 0.50, sustain: 70, release: 0.40, filterType: "lowpass", cutoff: 3500, resonance: 3.0, lfoRate: 5.5, lfoAmount: 150, lfoDestination: "pitch", reverbMix: 35, reverbDecay: 3.2, delayMix: 40, delayTime: 280, delayFeedback: 50, masterVolume: 0.24, presence: 40 },
    { name: "Neon Voyager", moduleMode: "synth", waveform: "square", waveformB: "trapezoid", waveFusion: 45, subWaveform: "triangle", subLevel: 15, oscBLevel: 0.45, oscBDetune: 18, voiceSpread: 55, noiseAmount: 8, drift: 28, stereoWidth: 70, attack: 0.05, decay: 0.70, sustain: 60, release: 0.50, filterType: "lowpass", cutoff: 2200, resonance: 2.2, lfoRate: 2.8, lfoAmount: 300, lfoDestination: "filter", reverbMix: 40, reverbDecay: 4.0, delayMix: 30, delayTime: 350, delayFeedback: 40, masterVolume: 0.25, presence: 35 }
  ],
  bass: [
    { name: "Subterranean Bass", moduleMode: "synth", waveform: "triangle", waveformB: "square", waveFusion: 20, subWaveform: "sine", subLevel: 85, oscBLevel: 0.35, oscBDetune: 5, voiceSpread: 10, noiseAmount: 15, drift: 10, stereoWidth: 20, attack: 0.01, decay: 0.40, sustain: 85, release: 0.30, filterType: "lowpass", cutoff: 350, resonance: 2.0, lfoRate: 1.0, lfoAmount: 80, lfoDestination: "filter", reverbMix: 15, reverbDecay: 1.8, delayMix: 10, delayTime: 200, delayFeedback: 25, masterVolume: 0.30, presence: 10 },
    { name: "Acid Grime", moduleMode: "synth", waveform: "sawtooth", waveformB: "sawtooth", waveFusion: 50, subWaveform: "square", subLevel: 50, oscBLevel: 0.60, oscBDetune: 12, voiceSpread: 25, noiseAmount: 20, drift: 20, stereoWidth: 40, attack: 0.01, decay: 0.35, sustain: 65, release: 0.35, filterType: "lowpass", cutoff: 800, resonance: 5.0, lfoRate: 3.5, lfoAmount: 450, lfoDestination: "filter", reverbMix: 25, reverbDecay: 2.5, delayMix: 20, delayTime: 240, delayFeedback: 35, masterVolume: 0.26, presence: 25 }
  ],
  textures: [
    { name: "Stardust Rain", moduleMode: "synth", waveform: "sine", waveformB: "trapezoid", waveFusion: 75, subWaveform: "sine", subLevel: 10, oscBLevel: 0.55, oscBDetune: 25, voiceSpread: 90, noiseAmount: 50, drift: 60, stereoWidth: 99, attack: 0.80, decay: 1.80, sustain: 50, release: 2.00, filterType: "highpass", cutoff: 2000, resonance: 3.5, lfoRate: 6.0, lfoAmount: 500, lfoDestination: "filter", reverbMix: 65, reverbDecay: 5.5, delayMix: 55, delayTime: 480, delayFeedback: 65, masterVolume: 0.20, presence: 50 },
    { name: "Abandonded Station", moduleMode: "synth", waveform: "square", waveformB: "sawtooth", waveFusion: 50, subWaveform: "square", subLevel: 30, oscBLevel: 0.40, oscBDetune: 22, voiceSpread: 70, noiseAmount: 40, drift: 45, stereoWidth: 80, attack: 0.50, decay: 2.20, sustain: 70, release: 2.50, filterType: "lowpass", cutoff: 650, resonance: 2.8, lfoRate: 0.5, lfoAmount: 350, lfoDestination: "pitch", reverbMix: 60, reverbDecay: 6.5, delayMix: 45, delayTime: 650, delayFeedback: 60, masterVolume: 0.22, presence: 30 }
  ]
};

// ============================================================================
// 2. AUDIO INITIALIZATION & FX INFRASTRUCTURE GRAPH
// ============================================================================
function initAudio() {
  if (synthState.audioContext) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  synthState.audioContext = new AudioContext();

  synthState.masterGain = synthState.audioContext.createGain();
  synthState.masterGain.gain.setValueAtTime(parseFloat(document.getElementById('masterVolume').value), synthState.audioContext.currentTime);

  synthState.dryGainNode = synthState.audioContext.createGain();
  synthState.delayNode = synthState.audioContext.createDelay(2.0);
  synthState.delayFeedbackNode = synthState.audioContext.createGain();
  synthState.delayWetGain = synthState.audioContext.createGain();
  
  synthState.reverbNode = synthState.audioContext.createConvolver();
  synthState.reverbWetGain = synthState.audioContext.createGain();

  // Topology Routing
  synthState.dryGainNode.connect(synthState.masterGain);

  synthState.delayNode.connect(synthState.delayFeedbackNode);
  synthState.delayFeedbackNode.connect(synthState.delayNode); 
  synthState.delayNode.connect(synthState.delayWetGain);
  synthState.delayWetGain.connect(synthState.masterGain);

  buildSyntheticReverbImpulse(); 
  synthState.reverbNode.connect(synthState.reverbWetGain);
  synthState.reverbWetGain.connect(synthState.masterGain);

  synthState.masterGain.connect(synthState.audioContext.destination);

  updateDelayNodeSettings();
  updateReverbNodeSettings();
  generateCustomWaves();
}

function buildSyntheticReverbImpulse() {
  if (!synthState.audioContext) return;
  const decayTime = parseFloat(document.getElementById('reverbDecay').value) || 3.0;
  const rate = synthState.audioContext.sampleRate;
  const length = rate * decayTime;
  const impulse = synthState.audioContext.createBuffer(2, length, rate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  synthState.reverbNode.buffer = impulse;
}

function generateCustomWaves() {
  const real = new Float32Array(64);
  const imag = new Float32Array(64);
  for (let n = 1; n < 64; n++) {
    if (n % 2 !== 0) {
      real[n] = (8 / Math.PI ** 2) * Math.sin((n * Math.PI) / 3) / (n ** 2);
    }
  }
  synthState.trapezoidWave = synthState.audioContext.createPeriodicWave(real, imag);
}

function updateDelayNodeSettings() {
  if (!synthState.audioContext) return;
  
  // HTML slider is 0.0 to 1.0, matching the target parameters smoothly
  const mix = parseFloat(document.getElementById('delayMix').value);       
  const rawTime = parseFloat(document.getElementById('delayTime').value);   
  const feedback = parseFloat(document.getElementById('delayFeedback').value);

  // Safe normalization fallback logic if presets feed 0-100 values into sliders
  const actualMix = mix > 1 ? mix / 100 : mix;
  const actualTime = rawTime > 1.5 ? rawTime / 1000 : rawTime;
  const actualFeedback = feedback > 1 ? feedback / 100 : feedback;

  const now = synthState.audioContext.currentTime;
  synthState.delayNode.delayTime.setTargetAtTime(actualTime, now, 0.02);
  synthState.delayFeedbackNode.gain.setTargetAtTime(actualFeedback, now, 0.01);
  synthState.delayWetGain.gain.setTargetAtTime(actualMix, now, 0.01);
  synthState.dryGainNode.gain.setTargetAtTime(1.0 - (actualMix * 0.5), now, 0.01);
}

function updateReverbNodeSettings() {
  if (!synthState.audioContext) return;
  const mix = parseFloat(document.getElementById('reverbMix').value);
  const actualMix = mix > 1 ? mix / 100 : mix;
  synthState.reverbWetGain.gain.setTargetAtTime(actualMix, synthState.audioContext.currentTime, 0.01);
}

// ============================================================================
// 3. POLYPHONIC AUDIO SYNTHESIS ENGINE VOICE CLASS
// ============================================================================
class SynthVoice {
  constructor(frequency, audioContext, targets) {
    this.ctx = audioContext;
    this.freq = frequency;
    this.now = this.ctx.currentTime;
    
    this.voiceGain = this.ctx.createGain();
    this.voiceGain.gain.setValueAtTime(0, this.now);
    
    this.voiceGain.connect(targets.dry);
    this.voiceGain.connect(targets.delay);
    this.voiceGain.connect(targets.reverb);

    this.oscillators = [];
    this.lfo = null;

    if (synthState.moduleMode === 'grand_piano') {
      this.assembleGrandPianoEngine();
    } else {
      this.assembleSubtractiveSynthEngine();
    }
  }

  assembleGrandPianoEngine() {
    const oscString1 = this.ctx.createOscillator();
    oscString1.type = 'triangle';
    oscString1.frequency.setValueAtTime(this.freq, this.now);

    const oscString2 = this.ctx.createOscillator();
    oscString2.type = 'sine';
    oscString2.frequency.setValueAtTime(this.freq * 2.002, this.now); 

    const gainStr1 = this.ctx.createGain();
    const gainStr2 = this.ctx.createGain();
    gainStr1.gain.setValueAtTime(0.65, this.now);
    gainStr2.gain.setValueAtTime(0.35, this.now);

    const oscHammer = this.ctx.createOscillator();
    oscHammer.type = 'sine';
    oscHammer.frequency.setValueAtTime(this.freq * 5.2, this.now); 

    const gainHammer = this.ctx.createGain();
    gainHammer.gain.setValueAtTime(0.80, this.now);

    const dampingFilter = this.ctx.createBiquadFilter();
    dampingFilter.type = 'lowpass';
    const cutoffBase = Math.min(11000, this.freq * 3.8);
    dampingFilter.frequency.setValueAtTime(cutoffBase, this.now);
    dampingFilter.Q.setValueAtTime(1.1, this.now);

    const presenceVal = parseFloat(document.getElementById('presence').value) / 100;
    let finalOutputNode = dampingFilter;
    if (presenceVal > 0) {
      const presFilter = this.ctx.createBiquadFilter();
      presFilter.type = 'highshelf';
      presFilter.frequency.setValueAtTime(5500, this.now);
      presFilter.gain.setValueAtTime(presenceVal * 12, this.now);
      dampingFilter.connect(presFilter);
      finalOutputNode = presFilter;
    }

    oscString1.connect(gainStr1);
    oscString2.connect(gainStr2);
    oscHammer.connect(gainHammer);

    gainStr1.connect(dampingFilter);
    gainStr2.connect(dampingFilter);
    gainHammer.connect(dampingFilter);

    finalOutputNode.connect(this.voiceGain);

    this.oscillators.push(oscString1, oscString2, oscHammer);

    this.attack = 0.002;
    this.decay = Math.max(0.5, 3.8 - (this.freq / 300)); 
    this.sustain = 0.03;                                
    this.release = 0.45;

    gainHammer.gain.setValueAtTime(0.80, this.now);
    gainHammer.gain.exponentialRampToValueAtTime(0.0001, this.now + 0.03); 
  }

  assembleSubtractiveSynthEngine() {
    const waveA = document.getElementById('waveform').value;
    const waveB = document.getElementById('waveformB').value;
    const fusion = parseFloat(document.getElementById('waveFusion').value) / 100;
    const oscBVol = parseFloat(document.getElementById('oscBLevel').value);
    const detune = parseFloat(document.getElementById('oscBDetune').value);
    const subLevel = parseFloat(document.getElementById('subLevel').value) / 100;
    const subWave = document.getElementById('subWaveform').value;
    const cutoff = parseFloat(document.getElementById('cutoff').value);
    const resonance = parseFloat(document.getElementById('resonance').value);
    const presenceVal = parseFloat(document.getElementById('presence').value) / 100;

    this.attack = parseFloat(document.getElementById('attack').value);
    this.decay = parseFloat(document.getElementById('decay').value);
    
    // SOUND CORRECTION: Safely normalize sustain values if they are loaded on 0-100 scale
    const rawSustain = parseFloat(document.getElementById('sustain').value);
    this.sustain = rawSustain > 1.0 ? rawSustain / 100 : rawSustain;
    
    this.release = parseFloat(document.getElementById('release').value);

    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const oscSub = this.ctx.createOscillator();

    const gainA = this.ctx.createGain();
    const gainB = this.ctx.createGain();
    const gainSub = this.ctx.createGain();

    const synthFilter = this.ctx.createBiquadFilter();

    if (waveA === 'trapezoid') oscA.setPeriodicWave(synthState.trapezoidWave);
    else oscA.type = waveA;

    if (waveB === 'trapezoid') oscB.setPeriodicWave(synthState.trapezoidWave);
    else oscB.type = waveB;

    oscSub.type = subWave;

    oscA.frequency.setValueAtTime(this.freq, this.now);
    oscB.frequency.setValueAtTime(this.freq, this.now);
    oscB.detune.setValueAtTime(detune, this.now);
    oscSub.frequency.setValueAtTime(this.freq * 0.5, this.now); 

    gainA.gain.setValueAtTime(1.0 - fusion, this.now);
    gainB.gain.setValueAtTime(fusion * oscBVol, this.now);
    gainSub.gain.setValueAtTime(subLevel, this.now);

    synthFilter.type = document.getElementById('filterType').value;
    synthFilter.frequency.setValueAtTime(cutoff, this.now);
    synthFilter.Q.setValueAtTime(resonance, this.now);

    let finalFilterOutput = synthFilter;
    if (presenceVal > 0) {
      const presFilter = this.ctx.createBiquadFilter();
      presFilter.type = 'highshelf';
      presFilter.frequency.setValueAtTime(6000, this.now);
      presFilter.gain.setValueAtTime(presenceVal * 12, this.now);
      synthFilter.connect(presFilter);
      finalFilterOutput = presFilter;
    }

    oscA.connect(gainA);
    oscB.connect(gainB);
    oscSub.connect(gainSub);

    gainA.connect(synthFilter);
    gainB.connect(synthFilter);
    gainSub.connect(synthFilter);

    finalFilterOutput.connect(this.voiceGain);

    this.oscillators.push(oscA, oscB, oscSub);

    const lfoAmt = parseFloat(document.getElementById('lfoAmount').value);
    const lfoDestination = document.getElementById('lfoDestination').value;
    
    if (lfoAmt > 0) {
      const lfoRate = parseFloat(document.getElementById('lfoRate').value);
      this.lfo = this.ctx.createOscillator();
      this.lfo.type = 'sine';
      this.lfo.frequency.setValueAtTime(lfoRate, this.now);

      this.lfoGain = this.ctx.createGain();

      if (lfoDestination === 'filter') {
        this.lfoGain.gain.setValueAtTime(lfoAmt, this.now);
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(synthFilter.frequency);
      } else if (lfoDestination === 'pitch') {
        this.lfoGain.gain.setValueAtTime(lfoAmt * 0.1, this.now);
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(oscA.detune);
        this.lfoGain.connect(oscB.detune);
      } else if (lfoDestination === 'volume') {
        this.lfoGain.gain.setValueAtTime(lfoAmt / 3000 * 0.4, this.now);
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.voiceGain.gain);
      }
      this.lfo.start(this.now);
    }
  }

  start() {
    const startNow = this.ctx.currentTime;
    this.voiceGain.gain.setValueAtTime(0, startNow);
    this.voiceGain.gain.linearRampToValueAtTime(1.0, startNow + this.attack);
    this.voiceGain.gain.exponentialRampToValueAtTime(Math.max(this.sustain, 0.001), startNow + this.attack + this.decay);

    this.oscillators.forEach(osc => osc.start(startNow));
  }

  stop() {
    const stopNow = this.ctx.currentTime;
    this.voiceGain.gain.cancelScheduledValues(stopNow);
    this.voiceGain.gain.setValueAtTime(this.voiceGain.gain.value, stopNow);
    this.voiceGain.gain.exponentialRampToValueAtTime(0.0001, stopNow + this.release);
    
    this.oscillators.forEach(osc => osc.stop(stopNow + this.release));
    if (this.lfo) this.lfo.stop(stopNow + this.release);
  }
}

// ============================================================================
// 4. NOTE TRACKING BUS
// ============================================================================
function noteOn(baseFreq) {
  initAudio();
  
  const adjustedFreq = baseFreq * Math.pow(2, synthState.octaveShift);
  const voiceLookupKey = baseFreq.toFixed(2); 

  if (synthState.activeVoices.has(voiceLookupKey)) return;

  const internalRoutingTargets = {
    dry: synthState.dryGainNode,
    delay: synthState.delayNode,
    reverb: synthState.reverbNode
  };

  const voiceInstance = new SynthVoice(adjustedFreq, synthState.audioContext, internalRoutingTargets);
  voiceInstance.start();
  synthState.activeVoices.set(voiceLookupKey, voiceInstance);
}

function noteOff(baseFreq) {
  const voiceLookupKey = baseFreq.toFixed(2);
  const voiceInstance = synthState.activeVoices.get(voiceLookupKey);
  if (voiceInstance) {
    voiceInstance.stop();
    synthState.activeVoices.delete(voiceLookupKey);
  }
}

// ============================================================================
// 5. DREAM ARPEGGIATOR SCHEDULER MATRIX ENGINE
// ============================================================================
function manageArpeggiatorExecution() {
  const arpEnabled = document.getElementById('dreamArpEnabled').checked;

  if (!arpEnabled || synthState.heldKeys.length === 0) {
    if (synthState.arpIntervalId) {
      clearInterval(synthState.arpIntervalId);
      synthState.arpIntervalId = null;
    }
    if (synthState.arpCurrentNote) {
      noteOff(synthState.arpCurrentNote);
      synthState.arpCurrentNote = null;
    }
    return;
  }

  const rateSelection = parseInt(document.getElementById('arpRate').value); 
  let intervalMs = 250; 
  if (rateSelection === 1) intervalMs = 500;  
  if (rateSelection === 2) intervalMs = 250;  
  if (rateSelection === 3) intervalMs = 125;  
  if (rateSelection === 4) intervalMs = 62.5; 

  if (synthState.arpIntervalId) clearInterval(synthState.arpIntervalId);

  synthState.arpIntervalId = setInterval(() => {
    executeArpNextStep();
  }, intervalMs);
}

function executeArpNextStep() {
  if (synthState.heldKeys.length === 0) return;

  if (synthState.arpCurrentNote) {
    noteOff(synthState.arpCurrentNote);
  }

  const mode = document.getElementById('arpMode').value;
  let notesSorted = [...synthState.heldKeys].sort((a, b) => a - b);

  switch (mode) {
    case 'up':
      if (synthState.arpIndex >= notesSorted.length) synthState.arpIndex = 0;
      synthState.arpCurrentNote = notesSorted[synthState.arpIndex];
      synthState.arpIndex++;
      break;
    case 'down':
      notesSorted.reverse();
      if (synthState.arpIndex >= notesSorted.length) synthState.arpIndex = 0;
      synthState.arpCurrentNote = notesSorted[synthState.arpIndex];
      synthState.arpIndex++;
      break;
    case 'updown':
      if (notesSorted.length === 1) {
        synthState.arpCurrentNote = notesSorted[0];
        break;
      }
      if (synthState.arpIndex >= notesSorted.length) {
        synthState.arpIndex = notesSorted.length - 2;
        synthState.arpDirectionUp = false;
      } else if (synthState.arpIndex < 0) {
        synthState.arpIndex = 1;
        synthState.arpDirectionUp = true;
      }
      synthState.arpCurrentNote = notesSorted[synthState.arpIndex];
      synthState.arpIndex += synthState.arpDirectionUp ? 1 : -1;
      break;
    case 'random':
      const randomIndex = Math.floor(Math.random() * notesSorted.length);
      synthState.arpCurrentNote = notesSorted[randomIndex];
      break;
    case 'asPlayed':
      if (synthState.arpIndex >= synthState.heldKeys.length) synthState.arpIndex = 0;
      synthState.arpCurrentNote = synthState.heldKeys[synthState.arpIndex];
      synthState.arpIndex++;
      break;
  }

  if (synthState.arpCurrentNote) {
    noteOn(synthState.arpCurrentNote);
    
    const pianoKeys = document.querySelectorAll('.key');
    pianoKeys.forEach(key => {
      if (parseFloat(key.dataset.note) === synthState.arpCurrentNote) {
        key.classList.add('key-active');
        const gatePercent = parseFloat(document.getElementById('arpGate').value) / 100;
        const gateDuration = 250 * gatePercent; 
        setTimeout(() => key.classList.remove('key-active'), gateDuration);
      }
    });
  }
}

// ============================================================================
// 6. DOM INTERACTIVE PIANO KEYBOARD LISTENERS
// ============================================================================
const keyboardElement = document.querySelector('.keyboard');

function handlePhysicalKeyTriggerOn(keyBtn) {
  if (!keyBtn) return;
  const noteFrequencyValue = parseFloat(keyBtn.dataset.note);
  const arpEnabled = document.getElementById('dreamArpEnabled').checked;
  const latchEnabled = document.getElementById('arpLatch').checked;

  if (arpEnabled) {
    if (!synthState.heldKeys.includes(noteFrequencyValue)) {
      synthState.heldKeys.push(noteFrequencyValue);
      if (latchEnabled) keyBtn.classList.add('key-latched');
      else keyBtn.classList.add('key-active');
      manageArpeggiatorExecution();
    }
  } else {
    if (latchEnabled) {
      const activeKeyCheck = noteFrequencyValue.toFixed(2);
      if (synthState.activeVoices.has(activeKeyCheck)) {
        noteOff(noteFrequencyValue);
        keyBtn.classList.remove('key-latched');
      } else {
        noteOn(noteFrequencyValue);
        keyBtn.classList.add('key-latched');
      }
    } else {
      noteOn(noteFrequencyValue);
      keyBtn.classList.add('key-active');
    }
  }
}

// Fixed Key Triggers to respond perfectly to your specific frequencies
function handlePhysicalKeyTriggerOff(keyBtn) {
  if (!keyBtn) return;
  const noteFrequencyValue = parseFloat(keyBtn.dataset.note);
  const arpEnabled = document.getElementById('dreamArpEnabled').checked;
  const latchEnabled = document.getElementById('arpLatch').checked;

  if (latchEnabled) return; 

  if (arpEnabled) {
    synthState.heldKeys = synthState.heldKeys.filter(freq => freq !== noteFrequencyValue);
    keyBtn.classList.remove('key-active');
    manageArpeggiatorExecution();
  } else {
    noteOff(noteFrequencyValue);
    keyBtn.classList.remove('key-active');
  }
}

keyboardElement.addEventListener('mousedown', (e) => {
  const targetKey = e.target.closest('.key');
  handlePhysicalKeyTriggerOn(targetKey);
});

window.addEventListener('mouseup', () => {
  const latchEnabled = document.getElementById('arpLatch').checked;
  if (latchEnabled) return;

  document.querySelectorAll('.key').forEach(keyBtn => {
    if (keyBtn.classList.contains('key-active')) {
      handlePhysicalKeyTriggerOff(keyBtn);
    }
  });
});

keyboardElement.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const targetKey = e.target.closest('.key');
  handlePhysicalKeyTriggerOn(targetKey);
}, { passive: false });

keyboardElement.addEventListener('touchend', (e) => {
  const targetKey = e.target.closest('.key');
  handlePhysicalKeyTriggerOff(targetKey);
});

// ============================================================================
// 7. SYSTEM CONTROLS & SHIFT CONTROLLER NAVIGATOR
// ============================================================================
const textOctaveDisplay = document.getElementById('octaveDisplay');

document.getElementById('octaveDown').addEventListener('click', () => {
  if (synthState.octaveShift > -3) {
    synthState.octaveShift--;
    textOctaveDisplay.textContent = `Shift: ${synthState.octaveShift}`;
  }
});

document.getElementById('octaveUp').addEventListener('click', () => {
  if (synthState.octaveShift < 3) {
    synthState.octaveShift++;
    textOctaveDisplay.textContent = `Shift: ${synthState.octaveShift}`;
  }
});

document.getElementById('arpLatch').addEventListener('change', (e) => {
  if (!e.target.checked) {
    document.querySelectorAll('.key').forEach(k => k.classList.remove('key-latched'));
    synthState.heldKeys = [];
    manageArpeggiatorExecution();
  }
});

document.getElementById('dreamArpEnabled').addEventListener('change', () => {
  synthState.heldKeys = [];
  manageArpeggiatorExecution();
});

// ============================================================================
// 8. DYNAMIC UI PARAMETER FEEDBACK MONITORS WIRING
// ============================================================================
function clearAllSystemSlidersFeedback(sliderId, readoutValueId, unitSuffix = "") {
  const elementSlider = document.getElementById(sliderId);
  const elementReadout = document.getElementById(readoutValueId);
  if (!elementSlider || !elementReadout) return;

  elementSlider.addEventListener('input', (e) => {
    let outputVal = e.target.value;
    
    // UI Format presentation adjustments
    if (unitSuffix === "%" && (elementSlider.max === "1" || elementSlider.max === "1.0")) {
      outputVal = Math.round(parseFloat(e.target.value) * 100);
    } else if (sliderId === 'oscBDetune') {
      outputVal = (parseInt(outputVal) >= 0 ? "+" : "") + outputVal;
    } else if (sliderId === 'delayTime' && parseFloat(outputVal) <= 1.5) {
      outputVal = Math.round(parseFloat(outputVal) * 1000); 
    }
    
    elementReadout.textContent = `${outputVal}${unitSuffix}`;
    
    if (sliderId === 'masterVolume' && synthState.masterGain) {
      const volRaw = parseFloat(e.target.value);
      const actualVol = volRaw > 1 ? volRaw / 100 : volRaw;
      synthState.masterGain.gain.setValueAtTime(actualVol, synthState.audioContext.currentTime);
    }
    
    if (['delayMix', 'delayTime', 'delayFeedback'].includes(sliderId)) updateDelayNodeSettings();
    if (sliderId === 'reverbMix') updateReverbNodeSettings();
    if (sliderId === 'reverbDecay') buildSyntheticReverbImpulse();
  });
}

clearAllSystemSlidersFeedback('waveFusion', 'waveFusionValue', '%');
clearAllSystemSlidersFeedback('subLevel', 'subLevelValue', '%');
clearAllSystemSlidersFeedback('oscBLevel', 'oscBLevelValue', '%');
clearAllSystemSlidersFeedback('oscBDetune', 'oscBDetuneValue', ' cents');
clearAllSystemSlidersFeedback('voiceSpread', 'voiceSpreadValue', '%');
clearAllSystemSlidersFeedback('noiseAmount', 'noiseAmountValue', '%');
clearAllSystemSlidersFeedback('drift', 'driftValue');
clearAllSystemSlidersFeedback('stereoWidth', 'stereoWidthValue', '%');
clearAllSystemSlidersFeedback('attack', 'attackValue', ' s');
clearAllSystemSlidersFeedback('decay', 'decayValue', ' s');
clearAllSystemSlidersFeedback('sustain', 'sustainValue', '%');
clearAllSystemSlidersFeedback('release', 'releaseValue', ' s');
clearAllSystemSlidersFeedback('cutoff', 'cutoffValue', ' Hz');
clearAllSystemSlidersFeedback('resonance', 'resonanceValue', '');
clearAllSystemSlidersFeedback('lfoRate', 'lfoRateValue', ' Hz');
clearAllSystemSlidersFeedback('lfoAmount', 'lfoAmountValue');
clearAllSystemSlidersFeedback('reverbMix', 'reverbMixValue', '%');
clearAllSystemSlidersFeedback('reverbDecay', 'reverbDecayValue', ' s');
clearAllSystemSlidersFeedback('delayMix', 'delayMixValue', '%');
clearAllSystemSlidersFeedback('delayTime', 'delayTimeValue', ' ms');
clearAllSystemSlidersFeedback('delayFeedback', 'delayFeedbackValue', '%');
clearAllSystemSlidersFeedback('arpRate', 'arpRateValue', '');
clearAllSystemSlidersFeedback('arpGate', 'arpGateValue', '%');
clearAllSystemSlidersFeedback('glideTime', 'glideTimeValue', 's');
clearAllSystemSlidersFeedback('masterVolume', 'masterVolumeValue', '%');
clearAllSystemSlidersFeedback('presence', 'presenceValue', '%');

// ============================================================================
// 9. PRESET DATABASE MODAL & PANEL RENDER CODES
// ============================================================================
const modalOverlay = document.getElementById('presetBrowserOverlay');
const presetListContainer = document.getElementById('presetBrowserList');
const messageIndicatorElement = document.getElementById('presetMessage');

document.getElementById('openPresetBrowser').addEventListener('click', () => {
  modalOverlay.classList.remove('hidden');
  renderPresetGroupBankList('signature'); 
});

document.getElementById('closePresetBrowser').addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

document.querySelectorAll('.preset-browser-tab').forEach(tabBtn => {
  tabBtn.addEventListener('click', (e) => {
    document.querySelectorAll('.preset-browser-tab').forEach(t => t.classList.remove('active-bank'));
    e.target.classList.add('active-bank');
    renderPresetGroupBankList(e.target.dataset.bank);
  });
});

function renderPresetGroupBankList(bankKey) {
  presetListContainer.innerHTML = "";
  const selectionBankListArray = presetLibrary[bankKey] || [];

  if (selectionBankListArray.length === 0) {
    presetListContainer.innerHTML = `<p style="padding:15px;color:#aaa;">No patches found in this directory.</p>`;
    return;
  }

  selectionBankListArray.forEach(patch => {
    const patchButton = document.createElement('button');
    patchButton.className = 'preset-browser-preset';
    patchButton.innerHTML = `<strong>${patch.name}</strong> — <span style="font-size:11px;color:#bbb;">${patch.moduleMode.toUpperCase()}</span>`;
    
    patchButton.addEventListener('click', () => {
      injectPatchIntoControlsPanel(patch);
      modalOverlay.classList.add('hidden');
    });
    
    presetListContainer.appendChild(patchButton);
  });
}

function injectPatchIntoControlsPanel(patch) {
  initAudio();
  synthState.moduleMode = patch.moduleMode;

  Object.keys(patch).forEach(key => {
    if (key === 'name' || key === 'moduleMode') return;
    const coreDOMInput = document.getElementById(key);
    if (coreDOMInput) {
      // Scale-aware UI mapping injection fallback translator
      let finalVal = patch[key];
      if (key === 'sustain' || key === 'reverbMix' || key === 'delayMix' || key === 'delayFeedback') {
        if (coreDOMInput.max === "1" || coreDOMInput.max === "1.0") {
          finalVal = patch[key] > 1 ? patch[key] / 100 : patch[key];
        }
      } else if (key === 'delayTime') {
        if (coreDOMInput.max === "1.5" || coreDOMInput.max === "1.50") {
          finalVal = patch[key] > 1.5 ? patch[key] / 1000 : patch[key];
        }
      }
      
      coreDOMInput.value = finalVal;
      coreDOMInput.dispatchEvent(new Event('input'));
    }
  });

  if (messageIndicatorElement) {
    messageIndicatorElement.textContent = `Loaded Patch: "${patch.name}"`;
    setTimeout(() => { messageIndicatorElement.textContent = ""; }, 4000);
  }
}
