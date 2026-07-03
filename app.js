/**
 * Dreamwell Synthesizer - Master Audio Application File
 * Architecture: Polyphonic Subtractive/Physical Modeling Engine + Integrated FX, Arp, & Presets
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
  activeVoices: new Map(),      // Tracks active notes: key = base frequency, value = voice object
  heldKeys: [],                 // Ordered array of user notes held down (for Arp "As Played")
  
  // Parameter State Modifiers
  octaveShift: 0,
  moduleMode: 'synth',          // Modes: 'synth' (Default Custom UI) or 'grand_piano'
  
  // Dream Arpeggiator Engine Variables
  arpIntervalId: null,
  arpIndex: 0,
  arpCurrentNote: null,
  arpDirectionUp: true,         // Tracking toggle for Up/Down mode
  
  // Custom Waves (Computed Tables)
  trapezoidWave: null
};

// Built-in Instrument Patch Presets Bank Library
const presetLibrary = {
  signature: [
    { name: "Resonant Doorway", moduleMode: "synth", waveform: "sine", waveformB: "sawtooth", waveFusion: 40, origin: "dream", waveFusionCurve: "smooth", dreamMorphMotion: false, subWaveform: "sine", subLevel: 20, oscBLevel: 0.40, oscBDetune: 8, voiceSpread: 35, noiseType: "air", deepDreamOrbit: true, noiseAmount: 15, drift: 20, stereoWidth: 60, attack: 0.25, decay: 0.60, sustain: 0.75, release: 1.20, filterType: "lowpass", cutoff: 1800, resonance: 2.5, lfoRate: 1.5, lfoAmount: 400, lfoDestination: "filter", reverbMix: 0.45, reverbDecay: 4.5, delayMix: 0.35, delayTime: 0.45, delayFeedback: 0.50, glideEnabled: true, glideTime: 0.15, masterVolume: 0.25, presence: 30 },
    { name: "Acoustic Concert Grand", moduleMode: "grand_piano", waveform: "triangle", waveformB: "sine", waveFusion: 50, origin: "pure", waveFusionCurve: "smooth", dreamMorphMotion: false, subWaveform: "sine", subLevel: 0, oscBLevel: 0.35, oscBDetune: 7, voiceSpread: 0, noiseType: "white", deepDreamOrbit: false, noiseAmount: 0, drift: 5, stereoWidth: 40, attack: 0.01, decay: 1.50, sustain: 0.10, release: 0.50, filterType: "lowpass", cutoff: 6000, resonance: 1.0, lfoRate: 2.0, lfoAmount: 0, lfoDestination: "pitch", reverbMix: 0.30, reverbDecay: 3.5, delayMix: 0.0, delayTime: 0.30, delayFeedback: 0.20, glideEnabled: false, glideTime: 0.05, masterVolume: 0.30, presence: 40 }
  ],
  keys: [
    { name: "Dreamwell Tine EP", moduleMode: "synth", waveform: "sine", waveformB: "triangle", waveFusion: 70, origin: "glass", waveFusionCurve: "bright", dreamMorphMotion: false, subWaveform: "sine", subLevel: 10, oscBLevel: 0.50, oscBDetune: 4, voiceSpread: 20, noiseType: "dust", deepDreamOrbit: false, noiseAmount: 8, drift: 15, stereoWidth: 50, attack: 0.02, decay: 0.80, sustain: 0.40, release: 0.60, filterType: "lowpass", cutoff: 3200, resonance: 0.8, lfoRate: 4.2, lfoAmount: 150, lfoDestination: "pitch", reverbMix: 0.35, reverbDecay: 2.8, delayMix: 0.40, delayTime: 0.35, delayFeedback: 0.45, glideEnabled: false, glideTime: 0.12, masterVolume: 0.25, presence: 50 }
  ],
  pads: [
    { name: "Ethereal Atmosphere", moduleMode: "synth", waveform: "triangle", waveformB: "sine", waveFusion: 30, origin: "dream", waveFusionCurve: "smooth", dreamMorphMotion: true, subWaveform: "sine", subLevel: 30, oscBLevel: 0.25, oscBDetune: 12, voiceSpread: 80, noiseType: "air", deepDreamOrbit: true, noiseAmount: 20, drift: 45, stereoWidth: 90, attack: 1.50, decay: 2.00, sustain: 0.90, release: 2.50, filterType: "lowpass", cutoff: 950, resonance: 1.5, lfoRate: 0.4, lfoAmount: 350, lfoDestination: "filter", reverbMix: 0.65, reverbDecay: 6.5, delayMix: 0.50, delayTime: 0.68, delayFeedback: 0.60, glideEnabled: true, glideTime: 0.30, masterVolume: 0.22, presence: 10 }
  ],
  leads: [
    { name: "Cosmic Portal Lead", moduleMode: "synth", waveform: "sawtooth", waveformB: "square", waveFusion: 50, origin: "cosmic", waveFusionCurve: "deep", dreamMorphMotion: false, subWaveform: "square", subLevel: 25, oscBLevel: 0.60, oscBDetune: 15, voiceSpread: 40, noiseType: "machine", deepDreamOrbit: false, noiseAmount: 5, drift: 25, stereoWidth: 30, attack: 0.08, decay: 0.40, sustain: 0.70, release: 0.45, filterType: "lowpass", cutoff: 4500, resonance: 4.2, lfoRate: 5.5, lfoAmount: 200, lfoDestination: "pitch", reverbMix: 0.25, reverbDecay: 2.5, delayMix: 0.55, delayTime: 0.28, delayFeedback: 0.55, glideEnabled: true, glideTime: 0.18, masterVolume: 0.20, presence: 65 }
  ],
  bass: [
    { name: "Subterran Void", moduleMode: "synth", waveform: "square", waveformB: "sawtooth", waveFusion: 20, origin: "ancient", waveFusionCurve: "linear", dreamMorphMotion: false, subWaveform: "triangle", subLevel: 80, oscBLevel: 0.30, oscBDetune: 5, voiceSpread: 10, noiseType: "dark", deepDreamOrbit: false, noiseAmount: 12, drift: 8, stereoWidth: 5, attack: 0.01, decay: 0.35, sustain: 0.80, release: 0.30, filterType: "lowpass", cutoff: 450, resonance: 3.0, lfoRate: 1.2, lfoAmount: 100, lfoDestination: "filter", reverbMix: 0.10, reverbDecay: 1.5, delayMix: 0.15, delayTime: 0.25, delayFeedback: 0.30, glideEnabled: true, glideTime: 0.10, masterVolume: 0.28, presence: 20 }
  ],
  textures: [
    { name: "Stardust Machine", moduleMode: "synth", waveform: "triangle", waveformB: "trapezoid", waveFusion: 60, origin: "cosmic", waveFusionCurve: "smooth", dreamMorphMotion: true, subWaveform: "sine", subLevel: 15, oscBLevel: 0.45, oscBDetune: 25, voiceSpread: 95, noiseType: "dust", deepDreamOrbit: true, noiseAmount: 65, drift: 60, stereoWidth: 100, attack: 0.80, decay: 1.50, sustain: 0.60, release: 2.00, filterType: "highpass", cutoff: 2200, resonance: 1.8, lfoRate: 0.8, lfoAmount: 800, lfoDestination: "filter", reverbMix: 0.55, reverbDecay: 5.0, delayMix: 0.60, delayTime: 0.75, delayFeedback: 0.70, glideEnabled: false, glideTime: 0.05, masterVolume: 0.18, presence: 45 }
  ]
};

// ============================================================================
// 2. AUDIO INITIALIZATION & FX INFRASTRUCTURE GRAPH
// ============================================================================
function initAudio() {
  if (synthState.audioContext) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  synthState.audioContext = new AudioContext();

  // Setup Routing Infrastructure Nodes
  synthState.masterGain = synthState.audioContext.createGain();
  synthState.masterGain.gain.setValueAtTime(parseFloat(document.getElementById('masterVolume').value), synthState.audioContext.currentTime);

  synthState.dryGainNode = synthState.audioContext.createGain();
  synthState.delayNode = synthState.audioContext.createDelay(2.0);
  synthState.delayFeedbackNode = synthState.audioContext.createGain();
  synthState.delayWetGain = synthState.audioContext.createGain();
  
  synthState.reverbNode = synthState.audioContext.createConvolver();
  synthState.reverbWetGain = synthState.audioContext.createGain();

  // Establish Routing Connections Matrix Graph
  // Dry Path
  synthState.dryGainNode.connect(synthState.masterGain);

  // Delay Feedback Loop Path
  synthState.delayNode.connect(synthState.delayFeedbackNode);
  synthState.delayFeedbackNode.connect(synthState.delayNode); // Feedback loop
  synthState.delayNode.connect(synthState.delayWetGain);
  synthState.delayWetGain.connect(synthState.masterGain);

  // Reverb Routing (Fed from Dry path to remain parallel)
  buildSyntheticReverbImpulse(); 
  synthState.reverbNode.connect(synthState.reverbWetGain);
  synthState.reverbWetGain.connect(synthState.masterGain);

  // Core Final Output Node Destination Bound
  synthState.masterGain.connect(synthState.audioContext.destination);

  // Build Real-Time Parameters from Sliders Configuration Update
  updateDelayNodeSettings();
  updateReverbNodeSettings();
  generateCustomWaves();
}

// Generates an mathematical algorithmic white-noise decay sample array for the Convolver reverb
function buildSyntheticReverbImpulse() {
  if (!synthState.audioContext) return;
  const decayTime = parseFloat(document.getElementById('reverbDecay').value);
  const rate = synthState.audioContext.sampleRate;
  const length = rate * decayTime;
  const impulse = synthState.audioContext.createBuffer(2, length, rate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      // Exponentially decaying white noise matrix formula
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  synthState.reverbNode.buffer = impulse;
}

// Periodic Waveform Drawing Math for custom Trapezoidal shape selection
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

// Live Dynamic Matrix updates for Reverb/Delay Mix configurations
function updateDelayNodeSettings() {
  if (!synthState.audioContext) return;
  const mix = parseFloat(document.getElementById('delayMix').value);
  const time = parseFloat(document.getElementById('delayTime').value);
  const feedback = parseFloat(document.getElementById('delayFeedback').value);

  const now = synthState.audioContext.currentTime;
  synthState.delayNode.delayTime.setTargetAtTime(time, now, 0.02);
  synthState.delayFeedbackNode.gain.setTargetAtTime(feedback, now, 0.01);
  synthState.delayWetGain.gain.setTargetAtTime(mix, now, 0.01);
  synthState.dryGainNode.gain.setTargetAtTime(1.0 - (mix * 0.5), now, 0.01); // Prevent clipping clipping
}

function updateReverbNodeSettings() {
  if (!synthState.audioContext) return;
  const mix = parseFloat(document.getElementById('reverbMix').value);
  synthState.reverbWetGain.gain.setTargetAtTime(mix, synthState.audioContext.currentTime, 0.01);
}

// ============================================================================
// 3. POLYPHONIC AUDIO SYNTHESIS ENGINE VOICE CLASS
// ============================================================================
class SynthVoice {
  constructor(frequency, audioContext, targets) {
    this.ctx = audioContext;
    this.freq = frequency;
    this.targets = targets;
    this.now = this.ctx.currentTime;
    
    // Voice Envelope Node Configuration Boundary Bound
    this.voiceGain = this.ctx.createGain();
    this.voiceGain.gain.setValueAtTime(0, this.now);
    
    // Route Voice to Audio Graph Ends
    this.voiceGain.connect(targets.dry);
    this.voiceGain.connect(targets.delay);
    this.voiceGain.connect(targets.reverb);

    // Audio Elements Structural Mapping
    this.oscillators = [];
    this.gainNodes = [];
    this.lfo = null;
    this.lfoGain = null;

    if (synthState.moduleMode === 'grand_piano') {
      this.assembleGrandPianoEngine();
    } else {
      this.assembleSubtractiveSynthEngine();
    }
  }

  /**
   * INTERACTIVE ACOUSTIC GRAND PIANO EMULATION SCHEMATIC
   */
  assembleGrandPianoEngine() {
    // 1. Strings Multi-Harmonic Unison Layer
    const oscString1 = this.ctx.createOscillator();
    oscString1.type = 'triangle';
    oscString1.frequency.setValueAtTime(this.freq, this.now);

    const oscString2 = this.ctx.createOscillator();
    oscString2.type = 'sine';
    oscString2.frequency.setValueAtTime(this.freq * 2.002, this.now); // Sympathetic overtone string string alignment

    const gainStr1 = this.ctx.createGain();
    const gainStr2 = this.ctx.createGain();
    gainStr1.gain.setValueAtTime(0.60, this.now);
    gainStr2.gain.setValueAtTime(0.30, this.now);

    // 2. Acoustic Hammer Impact Simulation Transient
    const oscHammer = this.ctx.createOscillator();
    oscHammer.type = 'sine';
    oscHammer.frequency.setValueAtTime(this.freq * 5.2, this.now); // Short metallic ping simulation

    const gainHammer = this.ctx.createGain();
    gainHammer.gain.setValueAtTime(0.75, this.now);

    // 3. High Damping Filter Topology Module
    const dampingFilter = this.ctx.createBiquadFilter();
    dampingFilter.type = 'lowpass';
    const cutoffBase = Math.min(11000, this.freq * 3.8);
    dampingFilter.frequency.setValueAtTime(cutoffBase, this.now);
    dampingFilter.Q.setValueAtTime(1.1, this.now);

    // Presence Processing Chain Element Configuration
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

    // Wiring Engine Graphs
    oscString1.connect(gainStr1);
    oscString2.connect(gainStr2);
    oscHammer.connect(gainHammer);

    gainStr1.connect(dampingFilter);
    gainStr2.connect(dampingFilter);
    gainHammer.connect(dampingFilter);

    finalOutputNode.connect(this.voiceGain);

    this.oscillators.push(oscString1, oscString2, oscHammer);
    this.gainNodes.push(gainStr1, gainStr2, gainHammer);

    // Rigid Fixed Envelope Standard Dimensions for Grand Piano
    this.attack = 0.002;
    this.decay = Math.max(0.5, 3.8 - (this.freq / 300)); // Higher strings damp out out faster
    this.sustain = 0.03;                                // Pianos naturally decay entirely over time if key is held
    this.release = 0.40;

    // Fast decay sweep trigger for hammer attack snap
    gainHammer.gain.setValueAtTime(0.75, this.now);
    gainHammer.gain.exponentialRampToValueAtTime(0.0001, this.now + 0.03); 
  }

  /**
   * SUBTRACTIVE SYNTHESIZER ENGINE CONFIGURATION DIAGRAM
   */
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

    // Read Envelope Modifiers Configuration sliders
    this.attack = parseFloat(document.getElementById('attack').value);
    this.decay = parseFloat(document.getElementById('decay').value);
    this.sustain = parseFloat(document.getElementById('sustain').value);
    this.release = parseFloat(document.getElementById('release').value);

    // Audio Oscillators Instantiation Map
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const oscSub = this.ctx.createOscillator();

    const gainA = this.ctx.createGain();
    const gainB = this.ctx.createGain();
    const gainSub = this.ctx.createGain();

    const synthFilter = this.ctx.createBiquadFilter();

    // Mapping Waveform Types Matrix
    if (waveA === 'trapezoid') oscA.setPeriodicWave(synthState.trapezoidWave);
    else oscA.type = waveA;

    if (waveB === 'trapezoid') oscB.setPeriodicWave(synthState.trapezoidWave);
    else oscB.type = waveB;

    oscSub.type = subWave;

    // Scaling Core Frequencies
    oscA.frequency.setValueAtTime(this.freq, this.now);
    oscB.frequency.setValueAtTime(this.freq, this.now);
    oscB.detune.setValueAtTime(detune, this.now);
    oscSub.frequency.setValueAtTime(this.freq * 0.5, this.now); // Sub is exactly 1 octave lower

    // Volume Crossfading Math Map (Based on HTML Wave Fusion Selector)
    gainA.gain.setValueAtTime(1.0 - fusion, this.now);
    gainB.gain.setValueAtTime(fusion * oscBVol, this.now);
    gainSub.gain.setValueAtTime(subLevel, this.now);

    // Primary Filters Matrix Alignment Routing
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

    // Connect Sub-Engine Infrastructure Node Lines
    oscA.connect(gainA);
    oscB.connect(gainB);
    oscSub.connect(gainSub);

    gainA.connect(synthFilter);
    gainB.connect(synthFilter);
    gainSub.connect(synthFilter);

    finalFilterOutput.connect(this.voiceGain);

    this.oscillators.push(oscA, oscB, oscSub);
    this.gainNodes.push(gainA, gainB, gainSub);

    // --- DREAM WAVE LFO ROUTING INTEGRATION MATRIX ---
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
        this.lfoGain.connect(synthFilter.frequency); // Target destination route: Cutoff
      } else if (lfoDestination === 'pitch') {
        // Detune relies on unit measurements of cents (100 cents = 1 semitone)
        this.lfoGain.gain.setValueAtTime(lfoAmt * 0.1, this.now);
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(oscA.detune);
        this.lfoGain.connect(oscB.detune);
      } else if (lfoDestination === 'volume') {
        this.lfoGain.gain.setValueAtTime(lfoAmt / 3000 * 0.4, this.now); // Normalize parameter input space
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.voiceGain.gain);
      }
      this.lfo.start(this.now);
    }
  }

  // Executes Primary Trigger Gate Envelope Curve Sequence
  start() {
    const startNow = this.ctx.currentTime;
    this.voiceGain.gain.setValueAtTime(0, startNow);
    this.voiceGain.gain.linearRampToValueAtTime(1.0, startNow + this.attack);
    this.voiceGain.gain.exponentialRampToValueAtTime(Math.max(this.sustain, 0.001), startNow + this.attack + this.decay);

    // Ignite internal generator banks
    this.oscillators.forEach(osc => osc.start(startNow));
  }

  // Initiates Gate Key Release Envelope Cycle Execution End
  stop() {
    const stopNow = this.ctx.currentTime;
    this.voiceGain.gain.cancelScheduledValues(stopNow);
    this.voiceGain.gain.setValueAtTime(this.voiceGain.gain.value, stopNow);
    this.voiceGain.gain.exponentialRampToValueAtTime(0.0001, stopNow + this.release);
    
    // Decommission hardware voice lines after complete envelope cycle termination release window passes
    this.oscillators.forEach(osc => osc.stop(stopNow + this.release));
    if (this.lfo) {
      this.lfo.stop(stopNow + this.release);
    }
  }
}

// ============================================================================
// 4. GENERAL GATE CONTROL ROUTING BUS (NOTE ON / NOTE OFF)
// ============================================================================
function noteOn(baseFreq) {
  initAudio();
  
  // Apply pitch shift multiplier algorithm formula
  const adjustedFreq = baseFreq * Math.pow(2, synthState.octaveShift);
  
  // Terminate voice collisions if key is already active
  if (synthState.activeVoices.has(adjustedFreq)) return;

  const internalRoutingTargets = {
    dry: synthState.dryGainNode,
    delay: synthState.delayNode,
    reverb: synthState.reverbNode
  };

  const voiceInstance = new SynthVoice(adjustedFreq, synthState.audioContext, internalRoutingTargets);
  voiceInstance.start();
  synthState.activeVoices.set(adjustedFreq, voiceInstance);
}

function noteOff(baseFreq) {
  const adjustedFreq = baseFreq * Math.pow(2, synthState.octaveShift);
  const voiceInstance = synthState.activeVoices.get(adjustedFreq);
  if (voiceInstance) {
    voiceInstance.stop();
    synthState.activeVoices.delete(adjustedFreq);
  }
}

// ============================================================================
// 5. DREAM ARPEGGIATOR SCHEDULER MATRIX ENGINE
// ============================================================================
function manageArpeggiatorExecution() {
  const arpEnabled = document.getElementById('dreamArpEnabled').checked;

  if (!arpEnabled || synthState.heldKeys.length === 0) {
    // Terminate Arpeggiator Clock Loop if empty
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

  // Read rate timing configuration values from UI dashboard layout mapping values
  const rateSelection = parseInt(document.getElementById('arpRate').value); // Sliders 1 to 4 mapping range bounds
  let intervalMs = 250; // Default baseline state: Eighth Note (1/8 selection equivalent)
  if (rateSelection === 1) intervalMs = 500;  // Quarter Note (1/4)
  if (rateSelection === 2) intervalMs = 250;  // Eighth Note (1/8)
  if (rateSelection === 3) intervalMs = 125;  // Sixteenth Note (1/16)
  if (rateSelection === 4) intervalMs = 62.5; // Thirty-Second Note (1/32)

  // Clear existing loop trackers before re-allocating new interval arrays
  if (synthState.arpIntervalId) clearInterval(synthState.arpIntervalId);

  synthState.arpIntervalId = setInterval(() => {
    executeArpNextStep();
  }, intervalMs);
}

function executeArpNextStep() {
  if (synthState.heldKeys.length === 0) return;

  // Turn off previous note before striking the next step
  if (synthState.arpCurrentNote) {
    noteOff(synthState.arpCurrentNote);
  }

  const mode = document.getElementById('arpMode').value;
  let notesSorted = [...synthState.heldKeys].sort((a, b) => a - b); // Ascending default order sorting configuration

  // Execute Mode Filtering Array Logic
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

  // Trigger audio execution step array mapping
  if (synthState.arpCurrentNote) {
    noteOn(synthState.arpCurrentNote);
    
    // Visual Highlight Indicator Logic tracking arpeggiator keys across the DOM elements
    const pianoKeys = document.querySelectorAll('.key');
    pianoKeys.forEach(key => {
      if (parseFloat(key.dataset.note) === synthState.arpCurrentNote) {
        key.classList.add('key-active');
        // Clear highlight tracking immediately right before Gate calculation parameter ends
        const gatePercent = parseFloat(document.getElementById('arpGate').value) / 100;
        const gateDuration = 250 * gatePercent; // Scaled estimate bound matching step size
        setTimeout(() => key.classList.remove('key-active'), gateDuration);
      }
    });
  }
}

// ============================================================================
// 6. DOM INTERACTIVE MATRIX EVENT MAPPING (KEYBOARD INTERFACE BOUNDS)
// ============================================================================
const keyboardElement = document.querySelector('.keyboard');

// Primary Key Extraction Mapping Event Function
function handlePhysicalKeyTriggerOn(keyBtn) {
  if (!keyBtn) return;
  const noteFrequencyValue = parseFloat(keyBtn.dataset.note);
  const arpEnabled = document.getElementById('dreamArpEnabled').checked;
  const latchEnabled = document.getElementById('arpLatch').checked;

  if (arpEnabled) {
    if (!synthState.heldKeys.includes(noteFrequencyValue)) {
      synthState.heldKeys.push(noteFrequencyValue);
      if (latchEnabled) {
        keyBtn.classList.add('key-latched');
      } else {
        keyBtn.classList.add('key-active');
      }
      manageArpeggiatorExecution();
    }
  } else {
    if (latchEnabled) {
      if (synthState.activeVoices.has(noteFrequencyValue * Math.pow(2, synthState.octaveShift))) {
        // Toggle release if key is re-tapped in Latch mode
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

function handlePhysicalKeyTriggerOff(keyBtn) {
  if (!keyBtn) return;
  const noteFrequencyValue = parseFloat(keyBtn.dataset.note);
  const arpEnabled = document.getElementById('dreamArpEnabled').checked;
  const latchEnabled = document.getElementById('arpLatch').checked;

  if (latchEnabled) return; // Ignore input release commands if structural Latched Mode locks state array

  if (arpEnabled) {
    synthState.heldKeys = synthState.heldKeys.filter(freq => freq !== noteFrequencyValue);
    keyBtn.classList.remove('key-active');
    manageArpeggiatorExecution();
  } else {
    noteOff(noteFrequencyValue);
    keyBtn.classList.remove('key-active');
  }
}

// Attach Core Mouse Interaction Event Listeners
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

// Mobile Multi-Touch Compatibility Engine Graph Configuration Mapping
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
// 7. MODULE SYSTEM CONTROLS & SHIFT CONTROLLER NAVIGATOR
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

// Clear latched controls when Arp toggles are altered or state flags drop
document.getElementById('arpLatch').addEventListener('change', (e) => {
  if (!e.target.checked) {
    document.querySelectorAll('.key').forEach(k => {
      k.classList.remove('key-latched');
    });
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
    
    // Scale percentages formatting for text readouts
    if (unitSuffix === "%" && elementSlider.max === "1") {
      outputVal = Math.round(parseFloat(e.target.value) * 100);
    } else if (sliderId === 'oscBDetune') {
      outputVal = (parseInt(outputVal) >= 0 ? "+" : "") + outputVal;
    }
    
    elementReadout.textContent = `${outputVal}${unitSuffix}`;
    
    // Hot-swap hardware context master gains mapping
    if (sliderId === 'masterVolume' && synthState.masterGain) {
      synthState.masterGain.gain.setValueAtTime(parseFloat(e.target.value), synthState.audioContext.currentTime);
    }
    
    // Route live modifier adjustments into Delay/Reverb matrix structures on slider adjustment interaction
    if (['delayMix', 'delayTime', 'delayFeedback'].includes(sliderId)) updateDelayNodeSettings();
    if (sliderId === 'reverbMix') updateReverbNodeSettings();
    if (sliderId === 'reverbDecay') buildSyntheticReverbImpulse();
  });
}

// Run mapping loops to match labels inside HTML
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
  renderPresetGroupBankList('signature'); // Initialize listing with Signature bank view open
});

document.getElementById('closePresetBrowser').addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

// Wire navigation selectors for the library tabs
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
    presetListContainer.innerHTML = `<p style="padding:15px;color:#aaa;">No patches found in this bank directory.</p>`;
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
  
  // Set tracking system state keys
  synthState.moduleMode = patch.moduleMode;

  // Process mapping updates to raw dashboard nodes securely
  Object.keys(patch).forEach(key => {
    if (key === 'name' || key === 'moduleMode') return;
    const coreDOMInput = document.getElementById(key);
    if (coreDOMInput) {
      coreDOMInput.value = patch[key];
      // Fire mock event handlers to force label monitor strings to synchronize instantly
      coreDOMInput.dispatchEvent(new Event('input'));
    }
  });

  // Post success notifications across the HUD interface area
  messageIndicatorElement.textContent = `Loaded Patch Configuration: "${patch.name}" successfully.`;
  setTimeout(() => { messageIndicatorElement.textContent = ""; }, 4000);
}
