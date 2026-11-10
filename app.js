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
// Prepared before keyboard initialization so the optional Binding hook is safe.
var dbHeldLayers = new Map();
// Dream Binder — FM Resonance State
let currentFmAmount = 0;
// Dream Binder — FM Ratio State
let currentFmRatio = 3.5;
// Dream Binder — FM Attack State
let currentFmAttack = 0.01;
// Dream Binder — FM Decay State
let currentFmDecay = 0.8;
// Dream Binder — FM Sustain State
let currentFmSustain = 0.0;
// Dream Binder — FM Release State
let currentFmRelease = 0.3;

// ========================================
// DREAM BINDER — FM AMOUNT LIVE CONTROL
// ========================================

document.getElementById("fmAmount")?.addEventListener("input", (event) => {

    currentFmAmount = Number(event.target.value);

    const fmAmountDisplay = document.getElementById("fmAmountValue");

    if (fmAmountDisplay) {
        fmAmountDisplay.textContent = `${currentFmAmount}%`;
    }

    updateActiveSynthFM("amount");
});

// ========================================
// DREAM BINDER — FM RATIO LIVE CONTROL
// ========================================

document.getElementById("fmRatio")?.addEventListener("input", (event) => {

    currentFmRatio = Number(event.target.value);

    const fmRatioDisplay = document.getElementById("fmRatioValue");

    if (fmRatioDisplay) {
        fmRatioDisplay.textContent = currentFmRatio.toFixed(1);
    }

    updateActiveSynthFM("ratio");
});

// ========================================
// DREAM BINDER — FM ATTACK LIVE CONTROL
// ========================================

document.getElementById("fmAttack")?.addEventListener("input", (event) => {

    currentFmAttack = Number(event.target.value);

    const fmAttackDisplay = document.getElementById("fmAttackValue");

    if (fmAttackDisplay) {
        fmAttackDisplay.textContent = `${currentFmAttack.toFixed(2)} s`;
    }

    updateActiveSynthFM("attack");
});

// ========================================
// DREAM BINDER — FM DECAY LIVE CONTROL
// ========================================

document.getElementById("fmDecay")?.addEventListener("input", (event) => {

    currentFmDecay = Number(event.target.value);

    const fmDecayDisplay = document.getElementById("fmDecayValue");

    if (fmDecayDisplay) {
        fmDecayDisplay.textContent = `${currentFmDecay.toFixed(2)} s`;
    }

    updateActiveSynthFM("decay");
});

// ========================================
// DREAM BINDER — FM SUSTAIN LIVE CONTROL
// ========================================

document.getElementById("fmSustain")?.addEventListener("input", (event) => {

    currentFmSustain = Number(event.target.value);

    const fmSustainDisplay = document.getElementById("fmSustainValue");

    if (fmSustainDisplay) {
        fmSustainDisplay.textContent = `${Math.round(currentFmSustain * 100)}%`;
    }

    updateActiveSynthFM("sustain");
});

// ========================================
// DREAM BINDER — FM RELEASE LIVE CONTROL
// ========================================

document.getElementById("fmRelease")?.addEventListener("input", (event) => {

    currentFmRelease = Number(event.target.value);

    const fmReleaseDisplay = document.getElementById("fmReleaseValue");

    if (fmReleaseDisplay) {
        fmReleaseDisplay.textContent = `${currentFmRelease.toFixed(2)} s`;
    }

    updateActiveSynthFM("release");
});

// ========================================
// DREAM BINDER — RESONANT FIELD (COHERENCE + DECOHERENCE)
// Independent live controls. 0 / 0 is a strict dry bypass.
// The current implementation affects Synth voices only; locked Piano and
// Choir voices and their own processing chains remain untouched.
// ========================================
let currentCoherence = 0;
let currentDecoherence = 0;
const coherenceSlider = document.getElementById("coherence");
const coherenceValue = document.getElementById("coherenceValue");
const decoherenceSlider = document.getElementById("decoherence");
const decoherenceValue = document.getElementById("decoherenceValue");

function clampResonantValue(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
}

function updateResonantFieldDisplay() {
    if (coherenceValue) coherenceValue.textContent = `${currentCoherence}%`;
    if (decoherenceValue) decoherenceValue.textContent = `${currentDecoherence}%`;
}

if (coherenceSlider) {
    currentCoherence = clampResonantValue(coherenceSlider.value);
    coherenceSlider.addEventListener("input", () => {
        currentCoherence = clampResonantValue(coherenceSlider.value);
        updateResonantFieldDisplay();
        updateActiveResonantFields();
    });
}

if (decoherenceSlider) {
    currentDecoherence = clampResonantValue(decoherenceSlider.value);
    decoherenceSlider.addEventListener("input", () => {
        currentDecoherence = clampResonantValue(decoherenceSlider.value);
        updateResonantFieldDisplay();
        updateActiveResonantFields();
    });
}
updateResonantFieldDisplay();

// ========================================
// DREAM BINDER — SHARED RESONANCE CLOCK
// One low-frequency reference oscillator is shared across all Synth notes.
// Harmonic, modulation and spatial systems use its same phase. No polling,
// requestAnimationFrame, JavaScript timers or separate coherence clocks.
// ========================================
const coherenceClock = {
    originSeconds: null,
    cyclesPerSecond: 0.42, // Audible shared movement, ~2.4-second cycle.
    oscillator: null,
    getSnapshot(ctx = audioContext) {
        if (!ctx || this.originSeconds === null) return null;
        const elapsedSeconds = Math.max(0, ctx.currentTime - this.originSeconds);
        const cycles = elapsedSeconds * this.cyclesPerSecond;
        return {
            elapsedSeconds,
            phase: (cycles % 1) * Math.PI * 2,
            cyclePosition: cycles % 1,
            coherence: currentCoherence / 100,
            decoherence: currentDecoherence / 100
        };
    }
};

function initializeCoherenceClock(ctx) {
    if (coherenceClock.oscillator) return;
    coherenceClock.originSeconds = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = coherenceClock.cyclesPerSecond;
    oscillator.start(coherenceClock.originSeconds);
    coherenceClock.oscillator = oscillator;
}

// ========================================
// DREAM BINDER — THREE-DIMENSION RESONANT FIELD
// Two gentle, pitch-tracked peaking bands act as Resonance Rings I and II.
// Their evolving gains make harmonic motion audible without replacing the
// existing timbre engine, waveform blend, FM or Presence processing.
// The same coherence source also coordinates motion and stereo movement.
// Decoherence adds its own per-voice, non-phase-locked movements; both
// sliders can be high simultaneously without cancelling each other.
// ========================================
function createSynthResonantField(ctx, frequency, input, output, stereoPanner, filter) {
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const ringOne = ctx.createBiquadFilter();
    const ringTwo = ctx.createBiquadFilter();
    const fieldMotion = ctx.createGain();

    ringOne.type = "peaking";
    ringTwo.type = "peaking";
    ringOne.frequency.value = Math.min(8000, frequency * 2.04);
    ringTwo.frequency.value = Math.min(10000, frequency * 4.08);
    ringOne.Q.value = 5.5;
    ringTwo.Q.value = 6.0;
    ringOne.gain.value = 0;
    ringTwo.gain.value = 0;
    fieldMotion.gain.value = 1;
    // Start both paths at the requested mix to avoid a note-on wet spike.
    const initialMix = 0.88 * Math.max(currentCoherence, currentDecoherence) / 100;
    dry.gain.value = 1 - initialMix;
    wet.gain.value = initialMix;

    // Dry output is byte-path equivalent to the prior unity-gain field.
    // At the neutral 0/0 defaults, the wet route is muted completely.
    input.connect(dry);
    dry.connect(output);
    input.connect(ringOne);
    ringOne.connect(ringTwo);
    ringTwo.connect(fieldMotion);
    fieldMotion.connect(wet);
    wet.connect(output);

    // Coherence: a single oscillator provides phase-locked movement to
    // harmonic bands, field motion and stereo pan across every Synth note.
    const sharedHarmonicOne = ctx.createGain();
    const sharedHarmonicTwo = ctx.createGain();
    const sharedMotion = ctx.createGain();
    const sharedPan = ctx.createGain();
    const sharedFilter = ctx.createGain();
    const clock = coherenceClock.oscillator;
    for (const modulatorGain of [
        sharedHarmonicOne, sharedHarmonicTwo, sharedMotion,
        sharedPan, sharedFilter
    ]) modulatorGain.gain.value = 0;
    clock.connect(sharedHarmonicOne);
    clock.connect(sharedHarmonicTwo);
    clock.connect(sharedMotion);
    clock.connect(sharedPan);
    clock.connect(sharedFilter);
    sharedHarmonicOne.connect(ringOne.gain);
    sharedHarmonicTwo.connect(ringTwo.gain);
    sharedMotion.connect(fieldMotion.gain);
    sharedPan.connect(stereoPanner.pan);
    sharedFilter.connect(filter.frequency);

    // Decoherence: two independent, low-frequency oscillators per voice.
    // Separate rate relationships create divergence, NOT white noise or
    // a mirror image of Coherence. Their outputs remain silent at 0%.
    const wanderOne = ctx.createOscillator();
    const wanderTwo = ctx.createOscillator();
    wanderOne.type = "sine";
    wanderTwo.type = "triangle";
    wanderOne.frequency.value = 0.55 + Math.random() * 0.35;
    wanderTwo.frequency.value = 0.85 + Math.random() * 0.55;
    const independentRingOne = ctx.createGain();
    const independentRingTwo = ctx.createGain();
    const independentMotion = ctx.createGain();
    const independentPan = ctx.createGain();
    const independentFilter = ctx.createGain();
    const independentRingFrequency = ctx.createGain();
    for (const modulatorGain of [
        independentRingOne, independentRingTwo, independentMotion,
        independentPan, independentFilter, independentRingFrequency
    ]) modulatorGain.gain.value = 0;
    wanderOne.connect(independentRingOne);
    wanderOne.connect(independentMotion);
    wanderOne.connect(independentFilter);
    wanderTwo.connect(independentRingTwo);
    wanderTwo.connect(independentPan);
    wanderTwo.connect(independentRingFrequency);
    independentRingOne.connect(ringOne.gain);
    independentRingTwo.connect(ringTwo.gain);
    independentMotion.connect(fieldMotion.gain);
    independentPan.connect(stereoPanner.pan);
    independentFilter.connect(filter.frequency);
    independentRingFrequency.connect(ringTwo.frequency);
    wanderOne.start();
    wanderTwo.start();

    const modulationGains = [
        sharedHarmonicOne, sharedHarmonicTwo, sharedMotion,
        sharedPan, sharedFilter, independentRingOne, independentRingTwo,
        independentMotion, independentPan, independentFilter,
        independentRingFrequency
    ];
    let stopped = false;
    const voice = {
        update() {
            if (stopped) return;
            const coherence = currentCoherence / 100;
            const decoherence = currentDecoherence / 100;
            const now = ctx.currentTime;
            const stereoWidth = getValue(stereoWidthSlider, 0) / 100;
            // Equal-valued dry/wet crossfade maintains baseline level; the
            // two independent field amounts determine the wet participation.
            const mix = 0.88 * Math.max(coherence, decoherence);
            dry.gain.setTargetAtTime(1 - mix, now, 0.035);
            wet.gain.setTargetAtTime(mix, now, 0.035);
            // Coherence organizes; it does not adjust Presence or detune.
            ringOne.gain.setTargetAtTime(11.0 * coherence, now, 0.025);
            ringTwo.gain.setTargetAtTime(-8.0 * coherence, now, 0.025);
            sharedHarmonicOne.gain.setTargetAtTime(7.0 * coherence, now, 0.025);
            sharedHarmonicTwo.gain.setTargetAtTime(-6.0 * coherence, now, 0.025);
            sharedMotion.gain.setTargetAtTime(0.13 * coherence, now, 0.025);
            sharedPan.gain.setTargetAtTime(0.32 * coherence * (0.45 + 0.55 * stereoWidth), now, 0.025);
            sharedFilter.gain.setTargetAtTime(150 * coherence, now, 0.025);
            // Independent harmonic instability, movement and spatial drift.
            independentRingOne.gain.setTargetAtTime(15.0 * decoherence, now, 0.025);
            independentRingTwo.gain.setTargetAtTime(13.0 * decoherence, now, 0.025);
            independentMotion.gain.setTargetAtTime(0.19 * decoherence, now, 0.025);
            independentPan.gain.setTargetAtTime(0.38 * decoherence * (0.45 + 0.55 * stereoWidth), now, 0.025);
            independentFilter.gain.setTargetAtTime(240 * decoherence, now, 0.025);
            independentRingFrequency.gain.setTargetAtTime(Math.min(480, frequency * 0.9) * decoherence, now, 0.025);
        },
        stop(delaySeconds) {
            if (stopped) return;
            stopped = true;
            const releaseAt = ctx.currentTime + Math.max(0, delaySeconds);
            for (const oscillator of [wanderOne, wanderTwo]) {
                try { oscillator.stop(releaseAt); } catch (error) { /* already stopped */ }
            }
            // Disconnect shared-clock taps after note release so inactive
            // voices cannot remain connected to the long-lived clock.
            setTimeout(() => {
                for (const node of modulationGains) {
                    try { node.disconnect(); } catch (error) { /* safe cleanup */ }
                    try { clock.disconnect(node); } catch (error) { /* safe cleanup */ }
                }
                for (const node of [wanderOne, wanderTwo, dry, wet, ringOne, ringTwo, fieldMotion]) {
                    try { node.disconnect(); } catch (error) { /* safe cleanup */ }
                }
            }, Math.ceil((Math.max(0, delaySeconds) + 0.15) * 1000));
        }
    };
    voice.update();
    return voice;
}

function updateActiveResonantFields() {
    if (!audioContext) return;
    activeNotes.forEach((note) => {
        if (note.resonantField) note.resonantField.update();
    });
}


// ================================================================
// DREAM BINDER — POLYNOMIAL RINGS + KRULL DIMENSION (SYNTH ONLY)
// ================================================================
// Mathematical model: A_d = R[x1, ..., xd] for d = 0..3, where
// R is the real coefficient field, hence Krull dimension(A_d) = d.
// Each indeterminate receives a real oscillator signal:
//   x1 = oscillator A; x2 = oscillator B; x3 = sub oscillator.
// Polynomial degree bounds the highest order audio product.
// This is an artistic evaluation of a genuine multivariate polynomial,
// not a real-time computation of prime ideals / Krull dimension.
//
// d=0 selects R (constant polynomials). That setting has no audio wet
// path and is an intentional neutral bypass.
// Existing presets lack these fields; they load with ringEnabled=false.
// The new DSP graph is allocated ONLY when enabled, nonzero & d > 0.
// Piano, Choir, existing oscillator dry paths and other DSP are unchanged.
// ================================================================
const polynomialRingUI = {
    enabled: document.getElementById("polynomialRingEnabled"),
    amount: document.getElementById("polynomialRingAmount"),
    amountValue: document.getElementById("polynomialRingAmountValue"),
    degree: document.getElementById("polynomialRingDegree"),
    degreeValue: document.getElementById("polynomialRingDegreeValue"),
    character: document.getElementById("polynomialRingCharacter"),
    dimension: document.getElementById("krullDimension"),
    dimensionValue: document.getElementById("krullDimensionValue"),
    status: document.getElementById("polynomialRingStatus")
};

const polynomialRingState = {
    enabled: false,
    amount: 35,
    degree: 3,
    character: "hybrid",
    dimension: 1
};

function boundPolynomialNumber(value, low, high, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
}

function setPolynomialRingState(values = {}) {
    polynomialRingState.enabled = values.enabled === true;
    polynomialRingState.amount = boundPolynomialNumber(values.amount, 0, 100, 35);
    polynomialRingState.degree = Math.round(boundPolynomialNumber(values.degree, 2, 6, 3));
    polynomialRingState.dimension = Math.round(boundPolynomialNumber(values.dimension, 0, 3, 1));
    polynomialRingState.character = ["even", "odd", "hybrid"].includes(values.character)
        ? values.character : "hybrid";
    // There is no non-linear odd polynomial of degree <= 2.
    if (polynomialRingState.character === "odd" && polynomialRingState.degree < 3) {
        polynomialRingState.degree = 3;
    }
    syncPolynomialRingUI();
    updateActivePolynomialRings();
}

function polynomialRingIsActive() {
    return polynomialRingState.enabled &&
        polynomialRingState.amount > 0 &&
        polynomialRingState.dimension > 0;
}

function syncPolynomialRingUI() {
    const s = polynomialRingState;
    if (polynomialRingUI.enabled) polynomialRingUI.enabled.checked = s.enabled;
    if (polynomialRingUI.amount) polynomialRingUI.amount.value = s.amount;
    if (polynomialRingUI.amountValue) polynomialRingUI.amountValue.textContent = `${Math.round(s.amount)}%`;
    if (polynomialRingUI.degree) polynomialRingUI.degree.value = s.degree;
    if (polynomialRingUI.degreeValue) polynomialRingUI.degreeValue.textContent = `${s.degree}`;
    if (polynomialRingUI.character) polynomialRingUI.character.value = s.character;
    if (polynomialRingUI.dimension) polynomialRingUI.dimension.value = s.dimension;
    if (polynomialRingUI.dimensionValue) polynomialRingUI.dimensionValue.textContent = `dim ${s.dimension}`;
    if (polynomialRingUI.status) polynomialRingUI.status.textContent =
        s.enabled && s.dimension === 0 ? "Dimension 0 is the real coefficient field: no harmonic transformation." :
        !s.enabled ? "Bypassed — original Synth sound preserved." :
        s.amount === 0 ? "Amount is zero — original Synth sound preserved." :
        `Active · degree ${s.degree} · dimension ${s.dimension} · ${s.character} harmonics`;
}

// Chebyshev polynomials T_n are ordinary real-coefficient polynomials.
// A sine source makes T2, T3, ... produce strongly identifiable harmonics.
// The curve is bounded; 4x oversampling reduces (but cannot eliminate)
// non-linear aliasing for high-frequency and non-sine source waveforms.
function buildPolynomialChebyshevCurve(degree, character) {
    const curve = new Float32Array(2049);
    const coefficients = {2: 1.0, 3: 0.82, 4: 0.60, 5: 0.42, 6: 0.30};
    let weightSum = 0;
    for (let n = 2; n <= degree; n++) {
        if (character === "even" && n % 2 !== 0) continue;
        if (character === "odd" && n % 2 === 0) continue;
        weightSum += coefficients[n];
    }
    if (weightSum === 0) weightSum = 1;

    for (let i = 0; i < curve.length; i++) {
        const x = 2 * i / (curve.length - 1) - 1;
        let t0 = 1;  // T0(x)
        let t1 = x;  // T1(x)
        let total = 0;
        for (let n = 2; n <= degree; n++) {
            const tn = 2 * x * t1 - t0;
            if (character === "hybrid" ||
                (character === "even" && n % 2 === 0) ||
                (character === "odd" && n % 2 !== 0)) {
                total += coefficients[n] * tn;
            }
            t0 = t1;
            t1 = tn;
        }
        curve[i] = Math.max(-1, Math.min(1, total / weightSum));
    }
    return curve;
}

// A separate low-CPU audio graph adds polynomial terms to the pre-filter
// oscillator mix. It NEVER reroutes the established dry oscillator output.
function createPolynomialRingVoice(ctx, oscA, oscB, subOsc, destinationFilter) {
    const s = polynomialRingState;
    const shapers = [ctx.createWaveShaper(), ctx.createWaveShaper()];
    const shapeGains = [ctx.createGain(), ctx.createGain()];
    const unaryLevel = ctx.createGain();
    const productAB = ctx.createGain();           // x1*x2, total degree 2
    const productABLevel = ctx.createGain();
    const productASub = ctx.createGain();         // x1*x3, total degree 2
    const productASubLevel = ctx.createGain();
    const productABSub = ctx.createGain();        // x1*x2*x3, degree 3
    const productABSubLevel = ctx.createGain();
    const sum = ctx.createGain();
    const removeDC = ctx.createBiquadFilter();
    const tameHighs = ctx.createBiquadFilter();
    const wetLevel = ctx.createGain();

    const curve = buildPolynomialChebyshevCurve(s.degree, s.character);
    shapers.forEach((shaper) => {
        shaper.curve = curve.slice();
        shaper.oversample = "4x";
    });
    shapeGains[0].gain.value = 1;
    shapeGains[1].gain.value = 0;
    unaryLevel.gain.value = 0.80;
    productAB.gain.value = 0;
    productASub.gain.value = 0;
    productABSub.gain.value = 0;
    productABLevel.gain.value = 0;
    productASubLevel.gain.value = 0;
    productABSubLevel.gain.value = 0;
    wetLevel.gain.value = 0; // click-free note-on, strictly neutral when bypassed

    // Unary polynomial contribution of oscillator A.
    for (let i = 0; i < 2; i++) {
        oscA.connect(shapers[i]);
        shapers[i].connect(shapeGains[i]);
        shapeGains[i].connect(unaryLevel);
    }
    unaryLevel.connect(sum);

    // Audio-rate GainNode modulation implements multivariate monomials.
    // Oscillator B / sub are variables, NOT separate MIDI notes.
    oscA.connect(productAB);
    oscB.connect(productAB.gain);
    productAB.connect(productABLevel);
    productABLevel.connect(sum);

    oscA.connect(productASub);
    subOsc.connect(productASub.gain);
    productASub.connect(productASubLevel);
    productASubLevel.connect(sum);

    productAB.connect(productABSub);
    subOsc.connect(productABSub.gain);
    productABSub.connect(productABSubLevel);
    productABSubLevel.connect(sum);

    removeDC.type = "highpass";
    removeDC.frequency.value = 25;
    removeDC.Q.value = 0.707;
    tameHighs.type = "lowpass";
    tameHighs.frequency.value = Math.min(11000, 0.44 * ctx.sampleRate);
    tameHighs.Q.value = 0.707;
    sum.connect(removeDC);
    removeDC.connect(tameHighs);
    tameHighs.connect(wetLevel);
    wetLevel.connect(destinationFilter);

    const ownedNodes = [
        ...shapers, ...shapeGains, unaryLevel,
        productAB, productABLevel, productASub, productASubLevel,
        productABSub, productABSubLevel, sum, removeDC, tameHighs, wetLevel
    ];
    let activeShape = 0;
    let currentShapeKey = `${s.degree}:${s.character}`;
    let retirementTimer = null;
    let disposed = false;
    let stopping = false;

    function dispose() {
        if (disposed) return;
        disposed = true;
        if (retirementTimer) clearTimeout(retirementTimer);
        // Disconnect only these outgoing taps, keeping ordinary Synth audio.
        for (const [source, target] of [
            [oscA, shapers[0]], [oscA, shapers[1]],
            [oscA, productAB], [oscA, productASub],
            [oscB, productAB.gain],
            [subOsc, productASub.gain], [subOsc, productABSub.gain]
        ]) {
            try { source.disconnect(target); } catch (error) { /* already disconnected */ }
        }
        ownedNodes.forEach(node => {
            try { node.disconnect(); } catch (error) { /* safe cleanup */ }
        });
    }

    const voice = {
        get disposed() { return disposed; },
        update() {
            if (stopping || disposed) return;
            const now = ctx.currentTime;
            const active = polynomialRingIsActive();
            const d = polynomialRingState.dimension;
            const degree = polynomialRingState.degree;
            const shapeKey = `${degree}:${polynomialRingState.character}`;
            if (shapeKey !== currentShapeKey && active) {
                const nextShape = 1 - activeShape;
                shapers[nextShape].curve = buildPolynomialChebyshevCurve(
                    degree, polynomialRingState.character
                );
                shapeGains[nextShape].gain.cancelScheduledValues(now);
                shapeGains[activeShape].gain.cancelScheduledValues(now);
                shapeGains[nextShape].gain.setTargetAtTime(1, now, 0.014);
                shapeGains[activeShape].gain.setTargetAtTime(0, now, 0.014);
                activeShape = nextShape;
                currentShapeKey = shapeKey;
            }
            // Each higher dimension introduces at least one new variable.
            productABLevel.gain.setTargetAtTime(active && d >= 2 ? 0.58 : 0, now, 0.025);
            productASubLevel.gain.setTargetAtTime(active && d >= 3 ? 0.40 : 0, now, 0.025);
            productABSubLevel.gain.setTargetAtTime(active && d >= 3 && degree >= 3 ? 0.45 : 0, now, 0.025);
            const amount = active ? polynomialRingState.amount / 100 : 0;
            const level = amount * 0.38 / (1 + 0.14 * Math.max(0, d - 1));
            wetLevel.gain.setTargetAtTime(level, now, 0.025);

            if (active) {
                if (retirementTimer) clearTimeout(retirementTimer);
                retirementTimer = null;
            } else if (!retirementTimer) {
                // Free the oversampled shapers after a brief, smooth bypass.
                retirementTimer = setTimeout(() => {
                    retirementTimer = null;
                    if (!polynomialRingIsActive()) dispose();
                }, 280);
            }
        },
        stop(delaySeconds) {
            if (stopping || disposed) return;
            stopping = true;
            const delay = Math.max(0, Number(delaySeconds) || 0);
            // The parent note envelope handles the release; retire taps after it.
            if (retirementTimer) clearTimeout(retirementTimer);
            retirementTimer = setTimeout(dispose, Math.ceil((delay + 0.12) * 1000));
        },
        dispose
    };
    voice.update();
    return voice;
}

function updateActivePolynomialRings() {
    if (!audioContext) return;
    activeNotes.forEach(note => {
        // Strictly Synth-only: piano and choir never expose these oscillators.
        if (!note.oscillatorA || !note.oscillatorB || !note.subOscillator || !note.filter) return;
        if (polynomialRingIsActive() && (!note.polynomialRing || note.polynomialRing.disposed)) {
            note.polynomialRing = createPolynomialRingVoice(
                audioContext, note.oscillatorA, note.oscillatorB,
                note.subOscillator, note.filter
            );
        } else if (note.polynomialRing) {
            note.polynomialRing.update();
        }
    });
}

// Controls are live on held notes, just like FM Resonance.
polynomialRingUI.enabled?.addEventListener("change", () => setPolynomialRingState({
    ...polynomialRingState, enabled: polynomialRingUI.enabled.checked
}));
polynomialRingUI.amount?.addEventListener("input", () => setPolynomialRingState({
    ...polynomialRingState, amount: polynomialRingUI.amount.value
}));
polynomialRingUI.degree?.addEventListener("input", () => setPolynomialRingState({
    ...polynomialRingState, degree: polynomialRingUI.degree.value
}));
polynomialRingUI.character?.addEventListener("change", () => setPolynomialRingState({
    ...polynomialRingState, character: polynomialRingUI.character.value
}));
polynomialRingUI.dimension?.addEventListener("change", () => setPolynomialRingState({
    ...polynomialRingState, dimension: polynomialRingUI.dimension.value
}));
syncPolynomialRingUI();

// Music Box Toy Piano — Mechanical Key Action
let toyPianoKeyClickEnabled = false;
let toyPianoKeyDownGain = 0.35;
let toyPianoKeyDownFrequency = 950;

// Piano Engine state
let pianoSustainPedalActive = false;
let pianoAuditionMode = true;
let activePianoNodes = [];
const MAX_PIANO_VOICES = 18;
let pianoPresetSoundboardBloom = 1.0;

// Choir Engine state
let activeChoirNodes = [];
let choirAhC3Buffer = null;
let choirNoiseBuffer = null;
let choirGlottalWave = null;
const MAX_CHOIR_VOICES = 4;

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

// ========================================
// DREAM BINDER — LIVE FM RESONANCE FOR HELD / LATCHED NOTES
// Works with both performance Latch and the arpeggiator's active synth voices.
// ========================================
function updateActiveSynthFM(parameter) {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    activeNotes.forEach((note) => {
        // Ignore Piano / Choir voices; only Synth FM voices have these nodes.
        if (!note.fmModulator || !note.fmEnvelope ||
            !note.fmDepth || !note.oscillatorA) return;

        if (parameter === "amount" || parameter === "ratio") {
            // Smoothly retune the existing modulator; don't retrigger the note.
            if (parameter === "ratio") {
                note.fmModulator.frequency.cancelAndHoldAtTime(now);
                note.fmModulator.frequency.setTargetAtTime(
                    note.fmFrequency * currentFmRatio,
                    now,
                    0.025
                );
            }

            // Depth is separate from the ADSR shape, so Amount / Ratio
            // can move continuously without wiping out the envelope.
            const targetDepth =
                note.fmFrequency * currentFmRatio *
                (currentFmAmount / 100) * 3;

            note.fmDepth.gain.cancelAndHoldAtTime(now);
            note.fmDepth.gain.setTargetAtTime(targetDepth, now, 0.025);
        }

        if (parameter === "attack" || parameter === "decay") {
            // Attack / Decay are time-based stages. When adjusted during a
            // held note, smoothly retrigger only the FM envelope as a swell.
            // The main note and its amplitude envelope keep playing.
            const envelope = note.fmEnvelope.gain;
            const attackTime = Math.max(0.001, currentFmAttack);
            const decayTime = Math.max(0.001, currentFmDecay);

            envelope.cancelAndHoldAtTime(now);
            envelope.linearRampToValueAtTime(1, now + attackTime);
            envelope.linearRampToValueAtTime(
                currentFmSustain,
                now + attackTime + decayTime
            );
        }

        if (parameter === "sustain") {
            // Smoothly reshape the existing note's sustained FM character.
            const envelope = note.fmEnvelope.gain;
            envelope.cancelAndHoldAtTime(now);
            envelope.setTargetAtTime(currentFmSustain, now, 0.04);
        }

        if (parameter === "release") {
            // Release takes effect when the held / latched key is let go.
            note.fmRelease = currentFmRelease;
        }
    });
}

// Music Box Toy Piano — Physical Key Tracking
const physicallyPressedToyKeys = new Set();

const activeTouchKeys = new Map();
let lastPlayedFrequency = null;
let waveFusionModulationTimer = null;
let pianoWaveFusionModulationTimer = null;
let choirWaveFusionModulationTimer = null;
let lastTouchTime = 0;
let trapezoidWave = null;

const waveformSelect = document.getElementById("waveform");
const waveformBSelect = document.getElementById("waveformB");
const originSelect = document.getElementById("origin");
const subWaveformSelect = document.getElementById("subWaveform");
const oscBLevelSlider = document.getElementById("oscBLevel");
const oscBDetuneSlider = document.getElementById("oscBDetune");
// Oscillator B beat tracking: only B-to-A detuning is controlled.
const beatTrackingMode = document.getElementById("beatTrackingMode");
const beatRateSlider = document.getElementById("beatRate");
const beatTempoSlider = document.getElementById("beatTempo");
const beatDivisionSelect = document.getElementById("beatDivision");
function beatTargetHz() {
  if (beatTrackingMode?.value === "fixed") return Number(beatRateSlider.value);
  if (beatTrackingMode?.value === "tempo")
    return (Number(beatTempoSlider.value) / 60) / Number(beatDivisionSelect.value);
  return null;
}
function oscillatorBDetuneCents(noteFrequency, originalCents) {
  const target = beatTargetHz();
  if (target === null || !Number.isFinite(noteFrequency) || noteFrequency <= 0) return originalCents;
  // Fixed absolute difference in Hz, unlike cents-based natural beating.
  // Preserve the user's detune direction; zero detune means no beating.
  const sign = Math.sign(Number(oscBDetuneSlider?.value ?? 7));
  if (!sign) return 0;
  return 1200 * Math.log2(1 + sign * Math.min(target, noteFrequency * 0.8) / noteFrequency);
}
function refreshBeatTrackingUI() {
  const mode = beatTrackingMode?.value || "natural";
  document.getElementById("beatRateRow").hidden = mode !== "fixed";
  document.getElementById("beatTempoRow").hidden = mode !== "tempo";
  document.getElementById("beatDivisionRow").hidden = mode !== "tempo";
  document.getElementById("beatRateValue").textContent = `${Number(beatRateSlider.value).toFixed(2)} Hz`;
  document.getElementById("beatTempoValue").textContent = `${beatTempoSlider.value} BPM`;
}
function updateLiveBeatTracking() {
  refreshBeatTrackingUI();
  updateActiveSynthOscBDetune();
  updateActiveSynthVoiceSpread();
}
[beatTrackingMode, beatRateSlider, beatTempoSlider, beatDivisionSelect].forEach(control => {
  control?.addEventListener("input", updateLiveBeatTracking);
  control?.addEventListener("change", updateLiveBeatTracking);
});
refreshBeatTrackingUI();

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
  selectPresetBank(activePresetBank);
}

function closePresetBrowser() {
  if (!presetBrowserOverlay) return;
  presetBrowserOverlay.classList.add("hidden");
}

// Dream Binder: factory banks + personal patches share the existing browser.
// Personal patches live in localStorage on this browser/device only.
let activePresetBank = "signature";
let selectedUserPresetName = null;

function selectPresetBank(bankName) {
  activePresetBank = bankName;
  presetBrowserTabs.forEach((tab) => {
    tab.classList.toggle("active-bank", tab.dataset.bank === bankName);
  });
  renderPresetBrowser(bankName);
}

function showPresetMessage(message) {
  if (presetMessage) presetMessage.textContent = message;
  const messageInBrowser = document.getElementById("presetManagerMessage");
  if (messageInBrowser) messageInBrowser.textContent = message;
}

// Two views of the same sounds: Instrument View (bank) and Dream Atlas (realm).
function updateDreamAtlasFilters() {
  const controls = document.getElementById("dreamAtlasFilters");
  if (controls) controls.hidden = activePresetBank !== "atlas";
}

document.getElementById("dreamAtlasRealm")?.addEventListener("change", () => {
  if (activePresetBank === "atlas") renderPresetBrowser("atlas");
});
document.getElementById("dreamAtlasInstrument")?.addEventListener("change", () => {
  if (activePresetBank === "atlas") renderPresetBrowser("atlas");
});

function renderPresetBrowser(bankName) {
  if (!presetBrowserList) return;
  activePresetBank = bankName;
  presetBrowserList.replaceChildren();

  const saved = bankName === "user" ? getSavedPresets() : null;
  const atlasRealm = document.getElementById("dreamAtlasRealm")?.value || "all";
  const atlasInstrument = document.getElementById("dreamAtlasInstrument")?.value || "all";
  const presets = bankName === "user"
    ? Object.entries(saved).map(([name, settings]) => ({
        name,
        collection: "My Presets — Saved on this device",
        settings,
        engine: settings.engine || "synth",
        isUserPreset: true
      }))
    : bankName === "atlas"
      ? dreamAtlasPatches.filter(patch =>
          (atlasRealm === "all" || patch.atlasRealm === atlasRealm) &&
          (atlasInstrument === "all" || patch.category === atlasInstrument)
        )
      : Object.values(presetBanks[bankName] || {});
  updateDreamAtlasFilters();
  const theme = document.getElementById("dreamAtlasRealmTheme");
  if (theme && bankName === "atlas") {
    theme.textContent = dreamAtlasRealms.find(r => r.id === atlasRealm)?.theme ||
      "Choose a dream environment or explore all thirteen realms.";
  }

  if (!presets.length) {
    const empty = document.createElement("p");
    empty.className = "preset-message";
    empty.textContent = bankName === "user"
      ? "No saved sounds yet. Enter a name above, then tap Save Current Sound."
      : "No presets in this bank yet.";
    presetBrowserList.appendChild(empty);
    return;
  }

  const grouped = {};
  for (const preset of presets) {
    const collection = preset.collection || "Other";
    (grouped[collection] ||= []).push(preset);
  }

  Object.entries(grouped).forEach(([collection, items]) => {
    const heading = document.createElement("h3");
    heading.className = "preset-collection-heading";
    heading.textContent = collection;
    presetBrowserList.appendChild(heading);

    for (const preset of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-browser-preset";
      button.textContent = preset.name || "Unnamed Preset";
      if (preset.description) {
        button.title = `${preset.description} • ${preset.category === "arpeggiator" ? "Hold notes to play the arpeggio" : "Suggested shift: " + preset.recommendedOctave}`;
      }
      button.addEventListener("click", () => {
        applyPresetSettings({
          ...(preset.settings || {}),
          engine: preset.engine || preset.settings?.engine || "synth"
        });
        selectedUserPresetName = preset.isUserPreset ? preset.name : null;
        if (presetNameInput) presetNameInput.value = preset.name || "";
        presetBrowserList.querySelectorAll(".preset-browser-preset").forEach((entry) => {
          entry.classList.remove("active-preset");
        });
        button.classList.add("active-preset");
        showPresetMessage(preset.atlasRealm
          ? `Dream Atlas · ${preset.collection} · ${preset.name} — ${preset.description} ${preset.category === "arpeggiator" ? "Arpeggiator ON: hold a key or several notes to start." : `Suggested octave shift: ${preset.recommendedOctave}.`}`
          : `Loaded "${preset.name}".`);
      });
      if (preset.isUserPreset && preset.name === selectedUserPresetName) {
        button.classList.add("active-preset");
      }
      presetBrowserList.appendChild(button);
    }
  });
}

if (openPresetBrowserButton) {
  openPresetBrowserButton.addEventListener("click", openPresetBrowser);
}

if (closePresetBrowserButton) {
  closePresetBrowserButton.addEventListener("click", closePresetBrowser);
}

presetBrowserTabs.forEach((tab) => {
  tab.addEventListener("click", () => selectPresetBank(tab.dataset.bank));
});

document.getElementById("quickSavePreset")?.addEventListener("click", () => {
  openPresetBrowser();
  selectPresetBank("user");
  presetNameInput?.focus();
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
let arpTempo = 100; // Quarter note tempo; preserves the original 100-BPM timing by default.
const arpTempoSlider = document.getElementById("arpTempo");
const arpTempoValue = document.getElementById("arpTempoValue");
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

function updateActiveSynthWaveforms() {
    if (!audioContext) return;

    activeNotes.forEach((note) => {
        if (!note.oscillatorA || !note.oscillatorB) return;

        // Live Oscillator A Switching
        applyWaveform(
            note.oscillatorA,
            waveformSelect.value,
            audioContext
        );

        // Live Oscillator B Switching
        applyWaveform(
            note.oscillatorB,
            waveformBSelect.value,
            audioContext
        );

        // Live Unison Waveform Switching
        if (note.unisonOscillators) {
            note.unisonOscillators.forEach(({ osc }, index) => {
                const waveform =
                    index < 2
                        ? waveformSelect.value
                        : waveformBSelect.value;

                applyWaveform(
                    osc,
                    waveform,
                    audioContext
                );
            });
        }
    });
}

// ========================================
// Live Synth Sub Waveform Switching
// ========================================

function updateActiveSynthSubWaveform() {
    if (!audioContext) return;

    activeNotes.forEach((note) => {
        if (!note.subOscillator) return;

        applyWaveform(
            note.subOscillator,
            subWaveformSelect.value,
            audioContext
        );
    });
}

// ========================================
// Live Synth Sub Level Control
// ========================================

function updateActiveSynthSubLevel() {
    if (!audioContext) return;

    const subLevel =
        getValue(subLevelSlider, 0) / 100 * 0.35;

    activeNotes.forEach((note) => {
        if (!note.subGain || !note.subOscillator) return;

        note.subGain.gain.setTargetAtTime(
            subLevel,
            audioContext.currentTime,
            0.05
        );
    });
}

// ========================================
// Live Synth OSC B Detune Control
// ========================================

function updateActiveSynthOscBDetune() {
    if (!audioContext) return;

    const detune =
        getValue(oscBDetuneSlider, 7);

    activeNotes.forEach((note) => {
        if (!note.oscillatorB) return;

        const driftOffset =
            note.oscillatorB.userDriftOffset || 0;

        note.oscillatorB.detune.setTargetAtTime(
            oscillatorBDetuneCents(note.fmFrequency, detune) - driftOffset,
            audioContext.currentTime,
            0.05
        );

// Synchronize OSC B unison voices
if (
    note.unisonOscillators &&
    note.unisonOscillators.length === 4
) {
    const presenceAmount =
        getValue(presenceSlider, 0) / 100;

    const voiceSpread =
        getValue(voiceSpreadSlider, 0) +
        presenceAmount * 70;

    const spreadCents = voiceSpread * 0.35;

    note.unisonOscillators[2].osc.detune.setTargetAtTime(
        oscillatorBDetuneCents(note.fmFrequency, detune) - driftOffset - spreadCents,
        audioContext.currentTime,
        0.05
    );

    note.unisonOscillators[3].osc.detune.setTargetAtTime(
        oscillatorBDetuneCents(note.fmFrequency, detune) - driftOffset + spreadCents,
        audioContext.currentTime,
        0.05
    );
}
        
    });
}

// ========================================
// Live Synth Voice Spread Control
// ========================================

function updateActiveSynthVoiceSpread() {
    if (!audioContext) return;

    const presenceAmount =
        getValue(presenceSlider, 0) / 100;

    const voiceSpread =
        getValue(voiceSpreadSlider, 0) +
        presenceAmount * 70;

    const spreadCents = voiceSpread * 0.35;

    const unisonLevel =
        (voiceSpread / 100) * 0.08;

    activeNotes.forEach((note) => {
        if (!note.unisonOscillators ||
            note.unisonOscillators.length !== 4) return;

        const driftCents =
            note.oscillatorA.detune.value;

        const oscBDetune =
            getValue(oscBDetuneSlider, 7);

        const detunes = [
            driftCents - spreadCents,
            driftCents + spreadCents,
            oscillatorBDetuneCents(note.fmFrequency, oscBDetune) - driftCents - spreadCents,
            oscillatorBDetuneCents(note.fmFrequency, oscBDetune) - driftCents + spreadCents
        ];

        note.unisonOscillators.forEach(({ osc, gain }, index) => {
            osc.detune.setTargetAtTime(
                detunes[index],
                audioContext.currentTime,
                0.05
            );

            gain.gain.setTargetAtTime(
                unisonLevel,
                audioContext.currentTime,
                0.05
            );
        });
    });
}

// ========================================
// Live Synth LFO Rate Control
// ========================================

function updateActiveSynthLFORate() {
    if (!audioContext) return;

    const rate = getValue(lfoRateSlider, 2);

    activeNotes.forEach((note) => {
        if (!note.lfoNodes?.lfo) return;

        note.lfoNodes.lfo.frequency.setTargetAtTime(
            rate,
            audioContext.currentTime,
            0.05
        );
    });
}

// ========================================
// Live Synth LFO Amount Control
// ========================================

function updateActiveSynthLFOAmount() {
    if (!audioContext) return;

    const amount = getValue(lfoAmountSlider, 0);

    const destination =
        lfoDestinationSelect?.value;

    const modulationDepth =
        destination === "volume"
            ? amount / 2000
            : amount;

    activeNotes.forEach((note) => {
        if (!note.lfoNodes?.lfoGain) return;

        note.lfoNodes.lfoGain.gain.setTargetAtTime(
            modulationDepth,
            audioContext.currentTime,
            0.05
        );
    });
}

// ========================================
// Live Synth LFO Destination Control
// ========================================

function updateActiveSynthLFODestination() {
    if (!audioContext || !lfoDestinationSelect) return;

    const destination = lfoDestinationSelect.value;
    const amount = getValue(lfoAmountSlider, 0);

    activeNotes.forEach((note) => {
        const nodes = note.lfoNodes;

        if (!nodes?.lfoGain) return;

        if (nodes.destination === destination) return;

        const {
            lfoGain,
            oscillatorA,
            oscillatorB,
            filter,
            noteGain
        } = nodes;

        // Silence modulation before rerouting
        lfoGain.gain.setValueAtTime(
            0,
            audioContext.currentTime
        );

        // Disconnect previous modulation destination
        lfoGain.disconnect();

        // Connect the newly selected destination
        if (destination === "filter") {
            lfoGain.connect(filter.frequency);
        }

        if (destination === "pitch") {
            lfoGain.connect(oscillatorA.frequency);
            lfoGain.connect(oscillatorB.frequency);
        }

        if (destination === "volume") {
            lfoGain.connect(noteGain.gain);
        }

        // Restore modulation with correct scaling
        const modulationDepth =
            destination === "volume"
                ? amount / 2000
                : amount;

        lfoGain.gain.setTargetAtTime(
            modulationDepth,
            audioContext.currentTime,
            0.05
        );

        // Remember the new destination
        nodes.destination = destination;
    });
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

        const mechanicalHum =
    Math.sin(2 * Math.PI * 110 * i / ctx.sampleRate) * 0.50;

sample = last * 0.45 + rumble + ticks + mechanicalHum;
        break;
      }

      case "cosmic": {
        last = last * 0.992 + white * 0.008;

        const deepDrift =
          Math.sin(i * 0.00018) * 0.12 +
          Math.sin(i * 0.00007) * 0.08;

        const distantSpark =
          Math.random() > 0.9975 ? white * 0.12 : 0;

        const cosmicResonance =
    Math.sin(2 * Math.PI * 165 * i / ctx.sampleRate) * 0.50;

sample = last * 0.55 + deepDrift + distantSpark + cosmicResonance;
        break;
      }

      case "white":
      default:
        sample = white;
        break;
    }

    data[i] =
    (type === "cosmic" || type === "machine")
        ? sample * 4.0
        : sample;
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

    initializeCoherenceClock(audioContext);

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

  if (!lfoRateSlider || !lfoDestinationSelect) return null;

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

  return {
    lfo,
    lfoGain,
    oscillatorA,
    oscillatorB,
    filter,
    noteGain,
    destination: lfoDestinationSelect.value
};
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

function startPianoWaveFusionModulation() {
    if (pianoWaveFusionModulationTimer !== null) return;

    pianoWaveFusionModulationTimer = setInterval(() => {
        if (!audioContext) return;

        const ctx = audioContext;

        const rawWaveFusion =
            getValue(waveFusionSlider, 50) / 100;

        const morphMotion =
            dreamMorphMotionCheckbox?.checked;

        const morphDrift =
            morphMotion
                ? Math.sin(ctx.currentTime * 0.12) * 0.08
                : 0;

        const fusionCurve =
            waveFusionCurveSelect?.value || "smooth";

        const adjustedWaveFusion =
            Math.min(
                1,
                Math.max(
                    0,
                    rawWaveFusion + morphDrift
                )
            );

        const shapedWaveFusion =
            shapeWaveFusion(
                adjustedWaveFusion,
                fusionCurve
            );

        const presence =
            getValue(presenceSlider, 0) / 100;

        const boundPresenceBoost =
            1.0 + (presence * 0.75);

        const boundGainA =
            0.20 *
            boundPresenceBoost *
            Math.cos(
                shapedWaveFusion * Math.PI * 0.5
            );

        const boundGainB =
            0.20 *
            boundPresenceBoost *
            Math.sin(
                shapedWaveFusion * Math.PI * 0.5
            );

        activePianoNodes.forEach((voice) => {
            if (
    voice.boundResonanceMorphGainA &&
    voice.boundResonanceMorphGainB
) {
    voice.boundResonanceMorphGainA.gain.setTargetAtTime(
        Math.max(0.0001, boundGainA),
        ctx.currentTime,
        0.08
    );

    voice.boundResonanceMorphGainB.gain.setTargetAtTime(
        Math.max(0.0001, boundGainB),
        ctx.currentTime,
        0.08
    );
}
        });

        if (activePianoNodes.length === 0) {
            clearInterval(
                pianoWaveFusionModulationTimer
            );

            pianoWaveFusionModulationTimer = null;
        }
    }, 80);
}

function startChoirWaveFusionModulation() {
    if (choirWaveFusionModulationTimer !== null) {
        return;
    }

    choirWaveFusionModulationTimer = setInterval(
        () => {
            if (!audioContext) {
                return;
            }

            const ctx = audioContext;

            const rawWaveFusion =
    getValue(waveFusionSlider, 50) / 100;

const morphMotion =
    dreamMorphMotionCheckbox?.checked;
            
        const morphDrift =
    morphMotion
        ? Math.sin(ctx.currentTime * 0.60) * 0.30
        : 0;

const adjustedWaveFusion =
    Math.min(
        1,
        Math.max(
            0,
            rawWaveFusion + morphDrift
        )
    );

const fusionCurve =
    waveFusionCurveSelect?.value || "linear";

const shapedWaveFusion =
    shapeWaveFusion(
        adjustedWaveFusion,
        fusionCurve
    );
            const humanAhFusionLevel =
    1.60 - (shapedWaveFusion * 1.20);

const liveChoirPresenceAmount =
    getValue(presenceSlider, 0) / 100;

const liveChoirPresenceLevel =
    1.0 + (liveChoirPresenceAmount * 0.35);

const liveChoirPresenceHighShelf =
    liveChoirPresenceAmount * 3.0;

const liveChoirOrbitDepth =
    deepDreamOrbitCheckbox?.checked
        ? 0.40
        : 0;

// Live Choir Living Texture intensity

const liveChoirTextureAmount =
    getValue(noiseAmountSlider, 0) / 100;

const liveChoirTextureLevels = {
    white: 0.035,
    air: 0.10,
    dust: 0.14,
    cosmic: 0.12,
    machine: 0.12,
    dark: 0.16
};
            
            activeChoirNodes.forEach(
                (voice) => {
                    if (
                        voice.humanAhFusionGain &&
                        !voice.released
                    ) {
                        voice.humanAhFusionGain.gain.setTargetAtTime(
                            humanAhFusionLevel,
                            ctx.currentTime,
                            0.05
                        );
                    }

if (
    voice.presenceGain &&
    voice.presenceFilter &&
    !voice.released
) {
    voice.presenceGain.gain.setTargetAtTime(
        liveChoirPresenceLevel,
        ctx.currentTime,
        0.05
    );

    voice.presenceFilter.gain.setTargetAtTime(
        liveChoirPresenceHighShelf,
        ctx.currentTime,
        0.05
    );
}

if (
    voice.orbitGain &&
    !voice.released
) {
    voice.orbitGain.gain.setTargetAtTime(
        liveChoirOrbitDepth,
        ctx.currentTime,
        0.05
    );
}

// Live Choir Living Texture control

if (
    voice.textureGain &&
    !voice.released
) { 
// Detect a new Living Texture selection
const selectedTextureType =
    noiseTypeSelect?.value || "white";

const textureTypeChanged =
    selectedTextureType !== voice.textureType;
// Prepare a smooth transition when the texture changes
if (
    textureTypeChanged &&
    voice.textureSource &&
    voice.textureCrossfadeGain &&
    voice.textureFilter
) {
    const oldTextureSource = voice.textureSource;
    const oldCrossfadeGain = voice.textureCrossfadeGain;

    const newTextureSource = ctx.createBufferSource();
    const newCrossfadeGain = ctx.createGain();

    newTextureSource.buffer = createNoiseBuffer(
        ctx,
        selectedTextureType
    );

    newTextureSource.loop = true;

    newCrossfadeGain.gain.setValueAtTime(
        0,
        ctx.currentTime
    );

    newTextureSource.connect(newCrossfadeGain);
    newCrossfadeGain.connect(voice.textureFilter);

    newTextureSource.start();

// Register replacement nodes for Choir cleanup
if (voice.textureSources && voice.textureProcessingNodes) {
    voice.textureSources.push(newTextureSource);
    voice.textureProcessingNodes.push(newCrossfadeGain);
}
    
    // Crossfade over 150 milliseconds
    oldCrossfadeGain.gain.cancelScheduledValues(
        ctx.currentTime
    );

    oldCrossfadeGain.gain.setTargetAtTime(
        0,
        ctx.currentTime,
        0.05
    );

    newCrossfadeGain.gain.setTargetAtTime(
        1,
        ctx.currentTime,
        0.05
    );

    // Update the active texture references
    voice.textureSource = newTextureSource;
    voice.textureCrossfadeGain = newCrossfadeGain;
    voice.textureType = selectedTextureType;

    // Retire the previous texture after the transition
    oldTextureSource.stop(ctx.currentTime + 0.25);

    oldTextureSource.onended = () => {
        oldTextureSource.disconnect();
        oldCrossfadeGain.disconnect();
    };
}
    
    const textureType =
        voice.textureType || "white";

    const textureLevel =
        liveChoirTextureLevels[textureType] ?? 0.035;

    voice.textureGain.gain.setTargetAtTime(
        liveChoirTextureAmount * textureLevel,
        ctx.currentTime,
        0.05
    );
}
                    
                }
            );

            if (activeChoirNodes.length === 0) {
                clearInterval(
                    choirWaveFusionModulationTimer
                );

                choirWaveFusionModulationTimer = null;
            }
        },
        80
    );
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

// ========================================
// Synth Resonant Field
// Coherence / Decoherence Foundation
// ========================================

const resonantFieldInput = ctx.createGain();
const resonantFieldOutput = ctx.createGain();

resonantFieldInput.gain.value = 1.0;
resonantFieldOutput.gain.value = 1.0;
    
  const noiseSource = ctx.createBufferSource();
  const noiseGain = ctx.createGain();
  const textureCrossfadeGain = ctx.createGain();
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

// ========================================
// DREAM BINDER — FM RESONANCE
// Independent Frequency Modulation + Live Latch Controls
// ========================================

const fmAmount = currentFmAmount;
const fmRatio = currentFmRatio;
const fmAttack = currentFmAttack;
const fmDecay = currentFmDecay;
const fmSustain = currentFmSustain;
const fmRelease = currentFmRelease;

// Keep a silent FM path even at Amount = 0. A latched note can then
// be brought into FM Resonance without restarting its oscillator.
const fmModulator = ctx.createOscillator();
const fmEnvelope = ctx.createGain();
const fmDepth = ctx.createGain();

fmModulator.type = "sine";
fmModulator.frequency.setValueAtTime(
    startFrequency * fmRatio,
    ctx.currentTime
);
fmModulator.frequency.exponentialRampToValueAtTime(
    frequency * fmRatio,
    ctx.currentTime + glideTime
);

// The normalized FM envelope multiplied by the modulation depth
// matches the original FM amplitude and preserves preset voicing.
const fmPeakDepth = frequency * fmRatio * (fmAmount / 100) * 3;
const fmNow = ctx.currentTime;

fmDepth.gain.setValueAtTime(fmPeakDepth, fmNow);
fmEnvelope.gain.setValueAtTime(0, fmNow);
fmEnvelope.gain.linearRampToValueAtTime(
    1,
    fmNow + Math.max(0.001, fmAttack)
);
fmEnvelope.gain.linearRampToValueAtTime(
    fmSustain,
    fmNow + Math.max(0.001, fmAttack) + Math.max(0.001, fmDecay)
);

// Pure sine FM -> independent envelope -> depth -> Oscillator A pitch.
fmModulator.connect(fmEnvelope);
fmEnvelope.connect(fmDepth);
fmDepth.connect(oscillatorA.frequency);
fmModulator.start();
    
oscillatorA.detune.value = driftCents;

oscillatorB.detune.value =
  oscillatorBDetuneCents(frequency, getValue(oscBDetuneSlider, 7)) - driftCents;

oscillatorB.userDriftOffset = driftCents;
    
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
  oscillatorBDetuneCents(frequency, getValue(oscBDetuneSlider, 7)) - driftCents - spreadCents
);

addUnisonOscillator(
  waveformB,
  oscillatorBDetuneCents(frequency, getValue(oscBDetuneSlider, 7)) - driftCents + spreadCents
);
  
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
  
  noiseSource.connect(textureCrossfadeGain);
textureCrossfadeGain.connect(noiseGain);
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
  
// ========================================
// Synth Resonant Field — Harmonic / Modulation / Spatial Rings
// ========================================

filter.connect(resonantFieldInput);

const resonantField = createSynthResonantField(
    ctx, frequency, resonantFieldInput, resonantFieldOutput,
    stereoPanner, filter
);

resonantFieldOutput.connect(noteGain);

noteGain.connect(stereoPanner);

stereoPanner.connect(dryGain);
stereoPanner.connect(reverbNode);
stereoPanner.connect(delayDryGain);
stereoPanner.connect(delayNode);

  // Optional Synth-only polynomial stage, evaluated in parallel with the
  // original dry oscillators. Nothing is allocated for neutral presets.
  const polynomialRing = polynomialRingIsActive()
      ? createPolynomialRingVoice(ctx, oscillatorA, oscillatorB, subOscillator, filter)
      : null;

  oscillatorA.start();
  oscillatorB.start();
  subOscillator.start();
  noiseSource.start();
  return {
  oscillatorA,
  oscillatorB,
  oscAGain,
  oscBGain,
  filter,
  stereoPanner,
  noteGain,
  polynomialRing,
  resonantField,
  lfoNodes,
  noiseSource,
  noiseGain,
  textureCrossfadeGain,
  textureType,
  subOscillator,
  subGain,
    livingTextureNodes,
  unisonOscillators,

  // FM Resonance — live controls for held / latched synth notes
  fmModulator,
  fmEnvelope,
  fmDepth,
  fmFrequency: frequency,
  fmRelease
};
}


function stopActivePianoNodes() {
    const voices = [...activePianoNodes];

    voices.forEach((voice) => {
        try {
            if (voice.steal) {
                voice.steal();
            } else if (voice.cleanup) {
                voice.cleanup();
            }
        } catch (error) {
            // Voice was already stopped.
        }
    });
}

function stopActiveChoirNodes() {
    const voices = [...activeChoirNodes];

    voices.forEach((voice) => {
        try {
            if (voice.steal) {
                voice.steal();
            } else if (voice.cleanup) {
                voice.cleanup();
            }
        } catch (error) {
            // Voice was already stopped.
        }
    });
}

// ========================================
// Music Box Toy Piano — Key-Down Click
// ========================================

function playToyPianoKeyDownClick() {
    const ctx = getAudioContext();

    const duration = 0.035;
    const length = Math.ceil(ctx.sampleRate * duration);

    const buffer = ctx.createBuffer(
        1,
        length,
        ctx.sampleRate
    );

    const data = buffer.getChannelData(0);

    let softenedNoise = 0;

    for (let i = 0; i < length; i++) {
        const time = i / ctx.sampleRate;

        const noise = Math.random() * 2 - 1;

        softenedNoise =
            softenedNoise * 0.72 +
            noise * 0.28;

        const envelope =
    toyPianoKeyDownFrequency === 650
        ? Math.exp(-time * 85)
        : Math.exp(-time * 170);

        data[i] = softenedNoise * envelope;
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const clickGain = ctx.createGain();

    source.buffer = buffer;

    filter.type = "bandpass";
    filter.frequency.value = toyPianoKeyDownFrequency;
    filter.Q.value = 0.8;

    clickGain.gain.value = toyPianoKeyDownGain;

    source.connect(filter);
    filter.connect(clickGain);

    // Dry mechanical action, independent of reverb.
    // Dry mechanical action, independent of reverb.
clickGain.connect(masterGain);

// ========================================
// Antique Wooden Toy Piano
// Hollow Wooden Mechanical Resonance
// ========================================

if (toyPianoKeyDownFrequency === 650) {

    const woodOsc = ctx.createOscillator();
    const woodGain = ctx.createGain();

    woodOsc.type = "sine";
    woodOsc.frequency.value = 380;

    const now = ctx.currentTime;

    woodGain.gain.setValueAtTime(0.0001, now);

    woodGain.gain.exponentialRampToValueAtTime(
    0.60,
    now + 0.004
);

    woodGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.075
    );

    woodOsc.connect(woodGain);
    woodGain.connect(masterGain);

    woodOsc.start(now);
    woodOsc.stop(now + 0.08);

    woodOsc.onended = () => {
        woodOsc.disconnect();
        woodGain.disconnect();
    };
}

source.start();

    source.onended = () => {
        source.disconnect();
        filter.disconnect();
        clickGain.disconnect();
    };
}

// ========================================
// Music Box Toy Piano — Key-Release Click
// ========================================

function playToyPianoKeyReleaseClick() {
    const ctx = getAudioContext();

    const duration = 0.028;
    const length = Math.ceil(ctx.sampleRate * duration);

    const buffer = ctx.createBuffer(
        1,
        length,
        ctx.sampleRate
    );

    const data = buffer.getChannelData(0);

    let softenedNoise = 0;

    for (let i = 0; i < length; i++) {
        const time = i / ctx.sampleRate;
        const noise = Math.random() * 2 - 1;

        softenedNoise =
            softenedNoise * 0.78 +
            noise * 0.22;

        const envelope = Math.exp(-time * 190);

        data[i] = softenedNoise * envelope;
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const clickGain = ctx.createGain();

    source.buffer = buffer;

    filter.type = "bandpass";
    filter.frequency.value = 720;
    filter.Q.value = 0.8;

    clickGain.gain.value = 0.22;
    
    source.connect(filter);
    filter.connect(clickGain);

    // Keep the mechanical return dry.
    clickGain.connect(masterGain);

    source.start();

    source.onended = () => {
        source.disconnect();
        filter.disconnect();
        clickGain.disconnect();
    };
}

function playNote(frequency) {
    
  if (currentResonanceSource === "piano") {
    createPianoNote(frequency);
    return;
  }

  if (currentResonanceSource === "choir") {
     
      if (!choirAhC3Buffer) {
    loadChoirAhC3Sample().then((buffer) => {
        if (buffer) {
            playNote(frequency);
        }
    });

    return;
}
      
    const noteId = String(frequency);

    const existingVoice =
        activeNotes.get(noteId);

    // A repeated press should quickly retire the
    // previous choir voice instead of allowing its
    // full release tail to overlap the new voice.
    if (existingVoice?.steal) {
        existingVoice.steal();
        activeNotes.delete(noteId);
    } else if (existingVoice?.release) {
        existingVoice.release();
        activeNotes.delete(noteId);
    }

    const choirVoice =
        createChoirNote(frequency);

    activeNotes.set(
        noteId,
        choirVoice
    );

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

  if (toyPianoKeyClickEnabled) {
      playToyPianoKeyDownClick();
  }

  activeNotes.set(noteId, note);
  lastPlayedFrequency = frequency;
  startWaveFusionModulation();  
}

function stopNote(frequency) {
  const noteId = String(frequency);
  const note = activeNotes.get(noteId);

  if (!note) return;

if (note.release) {
    note.release();
    activeNotes.delete(noteId);
    return;
}
    
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

  // Keep the polynomial harmonics inside the standard note release tail.
  if (note.polynomialRing) note.polynomialRing.stop(release + 0.05);

  if (note.resonantField) {
    note.resonantField.stop(release + 0.05);
  }

// ========================================
// FM Resonance — Note Release
// ========================================

if (note.fmModulator) {

// FM Resonance — Independent Release
const fmReleaseNow = ctx.currentTime;

note.fmEnvelope.gain.cancelAndHoldAtTime(fmReleaseNow);
note.fmEnvelope.gain.setTargetAtTime(
    0,
    fmReleaseNow,
    Math.max(0.001, note.fmRelease) / 5
);
    
    const fmStopTime =
        ctx.currentTime + release + 0.05;

    note.fmModulator.stop(fmStopTime);

    note.fmModulator.onended = () => {
        note.fmModulator.disconnect();
        note.fmEnvelope?.disconnect();
        note.fmDepth?.disconnect();
    };
}
    
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
  // 1/4, 1/8, 1/16, 1/32 at the selected BPM.
  return (60000 / arpTempo) / Math.pow(2, arpRate - 1);
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
  if (notes.length === 1) {
    note = notes[0];
    arpStepIndex = 0;
    arpDirection = 1;
  } else {
    arpStepIndex = Math.max(0, Math.min(notes.length - 1, arpStepIndex));
    note = notes[arpStepIndex];
    if (arpStepIndex === notes.length - 1) arpDirection = -1;
    else if (arpStepIndex === 0) arpDirection = 1;
    arpStepIndex += arpDirection;
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

function refreshLatchedKeyHighlights() {
  keys.forEach((key) => {
    const frequency = getKeyFrequency(key);
    const noteId = String(frequency);

    key.classList.toggle(
      "key-latched",
      arpHeldNotes.has(noteId)
    );
  });
}

function clearKeyHighlights() {
  keys.forEach((key) => {
    key.classList.remove("key-active");
    key.classList.remove("key-latched");
  });
}

function beginInputNote(frequency) {
    if (dbBindingPress(frequency)) return;
    const noteId = String(frequency);

        // Track physical key movement independently
    // from musical note sustain and Key Latch.
    if (
        toyPianoKeyClickEnabled &&
        currentResonanceSource === "synth" &&
        !dreamArpEnabled
    ) {
        physicallyPressedToyKeys.add(noteId);
    }

    // ========================================
    // Arpeggiator mode
    // ========================================

    if (dreamArpEnabled) {
        if (
            arpLatchEnabled &&
            arpHeldNotes.has(noteId)
        ) {
            arpHeldNotes.delete(noteId);

            arpPlayedOrder =
                arpPlayedOrder.filter(
                    (note) =>
                        note !== Number(frequency)
                );

            refreshLatchedKeyHighlights();

            if (arpHeldNotes.size === 0) {
                stopDreamArp();
            }

            return;
        }

        arpHeldNotes.add(noteId);

        if (
            !arpPlayedOrder.includes(
                Number(frequency)
            )
        ) {
            arpPlayedOrder.push(
                Number(frequency)
            );
        }

        setKeyLatched(frequency, true);
        startDreamArp();
        return;
    }

    // ========================================
    // Independent performance latch
    // ========================================

    if (arpLatchEnabled) {
        if (arpHeldNotes.has(noteId)) {
            arpHeldNotes.delete(noteId);

            stopNote(frequency);

            setKeyLatched(
                frequency,
                false
            );

            return;
        }

        arpHeldNotes.add(noteId);

        setKeyActive(frequency, true);
        setKeyLatched(frequency, true);

        playNote(frequency);

        return;
    }

    // ========================================
    // Normal keyboard behavior
    // ========================================

    setKeyActive(frequency, true);
    playNote(frequency);
    refreshLatchedKeyHighlights();
}


function endInputNote(frequency) {
    if (dbBindingRelease(frequency)) return;

    const noteId = String(frequency);

    // ========================================
    // Music Box Toy Piano — Physical Key Return
    // ========================================

    if (physicallyPressedToyKeys.has(noteId)) {

        physicallyPressedToyKeys.delete(noteId);

        if (
            toyPianoKeyClickEnabled &&
            currentResonanceSource === "synth" &&
            !dreamArpEnabled
        ) {
            playToyPianoKeyReleaseClick();
        }
    }

    setKeyActive(frequency, false);
    // Arpeggiator latch keeps its notes.
    if (dreamArpEnabled) {
        if (arpLatchEnabled) {
            return;
        }

        arpHeldNotes.delete(
            String(frequency)
        );

        setKeyLatched(
            frequency,
            false
        );

        if (arpHeldNotes.size === 0) {
            stopDreamArp();
        }

        return;
    }

    // Independent latch keeps the actual
    // sustained note/chord alive.
    if (arpLatchEnabled) {
        return;
    }

    if (
        currentResonanceSource !== "piano"
    ) {
        stopNote(frequency);
    }

    setKeyActive(frequency, false);
}

function updateKeyboardOctave() {
  dbReleaseAllBindings();
  keys.forEach((key) => {
    const baseFrequency = Number(key.dataset.note);
    const shiftedFrequency =
      baseFrequency * Math.pow(2, octaveShift);

    key.dataset.currentNote =
      shiftedFrequency.toFixed(2);
  });

  if (octaveDisplay) {
  octaveDisplay.textContent =
    `Shift: ${octaveShift > 0 ? "+" : ""}${octaveShift}`;
}

if (!arpLatchEnabled) {
  stopAllNotes();
}

refreshLatchedKeyHighlights();
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

// ========================================
// Synth Live Filter Modulation
// ========================================

function updateActiveSynthFilters() {
    if (!audioContext) return;

    const ctx = audioContext;

    const presenceAmount =
        getValue(presenceSlider, 0) / 100;

    const originSettings = getOriginSettings(
        originSelect ? originSelect.value : "pure"
    );

    const baseCutoff =
        getValue(cutoffSlider, 4000) +
        originSettings.filterShift;

    const cutoff =
        Math.max(0, baseCutoff) +
        (presenceAmount * 400);

    const resonance =
        getValue(resonanceSlider, 1) +
        originSettings.resonanceBoost;

    activeNotes.forEach((note) => {
        if (!note.filter) return;

// Live Synth Filter Type
if (filterTypeSelect) {
    note.filter.type = filterTypeSelect.value;
}
        
        note.filter.frequency.setTargetAtTime(
            cutoff,
            ctx.currentTime,
            0.05
        );

        note.filter.Q.setTargetAtTime(
            resonance,
            ctx.currentTime,
            0.05
        );
    });
}

// Live filter slider controls
if (cutoffSlider) {
    cutoffSlider.addEventListener(
        "input",
        updateActiveSynthFilters
    );
}

if (resonanceSlider) {
    resonanceSlider.addEventListener(
        "input",
        updateActiveSynthFilters
    );
}

// Live Filter Type Selection
if (filterTypeSelect) {
    filterTypeSelect.addEventListener(
        "change",
        updateActiveSynthFilters
    );
}

// ========================================
// Synth Live Noise Amount Modulation
// ========================================

function updateActiveSynthNoise() {
    if (!audioContext) return;

    const ctx = audioContext;

    const presenceAmount =
        getValue(presenceSlider, 0) / 100;

    const noiseAmount =
        getValue(noiseAmountSlider, 0) +
        presenceAmount * 0.05;

    const targetNoiseGain =
        (noiseAmount / 100) * 0.08;

    activeNotes.forEach((note) => {
        if (!note.noiseGain || !note.oscillatorA) return;

        note.noiseGain.gain.setTargetAtTime(
            targetNoiseGain,
            ctx.currentTime,
            0.05
        );
    });
}

// Live Noise Amount slider control
if (noiseAmountSlider) {
    noiseAmountSlider.addEventListener(
        "input",
        updateActiveSynthNoise
    );
}

// ========================================
// Synth Live Living Texture Switching
// ========================================

function updateActiveSynthTexture() {
    if (!audioContext || !noiseTypeSelect) return;

    const ctx = audioContext;
    const now = ctx.currentTime;
    const selectedTextureType = noiseTypeSelect.value;

    activeNotes.forEach((note) => {

        // Synth voices only
        if (
            !note.oscillatorA ||
            !note.noiseSource ||
            !note.textureCrossfadeGain ||
            !note.noiseGain
        ) return;

        // Do nothing if texture hasn't changed
        if (note.textureType === selectedTextureType) return;

        const oldSource = note.noiseSource;
        const oldCrossfadeGain = note.textureCrossfadeGain;

        // Create replacement texture
        const newSource = ctx.createBufferSource();
        const newCrossfadeGain = ctx.createGain();

        newSource.buffer = createNoiseBuffer(
            ctx,
            selectedTextureType
        );

        newSource.loop = true;

        newCrossfadeGain.gain.setValueAtTime(
            0,
            now
        );

        newSource.connect(newCrossfadeGain);
        newCrossfadeGain.connect(note.noiseGain);

        newSource.start();

        // Smooth crossfade
        oldCrossfadeGain.gain.cancelScheduledValues(now);

        oldCrossfadeGain.gain.setTargetAtTime(
            0,
            now,
            0.05
        );

        newCrossfadeGain.gain.setTargetAtTime(
            1,
            now,
            0.05
        );

        // Retire previous Living Texture motion
        if (note.livingTextureNodes) {
            for (
                let i = 0;
                i < note.livingTextureNodes.length;
                i += 2
            ) {
                const oldLFO = note.livingTextureNodes[i];
                const oldLFOGain = note.livingTextureNodes[i + 1];

                oldLFO.stop(now + 0.25);

                oldLFO.addEventListener("ended", () => {
                    oldLFO.disconnect();
                    oldLFOGain.disconnect();
                }, { once: true });
            }
        }

        // Activate new texture motion
        note.livingTextureNodes = createLivingTextureMotion(
            ctx,
            selectedTextureType,
            note.noiseGain,
            note.filter,
            note.stereoPanner
        );

        // Update the active Synth voice
        note.noiseSource = newSource;
        note.textureCrossfadeGain = newCrossfadeGain;
        note.textureType = selectedTextureType;

        // Stop and disconnect the previous texture
        oldSource.stop(now + 0.25);

        oldSource.addEventListener("ended", () => {
            oldSource.disconnect();
            oldCrossfadeGain.disconnect();
        }, { once: true });

    });
}

// Live Texture Type dropdown
if (noiseTypeSelect) {
    noiseTypeSelect.addEventListener(
        "change",
        updateActiveSynthTexture
    );
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

if (stereoWidthSlider) {
  stereoWidthSlider.addEventListener("input", updateActiveResonantFields);
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

// ========================================
// SHADOW REALMS — Factory Synth Patch Library
// 32 instrument patches; NO synthesis-engine/audio-routing changes.
// Each patch resets EVERY relevant Synth control to avoid settings leaking
// from a previously loaded sound. The browser categorizes by presetBanks.
// ========================================
const shadowRealmDefaults = {
  "waveform": "triangle",
  "waveformB": "sine",
  "origin": "pure",
  "waveFusion": 35,
  "waveFusionCurve": "smooth",
  "dreamMorphMotion": false,
  "subWaveform": "sine",
  "subLevel": 0,
  "oscBLevel": 0.3,
  "oscBDetune": 5,
  "voiceSpread": 20,
  "beatTrackingMode": "natural",
  "beatRate": 0.5,
  "beatTempo": 120,
  "beatDivision": 1,
  "noiseType": "dark",
  "noiseAmount": 0,
  "drift": 8,
  "stereoWidth": 30,
  "deepDreamOrbit": false,
  "coherence": 0,
  "decoherence": 0,
  "fmAmount": 0,
  "fmRatio": 3.5,
  "fmAttack": 0.01,
  "fmDecay": 0.8,
  "fmSustain": 0,
  "fmRelease": 0.3,
  "attack": 0.06,
  "decay": 0.65,
  "sustain": 0.65,
  "release": 1.6,
  "filterType": "lowpass",
  "cutoff": 2500,
  "resonance": 2.0,
  "lfoRate": 0.4,
  "lfoAmount": 0,
  "lfoDestination": "filter",
  "reverbMix": 0.25,
  "reverbDecay": 3,
  "delayMix": 0.12,
  "delayTime": 0.4,
  "delayFeedback": 0.22,
  "masterVolume": 0.2,
  "presence": 25,
  "glideEnabled": false,
  "glideTime": 0.12
};
const shadowRealmCategoryDefaults = {
  "leads": {
    "waveform": "trapezoid",
    "waveformB": "sawtooth",
    "oscBLevel": 0.32,
    "subLevel": 15,
    "voiceSpread": 26,
    "attack": 0.08,
    "decay": 0.7,
    "sustain": 0.74,
    "release": 1.6,
    "cutoff": 2100,
    "resonance": 3,
    "lfoRate": 0.4,
    "lfoAmount": 90,
    "reverbMix": 0.38,
    "reverbDecay": 4,
    "delayMix": 0.24,
    "delayTime": 0.37,
    "delayFeedback": 0.3,
    "masterVolume": 0.19,
    "presence": 40
  },
  "bass": {
    "waveform": "sawtooth",
    "waveformB": "triangle",
    "oscBLevel": 0.25,
    "subLevel": 52,
    "voiceSpread": 8,
    "attack": 0.02,
    "decay": 0.32,
    "sustain": 0.65,
    "release": 0.48,
    "cutoff": 1000,
    "resonance": 2.4,
    "lfoRate": 1.5,
    "lfoAmount": 0,
    "reverbMix": 0.12,
    "reverbDecay": 2,
    "delayMix": 0.03,
    "delayTime": 0.22,
    "delayFeedback": 0.16,
    "masterVolume": 0.18,
    "presence": 28
  },
  "pads": {
    "waveform": "triangle",
    "waveformB": "sawtooth",
    "oscBLevel": 0.42,
    "subLevel": 18,
    "oscBDetune": 8,
    "voiceSpread": 58,
    "attack": 1.25,
    "decay": 1.5,
    "sustain": 0.83,
    "release": 4.3,
    "cutoff": 1900,
    "resonance": 2.7,
    "lfoRate": 0.2,
    "lfoAmount": 175,
    "noiseType": "air",
    "noiseAmount": 12,
    "drift": 21,
    "stereoWidth": 67,
    "deepDreamOrbit": true,
    "reverbMix": 0.66,
    "reverbDecay": 6,
    "delayMix": 0.28,
    "delayTime": 0.62,
    "delayFeedback": 0.31,
    "masterVolume": 0.15,
    "presence": 42
  },
  "textures": {
    "waveform": "triangle",
    "waveformB": "square",
    "oscBLevel": 0.16,
    "subLevel": 0,
    "oscBDetune": 11,
    "voiceSpread": 12,
    "attack": 0.03,
    "decay": 0.6,
    "sustain": 0.25,
    "release": 1.3,
    "cutoff": 3000,
    "resonance": 4,
    "lfoRate": 2,
    "lfoAmount": 180,
    "noiseType": "machine",
    "noiseAmount": 65,
    "drift": 18,
    "stereoWidth": 55,
    "deepDreamOrbit": true,
    "reverbMix": 0.56,
    "reverbDecay": 5,
    "delayMix": 0.25,
    "delayTime": 0.36,
    "delayFeedback": 0.32,
    "masterVolume": 0.16,
    "presence": 30
  }
};
function shadowRealmSettings(category, changes) {
  return {
    ...shadowRealmDefaults,
    ...shadowRealmCategoryDefaults[category],
    ...changes
  };
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

  keys: {
     
  crystalMemory: {
    name: "Crystal Memory",
    collection: "Dream Memories",
    engine: "synth",

    settings: {
      waveform: "sine",
      waveformB: "trapezoid",

      oscBLevel: 0.38,
      oscBDetune: 0,

      subWaveform: "sine",
      subLevel: 0,

      waveFusion: 72,
      waveFusionCurve: "bright",
      dreamMorphMotion: false,

      origin: "glass",
      presence: 5,
      voiceSpread: 8,

      attack: 0.008,
      decay: 0.85,
      sustain: 0.12,
      release: 1.8,

      filterType: "lowpass",
      cutoff: 6500,
      resonance: 1.2,

      lfoRate: 0.35,
      lfoAmount: 18,
      lfoDestination: "filter",

      noiseType: "air",
      noiseAmount: 0,

      drift: 0,
      stereoWidth: 20,
      deepDreamOrbit: false,

      glideEnabled: false,
      glideTime: 0.12,

      reverbMix: 0.34,
      reverbDecay: 3.7,

      delayMix: 0.12,
      delayTime: 0.32,
      delayFeedback: 0.16,

      masterVolume: 0.17,
    },
  },

astralKeys: {
    name: "Astral Keys",
    collection: "Celestial Dreams",
    engine: "synth",

    settings: {
        waveform: "sine",
        waveformB: "triangle",

        oscBLevel: 0.42,
        oscBDetune: 9,

        subWaveform: "sine",
        subLevel: 0,

        waveFusion: 58,
        waveFusionCurve: "bright",
        dreamMorphMotion: true,

        origin: "glass",
        presence: 12,
        voiceSpread: 24,

        attack: 0.045,
        decay: 1.4,
        sustain: 0.28,
        release: 3.6,

        filterType: "lowpass",
        cutoff: 9200,
        resonance: 1.4,

        lfoRate: 0.18,
        lfoAmount: 65,
        lfoDestination: "filter",

        noiseType: "air",
        noiseAmount: 1,

        drift: 1.5,
        stereoWidth: 48,
        deepDreamOrbit: true,

        glideEnabled: false,
        glideTime: 0.12,

        reverbMix: 0.48,
        reverbDecay: 5.2,

        delayMix: 0.14,
        delayTime: 0.42,
        delayFeedback: 0.20,

        masterVolume: 0.18,
    },
},

 midnightKeys: {
    name: "Midnight Keys",
    collection: "Dream Memories",
    engine: "synth",

    settings: {
        waveform: "triangle",
        waveformB: "sine",

        oscBLevel: 0.46,
        oscBDetune: 3,

        subWaveform: "sine",
        subLevel: 8,

        waveFusion: 38,
        waveFusionCurve: "smooth",
        dreamMorphMotion: false,

        origin: "hollow",
        presence: 18,
        voiceSpread: 12,

        attack: 0.035,
        decay: 0.48,
        sustain: 0.62,
        release: 0.85,

        filterType: "lowpass",
        cutoff: 3100,
        resonance: 0.8,

        lfoRate: 0.24,
        lfoAmount: 8,
        lfoDestination: "filter",

        noiseType: "dark",
        noiseAmount: 1,

        drift: 1.2,
        stereoWidth: 22,
        deepDreamOrbit: false,

        glideEnabled: false,
        glideTime: 0.12,

        reverbMix: 0.22,
        reverbDecay: 2.8,

        delayMix: 0.06,
        delayTime: 0.28,
        delayFeedback: 0.12,

        masterVolume: 0.19,
    },
},     

// ========================================
// After Hours
// Neon Realms — Warm Electric Piano
// ========================================

afterHours: {
    name: "After Hours",
    collection: "Neon Realms",
    engine: "synth",

    settings: {

        // ========================================
        // Mechanical Action
        // ========================================

        mechanicalKeyClick: false,

        // ========================================
        // Primary Oscillators
        // ========================================

        waveform: "sine",
        waveformB: "triangle",

        oscBLevel: 0.46,
        oscBDetune: 4,

        // ========================================
        // Sub Oscillator
        // ========================================

        subWaveform: "sine",
        subLevel: 3,

        // ========================================
        // Wave Fusion
        // ========================================

        waveFusion: 38,
        waveFusionCurve: "smooth",
        dreamMorphMotion: false,

        // ========================================
        // Origin / Presence / Voice Spread
        // ========================================

        origin: "vintage",
        presence: 12,
        voiceSpread: 8,

        // ========================================
        // Amplitude Envelope
        // ========================================

        attack: 0.012,
        decay: 1.25,
        sustain: 0.22,
        release: 1.45,

        // ========================================
        // Filter
        // ========================================

        filterType: "lowpass",
        cutoff: 3900,
        resonance: 0.8,

        // ========================================
        // LFO
        // ========================================

        lfoRate: 0.28,
        lfoAmount: 0,
        lfoDestination: "filter",

        // ========================================
        // Noise / Drift
        // ========================================

        noiseType: "air",
        noiseAmount: 0,

        drift: 0.6,

        // ========================================
        // Stereo / Motion
        // ========================================

        stereoWidth: 24,
        deepDreamOrbit: false,

        // ========================================
        // Glide
        // ========================================

        glideEnabled: false,
        glideTime: 0.12,

        // ========================================
        // Reverb
        // ========================================

        reverbMix: 0.23,
        reverbDecay: 2.9,

        // ========================================
        // Delay
        // ========================================

        delayMix: 0,
        delayTime: 0.32,
        delayFeedback: 0,

        // ========================================
        // Master Output
        // ========================================

        masterVolume: 0.19,

    },
},

// ========================================
// Late Night Cabaret
// Neon Realms — Theatrical Electric Piano
// ========================================

lateNightCabaret: {
    name: "Late Night Cabaret",
    collection: "Neon Realms",
    engine: "synth",

    settings: {
 // FM Resonance — Crystalline Electric Piano
    fmAmount: 30,
       
        // ========================================
        // Mechanical Action
        // ========================================

        mechanicalKeyClick: false,

        // ========================================
        // Oscillator Character
        // ========================================

        waveform: "triangle",
        waveformB: "sine",

        oscBLevel: 0.52,
        oscBDetune: 7,

        // ========================================
        // Sub Oscillator
        // ========================================

        subWaveform: "sine",
        subLevel: 5,

        // ========================================
        // Wave Fusion
        // ========================================

        waveFusion: 42,
        waveFusionCurve: "smooth",
        dreamMorphMotion: false,

        // ========================================
        // Origin / Presence
        // ========================================

        origin: "vintage",
        presence: 19,
        voiceSpread: 14,

        // ========================================
        // Amplitude Envelope
        // ========================================

        attack: 0.008,
        decay: 1.65,
        sustain: 0.26,
        release: 1.85,

        // ========================================
        // Filter
        // ========================================

        filterType: "lowpass",
        cutoff: 4500,
        resonance: 1.15,

        // ========================================
        // LFO
        // ========================================

        lfoRate: 0.38,
        lfoAmount: 4,
        lfoDestination: "filter",

        // ========================================
        // Noise / Drift
        // ========================================

        noiseType: "air",
        noiseAmount: 0,

        drift: 1.1,

        // ========================================
        // Stereo / Motion
        // ========================================

        stereoWidth: 36,
        deepDreamOrbit: false,

        // ========================================
        // Glide
        // ========================================

        glideEnabled: false,
        glideTime: 0.12,

        // ========================================
        // Reverb
        // ========================================

        reverbMix: 0.29,
        reverbDecay: 3.5,

        // ========================================
        // Delay
        // ========================================

        delayMix: 0,
        delayTime: 0.34,
        delayFeedback: 0,

        // ========================================
        // Master Output
        // ========================================

        masterVolume: 0.18,

    },
},
      
neonPulse: {
    name: "Neon Pulse",
    collection: "Neon Realms",
    engine: "synth",

    settings: {
        waveform: "sawtooth",
        waveformB: "square",

        oscBLevel: 0.34,
        oscBDetune: 5,

        subWaveform: "sine",
        subLevel: 12,

        waveFusion: 46,
        waveFusionCurve: "bright",
        dreamMorphMotion: false,

        origin: "metal",
        presence: 24,
        voiceSpread: 10,

        attack: 0.006,
        decay: 0.24,
        sustain: 0.48,
        release: 0.32,

        filterType: "lowpass",
        cutoff: 4800,
        resonance: 2.2,

        lfoRate: 4.2,
        lfoAmount: 28,
        lfoDestination: "filter",

        noiseType: "machine",
        noiseAmount: 1,

        drift: 0,
        stereoWidth: 28,
        deepDreamOrbit: false,

        glideEnabled: false,
        glideTime: 0.12,

        reverbMix: 0.16,
        reverbDecay: 2.2,

        delayMix: 0.18,
        delayTime: 0.25,
        delayFeedback: 0.24,

        masterVolume: 0.15,
    },
},

forgottenIvory: {
    name: "Forgotten Ivory",
    collection: "Forgotten Realms",
    engine: "synth",

    settings: {
        waveform: "triangle",
        waveformB: "sine",

        oscBLevel: 0.16,
        oscBDetune: 2,

        subWaveform: "sine",
        subLevel: 0,

        waveFusion: 24,
        waveFusionCurve: "smooth",
        dreamMorphMotion: false,

        origin: "wood",
        presence: 14,
        voiceSpread: 4,

        attack: 0.005,
        decay: 0.72,
        sustain: 0.08,
        release: 0.38,

        filterType: "lowpass",
        cutoff: 3900,
        resonance: 1.1,

        lfoRate: 0.2,
        lfoAmount: 0,
        lfoDestination: "filter",

        noiseType: "dust",
        noiseAmount: 0,

        drift: 0,
        stereoWidth: 14,
        deepDreamOrbit: false,

        glideEnabled: false,
        glideTime: 0.12,

        reverbMix: 0.24,
        reverbDecay: 3.2,

        delayMix: 0,
        delayTime: 0.3,
        delayFeedback: 0,

        masterVolume: 0.18,
    },
},

etherealGlass: {
    name: "Ethereal Glass",
    collection: "Celestial Dreams",
    engine: "synth",

    settings: {
        waveform: "sine",
        waveformB: "triangle",

        oscBLevel: 0.52,
        oscBDetune: 7,

        subWaveform: "sine",
        subLevel: 0,

        waveFusion: 64,
        waveFusionCurve: "bright",
        dreamMorphMotion: true,

        origin: "glass",
        presence: 20,
        voiceSpread: 18,

        attack: 0.018,
        decay: 1.1,
        sustain: 0.52,
        release: 2.6,

        filterType: "lowpass",
        cutoff: 7800,
        resonance: 1.8,

        lfoRate: 0.28,
        lfoAmount: 22,
        lfoDestination: "filter",

        noiseType: "air",
        noiseAmount: 0,

        drift: 0.8,
        stereoWidth: 36,
        deepDreamOrbit: false,

        glideEnabled: false,
        glideTime: 0.12,

        reverbMix: 0.32,
        reverbDecay: 3.8,

        delayMix: 0.08,
        delayTime: 0.36,
        delayFeedback: 0.12,

        masterVolume: 0.17,
    },
},

liquidMemory: {
    name: "Liquid Memory",
    collection: "Dream Memories",
    engine: "synth",

    settings: {
        waveform: "sine",
        waveformB: "triangle",

        oscBLevel: 0.32,
        oscBDetune: -5,

        subWaveform: "sine",
        subLevel: 0,

        waveFusion: 42,
        waveFusionCurve: "smooth",
        dreamMorphMotion: true,

        origin: "hollow",
        presence: 12,
        voiceSpread: 8,

        attack: 0.012,
        decay: 0.95,
        sustain: 0.16,
        release: 1.6,

        filterType: "lowpass",
        cutoff: 4200,
        resonance: 1.6,

        lfoRate: 0.45,
        lfoAmount: 24,
        lfoDestination: "filter",

        noiseType: "air",
        noiseAmount: 0,

        drift: 0.6,
        stereoWidth: 42,
        deepDreamOrbit: true,

        glideEnabled: false,
        glideTime: 0.12,

        reverbMix: 0.38,
        reverbDecay: 4.8,

        delayMix: 0.26,
        delayTime: 0.38,
        delayFeedback: 0.34,

        masterVolume: 0.16,
    },
},

musicBoxToyPiano: {
    name: "Music Box Toy Piano",
    collection: "Forgotten Realms",
    engine: "synth",

    settings: {
    mechanicalKeyClick: true,

    waveform: "triangle",
    waveformB: "square",
        
        oscBLevel: 0.12,
        oscBDetune: 4,

        subWaveform: "sine",
        subLevel: 0,

        waveFusion: 18,
        waveFusionCurve: "bright",
        dreamMorphMotion: false,

        origin: "metal",
        presence: 50,
        voiceSpread: 3,

        attack: 0.005,
        decay: 1.00,
        sustain: 0.10,
        release: 2.00,
        
        filterType: "highpass",
        cutoff: 1400,
        resonance: 7.0,

        lfoRate: 0.2,
        lfoAmount: 0,
        lfoDestination: "filter",

        noiseType: "dust",
        noiseAmount: 0,

        drift: 0,
        stereoWidth: 12,
        deepDreamOrbit: false,

        glideEnabled: false,
        glideTime: 0.12,

        reverbMix: 0.30,
        reverbDecay: 3.0,

        delayMix: 0,
        delayTime: 0.3,
        delayFeedback: 0,

        masterVolume: 0.16,
    },
},

// ========================================
// Antique Wooden Toy Piano
// Forgotten Realms — Experimental
// ========================================

antiqueWoodenToyPiano: {
    name: "Antique Wooden Toy Piano",
    collection: "Forgotten Realms",
    engine: "synth",

            settings: {

           mechanicalKeyClick: true,
           mechanicalKeyDownGain: 1.00,
           mechanicalKeyDownFrequency: 650,
           mechanicalKeyReleaseGain: 0.35,
                
        // ========================================
        // Primary Oscillators
        // ========================================

        waveform: "triangle",
        waveformB: "square",

        oscBLevel: 0.10,
        oscBDetune: 2,

        // ========================================
        // Sub Oscillator
        // ========================================

        subWaveform: "sine",
        subLevel: 0,

        // ========================================
        // Wave Fusion
        // ========================================

        waveFusion: 14,
        waveFusionCurve: "smooth",
        dreamMorphMotion: false,

        // ========================================
        // Origin / Presence / Voice Spread
        // ========================================

        origin: "vintage",
        presence: 18,
        voiceSpread: 2,

        // ========================================
        // Amplitude Envelope
        // ========================================

        attack: 0.005,
        decay: 1.15,
        sustain: 0.08,
        release: 1.65,

        // ========================================
        // Filter
        // ========================================

        filterType: "lowpass",
        cutoff: 3300,
        resonance: 0.8,

        // ========================================
        // LFO
        // ========================================

        lfoRate: 0.2,
        lfoAmount: 0,
        lfoDestination: "filter",

        // ========================================
        // Noise / Drift
        // ========================================

        noiseType: "dust",
        noiseAmount: 0,

        drift: 0,

        // ========================================
        // Stereo / Motion
        // ========================================

        stereoWidth: 10,
        deepDreamOrbit: false,

        // ========================================
        // Glide
        // ========================================

        glideEnabled: false,
        glideTime: 0.12,

        // ========================================
        // Reverb
        // ========================================

        reverbMix: 0.14,
        reverbDecay: 1.9,

        // ========================================
        // Delay
        // ========================================

        delayMix: 0,
        delayTime: 0.3,
        delayFeedback: 0,

        // ========================================
        // Master Output
        // ========================================

        masterVolume: 0.16,

    },
},

// ========================================
// Weeping Lullaby
// Forgotten Realms — Ghostly Toy Piano
// ========================================

weepingLullaby: {
    name: "Weeping Lullaby",
    collection: "Forgotten Realms",
    engine: "synth",

    settings: {

        // ========================================
        // Mechanical Toy Piano Character
        // ========================================

        mechanicalKeyClick: true,
        mechanicalKeyDownGain: 0.22,
        mechanicalKeyDownFrequency: 950,

        // ========================================
        // Primary Oscillators
        // ========================================

        waveform: "triangle",
        waveformB: "square",

        oscBLevel: 0.10,
        oscBDetune: 5,

        // ========================================
        // Sub Oscillator
        // ========================================

        subWaveform: "sine",
        subLevel: 0,

        // ========================================
        // Wave Fusion
        // ========================================

        waveFusion: 18,
        waveFusionCurve: "smooth",
        dreamMorphMotion: false,

        // ========================================
        // Origin / Presence / Voice Spread
        // ========================================

        origin: "vintage",
        presence: 12,
        voiceSpread: 65,

        // ========================================
        // Amplitude Envelope
        // ========================================

        attack: 0.005,
        decay: 1.35,
        sustain: 0.08,
        release: 2.40,

        // ========================================
        // Filter
        // ========================================

        filterType: "lowpass",
        cutoff: 3300,
        resonance: 0.8,

        // ========================================
        // LFO
        // ========================================

        lfoRate: 0.2,
        lfoAmount: 0,
        lfoDestination: "filter",

        // ========================================
        // Noise / Drift
        // ========================================

        noiseType: "air",
        noiseAmount: 0,

        drift: 7,

        // ========================================
        // Stereo / Motion
        // ========================================

        stereoWidth: 75,
        deepDreamOrbit: true,

        // ========================================
        // Glide
        // ========================================

        glideEnabled: false,
        glideTime: 0.12,

        // ========================================
        // Reverb
        // ========================================

        reverbMix: 0.35,
        reverbDecay: 4.5,

        // ========================================
        // Delay
        // ========================================

        delayMix: 0,
        delayTime: 0.3,
        delayFeedback: 0,

        // ========================================
        // Master Output
        // ========================================

        masterVolume: 0.16,

    },
},
      
grandPiano: {
    name: "Grand Piano",
    engine: "piano",

    settings: {
        attack: 0.02,
        decay: 1.8,
        sustain: 0.25,
        release: 2.8,

        origin: "pure",
        presence: 10,

        waveFusion: 0,
        waveFusionCurve: "smooth",
        dreamMorphMotion: false,

        noiseType: "air",
        noiseAmount: 0,
        drift: 0,
        stereoWidth: 30,
        deepDreamOrbit: false,

        reverbMix: 0.08,
        reverbDecay: 2.4,

        delayMix: 0,
        delayTime: 0.2,
        delayFeedback: 0,

        masterVolume: 0.8,
        soundboardBloom: 1.0,
    },
},

dreamGrand: {
    name: "Dream Grand",
    engine: "piano",

    settings: {
        attack: 0.035,
        decay: 2.6,
        sustain: 0.32,
        release: 4.2,

        origin: "dream",
        presence: 24,

        waveFusion: 22,
        waveFusionCurve: "smooth",
        dreamMorphMotion: true,

        noiseType: "air",
        noiseAmount: 4,
        drift: 5,
        stereoWidth: 58,
        deepDreamOrbit: true,

        reverbMix: 0.58,
        reverbDecay: 6.2,

        delayMix: 0.1,
        delayTime: 0.48,
        delayFeedback: 0.16,

        masterVolume: 0.8,
        soundboardBloom: 2.5,
    },
},
      
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
    voidSanctuary: {
      name: "Void Sanctuary",
      collection: "Shadow Realms",
      engine: "synth",
      // Tranquil shadow pad: one low note opens a deep, calm space.
      settings: shadowRealmSettings("pads", {
          "origin": "hollow",
          "waveform": "sine",
          "waveformB": "triangle",
          "waveFusion": 20,
          "oscBLevel": 0.39,
          "oscBDetune": 6,
          "subLevel": 22,
          "voiceSpread": 52,
          "attack": 1.8,
          "decay": 1.8,
          "sustain": 0.91,
          "release": 5,
          "cutoff": 1320,
          "resonance": 1.7,
          "lfoRate": 0.1,
          "lfoAmount": 85,
          "noiseType": "dark",
          "noiseAmount": 21,
          "drift": 12,
          "stereoWidth": 72,
          "deepDreamOrbit": true,
          "coherence": 24,
          "fmAmount": 2,
          "fmRatio": 1.5,
          "fmAttack": 1.5,
          "fmDecay": 2.3,
          "fmSustain": 0.24,
          "fmRelease": 4.1,
          "reverbMix": 0.77,
          "reverbDecay": 7.8,
          "delayMix": 0.17,
          "delayTime": 0.8,
          "masterVolume": 0.14,
          "presence": 30
        })
    },
    unstableHorizon: {
      name: "Unstable Horizon",
      collection: "Shadow Realms",
      engine: "synth",
      // A disorienting slowly wandering pad; decoherence and detuning are the focus.
      settings: shadowRealmSettings("pads", {
          "origin": "cosmic",
          "waveform": "sawtooth",
          "waveformB": "trapezoid",
          "waveFusion": 55,
          "dreamMorphMotion": true,
          "oscBLevel": 0.44,
          "oscBDetune": -19,
          "subLevel": 17,
          "voiceSpread": 78,
          "attack": 1.15,
          "decay": 1.4,
          "sustain": 0.83,
          "release": 4.8,
          "cutoff": 2050,
          "resonance": 3.5,
          "lfoRate": 0.2,
          "lfoAmount": 340,
          "noiseType": "cosmic",
          "noiseAmount": 25,
          "drift": 68,
          "stereoWidth": 91,
          "deepDreamOrbit": true,
          "coherence": 5,
          "decoherence": 59,
          "fmAmount": 6,
          "fmRatio": 2.7,
          "fmAttack": 1.3,
          "fmDecay": 2.0,
          "fmSustain": 0.3,
          "fmRelease": 3.2,
          "reverbMix": 0.63,
          "reverbDecay": 6.6,
          "delayMix": 0.32,
          "delayTime": 0.77,
          "masterVolume": 0.12,
          "presence": 47
        })
    },
    blackCathedral: {
      name: "Black Cathedral",
      collection: "Shadow Realms",
      engine: "synth",
      // A weighty resonant cathedral interior; sustained one-note exploration.
      settings: shadowRealmSettings("pads", {
          "origin": "ancient",
          "waveform": "trapezoid",
          "waveformB": "sawtooth",
          "waveFusion": 43,
          "oscBLevel": 0.48,
          "oscBDetune": 8,
          "subLevel": 36,
          "voiceSpread": 65,
          "attack": 1.75,
          "decay": 1.8,
          "sustain": 0.88,
          "release": 5,
          "cutoff": 920,
          "resonance": 4.9,
          "lfoRate": 0.1,
          "lfoAmount": 120,
          "noiseType": "machine",
          "noiseAmount": 14,
          "drift": 24,
          "stereoWidth": 79,
          "coherence": 38,
          "fmAmount": 5,
          "fmRatio": 1.8,
          "fmAttack": 1.1,
          "fmDecay": 2.8,
          "fmSustain": 0.4,
          "fmRelease": 3.5,
          "reverbMix": 0.79,
          "reverbDecay": 8,
          "delayMix": 0.25,
          "delayTime": 0.95,
          "masterVolume": 0.12,
          "presence": 37
        })
    },
    distantLantern: {
      name: "Distant Lantern",
      collection: "Shadow Realms",
      engine: "synth",
      // Airy tranquil distant pad with a small glimmer of FM harmonics.
      settings: shadowRealmSettings("pads", {
          "origin": "dream",
          "waveform": "sine",
          "waveformB": "triangle",
          "waveFusion": 64,
          "dreamMorphMotion": true,
          "oscBLevel": 0.33,
          "oscBDetune": 4,
          "subLevel": 8,
          "voiceSpread": 52,
          "attack": 1.5,
          "decay": 1.8,
          "sustain": 0.8,
          "release": 4.6,
          "cutoff": 4200,
          "resonance": 1.8,
          "lfoRate": 0.2,
          "lfoAmount": 110,
          "noiseType": "air",
          "noiseAmount": 28,
          "drift": 9,
          "stereoWidth": 89,
          "coherence": 28,
          "fmAmount": 4,
          "fmRatio": 3.0,
          "fmAttack": 1.4,
          "fmDecay": 2.5,
          "fmSustain": 0.21,
          "fmRelease": 2.4,
          "reverbMix": 0.82,
          "reverbDecay": 7.2,
          "delayMix": 0.18,
          "delayTime": 0.7,
          "masterVolume": 0.15,
          "presence": 33
        })
    },
    eclipseBloom: {
      name: "Eclipse Bloom",
      collection: "Shadow Realms",
      engine: "synth",
      // An enveloping bass-rich pad whose color emerges over the held note.
      settings: shadowRealmSettings("pads", {
          "origin": "hollow",
          "waveform": "triangle",
          "waveformB": "square",
          "waveFusion": 37,
          "dreamMorphMotion": true,
          "oscBLevel": 0.41,
          "oscBDetune": -11,
          "subLevel": 42,
          "voiceSpread": 43,
          "beatTrackingMode": "fixed",
          "beatRate": 0.25,
          "attack": 1.3,
          "decay": 1.9,
          "sustain": 0.89,
          "release": 4.7,
          "cutoff": 1450,
          "resonance": 4.1,
          "lfoRate": 0.1,
          "lfoAmount": 260,
          "noiseType": "dark",
          "noiseAmount": 21,
          "drift": 28,
          "stereoWidth": 76,
          "deepDreamOrbit": true,
          "coherence": 16,
          "fmAmount": 9,
          "fmRatio": 2.2,
          "fmAttack": 1.7,
          "fmDecay": 2.6,
          "fmSustain": 0.44,
          "fmRelease": 3.4,
          "reverbMix": 0.7,
          "reverbDecay": 6.7,
          "delayMix": 0.28,
          "delayTime": 0.65,
          "masterVolume": 0.14,
          "presence": 45
        })
    },
    fracturedSleep: {
      name: "Fractured Sleep",
      collection: "Shadow Realms",
      engine: "synth",
      // Intentionally unstable tonal pad, slowly dissolving into dissonance.
      settings: shadowRealmSettings("pads", {
          "origin": "glass",
          "waveform": "sawtooth",
          "waveformB": "square",
          "waveFusion": 61,
          "dreamMorphMotion": true,
          "oscBLevel": 0.52,
          "oscBDetune": 23,
          "subLevel": 9,
          "voiceSpread": 84,
          "beatTrackingMode": "fixed",
          "beatRate": 0.8,
          "attack": 0.95,
          "decay": 1.45,
          "sustain": 0.72,
          "release": 4.1,
          "cutoff": 2640,
          "resonance": 5.3,
          "lfoRate": 0.4,
          "lfoAmount": 380,
          "noiseType": "dust",
          "noiseAmount": 33,
          "drift": 75,
          "stereoWidth": 90,
          "coherence": 12,
          "decoherence": 66,
          "fmAmount": 15,
          "fmRatio": 4.8,
          "fmAttack": 0.75,
          "fmDecay": 2.4,
          "fmSustain": 0.36,
          "fmRelease": 2.8,
          "reverbMix": 0.57,
          "reverbDecay": 6.1,
          "delayMix": 0.35,
          "delayTime": 0.67,
          "masterVolume": 0.1,
          "presence": 52
        })
    },
    starlessSea: {
      name: "Starless Sea",
      collection: "Shadow Realms",
      engine: "synth",
      // A vast slowly moving low-harmonic pad with dim celestial noise.
      settings: shadowRealmSettings("pads", {
          "origin": "cosmic",
          "waveform": "triangle",
          "waveformB": "sine",
          "waveFusion": 46,
          "oscBLevel": 0.25,
          "oscBDetune": -6,
          "subLevel": 33,
          "voiceSpread": 49,
          "attack": 2,
          "decay": 2,
          "sustain": 0.92,
          "release": 5,
          "cutoff": 1150,
          "resonance": 2.0,
          "lfoRate": 0.1,
          "lfoAmount": 125,
          "noiseType": "cosmic",
          "noiseAmount": 35,
          "drift": 22,
          "stereoWidth": 93,
          "deepDreamOrbit": true,
          "coherence": 36,
          "fmAmount": 2,
          "fmRatio": 0.8,
          "fmAttack": 2.2,
          "fmDecay": 2.7,
          "fmSustain": 0.2,
          "fmRelease": 4.5,
          "reverbMix": 0.82,
          "reverbDecay": 8,
          "delayMix": 0.28,
          "delayTime": 1.15,
          "masterVolume": 0.12,
          "presence": 35
        })
    },
    glassRemnants: {
      name: "Glass Remnants",
      collection: "Shadow Realms",
      engine: "synth",
      // Haunting shimmering pad, metallic but delicate, not a real choir sample.
      settings: shadowRealmSettings("pads", {
          "origin": "glass",
          "waveform": "sine",
          "waveformB": "trapezoid",
          "waveFusion": 63,
          "dreamMorphMotion": true,
          "oscBLevel": 0.47,
          "oscBDetune": 12,
          "subLevel": 6,
          "voiceSpread": 68,
          "attack": 1.0,
          "decay": 1.3,
          "sustain": 0.76,
          "release": 4.9,
          "filterType": "bandpass",
          "cutoff": 2280,
          "resonance": 2.8,
          "lfoRate": 0.2,
          "lfoAmount": 185,
          "noiseType": "dust",
          "noiseAmount": 22,
          "drift": 31,
          "stereoWidth": 94,
          "deepDreamOrbit": true,
          "coherence": 21,
          "decoherence": 20,
          "fmAmount": 12,
          "fmRatio": 6.2,
          "fmAttack": 1.0,
          "fmDecay": 1.7,
          "fmSustain": 0.18,
          "fmRelease": 3.7,
          "reverbMix": 0.76,
          "reverbDecay": 7.2,
          "delayMix": 0.31,
          "delayTime": 0.75,
          "masterVolume": 0.12,
          "presence": 49
        })
    },
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

    
  leads: {
    nightCaller: {
      name: "Night Caller",
      collection: "Shadow Realms",
      engine: "synth",
      // A hollow one-note beckoning drone; hold C1–G2 and let fixed oscillator movement unfold.
      settings: shadowRealmSettings("leads", {
          "origin": "hollow",
          "waveform": "trapezoid",
          "waveformB": "triangle",
          "waveFusion": 34,
          "oscBDetune": 11,
          "subLevel": 26,
          "beatTrackingMode": "fixed",
          "beatRate": 0.35,
          "attack": 0.34,
          "decay": 1.15,
          "sustain": 0.91,
          "release": 4.4,
          "cutoff": 1360,
          "resonance": 5.2,
          "lfoRate": 0.2,
          "lfoAmount": 120,
          "noiseType": "dark",
          "noiseAmount": 13,
          "drift": 23,
          "deepDreamOrbit": true,
          "coherence": 28,
          "fmAmount": 5,
          "fmRatio": 2.5,
          "fmAttack": 0.5,
          "fmDecay": 1.7,
          "fmSustain": 0.28,
          "fmRelease": 2.5,
          "reverbMix": 0.66,
          "reverbDecay": 6.4,
          "delayMix": 0.24,
          "delayTime": 0.58,
          "masterVolume": 0.16,
          "presence": 37
        })
    },
    veilSiren: {
      name: "Veil Siren",
      collection: "Shadow Realms",
      engine: "synth",
      // A glassy spectral melody with long singing tails; try octave 0 and -1.
      settings: shadowRealmSettings("leads", {
          "origin": "glass",
          "waveform": "sine",
          "waveformB": "sawtooth",
          "waveFusion": 58,
          "dreamMorphMotion": true,
          "oscBDetune": -9,
          "voiceSpread": 49,
          "subLevel": 4,
          "attack": 0.18,
          "decay": 0.85,
          "sustain": 0.82,
          "release": 3.0,
          "filterType": "bandpass",
          "cutoff": 2400,
          "resonance": 3.4,
          "lfoRate": 0.3,
          "lfoAmount": 170,
          "noiseType": "air",
          "noiseAmount": 16,
          "drift": 18,
          "stereoWidth": 79,
          "deepDreamOrbit": true,
          "fmAmount": 11,
          "fmRatio": 3.4,
          "fmAttack": 0.16,
          "fmDecay": 0.9,
          "fmSustain": 0.33,
          "fmRelease": 1.9,
          "reverbMix": 0.61,
          "reverbDecay": 5.8,
          "delayMix": 0.32,
          "delayTime": 0.45,
          "masterVolume": 0.15,
          "presence": 62
        })
    },
    phantomSignal: {
      name: "Phantom Signal",
      collection: "Shadow Realms",
      engine: "synth",
      // A pulsing electronic lead; beat tracking synced to 130 BPM.
      settings: shadowRealmSettings("leads", {
          "origin": "cosmic",
          "waveform": "square",
          "waveformB": "sawtooth",
          "waveFusion": 48,
          "oscBDetune": 17,
          "voiceSpread": 21,
          "beatTrackingMode": "tempo",
          "beatTempo": 130,
          "beatDivision": 0.5,
          "attack": 0.02,
          "decay": 0.3,
          "sustain": 0.57,
          "release": 0.66,
          "cutoff": 2900,
          "resonance": 5.1,
          "lfoRate": 2.2,
          "lfoAmount": 340,
          "noiseType": "machine",
          "noiseAmount": 9,
          "coherence": 35,
          "fmAmount": 15,
          "fmRatio": 4.0,
          "fmAttack": 0.01,
          "fmDecay": 0.24,
          "fmSustain": 0.18,
          "fmRelease": 0.45,
          "reverbMix": 0.27,
          "delayMix": 0.36,
          "delayTime": 0.23,
          "delayFeedback": 0.4,
          "masterVolume": 0.17,
          "presence": 55
        })
    },
    ritualNeedle: {
      name: "Ritual Needle",
      collection: "Shadow Realms",
      engine: "synth",
      // Sharper, percussive FM-based lead for eerie short motifs.
      settings: shadowRealmSettings("leads", {
          "origin": "glass",
          "waveform": "trapezoid",
          "waveformB": "square",
          "waveFusion": 24,
          "oscBLevel": 0.24,
          "oscBDetune": -4,
          "subLevel": 0,
          "attack": 0.01,
          "decay": 0.22,
          "sustain": 0.43,
          "release": 0.48,
          "cutoff": 5400,
          "resonance": 2.3,
          "lfoRate": 0.8,
          "lfoAmount": 16,
          "noiseType": "dust",
          "noiseAmount": 8,
          "fmAmount": 22,
          "fmRatio": 6.4,
          "fmAttack": 0.01,
          "fmDecay": 0.24,
          "fmSustain": 0.07,
          "fmRelease": 0.17,
          "reverbMix": 0.28,
          "reverbDecay": 3.7,
          "delayMix": 0.22,
          "delayTime": 0.32,
          "masterVolume": 0.13,
          "presence": 48
        })
    },
    mirrorWraith: {
      name: "Mirror Wraith",
      collection: "Shadow Realms",
      engine: "synth",
      // An airy hollow glide, part melody and part spectral wind.
      settings: shadowRealmSettings("leads", {
          "origin": "hollow",
          "waveform": "sine",
          "waveformB": "trapezoid",
          "waveFusion": 65,
          "dreamMorphMotion": true,
          "oscBDetune": 9,
          "voiceSpread": 45,
          "subLevel": 7,
          "glideEnabled": true,
          "glideTime": 0.19,
          "attack": 0.33,
          "decay": 0.9,
          "sustain": 0.73,
          "release": 2.6,
          "filterType": "highpass",
          "cutoff": 470,
          "resonance": 3.1,
          "lfoRate": 0.3,
          "lfoAmount": 125,
          "noiseType": "air",
          "noiseAmount": 26,
          "drift": 34,
          "stereoWidth": 87,
          "deepDreamOrbit": true,
          "decoherence": 27,
          "fmAmount": 8,
          "fmRatio": 1.5,
          "fmAttack": 0.32,
          "fmDecay": 1.4,
          "fmSustain": 0.2,
          "fmRelease": 1.8,
          "reverbMix": 0.72,
          "reverbDecay": 6.8,
          "delayMix": 0.29,
          "delayTime": 0.64,
          "masterVolume": 0.15,
          "presence": 52
        })
    },
    hollowBroadcast: {
      name: "Hollow Broadcast",
      collection: "Shadow Realms",
      engine: "synth",
      // Detuned radio-phantom lead, with machine grit and narrow resonance.
      settings: shadowRealmSettings("leads", {
          "origin": "ancient",
          "waveform": "sawtooth",
          "waveformB": "square",
          "waveFusion": 73,
          "oscBLevel": 0.37,
          "oscBDetune": -22,
          "voiceSpread": 14,
          "subLevel": 0,
          "beatTrackingMode": "fixed",
          "beatRate": 1.3,
          "attack": 0.04,
          "decay": 0.55,
          "sustain": 0.61,
          "release": 1.7,
          "filterType": "bandpass",
          "cutoff": 1280,
          "resonance": 7.2,
          "lfoRate": 1.3,
          "lfoAmount": 260,
          "noiseType": "machine",
          "noiseAmount": 22,
          "drift": 28,
          "stereoWidth": 39,
          "decoherence": 35,
          "fmAmount": 14,
          "fmRatio": 5.1,
          "fmAttack": 0.04,
          "fmDecay": 0.8,
          "fmSustain": 0.32,
          "fmRelease": 0.65,
          "reverbMix": 0.42,
          "delayMix": 0.37,
          "delayTime": 0.28,
          "masterVolume": 0.14,
          "presence": 56
        })
    },
    witchlightArpeggio: {
      name: "Witchlight Arpeggio",
      collection: "Shadow Realms",
      engine: "synth",
      // Crystal-tipped plucks for rhythmic motifs, arpeggios controlled manually.
      settings: shadowRealmSettings("leads", {
          "origin": "dream",
          "waveform": "triangle",
          "waveformB": "sine",
          "waveFusion": 22,
          "oscBDetune": 3,
          "voiceSpread": 10,
          "subLevel": 0,
          "attack": 0.01,
          "decay": 0.37,
          "sustain": 0.1,
          "release": 0.76,
          "cutoff": 4200,
          "resonance": 2.6,
          "lfoRate": 0.6,
          "lfoAmount": 60,
          "noiseType": "dust",
          "noiseAmount": 17,
          "drift": 4,
          "stereoWidth": 54,
          "coherence": 16,
          "fmAmount": 17,
          "fmRatio": 7.0,
          "fmAttack": 0.01,
          "fmDecay": 0.23,
          "fmSustain": 0.03,
          "fmRelease": 0.32,
          "reverbMix": 0.49,
          "reverbDecay": 5.1,
          "delayMix": 0.33,
          "delayTime": 0.38,
          "masterVolume": 0.15,
          "presence": 45
        })
    },
    obsidianThread: {
      name: "Obsidian Thread",
      collection: "Shadow Realms",
      engine: "synth",
      // Controlled dark melodic lead with subtle unstable movement.
      settings: shadowRealmSettings("leads", {
          "origin": "vintage",
          "waveform": "trapezoid",
          "waveformB": "triangle",
          "waveFusion": 39,
          "oscBDetune": 7,
          "voiceSpread": 31,
          "subLevel": 30,
          "beatTrackingMode": "fixed",
          "beatRate": 0.55,
          "glideEnabled": true,
          "glideTime": 0.12,
          "attack": 0.11,
          "decay": 0.75,
          "sustain": 0.82,
          "release": 2.2,
          "cutoff": 1750,
          "resonance": 3.6,
          "lfoRate": 0.2,
          "lfoAmount": 90,
          "noiseType": "dark",
          "noiseAmount": 8,
          "drift": 17,
          "stereoWidth": 48,
          "deepDreamOrbit": true,
          "coherence": 19,
          "decoherence": 8,
          "fmAmount": 4,
          "fmRatio": 2.0,
          "fmAttack": 0.22,
          "fmDecay": 1.4,
          "fmSustain": 0.25,
          "fmRelease": 1.0,
          "reverbMix": 0.41,
          "delayMix": 0.2,
          "delayTime": 0.47,
          "masterVolume": 0.18,
          "presence": 39
        })
    },
    blackVeilReference: {
      name: "Black Veil — Reference",
      collection: "Shadow Encounters",
      engine: "synth",
      // Values reconstructed from the screenshots. Master gain reduced from
      // screenshot's 97% to 55% for safer audition and less limiter pumping.
      settings: {
    waveform: "trapezoid", waveformB: "sawtooth",
    origin: "glass", waveFusion: 41, waveFusionCurve: "smooth",
    dreamMorphMotion: true, subWaveform: "sine", subLevel: 43,
    oscBLevel: 0.32, oscBDetune: 6, voiceSpread: 49,
    beatTrackingMode: "natural", beatRate: 0.5, beatTempo: 120, beatDivision: 1,
    noiseType: "air", noiseAmount: 0, drift: 37, stereoWidth: 67,
    deepDreamOrbit: true, coherence: 0, decoherence: 0,
    fmAmount: 3, fmRatio: 3.2, fmAttack: 0.43,
    fmDecay: 0.65, fmSustain: 0.33, fmRelease: 3.39,
    attack: 0.20, decay: 1.76, sustain: 0.86, release: 4.45,
    filterType: "lowpass", cutoff: 5073, resonance: 5.2,
    lfoRate: 0.2, lfoAmount: 130, lfoDestination: "filter",
    reverbMix: 0.48, reverbDecay: 3.6,
    delayMix: 0.30, delayTime: 0.20, delayFeedback: 0.18,
    masterVolume: 0.55, presence: 94,
    glideEnabled: false, glideTime: 0.12
      }
    },
    blackVeilFocused: {
      name: "Black Veil — Focused",
      collection: "Shadow Encounters",
      engine: "synth",
      // A conservative alternate patch: deeper humming center, less midrange
      // edge and less diffuse masking. This requires auditioning by ear.
      settings: {
    waveform: "trapezoid", waveformB: "sawtooth",
    origin: "glass", waveFusion: 41, waveFusionCurve: "smooth",
    dreamMorphMotion: true, subWaveform: "sine", subLevel: 43,
    oscBLevel: 0.32, oscBDetune: 6, voiceSpread: 49,
    beatTrackingMode: "natural", beatRate: 0.5, beatTempo: 120, beatDivision: 1,
    noiseType: "air", noiseAmount: 0, drift: 37, stereoWidth: 67,
    deepDreamOrbit: true, coherence: 0, decoherence: 0,
    fmAmount: 3, fmRatio: 3.2, fmAttack: 0.43,
    fmDecay: 0.65, fmSustain: 0.33, fmRelease: 3.39,
    attack: 0.20, decay: 1.76, sustain: 0.86, release: 4.45,
    filterType: "lowpass", cutoff: 5073, resonance: 5.2,
    lfoRate: 0.2, lfoAmount: 130, lfoDestination: "filter",
    reverbMix: 0.48, reverbDecay: 3.6,
    delayMix: 0.30, delayTime: 0.20, delayFeedback: 0.18,
    masterVolume: 0.55, presence: 94,
    glideEnabled: false, glideTime: 0.12,
        subLevel: 48, voiceSpread: 44, drift: 29,
        cutoff: 3400, resonance: 3.6, lfoAmount: 100,
        reverbMix: 0.43, delayMix: 0.24,
        stereoWidth: 62, presence: 90
      }
    }
  },
bass: {
    witchHouseSub: {
      name: "Witch House Sub",
      collection: "Shadow Realms",
      engine: "synth",
      // Dark rounded sub with an audible upper voice; start at octave -1.
      settings: shadowRealmSettings("bass", {
          "origin": "vintage",
          "waveform": "triangle",
          "waveformB": "square",
          "waveFusion": 15,
          "oscBLevel": 0.17,
          "oscBDetune": 2,
          "subLevel": 67,
          "voiceSpread": 3,
          "attack": 0.02,
          "decay": 0.32,
          "sustain": 0.81,
          "release": 0.68,
          "cutoff": 660,
          "resonance": 1.6,
          "noiseType": "dark",
          "noiseAmount": 0,
          "drift": 4,
          "stereoWidth": 9,
          "fmAmount": 0,
          "reverbMix": 0.09,
          "delayMix": 0,
          "masterVolume": 0.2,
          "presence": 15
        })
    },
    pressureSwell172: {
      name: "Pressure Swell 172",
      collection: "Shadow Realms",
      engine: "synth",
      // DnB-style swelling bass; 172-BPM beat target and moving filter.
      settings: shadowRealmSettings("bass", {
          "origin": "cosmic",
          "waveform": "sawtooth",
          "waveformB": "trapezoid",
          "waveFusion": 39,
          "oscBLevel": 0.32,
          "oscBDetune": 9,
          "subLevel": 41,
          "voiceSpread": 15,
          "beatTrackingMode": "tempo",
          "beatTempo": 172,
          "beatDivision": 1,
          "attack": 0.42,
          "decay": 0.72,
          "sustain": 0.75,
          "release": 1.5,
          "cutoff": 1480,
          "resonance": 4.5,
          "lfoRate": 2.9,
          "lfoAmount": 900,
          "noiseType": "dark",
          "noiseAmount": 7,
          "drift": 14,
          "stereoWidth": 33,
          "deepDreamOrbit": false,
          "coherence": 12,
          "fmAmount": 9,
          "fmRatio": 2.0,
          "fmAttack": 0.33,
          "fmDecay": 0.72,
          "fmSustain": 0.37,
          "fmRelease": 0.75,
          "reverbMix": 0.18,
          "delayMix": 0.06,
          "masterVolume": 0.16,
          "presence": 43
        })
    },
    graveWobble: {
      name: "Grave Wobble",
      collection: "Shadow Realms",
      engine: "synth",
      // Wobbling bass via filter LFO; rate is free-running, not transport-synced.
      settings: shadowRealmSettings("bass", {
          "origin": "hollow",
          "waveform": "square",
          "waveformB": "sawtooth",
          "waveFusion": 56,
          "oscBLevel": 0.34,
          "oscBDetune": -5,
          "subLevel": 43,
          "voiceSpread": 7,
          "beatTrackingMode": "fixed",
          "beatRate": 0.7,
          "attack": 0.02,
          "decay": 0.55,
          "sustain": 0.77,
          "release": 0.72,
          "cutoff": 1180,
          "resonance": 5.6,
          "lfoRate": 2.4,
          "lfoAmount": 850,
          "noiseType": "machine",
          "noiseAmount": 4,
          "stereoWidth": 15,
          "fmAmount": 6,
          "fmRatio": 1.5,
          "fmAttack": 0.01,
          "fmDecay": 0.65,
          "fmSustain": 0.28,
          "fmRelease": 0.52,
          "reverbMix": 0.14,
          "delayMix": 0.08,
          "masterVolume": 0.16,
          "presence": 37
        })
    },
    ironFistBass: {
      name: "Iron Fist Bass",
      collection: "Shadow Realms",
      engine: "synth",
      // Short, punchy bass with a bright FM attack and dry weight.
      settings: shadowRealmSettings("bass", {
          "origin": "pure",
          "waveform": "sawtooth",
          "waveformB": "triangle",
          "waveFusion": 11,
          "oscBLevel": 0.18,
          "oscBDetune": 0,
          "subLevel": 60,
          "voiceSpread": 0,
          "attack": 0.01,
          "decay": 0.18,
          "sustain": 0.39,
          "release": 0.21,
          "cutoff": 2100,
          "resonance": 2.1,
          "lfoAmount": 0,
          "noiseAmount": 0,
          "stereoWidth": 0,
          "fmAmount": 14,
          "fmRatio": 3,
          "fmAttack": 0.01,
          "fmDecay": 0.12,
          "fmSustain": 0,
          "fmRelease": 0.12,
          "reverbMix": 0.04,
          "delayMix": 0,
          "masterVolume": 0.18,
          "presence": 39
        })
    },
    corruptedCircuit: {
      name: "Corrupted Circuit",
      collection: "Shadow Realms",
      engine: "synth",
      // Harsh digital FM grit without a distortion effect; use careful volume.
      settings: shadowRealmSettings("bass", {
          "origin": "glass",
          "waveform": "square",
          "waveformB": "sawtooth",
          "waveFusion": 62,
          "oscBLevel": 0.38,
          "oscBDetune": 4,
          "subWaveform": "square",
          "subLevel": 29,
          "voiceSpread": 11,
          "attack": 0.01,
          "decay": 0.36,
          "sustain": 0.7,
          "release": 0.48,
          "cutoff": 3250,
          "resonance": 3.0,
          "lfoRate": 4.2,
          "lfoAmount": 250,
          "noiseType": "machine",
          "noiseAmount": 13,
          "stereoWidth": 16,
          "decoherence": 12,
          "fmAmount": 29,
          "fmRatio": 5.8,
          "fmAttack": 0.01,
          "fmDecay": 0.48,
          "fmSustain": 0.43,
          "fmRelease": 0.29,
          "reverbMix": 0.12,
          "delayMix": 0.07,
          "masterVolume": 0.11,
          "presence": 47
        })
    },
    velvetUndertow: {
      name: "Velvet Undertow",
      collection: "Shadow Realms",
      engine: "synth",
      // Warm rounded electronic bass with subtle drifting unison.
      settings: shadowRealmSettings("bass", {
          "origin": "vintage",
          "waveform": "triangle",
          "waveformB": "sine",
          "waveFusion": 23,
          "oscBLevel": 0.3,
          "oscBDetune": 5,
          "subLevel": 57,
          "voiceSpread": 6,
          "attack": 0.04,
          "decay": 0.51,
          "sustain": 0.73,
          "release": 0.93,
          "cutoff": 1260,
          "resonance": 1.2,
          "lfoRate": 0.4,
          "lfoAmount": 45,
          "noiseType": "air",
          "noiseAmount": 3,
          "drift": 11,
          "stereoWidth": 20,
          "deepDreamOrbit": false,
          "fmAmount": 2,
          "fmRatio": 1.0,
          "fmAttack": 0.08,
          "fmDecay": 0.5,
          "fmSustain": 0.1,
          "reverbMix": 0.16,
          "delayMix": 0,
          "masterVolume": 0.19,
          "presence": 18
        })
    },
    dreamDataBass: {
      name: "Dream Data Bass",
      collection: "Shadow Realms",
      engine: "synth",
      // Digital dreamy bass with a glass attack and atmospheric tail.
      settings: shadowRealmSettings("bass", {
          "origin": "glass",
          "waveform": "sine",
          "waveformB": "trapezoid",
          "waveFusion": 50,
          "dreamMorphMotion": true,
          "oscBLevel": 0.27,
          "oscBDetune": 8,
          "subLevel": 39,
          "voiceSpread": 20,
          "attack": 0.06,
          "decay": 0.65,
          "sustain": 0.52,
          "release": 2.2,
          "cutoff": 2700,
          "resonance": 2.8,
          "lfoRate": 0.3,
          "lfoAmount": 120,
          "noiseType": "cosmic",
          "noiseAmount": 8,
          "drift": 12,
          "stereoWidth": 58,
          "coherence": 27,
          "fmAmount": 13,
          "fmRatio": 4.4,
          "fmAttack": 0.02,
          "fmDecay": 0.82,
          "fmSustain": 0.08,
          "fmRelease": 1.2,
          "reverbMix": 0.39,
          "reverbDecay": 5.6,
          "delayMix": 0.22,
          "delayTime": 0.46,
          "masterVolume": 0.15,
          "presence": 39
        })
    },
    nightstepRoller: {
      name: "Nightstep Roller",
      collection: "Shadow Realms",
      engine: "synth",
      // Fast rolling DnB bass with a chattering filter and compact release.
      settings: shadowRealmSettings("bass", {
          "origin": "ancient",
          "waveform": "sawtooth",
          "waveformB": "square",
          "waveFusion": 46,
          "oscBLevel": 0.36,
          "oscBDetune": -8,
          "subLevel": 46,
          "voiceSpread": 10,
          "beatTrackingMode": "tempo",
          "beatTempo": 174,
          "beatDivision": 0.5,
          "attack": 0.01,
          "decay": 0.4,
          "sustain": 0.68,
          "release": 0.37,
          "cutoff": 1520,
          "resonance": 4.8,
          "lfoRate": 5.8,
          "lfoAmount": 640,
          "noiseType": "dark",
          "noiseAmount": 6,
          "stereoWidth": 13,
          "coherence": 22,
          "fmAmount": 12,
          "fmRatio": 2.5,
          "fmAttack": 0.01,
          "fmDecay": 0.33,
          "fmSustain": 0.23,
          "fmRelease": 0.28,
          "reverbMix": 0.1,
          "delayMix": 0.04,
          "masterVolume": 0.15,
          "presence": 46
        })
    },
  },

choir: {
    dreamChoir: {
        name: "Dream Choir",
        engine: "choir",

        settings: {
            attack: 0.45,
            decay: 1.4,
            sustain: 0.82,
            release: 2.2,

            origin: "pure",
            presence: 12,

            waveFusion: 0,
            waveFusionCurve: "smooth",
            dreamMorphMotion: false,

            noiseType: "air",
            noiseAmount: 0,
            drift: 2,
            stereoWidth: 45,
            deepDreamOrbit: false,

            reverbMix: 0.55,
            reverbDecay: 7.0,

            delayMix: 0.10,
            delayTime: 0.42,
            delayFeedback: 0.18,

            masterVolume: 0.80,
        },
    },
},

textures: {
    steelDrag: {
      name: "Steel Drag",
      collection: "Shadow Realms",
      engine: "synth",
      // Stylized metal scrape: hold then release a mid-high note; not recorded foley.
      settings: shadowRealmSettings("textures", {
          "origin": "glass",
          "waveform": "sawtooth",
          "waveformB": "square",
          "waveFusion": 69,
          "oscBLevel": 0.3,
          "oscBDetune": 18,
          "voiceSpread": 21,
          "attack": 0.55,
          "decay": 0.9,
          "sustain": 0.45,
          "release": 1.4,
          "filterType": "highpass",
          "cutoff": 1400,
          "resonance": 6.3,
          "lfoRate": 5.5,
          "lfoAmount": 740,
          "noiseType": "machine",
          "noiseAmount": 81,
          "drift": 21,
          "stereoWidth": 59,
          "decoherence": 44,
          "fmAmount": 24,
          "fmRatio": 7.2,
          "fmAttack": 0.45,
          "fmDecay": 1.3,
          "fmSustain": 0.46,
          "fmRelease": 0.9,
          "reverbMix": 0.44,
          "delayMix": 0.19,
          "masterVolume": 0.1,
          "presence": 41
        })
    },
    ironKnock: {
      name: "Iron Knock",
      collection: "Shadow Realms",
      engine: "synth",
      // Single synthetic metallic impact; a short key press triggers a reverb tail.
      settings: shadowRealmSettings("textures", {
          "origin": "ancient",
          "waveform": "square",
          "waveformB": "trapezoid",
          "waveFusion": 64,
          "oscBLevel": 0.38,
          "oscBDetune": 0,
          "attack": 0.01,
          "decay": 0.2,
          "sustain": 0,
          "release": 0.22,
          "filterType": "bandpass",
          "cutoff": 1880,
          "resonance": 6.8,
          "lfoRate": 2,
          "lfoAmount": 0,
          "noiseType": "machine",
          "noiseAmount": 81,
          "drift": 5,
          "stereoWidth": 24,
          "deepDreamOrbit": false,
          "fmAmount": 35,
          "fmRatio": 8.0,
          "fmAttack": 0.01,
          "fmDecay": 0.16,
          "fmSustain": 0,
          "fmRelease": 0.16,
          "reverbMix": 0.67,
          "reverbDecay": 5.9,
          "delayMix": 0.26,
          "delayTime": 0.39,
          "delayFeedback": 0.33,
          "masterVolume": 0.1,
          "presence": 43
        })
    },
    hollowFootfall: {
      name: "Hollow Footfall",
      collection: "Shadow Realms",
      engine: "synth",
      // One stylized footstep-like thud with corridor echoes per key press.
      settings: shadowRealmSettings("textures", {
          "origin": "hollow",
          "waveform": "triangle",
          "waveformB": "sine",
          "waveFusion": 16,
          "oscBLevel": 0.1,
          "subLevel": 17,
          "voiceSpread": 0,
          "attack": 0.01,
          "decay": 0.19,
          "sustain": 0,
          "release": 0.22,
          "filterType": "lowpass",
          "cutoff": 620,
          "resonance": 2.5,
          "lfoRate": 0.5,
          "lfoAmount": 0,
          "noiseType": "air",
          "noiseAmount": 70,
          "drift": 1,
          "stereoWidth": 36,
          "deepDreamOrbit": false,
          "fmAmount": 4,
          "fmRatio": 2.2,
          "fmAttack": 0.01,
          "fmDecay": 0.1,
          "fmSustain": 0,
          "fmRelease": 0.14,
          "reverbMix": 0.62,
          "reverbDecay": 5.6,
          "delayMix": 0.48,
          "delayTime": 0.41,
          "delayFeedback": 0.48,
          "masterVolume": 0.16,
          "presence": 18
        })
    },
    wallScratches: {
      name: "Wall Scratches",
      collection: "Shadow Realms",
      engine: "synth",
      // Rapid jagged scraping illusion; mid-high notes expose the texture.
      settings: shadowRealmSettings("textures", {
          "origin": "hollow",
          "waveform": "trapezoid",
          "waveformB": "sawtooth",
          "waveFusion": 52,
          "oscBLevel": 0.34,
          "oscBDetune": -9,
          "voiceSpread": 15,
          "attack": 0.09,
          "decay": 0.75,
          "sustain": 0.35,
          "release": 0.67,
          "filterType": "highpass",
          "cutoff": 970,
          "resonance": 7.8,
          "lfoRate": 6.3,
          "lfoAmount": 1450,
          "noiseType": "white",
          "noiseAmount": 91,
          "drift": 32,
          "stereoWidth": 49,
          "deepDreamOrbit": false,
          "decoherence": 32,
          "fmAmount": 18,
          "fmRatio": 9.2,
          "fmAttack": 0.08,
          "fmDecay": 0.7,
          "fmSustain": 0.38,
          "fmRelease": 0.55,
          "reverbMix": 0.29,
          "reverbDecay": 3.6,
          "delayMix": 0.16,
          "masterVolume": 0.1,
          "presence": 48
        })
    },
    abandonedVent: {
      name: "Abandoned Vent",
      collection: "Shadow Realms",
      engine: "synth",
      // Moving wind/air-bed illusion; hold one note and sweep the cutoff.
      settings: shadowRealmSettings("textures", {
          "origin": "dream",
          "waveform": "sine",
          "waveformB": "triangle",
          "waveFusion": 52,
          "oscBLevel": 0.1,
          "subLevel": 0,
          "voiceSpread": 10,
          "attack": 1.5,
          "decay": 1.4,
          "sustain": 0.85,
          "release": 4.5,
          "filterType": "highpass",
          "cutoff": 760,
          "resonance": 1.2,
          "lfoRate": 0.2,
          "lfoAmount": 440,
          "noiseType": "air",
          "noiseAmount": 100,
          "drift": 28,
          "stereoWidth": 87,
          "deepDreamOrbit": true,
          "decoherence": 23,
          "fmAmount": 1,
          "fmRatio": 1.5,
          "fmAttack": 1.3,
          "fmDecay": 2.2,
          "fmSustain": 0.16,
          "fmRelease": 2.4,
          "reverbMix": 0.75,
          "reverbDecay": 7.1,
          "delayMix": 0.23,
          "delayTime": 0.88,
          "masterVolume": 0.16,
          "presence": 23
        })
    },
    deadChannel: {
      name: "Dead Channel",
      collection: "Shadow Realms",
      engine: "synth",
      // TV-like static/fuzz bed; highpass white noise, with a pitched electronic undertone.
      settings: shadowRealmSettings("textures", {
          "origin": "glass",
          "waveform": "square",
          "waveformB": "triangle",
          "waveFusion": 46,
          "oscBLevel": 0.13,
          "subLevel": 0,
          "voiceSpread": 8,
          "attack": 0.1,
          "decay": 0.75,
          "sustain": 0.8,
          "release": 1.9,
          "filterType": "highpass",
          "cutoff": 3200,
          "resonance": 2.4,
          "lfoRate": 3.5,
          "lfoAmount": 520,
          "noiseType": "white",
          "noiseAmount": 100,
          "drift": 10,
          "stereoWidth": 62,
          "deepDreamOrbit": false,
          "decoherence": 20,
          "fmAmount": 7,
          "fmRatio": 4.0,
          "fmAttack": 0.1,
          "fmDecay": 0.5,
          "fmSustain": 0.22,
          "fmRelease": 0.7,
          "reverbMix": 0.28,
          "reverbDecay": 2.7,
          "delayMix": 0.08,
          "masterVolume": 0.12,
          "presence": 43
        })
    },
    factoryCorridor: {
      name: "Factory Corridor",
      collection: "Shadow Realms",
      engine: "synth",
      // Ancient machine rumble, occasional ticks and cavernous movement.
      settings: shadowRealmSettings("textures", {
          "origin": "ancient",
          "waveform": "triangle",
          "waveformB": "square",
          "waveFusion": 37,
          "oscBLevel": 0.26,
          "oscBDetune": 15,
          "subLevel": 21,
          "voiceSpread": 28,
          "beatTrackingMode": "fixed",
          "beatRate": 0.3,
          "attack": 0.85,
          "decay": 1.2,
          "sustain": 0.74,
          "release": 4.2,
          "filterType": "bandpass",
          "cutoff": 870,
          "resonance": 5.1,
          "lfoRate": 0.2,
          "lfoAmount": 180,
          "noiseType": "machine",
          "noiseAmount": 93,
          "drift": 24,
          "stereoWidth": 72,
          "deepDreamOrbit": true,
          "coherence": 25,
          "fmAmount": 9,
          "fmRatio": 3.2,
          "fmAttack": 0.7,
          "fmDecay": 1.4,
          "fmSustain": 0.28,
          "fmRelease": 2.3,
          "reverbMix": 0.71,
          "reverbDecay": 7.5,
          "delayMix": 0.36,
          "delayTime": 0.69,
          "masterVolume": 0.12,
          "presence": 28
        })
    },
    shatteredMirror: {
      name: "Shattered Mirror",
      collection: "Shadow Realms",
      engine: "synth",
      // A single bright FM/crystalline impact with dust flecks and long echoes.
      settings: shadowRealmSettings("textures", {
          "origin": "glass",
          "waveform": "sine",
          "waveformB": "trapezoid",
          "waveFusion": 73,
          "oscBLevel": 0.4,
          "oscBDetune": 24,
          "voiceSpread": 34,
          "attack": 0.01,
          "decay": 0.32,
          "sustain": 0,
          "release": 0.65,
          "filterType": "highpass",
          "cutoff": 1300,
          "resonance": 4.8,
          "lfoRate": 1.3,
          "lfoAmount": 100,
          "noiseType": "dust",
          "noiseAmount": 96,
          "drift": 6,
          "stereoWidth": 88,
          "deepDreamOrbit": true,
          "coherence": 18,
          "fmAmount": 31,
          "fmRatio": 11.0,
          "fmAttack": 0.01,
          "fmDecay": 0.23,
          "fmSustain": 0,
          "fmRelease": 0.39,
          "reverbMix": 0.8,
          "reverbDecay": 7.8,
          "delayMix": 0.32,
          "delayTime": 0.54,
          "delayFeedback": 0.42,
          "masterVolume": 0.08,
          "presence": 54
        })
    },
  },
};
    



// ========================================
// DREAM BINDER — DREAM ATLAS · 13 realms · 104 hand-voiced Synth patches.
// Additive factory bank registration only. Existing sounds remain byte-identical.
// All 104 settings are complete; loading one cannot inherit preceding controls.
// ========================================
const dreamAtlasRealms = [
  {
    "id": "lucidStates",
    "title": "Lucid States",
    "theme": "The moment you realize the world is a dream."
  },
  {
    "id": "cityscapes",
    "title": "Cityscapes",
    "theme": "Neon streets and windows that lead nowhere."
  },
  {
    "id": "houseOfMemories",
    "title": "The House of Memories",
    "theme": "Rooms, staircases and voices held inside the past."
  },
  {
    "id": "neverEndingFields",
    "title": "Never-Ending Fields",
    "theme": "Wind, wild grass, distant lights and a horizon without an edge."
  },
  {
    "id": "castlesAndPonds",
    "title": "Castles and Ponds",
    "theme": "Still water, ancient stone and impossible gardens."
  },
  {
    "id": "dreamMountainPeaks",
    "title": "Dream Mountain Peaks",
    "theme": "Cloud oceans, thin air and the scale of impossible altitude."
  },
  {
    "id": "secretSparkleCaverns",
    "title": "Secret Sparkle Caverns",
    "theme": "Bioluminescent stone, impossible crystals and delicate echoes."
  },
  {
    "id": "mirrorWalking",
    "title": "Mirror Walking",
    "theme": "Reflections that move differently from the original."
  },
  {
    "id": "cozyDreams",
    "title": "Cozy Dreams",
    "theme": "Comfort, softness and gentle interior spaces."
  },
  {
    "id": "infiniteCarRide",
    "title": "Infinite Car Ride",
    "theme": "A nighttime road, passing lamps and nowhere to arrive."
  },
  {
    "id": "fallingInReverse",
    "title": "Falling in Reverse",
    "theme": "Weightlessness, inverted gravity and disorientation."
  },
  {
    "id": "timeSkip",
    "title": "Time Skip",
    "theme": "Missing moments and clocks out of agreement."
  },
  {
    "id": "sensualExperience",
    "title": "Sensual Experience",
    "theme": "Intimate warmth, closeness, tenderness and embodied dream sensation."
  }
];
const dreamAtlasPatches = [
  {
    "key": "atlas_lucidStates_Conscious_Awakening",
    "name": "Conscious Awakening",
    "atlasRealm": "lucidStates",
    "collection": "Lucid States",
    "category": "pads",
    "description": "A horizon of light gradually comes into focus.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sawtooth",
      "origin": "dream",
      "waveFusion": 58,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 6,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 9,
      "drift": 13,
      "stereoWidth": 72,
      "deepDreamOrbit": true,
      "coherence": 31,
      "decoherence": 4,
      "fmAmount": 8,
      "fmRatio": 2.5,
      "fmAttack": 1.2,
      "fmDecay": 0.8,
      "fmSustain": 0.38,
      "fmRelease": 0.3,
      "attack": 1.65,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.8,
      "filterType": "lowpass",
      "cutoff": 3100,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 125,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 37,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_lucidStates_Weightless_Geometry",
    "name": "Weightless Geometry",
    "atlasRealm": "lucidStates",
    "collection": "Lucid States",
    "category": "pads",
    "description": "A floating bodyless room with gentle inner motion.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "dream",
      "waveFusion": 27,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 21,
      "oscBLevel": 0.35,
      "oscBDetune": 6,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.17,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 9,
      "drift": 13,
      "stereoWidth": 87,
      "deepDreamOrbit": true,
      "coherence": 49,
      "decoherence": 4,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.95,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 1500,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.72,
      "reverbDecay": 5.7,
      "delayMix": 0.12,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 37,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_lucidStates_The_Memory_Returns",
    "name": "The Memory Returns",
    "atlasRealm": "lucidStates",
    "collection": "Lucid States",
    "category": "keys",
    "description": "A clear note carrying a half-remembered melody.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sine",
      "origin": "dream",
      "waveFusion": 18,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 6,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 4,
      "drift": 13,
      "stereoWidth": 72,
      "deepDreamOrbit": true,
      "coherence": 31,
      "decoherence": 4,
      "fmAmount": 18,
      "fmRatio": 3.0,
      "fmAttack": 0.01,
      "fmDecay": 0.52,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.012,
      "decay": 1.35,
      "sustain": 0.16,
      "release": 3.6,
      "filterType": "lowpass",
      "cutoff": 3400,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.51,
      "reverbDecay": 5.8,
      "delayMix": 0.2,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 37,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_lucidStates_Familiar_Stranger",
    "name": "Familiar Stranger",
    "atlasRealm": "lucidStates",
    "collection": "Lucid States",
    "category": "leads",
    "description": "A voice-like tone, friendly yet impossibly unfamiliar.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "sine",
      "origin": "dream",
      "waveFusion": 32,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": -9,
      "voiceSpread": 26,
      "beatTrackingMode": "fixed",
      "beatRate": 0.44,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 9,
      "drift": 13,
      "stereoWidth": 72,
      "deepDreamOrbit": true,
      "coherence": 31,
      "decoherence": 4,
      "fmAmount": 7,
      "fmRatio": 1.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.22,
      "decay": 0.72,
      "sustain": 0.82,
      "release": 2.8,
      "filterType": "lowpass",
      "cutoff": 2350,
      "resonance": 2.5,
      "lfoRate": 0.3,
      "lfoAmount": 65,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 5.8,
      "delayMix": 0.2,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 37,
      "glideEnabled": true,
      "glideTime": 0.16,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_lucidStates_Soft_Lucidity",
    "name": "Soft Lucidity",
    "atlasRealm": "lucidStates",
    "collection": "Lucid States",
    "category": "bass",
    "description": "An elastic, soft pulse beneath the awakening.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sine",
      "origin": "dream",
      "waveFusion": 12,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 53,
      "oscBLevel": 0.22,
      "oscBDetune": 6,
      "voiceSpread": 8,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 0,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 40,
      "decoherence": 4,
      "fmAmount": 3,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.022,
      "decay": 0.47,
      "sustain": 0.52,
      "release": 0.58,
      "filterType": "lowpass",
      "cutoff": 1150,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.14,
      "reverbDecay": 2.0,
      "delayMix": 0.04,
      "delayTime": 0.4,
      "delayFeedback": 0.12,
      "masterVolume": 0.17,
      "presence": 37,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_lucidStates_Beyond_the_Window",
    "name": "Beyond the Window",
    "atlasRealm": "lucidStates",
    "collection": "Lucid States",
    "category": "textures",
    "description": "An airy exterior world heard through distant glass.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "dream",
      "waveFusion": 43,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": 6,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 73,
      "drift": 22,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 31,
      "decoherence": 4,
      "fmAmount": 13,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.2,
      "decay": 0.9,
      "sustain": 0.76,
      "release": 4.3,
      "filterType": "highpass",
      "cutoff": 950,
      "resonance": 3.5,
      "lfoRate": 0.3,
      "lfoAmount": 205,
      "lfoDestination": "filter",
      "reverbMix": 0.74,
      "reverbDecay": 5.8,
      "delayMix": 0.19,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.11,
      "presence": 37,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_lucidStates_Dream_Sequence",
    "name": "Dream Sequence",
    "atlasRealm": "lucidStates",
    "collection": "Lucid States",
    "category": "arpeggiator",
    "description": "Flowing eighth-note pearls through a lucid landscape.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "dream",
      "waveFusion": 43,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": 6,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 31,
      "decoherence": 4,
      "fmAmount": 23,
      "fmRatio": 5,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.015,
      "decay": 0.36,
      "sustain": 0.12,
      "release": 0.6,
      "filterType": "lowpass",
      "cutoff": 4400,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.41,
      "reverbDecay": 5.8,
      "delayMix": 0.28,
      "delayTime": 0.33,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 37,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.63,
      "arpTempo": 92
    }
  },
  {
    "key": "atlas_lucidStates_Between_Two_Sleeps",
    "name": "Between Two Sleeps",
    "atlasRealm": "lucidStates",
    "collection": "Lucid States",
    "category": "pads",
    "description": "Euphoric calm that wavers at the edge of waking.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "square",
      "origin": "dream",
      "waveFusion": 64,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 6,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.26,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 9,
      "drift": 13,
      "stereoWidth": 72,
      "deepDreamOrbit": true,
      "coherence": 26,
      "decoherence": 17,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.3,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.7,
      "filterType": "lowpass",
      "cutoff": 2550,
      "resonance": 2.1,
      "lfoRate": 0.1,
      "lfoAmount": 90,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.37,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 37,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cityscapes_Neon_Afterimage",
    "name": "Neon Afterimage",
    "atlasRealm": "cityscapes",
    "collection": "Cityscapes",
    "category": "pads",
    "description": "Blue-purple neon stains wet pavement after midnight.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "sawtooth",
      "origin": "glass",
      "waveFusion": 61,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 14,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "machine",
      "noiseAmount": 7,
      "drift": 10,
      "stereoWidth": 61,
      "deepDreamOrbit": true,
      "coherence": 16,
      "decoherence": 16,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.12,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.1,
      "filterType": "lowpass",
      "cutoff": 1900,
      "resonance": 2.1,
      "lfoRate": 0.3,
      "lfoAmount": 185,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.44,
      "delayFeedback": 0.36,
      "masterVolume": 0.14,
      "presence": 49,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cityscapes_Empty_Boulevard",
    "name": "Empty Boulevard",
    "atlasRealm": "cityscapes",
    "collection": "Cityscapes",
    "category": "pads",
    "description": "A vast abandoned boulevard humming at 3 a.m.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sine",
      "origin": "glass",
      "waveFusion": 25,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 24,
      "oscBLevel": 0.35,
      "oscBDetune": 8,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.35,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dark",
      "noiseAmount": 27,
      "drift": 10,
      "stereoWidth": 78,
      "deepDreamOrbit": true,
      "coherence": 16,
      "decoherence": 16,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.8,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.2,
      "filterType": "lowpass",
      "cutoff": 1070,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.67,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.38,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 49,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cityscapes_Rain_on_Glass",
    "name": "Rain on Glass",
    "atlasRealm": "cityscapes",
    "collection": "Cityscapes",
    "category": "keys",
    "description": "Bright points of light against a rainy window.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 31,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 8,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 19,
      "drift": 10,
      "stereoWidth": 61,
      "deepDreamOrbit": true,
      "coherence": 16,
      "decoherence": 16,
      "fmAmount": 24,
      "fmRatio": 6.1,
      "fmAttack": 0.01,
      "fmDecay": 0.27,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.012,
      "decay": 0.46,
      "sustain": 0.1,
      "release": 1.8,
      "filterType": "lowpass",
      "cutoff": 6000,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.46,
      "reverbDecay": 4.8,
      "delayMix": 0.2,
      "delayTime": 0.28,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 49,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cityscapes_Rooftop_Transmission",
    "name": "Rooftop Transmission",
    "atlasRealm": "cityscapes",
    "collection": "Cityscapes",
    "category": "leads",
    "description": "A narrow analog signal crossing a forest of antennas.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "square",
      "waveformB": "sawtooth",
      "origin": "glass",
      "waveFusion": 46,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": 8,
      "voiceSpread": 16,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "machine",
      "noiseAmount": 12,
      "drift": 10,
      "stereoWidth": 61,
      "deepDreamOrbit": true,
      "coherence": 16,
      "decoherence": 16,
      "fmAmount": 13,
      "fmRatio": 2.2,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.04,
      "decay": 0.72,
      "sustain": 0.77,
      "release": 2.4,
      "filterType": "lowpass",
      "cutoff": 3000,
      "resonance": 4.8,
      "lfoRate": 0.7,
      "lfoAmount": 80,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 4.8,
      "delayMix": 0.2,
      "delayTime": 0.38,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 49,
      "glideEnabled": true,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cityscapes_Underground_Current",
    "name": "Underground Current",
    "atlasRealm": "cityscapes",
    "collection": "Cityscapes",
    "category": "bass",
    "description": "The mechanical heart beneath a sleeping city.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sawtooth",
      "waveformB": "square",
      "origin": "glass",
      "waveFusion": 27,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 67,
      "oscBLevel": 0.22,
      "oscBDetune": 3,
      "voiceSpread": 8,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "machine",
      "noiseAmount": 5,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 16,
      "decoherence": 16,
      "fmAmount": 3,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.011,
      "decay": 0.3,
      "sustain": 0.68,
      "release": 0.45,
      "filterType": "lowpass",
      "cutoff": 880,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.09,
      "reverbDecay": 2.0,
      "delayMix": 0.03,
      "delayTime": 0.38,
      "delayFeedback": 0.12,
      "masterVolume": 0.15,
      "presence": 49,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cityscapes_Ventilation_Shaft",
    "name": "Ventilation Shaft",
    "atlasRealm": "cityscapes",
    "collection": "Cityscapes",
    "category": "textures",
    "description": "Filtered ventilation and deep infrastructure echoes.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "square",
      "waveformB": "triangle",
      "origin": "glass",
      "waveFusion": 49,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": 8,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "machine",
      "noiseAmount": 83,
      "drift": 20,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 16,
      "decoherence": 39,
      "fmAmount": 13,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.5,
      "decay": 0.9,
      "sustain": 0.75,
      "release": 2.6,
      "filterType": "highpass",
      "cutoff": 720,
      "resonance": 3.5,
      "lfoRate": 1.5,
      "lfoAmount": 320,
      "lfoDestination": "filter",
      "reverbMix": 0.6,
      "reverbDecay": 4.8,
      "delayMix": 0.19,
      "delayTime": 0.38,
      "delayFeedback": 0.22,
      "masterVolume": 0.1,
      "presence": 49,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cityscapes_Crosswalk_at_Infinity",
    "name": "Crosswalk at Infinity",
    "atlasRealm": "cityscapes",
    "collection": "Cityscapes",
    "category": "arpeggiator",
    "description": "A restless sixteenth-note signal between silent avenues.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "square",
      "waveformB": "triangle",
      "origin": "glass",
      "waveFusion": 49,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": 8,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "machine",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 16,
      "decoherence": 16,
      "fmAmount": 19,
      "fmRatio": 3.7,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.01,
      "decay": 0.19,
      "sustain": 0.08,
      "release": 0.38,
      "filterType": "lowpass",
      "cutoff": 2750,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.26,
      "reverbDecay": 4.8,
      "delayMix": 0.31,
      "delayTime": 0.38,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 49,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 3,
      "arpMode": "asPlayed",
      "arpGate": 0.44,
      "arpTempo": 116
    }
  },
  {
    "key": "atlas_cityscapes_Skyline_Receding",
    "name": "Skyline Receding",
    "atlasRealm": "cityscapes",
    "collection": "Cityscapes",
    "category": "pads",
    "description": "Buildings shrink into a misty magnetic skyline.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sawtooth",
      "waveformB": "sine",
      "origin": "glass",
      "waveFusion": 52,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 8,
      "voiceSpread": 54,
      "beatTrackingMode": "tempo",
      "beatRate": 0.5,
      "beatTempo": 92,
      "beatDivision": 2,
      "noiseType": "air",
      "noiseAmount": 22,
      "drift": 10,
      "stereoWidth": 87,
      "deepDreamOrbit": true,
      "coherence": 16,
      "decoherence": 16,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.5,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.9,
      "filterType": "lowpass",
      "cutoff": 2800,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 140,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.38,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 49,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_houseOfMemories_Sunlit_Hallway",
    "name": "Sunlit Hallway",
    "atlasRealm": "houseOfMemories",
    "collection": "The House of Memories",
    "category": "pads",
    "description": "A warm doorway to somewhere you once knew.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sawtooth",
      "origin": "vintage",
      "waveFusion": 17,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 4,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 15,
      "drift": 12,
      "stereoWidth": 49,
      "deepDreamOrbit": true,
      "coherence": 40,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.8,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.8,
      "filterType": "lowpass",
      "cutoff": 1950,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.64,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.46,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 31,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_houseOfMemories_The_Unopened_Room",
    "name": "The Unopened Room",
    "atlasRealm": "houseOfMemories",
    "collection": "The House of Memories",
    "category": "pads",
    "description": "A dim room full of things nobody remembers.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "hollow",
      "waveFusion": 22,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 16,
      "oscBLevel": 0.35,
      "oscBDetune": 4,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.2,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dark",
      "noiseAmount": 21,
      "drift": 12,
      "stereoWidth": 71,
      "deepDreamOrbit": true,
      "coherence": 22,
      "decoherence": 24,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.4,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.7,
      "filterType": "lowpass",
      "cutoff": 780,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.46,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 31,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_houseOfMemories_Music_Box_on_the_Shelf",
    "name": "Music Box on the Shelf",
    "atlasRealm": "houseOfMemories",
    "collection": "The House of Memories",
    "category": "keys",
    "description": "Fragile struck tones with an intimate nostalgic tail.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "vintage",
      "waveFusion": 16,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 4,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 4,
      "drift": 12,
      "stereoWidth": 49,
      "deepDreamOrbit": true,
      "coherence": 22,
      "decoherence": 0,
      "fmAmount": 15,
      "fmRatio": 4.0,
      "fmAttack": 0.01,
      "fmDecay": 0.39,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.01,
      "decay": 0.8,
      "sustain": 0.08,
      "release": 2.9,
      "filterType": "lowpass",
      "cutoff": 4200,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.42,
      "reverbDecay": 4.4,
      "delayMix": 0.2,
      "delayTime": 0.46,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 31,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_houseOfMemories_A_Voice_from_Upstairs",
    "name": "A Voice from Upstairs",
    "atlasRealm": "houseOfMemories",
    "collection": "The House of Memories",
    "category": "leads",
    "description": "A distant invitation from the top of the stairs.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "triangle",
      "origin": "vintage",
      "waveFusion": 38,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": -7,
      "voiceSpread": 26,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 5,
      "drift": 12,
      "stereoWidth": 49,
      "deepDreamOrbit": true,
      "coherence": 22,
      "decoherence": 0,
      "fmAmount": 7,
      "fmRatio": 2.1,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.31,
      "decay": 0.72,
      "sustain": 0.83,
      "release": 3.3,
      "filterType": "lowpass",
      "cutoff": 1560,
      "resonance": 2.5,
      "lfoRate": 0.2,
      "lfoAmount": 65,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 4.4,
      "delayMix": 0.2,
      "delayTime": 0.46,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 31,
      "glideEnabled": true,
      "glideTime": 0.23,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_houseOfMemories_Floorboard_Heartbeat",
    "name": "Floorboard Heartbeat",
    "atlasRealm": "houseOfMemories",
    "collection": "The House of Memories",
    "category": "bass",
    "description": "A soft rounded thump heard through wooden flooring.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "vintage",
      "waveFusion": 12,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 48,
      "oscBLevel": 0.22,
      "oscBDetune": 4,
      "voiceSpread": 8,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 0,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 22,
      "decoherence": 0,
      "fmAmount": 6,
      "fmRatio": 1,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.021,
      "decay": 0.36,
      "sustain": 0.3,
      "release": 0.52,
      "filterType": "lowpass",
      "cutoff": 670,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.11,
      "reverbDecay": 2.0,
      "delayMix": 0,
      "delayTime": 0.46,
      "delayFeedback": 0.12,
      "masterVolume": 0.15,
      "presence": 31,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_houseOfMemories_Wallpaper_Hiss",
    "name": "Wallpaper Hiss",
    "atlasRealm": "houseOfMemories",
    "collection": "The House of Memories",
    "category": "textures",
    "description": "A curtain of old tape grain around a fading room.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "square",
      "origin": "vintage",
      "waveFusion": 27,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": 4,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "white",
      "noiseAmount": 82,
      "drift": 20,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 22,
      "decoherence": 0,
      "fmAmount": 13,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.65,
      "decay": 1.2,
      "sustain": 0.65,
      "release": 3.4,
      "filterType": "highpass",
      "cutoff": 2000,
      "resonance": 3.5,
      "lfoRate": 0.2,
      "lfoAmount": 120,
      "lfoDestination": "filter",
      "reverbMix": 0.66,
      "reverbDecay": 4.4,
      "delayMix": 0.19,
      "delayTime": 0.46,
      "delayFeedback": 0.22,
      "masterVolume": 0.1,
      "presence": 31,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_houseOfMemories_Staircase_Repetition",
    "name": "Staircase Repetition",
    "atlasRealm": "houseOfMemories",
    "collection": "The House of Memories",
    "category": "arpeggiator",
    "description": "Gentle quarter-note steps ascending through forgotten floors.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "vintage",
      "waveFusion": 29,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": 4,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 22,
      "decoherence": 0,
      "fmAmount": 12,
      "fmRatio": 3,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.013,
      "decay": 0.55,
      "sustain": 0.09,
      "release": 0.9,
      "filterType": "lowpass",
      "cutoff": 2100,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.41,
      "reverbDecay": 4.4,
      "delayMix": 0.29,
      "delayTime": 0.53,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 31,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 1,
      "arpMode": "up",
      "arpGate": 0.73,
      "arpTempo": 74
    }
  },
  {
    "key": "atlas_houseOfMemories_Photograph_in_Rain",
    "name": "Photograph in Rain",
    "atlasRealm": "houseOfMemories",
    "collection": "The House of Memories",
    "category": "keys",
    "description": "A cloudy pluck like a picture slowly dissolving.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sine",
      "origin": "vintage",
      "waveFusion": 33,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 4,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 22,
      "drift": 19,
      "stereoWidth": 49,
      "deepDreamOrbit": true,
      "coherence": 22,
      "decoherence": 0,
      "fmAmount": 8,
      "fmRatio": 2.3,
      "fmAttack": 0.01,
      "fmDecay": 0.38,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.04,
      "decay": 1.6,
      "sustain": 0.19,
      "release": 3.1,
      "filterType": "lowpass",
      "cutoff": 1300,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.46,
      "reverbDecay": 4.4,
      "delayMix": 0.21,
      "delayTime": 0.46,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 31,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_neverEndingFields_Golden_Distance",
    "name": "Golden Distance",
    "atlasRealm": "neverEndingFields",
    "collection": "Never-Ending Fields",
    "category": "pads",
    "description": "Grass and afternoon sunlight extending forever.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sine",
      "origin": "dream",
      "waveFusion": 28,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 3,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 18,
      "drift": 9,
      "stereoWidth": 84,
      "deepDreamOrbit": true,
      "coherence": 48,
      "decoherence": 0,
      "fmAmount": 5,
      "fmRatio": 2.1,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.85,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 3000,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 95,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 33,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_neverEndingFields_Blue_Hour_Prairie",
    "name": "Blue Hour Prairie",
    "atlasRealm": "neverEndingFields",
    "collection": "Never-Ending Fields",
    "category": "pads",
    "description": "Fields turning blue as the last sunlight disappears.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "sawtooth",
      "origin": "hollow",
      "waveFusion": 18,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 19,
      "oscBLevel": 0.35,
      "oscBDetune": 3,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.16,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dark",
      "noiseAmount": 17,
      "drift": 9,
      "stereoWidth": 84,
      "deepDreamOrbit": true,
      "coherence": 36,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.9,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 900,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 33,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_neverEndingFields_Dew_on_the_Grass",
    "name": "Dew on the Grass",
    "atlasRealm": "neverEndingFields",
    "collection": "Never-Ending Fields",
    "category": "keys",
    "description": "Light crystalline drops suspended over the meadow.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 24,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 3,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 12,
      "drift": 9,
      "stereoWidth": 84,
      "deepDreamOrbit": true,
      "coherence": 48,
      "decoherence": 0,
      "fmAmount": 20,
      "fmRatio": 5.4,
      "fmAttack": 0.01,
      "fmDecay": 0.3,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.01,
      "decay": 0.44,
      "sustain": 0.08,
      "release": 2.3,
      "filterType": "lowpass",
      "cutoff": 4900,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.46,
      "reverbDecay": 6.3,
      "delayMix": 0.2,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 33,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_neverEndingFields_Distant_Shepherd",
    "name": "Distant Shepherd",
    "atlasRealm": "neverEndingFields",
    "collection": "Never-Ending Fields",
    "category": "leads",
    "description": "A gentle singing line from the far side of the field.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "sine",
      "origin": "dream",
      "waveFusion": 39,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": 3,
      "voiceSpread": 24,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 6,
      "drift": 9,
      "stereoWidth": 84,
      "deepDreamOrbit": true,
      "coherence": 48,
      "decoherence": 0,
      "fmAmount": 7,
      "fmRatio": 2.1,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.28,
      "decay": 0.72,
      "sustain": 0.79,
      "release": 2.8,
      "filterType": "lowpass",
      "cutoff": 1900,
      "resonance": 2.5,
      "lfoRate": 0.3,
      "lfoAmount": 52,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 6.3,
      "delayMix": 0.2,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 33,
      "glideEnabled": true,
      "glideTime": 0.18,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_neverEndingFields_Roots_Beneath_Earth",
    "name": "Roots Beneath Earth",
    "atlasRealm": "neverEndingFields",
    "collection": "Never-Ending Fields",
    "category": "bass",
    "description": "Warm deep vibration beneath the open landscape.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sine",
      "origin": "dream",
      "waveFusion": 12,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 61,
      "oscBLevel": 0.22,
      "oscBDetune": 3,
      "voiceSpread": 8,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 0,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 48,
      "decoherence": 0,
      "fmAmount": 3,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.045,
      "decay": 0.7,
      "sustain": 0.78,
      "release": 1.0,
      "filterType": "lowpass",
      "cutoff": 780,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.12,
      "reverbDecay": 2.0,
      "delayMix": 0,
      "delayTime": 0.4,
      "delayFeedback": 0.12,
      "masterVolume": 0.14,
      "presence": 33,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_neverEndingFields_Grasswind",
    "name": "Grasswind",
    "atlasRealm": "neverEndingFields",
    "collection": "Never-Ending Fields",
    "category": "textures",
    "description": "A soft-moving synthetic breeze through endless stalks.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "dream",
      "waveFusion": 31,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": 3,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 94,
      "drift": 18,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 48,
      "decoherence": 0,
      "fmAmount": 13,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.6,
      "decay": 0.9,
      "sustain": 0.83,
      "release": 4.2,
      "filterType": "highpass",
      "cutoff": 1250,
      "resonance": 3.5,
      "lfoRate": 0.4,
      "lfoAmount": 230,
      "lfoDestination": "filter",
      "reverbMix": 0.57,
      "reverbDecay": 6.3,
      "delayMix": 0.19,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.11,
      "presence": 33,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_neverEndingFields_Fireflies_by_the_Road",
    "name": "Fireflies by the Road",
    "atlasRealm": "neverEndingFields",
    "collection": "Never-Ending Fields",
    "category": "arpeggiator",
    "description": "Unhurried eighth-note sparks appearing beyond the grass.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 31,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": 3,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 7,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 48,
      "decoherence": 0,
      "fmAmount": 19,
      "fmRatio": 6.2,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.01,
      "decay": 0.29,
      "sustain": 0.08,
      "release": 0.83,
      "filterType": "lowpass",
      "cutoff": 4400,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.41,
      "reverbDecay": 6.3,
      "delayMix": 0.34,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 33,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "random",
      "arpGate": 0.5,
      "arpTempo": 83
    }
  },
  {
    "key": "atlas_neverEndingFields_After_the_Rain",
    "name": "After the Rain",
    "atlasRealm": "neverEndingFields",
    "collection": "Never-Ending Fields",
    "category": "pads",
    "description": "A quiet clean landscape stretching beyond memory.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "trapezoid",
      "origin": "dream",
      "waveFusion": 47,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 3,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 24,
      "drift": 13,
      "stereoWidth": 84,
      "deepDreamOrbit": true,
      "coherence": 52,
      "decoherence": 0,
      "fmAmount": 9,
      "fmRatio": 4,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.25,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.7,
      "filterType": "lowpass",
      "cutoff": 3900,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.78,
      "reverbDecay": 5.7,
      "delayMix": 0.18,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 33,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_castlesAndPonds_Castle_Beneath_Clouds",
    "name": "Castle Beneath Clouds",
    "atlasRealm": "castlesAndPonds",
    "collection": "Castles and Ponds",
    "category": "pads",
    "description": "Immense stone towers rising into luminous cloud.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sawtooth",
      "origin": "ancient",
      "waveFusion": 40,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 16,
      "oscBLevel": 0.35,
      "oscBDetune": 7,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.29,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 14,
      "drift": 12,
      "stereoWidth": 75,
      "deepDreamOrbit": true,
      "coherence": 37,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.9,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 1560,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.76,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.53,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 38,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_castlesAndPonds_Stillwater_Garden",
    "name": "Stillwater Garden",
    "atlasRealm": "castlesAndPonds",
    "collection": "Castles and Ponds",
    "category": "pads",
    "description": "A vast pond almost completely without a ripple.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "dream",
      "waveFusion": 20,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 2,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 5,
      "drift": 3,
      "stereoWidth": 81,
      "deepDreamOrbit": true,
      "coherence": 54,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 2,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.2,
      "filterType": "lowpass",
      "cutoff": 2200,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.09,
      "delayTime": 0.53,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 38,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_castlesAndPonds_Silver_Fountain",
    "name": "Silver Fountain",
    "atlasRealm": "castlesAndPonds",
    "collection": "Castles and Ponds",
    "category": "keys",
    "description": "Tiny bright droplets between old marble pillars.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 26,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 7,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 14,
      "drift": 12,
      "stereoWidth": 75,
      "deepDreamOrbit": true,
      "coherence": 25,
      "decoherence": 0,
      "fmAmount": 26,
      "fmRatio": 7.1,
      "fmAttack": 0.01,
      "fmDecay": 0.31,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.01,
      "decay": 0.6,
      "sustain": 0.12,
      "release": 2.8,
      "filterType": "lowpass",
      "cutoff": 5900,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.46,
      "reverbDecay": 6.4,
      "delayMix": 0.2,
      "delayTime": 0.53,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 38,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_castlesAndPonds_Keeper_of_the_Gate",
    "name": "Keeper of the Gate",
    "atlasRealm": "castlesAndPonds",
    "collection": "Castles and Ponds",
    "category": "leads",
    "description": "A broad ancient melody echoing from an empty watchtower.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "sawtooth",
      "origin": "ancient",
      "waveFusion": 38,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": 7,
      "voiceSpread": 27,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 14,
      "drift": 12,
      "stereoWidth": 75,
      "deepDreamOrbit": true,
      "coherence": 25,
      "decoherence": 0,
      "fmAmount": 10,
      "fmRatio": 2.8,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.17,
      "decay": 0.72,
      "sustain": 0.8,
      "release": 3.5,
      "filterType": "lowpass",
      "cutoff": 2050,
      "resonance": 2.5,
      "lfoRate": 0.3,
      "lfoAmount": 65,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 6.4,
      "delayMix": 0.2,
      "delayTime": 0.53,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 38,
      "glideEnabled": true,
      "glideTime": 0.14,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_castlesAndPonds_Moat_Below",
    "name": "Moat Below",
    "atlasRealm": "castlesAndPonds",
    "collection": "Castles and Ponds",
    "category": "bass",
    "description": "Deep measured bass under the still surface of a moat.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "ancient",
      "waveFusion": 14,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 56,
      "oscBLevel": 0.22,
      "oscBDetune": 7,
      "voiceSpread": 8,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 0,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 25,
      "decoherence": 0,
      "fmAmount": 3,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.038,
      "decay": 0.46,
      "sustain": 0.68,
      "release": 0.76,
      "filterType": "lowpass",
      "cutoff": 940,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.18,
      "reverbDecay": 2.0,
      "delayMix": 0.04,
      "delayTime": 0.53,
      "delayFeedback": 0.12,
      "masterVolume": 0.16,
      "presence": 38,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_castlesAndPonds_Stone_Hall_Drips",
    "name": "Stone Hall Drips",
    "atlasRealm": "castlesAndPonds",
    "collection": "Castles and Ponds",
    "category": "textures",
    "description": "Water-like synthetic ticks receding in a huge hall.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "ancient",
      "waveFusion": 37,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": 7,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 63,
      "drift": 20,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 25,
      "decoherence": 0,
      "fmAmount": 34,
      "fmRatio": 9.1,
      "fmAttack": 0.01,
      "fmDecay": 0.15,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.01,
      "decay": 0.18,
      "sustain": 0.05,
      "release": 2.1,
      "filterType": "lowpass",
      "cutoff": 5000,
      "resonance": 3.5,
      "lfoRate": 0.8,
      "lfoAmount": 220,
      "lfoDestination": "filter",
      "reverbMix": 0.55,
      "reverbDecay": 6.4,
      "delayMix": 0.42,
      "delayTime": 0.7,
      "delayFeedback": 0.22,
      "masterVolume": 0.09,
      "presence": 38,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_castlesAndPonds_Court_of_Lanterns",
    "name": "Court of Lanterns",
    "atlasRealm": "castlesAndPonds",
    "collection": "Castles and Ponds",
    "category": "arpeggiator",
    "description": "A gently descending eighth-note court dance.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "ancient",
      "waveFusion": 37,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": 7,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 25,
      "decoherence": 0,
      "fmAmount": 21,
      "fmRatio": 4.5,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.016,
      "decay": 0.38,
      "sustain": 0.1,
      "release": 0.72,
      "filterType": "lowpass",
      "cutoff": 3800,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.41,
      "reverbDecay": 6.4,
      "delayMix": 0.29,
      "delayTime": 0.53,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 38,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "down",
      "arpGate": 0.66,
      "arpTempo": 88
    }
  },
  {
    "key": "atlas_castlesAndPonds_Moon_on_the_Water",
    "name": "Moon on the Water",
    "atlasRealm": "castlesAndPonds",
    "collection": "Castles and Ponds",
    "category": "pads",
    "description": "Moonlight moving through the reflected castle.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "ancient",
      "waveFusion": 46,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 7,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 14,
      "drift": 12,
      "stereoWidth": 92,
      "deepDreamOrbit": true,
      "coherence": 32,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.3,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.6,
      "filterType": "lowpass",
      "cutoff": 3000,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 160,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.67,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 38,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_dreamMountainPeaks_Above_the_Cloud_Sea",
    "name": "Above the Cloud Sea",
    "atlasRealm": "dreamMountainPeaks",
    "collection": "Dream Mountain Peaks",
    "category": "pads",
    "description": "An endless canopy of white clouds from the summit.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "sawtooth",
      "origin": "cosmic",
      "waveFusion": 30,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 9,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 25,
      "drift": 22,
      "stereoWidth": 92,
      "deepDreamOrbit": true,
      "coherence": 35,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.95,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 2850,
      "resonance": 2.1,
      "lfoRate": 0.1,
      "lfoAmount": 105,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.67,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_dreamMountainPeaks_The_Summit_is_Silent",
    "name": "The Summit is Silent",
    "atlasRealm": "dreamMountainPeaks",
    "collection": "Dream Mountain Peaks",
    "category": "pads",
    "description": "Thin frozen air, absolute stillness, immense distance.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "cosmic",
      "waveFusion": 17,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 9,
      "voiceSpread": 82,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 36,
      "drift": 6,
      "stereoWidth": 97,
      "deepDreamOrbit": true,
      "coherence": 24,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 2,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 1220,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.81,
      "reverbDecay": 5.7,
      "delayMix": 0.08,
      "delayTime": 0.67,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_dreamMountainPeaks_Ice_Crystal_Sunlight",
    "name": "Ice-Crystal Sunlight",
    "atlasRealm": "dreamMountainPeaks",
    "collection": "Dream Mountain Peaks",
    "category": "keys",
    "description": "Hard, glittering points of reflected alpine sun.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 27,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 9,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 18,
      "drift": 22,
      "stereoWidth": 92,
      "deepDreamOrbit": true,
      "coherence": 24,
      "decoherence": 0,
      "fmAmount": 31,
      "fmRatio": 8.3,
      "fmAttack": 0.01,
      "fmDecay": 0.21,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.01,
      "decay": 0.29,
      "sustain": 0.06,
      "release": 2.8,
      "filterType": "lowpass",
      "cutoff": 7100,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.46,
      "reverbDecay": 7.2,
      "delayMix": 0.2,
      "delayTime": 0.67,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_dreamMountainPeaks_Skyline_Call",
    "name": "Skyline Call",
    "atlasRealm": "dreamMountainPeaks",
    "collection": "Dream Mountain Peaks",
    "category": "leads",
    "description": "A high open melodic signal across vast alpine air.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "triangle",
      "origin": "cosmic",
      "waveFusion": 39,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": 9,
      "voiceSpread": 26,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 12,
      "drift": 22,
      "stereoWidth": 92,
      "deepDreamOrbit": true,
      "coherence": 24,
      "decoherence": 0,
      "fmAmount": 12,
      "fmRatio": 2.4,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.37,
      "decay": 0.72,
      "sustain": 0.73,
      "release": 3.8,
      "filterType": "lowpass",
      "cutoff": 3600,
      "resonance": 2.5,
      "lfoRate": 0.3,
      "lfoAmount": 65,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 7.2,
      "delayMix": 0.2,
      "delayTime": 0.67,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 41,
      "glideEnabled": true,
      "glideTime": 0.13,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_dreamMountainPeaks_Bedrock_Resonance",
    "name": "Bedrock Resonance",
    "atlasRealm": "dreamMountainPeaks",
    "collection": "Dream Mountain Peaks",
    "category": "bass",
    "description": "Ancient rock vibrating underneath immense peaks.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "square",
      "origin": "cosmic",
      "waveFusion": 45,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 68,
      "oscBLevel": 0.22,
      "oscBDetune": 9,
      "voiceSpread": 8,
      "beatTrackingMode": "fixed",
      "beatRate": 0.2,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dark",
      "noiseAmount": 15,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 24,
      "decoherence": 0,
      "fmAmount": 3,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.09,
      "decay": 0.76,
      "sustain": 0.82,
      "release": 1.6,
      "filterType": "lowpass",
      "cutoff": 740,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.21,
      "reverbDecay": 2.0,
      "delayMix": 0.02,
      "delayTime": 0.67,
      "delayFeedback": 0.12,
      "masterVolume": 0.13,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_dreamMountainPeaks_Glacial_Draft",
    "name": "Glacial Draft",
    "atlasRealm": "dreamMountainPeaks",
    "collection": "Dream Mountain Peaks",
    "category": "textures",
    "description": "A synthetic icy wind crossing bare mountain faces.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "cosmic",
      "waveFusion": 45,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": 9,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 96,
      "drift": 20,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 24,
      "decoherence": 0,
      "fmAmount": 13,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.5,
      "decay": 0.9,
      "sustain": 0.84,
      "release": 4.5,
      "filterType": "highpass",
      "cutoff": 1600,
      "resonance": 3.5,
      "lfoRate": 0.6,
      "lfoAmount": 300,
      "lfoDestination": "filter",
      "reverbMix": 0.63,
      "reverbDecay": 7.2,
      "delayMix": 0.19,
      "delayTime": 0.67,
      "delayFeedback": 0.22,
      "masterVolume": 0.1,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_dreamMountainPeaks_Cloudstep_Ascension",
    "name": "Cloudstep Ascension",
    "atlasRealm": "dreamMountainPeaks",
    "collection": "Dream Mountain Peaks",
    "category": "arpeggiator",
    "description": "Bright quarter-note steps slowly climbing above the clouds.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 45,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": 9,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 24,
      "decoherence": 0,
      "fmAmount": 24,
      "fmRatio": 6.5,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.01,
      "decay": 0.38,
      "sustain": 0.13,
      "release": 1.0,
      "filterType": "lowpass",
      "cutoff": 4400,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.41,
      "reverbDecay": 7.2,
      "delayMix": 0.35,
      "delayTime": 0.67,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 1,
      "arpMode": "up",
      "arpGate": 0.57,
      "arpTempo": 68
    }
  },
  {
    "key": "atlas_dreamMountainPeaks_Solar_Halo",
    "name": "Solar Halo",
    "atlasRealm": "dreamMountainPeaks",
    "collection": "Dream Mountain Peaks",
    "category": "pads",
    "description": "An enormous halo in an impossibly clear sky.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sawtooth",
      "waveformB": "sine",
      "origin": "cosmic",
      "waveFusion": 57,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 9,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 25,
      "drift": 22,
      "stereoWidth": 92,
      "deepDreamOrbit": true,
      "coherence": 44,
      "decoherence": 8,
      "fmAmount": 15,
      "fmRatio": 2.7,
      "fmAttack": 0.9,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.2,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.9,
      "filterType": "lowpass",
      "cutoff": 3950,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.67,
      "delayFeedback": 0.22,
      "masterVolume": 0.13,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_secretSparkleCaverns_Blue_Crystal_Cathedral",
    "name": "Blue Crystal Cathedral",
    "atlasRealm": "secretSparkleCaverns",
    "collection": "Secret Sparkle Caverns",
    "category": "pads",
    "description": "A cavern cathedral gently singing through its crystals.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 59,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 13,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 24,
      "drift": 8,
      "stereoWidth": 88,
      "deepDreamOrbit": true,
      "coherence": 28,
      "decoherence": 0,
      "fmAmount": 19,
      "fmRatio": 6.3,
      "fmAttack": 0.9,
      "fmDecay": 0.8,
      "fmSustain": 0.18,
      "fmRelease": 0.3,
      "attack": 1.5,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.9,
      "filterType": "lowpass",
      "cutoff": 4300,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.49,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 46,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_secretSparkleCaverns_Cave_of_Sleeping_Stars",
    "name": "Cave of Sleeping Stars",
    "atlasRealm": "secretSparkleCaverns",
    "collection": "Secret Sparkle Caverns",
    "category": "pads",
    "description": "Tiny lights embedded in a completely dark ceiling.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "glass",
      "waveFusion": 25,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 11,
      "oscBLevel": 0.35,
      "oscBDetune": 13,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.24,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 39,
      "drift": 8,
      "stereoWidth": 88,
      "deepDreamOrbit": true,
      "coherence": 19,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.85,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 1700,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.78,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.49,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 46,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_secretSparkleCaverns_Prism_Drops",
    "name": "Prism Drops",
    "atlasRealm": "secretSparkleCaverns",
    "collection": "Secret Sparkle Caverns",
    "category": "keys",
    "description": "Struck glass drops with bright upper partials.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "glass",
      "waveFusion": 35,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 13,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 24,
      "drift": 8,
      "stereoWidth": 88,
      "deepDreamOrbit": true,
      "coherence": 28,
      "decoherence": 0,
      "fmAmount": 37,
      "fmRatio": 9.3,
      "fmAttack": 0.01,
      "fmDecay": 0.22,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.01,
      "decay": 0.34,
      "sustain": 0.07,
      "release": 2.9,
      "filterType": "lowpass",
      "cutoff": 6800,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.63,
      "reverbDecay": 7.4,
      "delayMix": 0.2,
      "delayTime": 0.49,
      "delayFeedback": 0.22,
      "masterVolume": 0.11,
      "presence": 46,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_secretSparkleCaverns_Light_Through_Quartz",
    "name": "Light Through Quartz",
    "atlasRealm": "secretSparkleCaverns",
    "collection": "Secret Sparkle Caverns",
    "category": "leads",
    "description": "A thin luminous thread tracing cracks in stone.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "sine",
      "origin": "glass",
      "waveFusion": 44,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": 13,
      "voiceSpread": 24,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 11,
      "drift": 8,
      "stereoWidth": 88,
      "deepDreamOrbit": true,
      "coherence": 28,
      "decoherence": 0,
      "fmAmount": 22,
      "fmRatio": 7.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.12,
      "decay": 0.72,
      "sustain": 0.74,
      "release": 2.4,
      "filterType": "lowpass",
      "cutoff": 5600,
      "resonance": 2.5,
      "lfoRate": 0.3,
      "lfoAmount": 65,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 7.4,
      "delayMix": 0.2,
      "delayTime": 0.49,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 46,
      "glideEnabled": true,
      "glideTime": 0.11,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_secretSparkleCaverns_Crystal_Foundation",
    "name": "Crystal Foundation",
    "atlasRealm": "secretSparkleCaverns",
    "collection": "Secret Sparkle Caverns",
    "category": "bass",
    "description": "A smooth sub-bass running beneath the glitter.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "glass",
      "waveFusion": 19,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 57,
      "oscBLevel": 0.22,
      "oscBDetune": 13,
      "voiceSpread": 8,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 0,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 28,
      "decoherence": 0,
      "fmAmount": 12,
      "fmRatio": 3.2,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.035,
      "decay": 0.55,
      "sustain": 0.57,
      "release": 0.82,
      "filterType": "lowpass",
      "cutoff": 1320,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.2,
      "reverbDecay": 2.0,
      "delayMix": 0.09,
      "delayTime": 0.49,
      "delayFeedback": 0.12,
      "masterVolume": 0.15,
      "presence": 46,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_secretSparkleCaverns_Selenite_Scratches",
    "name": "Selenite Scratches",
    "atlasRealm": "secretSparkleCaverns",
    "collection": "Secret Sparkle Caverns",
    "category": "textures",
    "description": "Stylized crystalline scraping, brittle shimmer and echoes.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sawtooth",
      "waveformB": "square",
      "origin": "glass",
      "waveFusion": 64,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": 13,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 88,
      "drift": 20,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 28,
      "decoherence": 0,
      "fmAmount": 42,
      "fmRatio": 10.4,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.35,
      "decay": 0.9,
      "sustain": 0.33,
      "release": 1.7,
      "filterType": "highpass",
      "cutoff": 2500,
      "resonance": 6.5,
      "lfoRate": 5.1,
      "lfoAmount": 700,
      "lfoDestination": "filter",
      "reverbMix": 0.55,
      "reverbDecay": 7.4,
      "delayMix": 0.19,
      "delayTime": 0.49,
      "delayFeedback": 0.22,
      "masterVolume": 0.08,
      "presence": 46,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_secretSparkleCaverns_Crystal_Rain_Sequence",
    "name": "Crystal Rain Sequence",
    "atlasRealm": "secretSparkleCaverns",
    "collection": "Secret Sparkle Caverns",
    "category": "arpeggiator",
    "description": "Rapid thirty-second-note crystals suspended in echo.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 47,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": 13,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 28,
      "decoherence": 0,
      "fmAmount": 36,
      "fmRatio": 8.6,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.01,
      "decay": 0.18,
      "sustain": 0.03,
      "release": 0.51,
      "filterType": "lowpass",
      "cutoff": 6500,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.41,
      "reverbDecay": 7.4,
      "delayMix": 0.42,
      "delayTime": 0.31,
      "delayFeedback": 0.22,
      "masterVolume": 0.1,
      "presence": 46,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 4,
      "arpMode": "updown",
      "arpGate": 0.42,
      "arpTempo": 84
    }
  },
  {
    "key": "atlas_secretSparkleCaverns_Geode_Opening",
    "name": "Geode Opening",
    "atlasRealm": "secretSparkleCaverns",
    "collection": "Secret Sparkle Caverns",
    "category": "keys",
    "description": "A dense resonant strike revealing glassy overtones.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 69,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 13,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 13,
      "drift": 8,
      "stereoWidth": 88,
      "deepDreamOrbit": true,
      "coherence": 46,
      "decoherence": 0,
      "fmAmount": 30,
      "fmRatio": 5.7,
      "fmAttack": 0.01,
      "fmDecay": 0.61,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.01,
      "decay": 1.17,
      "sustain": 0.17,
      "release": 3.4,
      "filterType": "lowpass",
      "cutoff": 3750,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.46,
      "reverbDecay": 7.4,
      "delayMix": 0.2,
      "delayTime": 0.49,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 46,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_mirrorWalking_The_Other_Side",
    "name": "The Other Side",
    "atlasRealm": "mirrorWalking",
    "collection": "Mirror Walking",
    "category": "pads",
    "description": "A smooth reflection opens into an unrelated room.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "glass",
      "waveFusion": 61,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": -13,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.28,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 9,
      "drift": 24,
      "stereoWidth": 91,
      "deepDreamOrbit": true,
      "coherence": 34,
      "decoherence": 29,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.75,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.8,
      "filterType": "lowpass",
      "cutoff": 2700,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.48,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 44,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_mirrorWalking_Reflections_Misalign",
    "name": "Reflections Misalign",
    "atlasRealm": "mirrorWalking",
    "collection": "Mirror Walking",
    "category": "pads",
    "description": "Two copies of the same world slowly drifting apart.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sawtooth",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 52,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 24,
      "voiceSpread": 89,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 9,
      "drift": 24,
      "stereoWidth": 91,
      "deepDreamOrbit": true,
      "coherence": 9,
      "decoherence": 48,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.1,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.9,
      "filterType": "lowpass",
      "cutoff": 1600,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 240,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.48,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 44,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_mirrorWalking_Silver_Fingertips",
    "name": "Silver Fingertips",
    "atlasRealm": "mirrorWalking",
    "collection": "Mirror Walking",
    "category": "keys",
    "description": "Cold reflective keys; one strike produces split-colored echoes.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 59,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": -13,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 9,
      "drift": 24,
      "stereoWidth": 91,
      "deepDreamOrbit": true,
      "coherence": 20,
      "decoherence": 27,
      "fmAmount": 28,
      "fmRatio": 6.9,
      "fmAttack": 0.01,
      "fmDecay": 0.3,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.011,
      "decay": 0.69,
      "sustain": 0.13,
      "release": 2.7,
      "filterType": "lowpass",
      "cutoff": 4750,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.46,
      "reverbDecay": 5.8,
      "delayMix": 0.43,
      "delayTime": 0.27,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 44,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_mirrorWalking_Reverse_Doppelg_nger",
    "name": "Reverse Doppelgänger",
    "atlasRealm": "mirrorWalking",
    "collection": "Mirror Walking",
    "category": "leads",
    "description": "An unstable voice moving between near-identical timbres.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "square",
      "waveformB": "triangle",
      "origin": "glass",
      "waveFusion": 45,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": -13,
      "voiceSpread": 26,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 9,
      "drift": 39,
      "stereoWidth": 91,
      "deepDreamOrbit": true,
      "coherence": 20,
      "decoherence": 27,
      "fmAmount": 17,
      "fmRatio": 2.7,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.18,
      "decay": 0.72,
      "sustain": 0.76,
      "release": 2.9,
      "filterType": "lowpass",
      "cutoff": 2500,
      "resonance": 2.5,
      "lfoRate": 0.3,
      "lfoAmount": 65,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 5.8,
      "delayMix": 0.2,
      "delayTime": 0.48,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 44,
      "glideEnabled": true,
      "glideTime": 0.31,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_mirrorWalking_Behind_the_Mirror",
    "name": "Behind the Mirror",
    "atlasRealm": "mirrorWalking",
    "collection": "Mirror Walking",
    "category": "bass",
    "description": "A hollow, glass-edged pulse on the wrong side of reality.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "square",
      "waveformB": "sine",
      "origin": "glass",
      "waveFusion": 26,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 41,
      "oscBLevel": 0.22,
      "oscBDetune": -13,
      "voiceSpread": 8,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 0,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 20,
      "decoherence": 27,
      "fmAmount": 16,
      "fmRatio": 3.8,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.02,
      "decay": 0.46,
      "sustain": 0.67,
      "release": 0.73,
      "filterType": "lowpass",
      "cutoff": 1050,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.18,
      "reverbDecay": 2.0,
      "delayMix": 0.06,
      "delayTime": 0.48,
      "delayFeedback": 0.12,
      "masterVolume": 0.14,
      "presence": 44,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_mirrorWalking_Cracked_Looking_Glass",
    "name": "Cracked Looking Glass",
    "atlasRealm": "mirrorWalking",
    "collection": "Mirror Walking",
    "category": "textures",
    "description": "Metallic grain, fractured highs and a shifting reflection.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sawtooth",
      "waveformB": "square",
      "origin": "glass",
      "waveFusion": 52,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": -13,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 82,
      "drift": 20,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 20,
      "decoherence": 27,
      "fmAmount": 36,
      "fmRatio": 8.7,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.08,
      "decay": 0.9,
      "sustain": 0.41,
      "release": 2.3,
      "filterType": "highpass",
      "cutoff": 1800,
      "resonance": 6.7,
      "lfoRate": 4.6,
      "lfoAmount": 540,
      "lfoDestination": "filter",
      "reverbMix": 0.55,
      "reverbDecay": 5.8,
      "delayMix": 0.19,
      "delayTime": 0.48,
      "delayFeedback": 0.22,
      "masterVolume": 0.09,
      "presence": 44,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_mirrorWalking_Double_Exposure",
    "name": "Double Exposure",
    "atlasRealm": "mirrorWalking",
    "collection": "Mirror Walking",
    "category": "arpeggiator",
    "description": "As-played sixteenths chase the reflected keyboard order.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "glass",
      "waveFusion": 42,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": -13,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 20,
      "decoherence": 27,
      "fmAmount": 25,
      "fmRatio": 4.4,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.01,
      "decay": 0.25,
      "sustain": 0.13,
      "release": 0.53,
      "filterType": "lowpass",
      "cutoff": 4300,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.41,
      "reverbDecay": 5.8,
      "delayMix": 0.39,
      "delayTime": 0.24,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 44,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 3,
      "arpMode": "asPlayed",
      "arpGate": 0.51,
      "arpTempo": 103
    }
  },
  {
    "key": "atlas_mirrorWalking_Hall_of_Doubles",
    "name": "Hall of Doubles",
    "atlasRealm": "mirrorWalking",
    "collection": "Mirror Walking",
    "category": "pads",
    "description": "A hall where every surface repeats a different version.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sawtooth",
      "origin": "glass",
      "waveFusion": 72,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": -13,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dark",
      "noiseAmount": 24,
      "drift": 24,
      "stereoWidth": 91,
      "deepDreamOrbit": true,
      "coherence": 12,
      "decoherence": 42,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.55,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 2200,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.75,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.48,
      "delayFeedback": 0.5,
      "masterVolume": 0.14,
      "presence": 44,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cozyDreams_Blanket_Fort",
    "name": "Blanket Fort",
    "atlasRealm": "cozyDreams",
    "collection": "Cozy Dreams",
    "category": "pads",
    "description": "Soft sheltered warmth around a candlelit nook.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sine",
      "origin": "vintage",
      "waveFusion": 24,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 2,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 7,
      "drift": 4,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 60,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.8,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.7,
      "filterType": "lowpass",
      "cutoff": 1900,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.51,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 28,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cozyDreams_Window_Rain_at_Dawn",
    "name": "Window Rain at Dawn",
    "atlasRealm": "cozyDreams",
    "collection": "Cozy Dreams",
    "category": "pads",
    "description": "Slow raindrops against a warm morning window.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "vintage",
      "waveFusion": 28,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 3,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 23,
      "drift": 5,
      "stereoWidth": 73,
      "deepDreamOrbit": true,
      "coherence": 45,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.7,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 2550,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 55,
      "lfoDestination": "filter",
      "reverbMix": 0.57,
      "reverbDecay": 5.7,
      "delayMix": 0.17,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 28,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cozyDreams_Sleepy_Lantern_Keys",
    "name": "Sleepy Lantern Keys",
    "atlasRealm": "cozyDreams",
    "collection": "Cozy Dreams",
    "category": "keys",
    "description": "Rounded soft struck keys with little upper attack.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "vintage",
      "waveFusion": 17,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 3,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 0,
      "drift": 5,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 45,
      "decoherence": 0,
      "fmAmount": 4,
      "fmRatio": 2,
      "fmAttack": 0.01,
      "fmDecay": 0.38,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.025,
      "decay": 0.98,
      "sustain": 0.16,
      "release": 2.4,
      "filterType": "lowpass",
      "cutoff": 2100,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.36,
      "reverbDecay": 4.2,
      "delayMix": 0.2,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 28,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cozyDreams_Humming_on_the_Sofa",
    "name": "Humming on the Sofa",
    "atlasRealm": "cozyDreams",
    "collection": "Cozy Dreams",
    "category": "leads",
    "description": "A tender sustained analog melody under a blanket.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "sine",
      "origin": "vintage",
      "waveFusion": 19,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": 3,
      "voiceSpread": 14,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 7,
      "drift": 5,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 45,
      "decoherence": 0,
      "fmAmount": 2,
      "fmRatio": 2.1,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.31,
      "decay": 0.72,
      "sustain": 0.8,
      "release": 2.7,
      "filterType": "lowpass",
      "cutoff": 1650,
      "resonance": 2.5,
      "lfoRate": 0.3,
      "lfoAmount": 35,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 4.2,
      "delayMix": 0.2,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 28,
      "glideEnabled": true,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cozyDreams_Fireside_Low_Note",
    "name": "Fireside Low Note",
    "atlasRealm": "cozyDreams",
    "collection": "Cozy Dreams",
    "category": "bass",
    "description": "Gentle warm low register; no aggressive transients.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "vintage",
      "waveFusion": 11,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 51,
      "oscBLevel": 0.22,
      "oscBDetune": 3,
      "voiceSpread": 8,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 0,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 45,
      "decoherence": 0,
      "fmAmount": 3,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.055,
      "decay": 0.68,
      "sustain": 0.64,
      "release": 0.85,
      "filterType": "lowpass",
      "cutoff": 790,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.11,
      "reverbDecay": 2.0,
      "delayMix": 0,
      "delayTime": 0.4,
      "delayFeedback": 0.12,
      "masterVolume": 0.15,
      "presence": 28,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cozyDreams_Soft_Quilt_Air",
    "name": "Soft Quilt Air",
    "atlasRealm": "cozyDreams",
    "collection": "Cozy Dreams",
    "category": "textures",
    "description": "A low filtered airy bed, more feeling than noise.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "vintage",
      "waveFusion": 24,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": 3,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 71,
      "drift": 20,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 45,
      "decoherence": 0,
      "fmAmount": 13,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.55,
      "decay": 0.9,
      "sustain": 0.77,
      "release": 4.6,
      "filterType": "lowpass",
      "cutoff": 1350,
      "resonance": 3.5,
      "lfoRate": 0.2,
      "lfoAmount": 45,
      "lfoDestination": "filter",
      "reverbMix": 0.53,
      "reverbDecay": 4.2,
      "delayMix": 0.19,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.11,
      "presence": 28,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_cozyDreams_Nightlight_Carousel",
    "name": "Nightlight Carousel",
    "atlasRealm": "cozyDreams",
    "collection": "Cozy Dreams",
    "category": "arpeggiator",
    "description": "Soft quarter notes circling peacefully without urgency.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "vintage",
      "waveFusion": 24,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": 3,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 45,
      "decoherence": 0,
      "fmAmount": 5,
      "fmRatio": 3,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.024,
      "decay": 0.65,
      "sustain": 0.12,
      "release": 0.72,
      "filterType": "lowpass",
      "cutoff": 2400,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.38,
      "reverbDecay": 4.2,
      "delayMix": 0.14,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 28,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 1,
      "arpMode": "updown",
      "arpGate": 0.75,
      "arpTempo": 66
    }
  },
  {
    "key": "atlas_cozyDreams_Safe_Harbor",
    "name": "Safe Harbor",
    "atlasRealm": "cozyDreams",
    "collection": "Cozy Dreams",
    "category": "pads",
    "description": "A smooth tranquil one-note sanctuary.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "sine",
      "origin": "vintage",
      "waveFusion": 13,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 26,
      "oscBLevel": 0.24,
      "oscBDetune": 3,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 0,
      "drift": 1,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 68,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.95,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 990,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.6,
      "reverbDecay": 5.7,
      "delayMix": 0.05,
      "delayTime": 0.4,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 28,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_infiniteCarRide_Midnight_Motorway",
    "name": "Midnight Motorway",
    "atlasRealm": "infiniteCarRide",
    "collection": "Infinite Car Ride",
    "category": "pads",
    "description": "Hypnotic orange streetlights disappearing over wet road.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sawtooth",
      "origin": "cosmic",
      "waveFusion": 51,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 21,
      "oscBLevel": 0.35,
      "oscBDetune": 10,
      "voiceSpread": 54,
      "beatTrackingMode": "tempo",
      "beatRate": 0.5,
      "beatTempo": 96,
      "beatDivision": 0.5,
      "noiseType": "machine",
      "noiseAmount": 17,
      "drift": 15,
      "stereoWidth": 75,
      "deepDreamOrbit": true,
      "coherence": 23,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.24,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.5,
      "filterType": "lowpass",
      "cutoff": 1850,
      "resonance": 2.1,
      "lfoRate": 0.3,
      "lfoAmount": 150,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.35,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_infiniteCarRide_Rearview_Stars",
    "name": "Rearview Stars",
    "atlasRealm": "infiniteCarRide",
    "collection": "Infinite Car Ride",
    "category": "pads",
    "description": "Distant stars appearing in an endlessly receding mirror.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "cosmic",
      "waveFusion": 34,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 10,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 28,
      "drift": 15,
      "stereoWidth": 91,
      "deepDreamOrbit": true,
      "coherence": 41,
      "decoherence": 0,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.78,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 2600,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.72,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.35,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_infiniteCarRide_Passing_Lamp_Keys",
    "name": "Passing Lamp Keys",
    "atlasRealm": "infiniteCarRide",
    "collection": "Infinite Car Ride",
    "category": "keys",
    "description": "Small bright piano-like sparks, each light a passing landmark.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "cosmic",
      "waveFusion": 27,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 10,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "machine",
      "noiseAmount": 17,
      "drift": 15,
      "stereoWidth": 75,
      "deepDreamOrbit": true,
      "coherence": 23,
      "decoherence": 0,
      "fmAmount": 22,
      "fmRatio": 4.8,
      "fmAttack": 0.01,
      "fmDecay": 0.38,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.01,
      "decay": 0.34,
      "sustain": 0.1,
      "release": 1.7,
      "filterType": "lowpass",
      "cutoff": 4500,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.46,
      "reverbDecay": 5.0,
      "delayMix": 0.39,
      "delayTime": 0.26,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_infiniteCarRide_Radio_in_the_Distance",
    "name": "Radio in the Distance",
    "atlasRealm": "infiniteCarRide",
    "collection": "Infinite Car Ride",
    "category": "leads",
    "description": "A narrow wistful analog melody heard through car speakers.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "square",
      "waveformB": "sine",
      "origin": "cosmic",
      "waveFusion": 27,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": 10,
      "voiceSpread": 17,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "white",
      "noiseAmount": 9,
      "drift": 15,
      "stereoWidth": 75,
      "deepDreamOrbit": true,
      "coherence": 23,
      "decoherence": 0,
      "fmAmount": 7,
      "fmRatio": 2.1,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.11,
      "decay": 0.72,
      "sustain": 0.76,
      "release": 2.3,
      "filterType": "lowpass",
      "cutoff": 1600,
      "resonance": 3.6,
      "lfoRate": 0.3,
      "lfoAmount": 65,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 5.0,
      "delayMix": 0.2,
      "delayTime": 0.35,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 39,
      "glideEnabled": true,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_infiniteCarRide_Engine_at_Idle",
    "name": "Engine at Idle",
    "atlasRealm": "infiniteCarRide",
    "collection": "Infinite Car Ride",
    "category": "bass",
    "description": "A warm persistent motor-like bass pulse.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sawtooth",
      "waveformB": "triangle",
      "origin": "cosmic",
      "waveFusion": 31,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 62,
      "oscBLevel": 0.22,
      "oscBDetune": 3,
      "voiceSpread": 8,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "machine",
      "noiseAmount": 0,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 23,
      "decoherence": 0,
      "fmAmount": 3,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.023,
      "decay": 0.5,
      "sustain": 0.73,
      "release": 0.54,
      "filterType": "lowpass",
      "cutoff": 900,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.13,
      "reverbDecay": 2.0,
      "delayMix": 0.04,
      "delayTime": 0.35,
      "delayFeedback": 0.12,
      "masterVolume": 0.15,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_infiniteCarRide_Road_Noise",
    "name": "Road Noise",
    "atlasRealm": "infiniteCarRide",
    "collection": "Infinite Car Ride",
    "category": "textures",
    "description": "Airborne tire noise and distant synthetic roadway hiss.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "square",
      "waveformB": "triangle",
      "origin": "cosmic",
      "waveFusion": 43,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": 10,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "white",
      "noiseAmount": 86,
      "drift": 22,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 23,
      "decoherence": 0,
      "fmAmount": 13,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.76,
      "decay": 0.9,
      "sustain": 0.82,
      "release": 3.4,
      "filterType": "highpass",
      "cutoff": 950,
      "resonance": 3.5,
      "lfoRate": 0.9,
      "lfoAmount": 230,
      "lfoDestination": "filter",
      "reverbMix": 0.38,
      "reverbDecay": 5.0,
      "delayMix": 0.19,
      "delayTime": 0.35,
      "delayFeedback": 0.22,
      "masterVolume": 0.09,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_infiniteCarRide_Lane_Markers_Forever",
    "name": "Lane Markers Forever",
    "atlasRealm": "infiniteCarRide",
    "collection": "Infinite Car Ride",
    "category": "arpeggiator",
    "description": "Regular eighth notes mimicking the flow of road markings.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "triangle",
      "origin": "cosmic",
      "waveFusion": 27,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": 10,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "machine",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 23,
      "decoherence": 0,
      "fmAmount": 15,
      "fmRatio": 4.4,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.012,
      "decay": 0.24,
      "sustain": 0.19,
      "release": 0.38,
      "filterType": "lowpass",
      "cutoff": 2400,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.41,
      "reverbDecay": 5.0,
      "delayMix": 0.24,
      "delayTime": 0.29,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.56,
      "arpTempo": 104
    }
  },
  {
    "key": "atlas_infiniteCarRide_No_Final_Exit",
    "name": "No Final Exit",
    "atlasRealm": "infiniteCarRide",
    "collection": "Infinite Car Ride",
    "category": "pads",
    "description": "A dark tranquil drone with distant rhythmic undercurrent.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "sawtooth",
      "origin": "cosmic",
      "waveFusion": 38,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 35,
      "oscBLevel": 0.35,
      "oscBDetune": 10,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.45,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dark",
      "noiseAmount": 27,
      "drift": 15,
      "stereoWidth": 75,
      "deepDreamOrbit": true,
      "coherence": 23,
      "decoherence": 15,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.6,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 1100,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.64,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.35,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_fallingInReverse_Gravity_Unlearned",
    "name": "Gravity Unlearned",
    "atlasRealm": "fallingInReverse",
    "collection": "Falling in Reverse",
    "category": "pads",
    "description": "A suspended low note, pressure without direction.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "hollow",
      "waveFusion": 34,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 30,
      "oscBLevel": 0.35,
      "oscBDetune": -16,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.14,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 22,
      "drift": 28,
      "stereoWidth": 91,
      "deepDreamOrbit": true,
      "coherence": 13,
      "decoherence": 38,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.8,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 980,
      "resonance": 2.1,
      "lfoRate": 0.1,
      "lfoAmount": 175,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.56,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_fallingInReverse_Ceiling_Beneath_You",
    "name": "Ceiling Beneath You",
    "atlasRealm": "fallingInReverse",
    "collection": "Falling in Reverse",
    "category": "pads",
    "description": "An unstable layer turning spatial orientation inside out.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sawtooth",
      "waveformB": "trapezoid",
      "origin": "hollow",
      "waveFusion": 67,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": -16,
      "voiceSpread": 93,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 22,
      "drift": 28,
      "stereoWidth": 91,
      "deepDreamOrbit": true,
      "coherence": 6,
      "decoherence": 57,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.24,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.6,
      "filterType": "lowpass",
      "cutoff": 2300,
      "resonance": 2.1,
      "lfoRate": 0.3,
      "lfoAmount": 250,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.56,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_fallingInReverse_Upside_Down_Piano",
    "name": "Upside-Down Piano",
    "atlasRealm": "fallingInReverse",
    "collection": "Falling in Reverse",
    "category": "keys",
    "description": "Glassy struck notes that keep no stable center.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "glass",
      "waveFusion": 58,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": -16,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 22,
      "drift": 34,
      "stereoWidth": 91,
      "deepDreamOrbit": true,
      "coherence": 13,
      "decoherence": 42,
      "fmAmount": 29,
      "fmRatio": 5.9,
      "fmAttack": 0.01,
      "fmDecay": 0.38,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.012,
      "decay": 0.63,
      "sustain": 0.12,
      "release": 2.5,
      "filterType": "lowpass",
      "cutoff": 2900,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.46,
      "reverbDecay": 6.2,
      "delayMix": 0.45,
      "delayTime": 0.56,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_fallingInReverse_Reverse_Lift",
    "name": "Reverse Lift",
    "atlasRealm": "fallingInReverse",
    "collection": "Falling in Reverse",
    "category": "leads",
    "description": "A gliding melodic signal rising through an impossible void.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "triangle",
      "origin": "hollow",
      "waveFusion": 44,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": -16,
      "voiceSpread": 26,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 22,
      "drift": 28,
      "stereoWidth": 91,
      "deepDreamOrbit": true,
      "coherence": 13,
      "decoherence": 38,
      "fmAmount": 15,
      "fmRatio": 2.6,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.32,
      "decay": 0.72,
      "sustain": 0.77,
      "release": 3.6,
      "filterType": "lowpass",
      "cutoff": 2600,
      "resonance": 2.5,
      "lfoRate": 0.2,
      "lfoAmount": 14,
      "lfoDestination": "pitch",
      "reverbMix": 0.43,
      "reverbDecay": 6.2,
      "delayMix": 0.2,
      "delayTime": 0.56,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 39,
      "glideEnabled": true,
      "glideTime": 0.44,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_fallingInReverse_Negative_Mass",
    "name": "Negative Mass",
    "atlasRealm": "fallingInReverse",
    "collection": "Falling in Reverse",
    "category": "bass",
    "description": "A dense hollow low-register foundation that seems to float.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "square",
      "waveformB": "sine",
      "origin": "hollow",
      "waveFusion": 23,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 58,
      "oscBLevel": 0.22,
      "oscBDetune": -16,
      "voiceSpread": 8,
      "beatTrackingMode": "fixed",
      "beatRate": 0.18,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 0,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 13,
      "decoherence": 38,
      "fmAmount": 3,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.11,
      "decay": 0.69,
      "sustain": 0.75,
      "release": 1.3,
      "filterType": "lowpass",
      "cutoff": 720,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.24,
      "reverbDecay": 2.0,
      "delayMix": 0.04,
      "delayTime": 0.56,
      "delayFeedback": 0.12,
      "masterVolume": 0.13,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_fallingInReverse_Air_Without_Floor",
    "name": "Air Without Floor",
    "atlasRealm": "fallingInReverse",
    "collection": "Falling in Reverse",
    "category": "textures",
    "description": "A drifting breath with no physical source.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "hollow",
      "waveFusion": 56,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": -16,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 92,
      "drift": 20,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 13,
      "decoherence": 38,
      "fmAmount": 13,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.48,
      "decay": 0.9,
      "sustain": 0.89,
      "release": 4.1,
      "filterType": "highpass",
      "cutoff": 850,
      "resonance": 3.5,
      "lfoRate": 0.6,
      "lfoAmount": 270,
      "lfoDestination": "filter",
      "reverbMix": 0.78,
      "reverbDecay": 6.2,
      "delayMix": 0.19,
      "delayTime": 0.56,
      "delayFeedback": 0.22,
      "masterVolume": 0.09,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_fallingInReverse_Inverse_Cascade",
    "name": "Inverse Cascade",
    "atlasRealm": "fallingInReverse",
    "collection": "Falling in Reverse",
    "category": "arpeggiator",
    "description": "An inverted rapid sixteenth-note fall that keeps ascending.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "hollow",
      "waveFusion": 56,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": -16,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "cosmic",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 13,
      "decoherence": 38,
      "fmAmount": 27,
      "fmRatio": 6.6,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.01,
      "decay": 0.26,
      "sustain": 0.06,
      "release": 0.56,
      "filterType": "lowpass",
      "cutoff": 3100,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.41,
      "reverbDecay": 6.2,
      "delayMix": 0.36,
      "delayTime": 0.21,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 3,
      "arpMode": "down",
      "arpGate": 0.41,
      "arpTempo": 112
    }
  },
  {
    "key": "atlas_fallingInReverse_Without_a_Ground",
    "name": "Without a Ground",
    "atlasRealm": "fallingInReverse",
    "collection": "Falling in Reverse",
    "category": "pads",
    "description": "A profound slow drift into featureless reverse space.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "hollow",
      "waveFusion": 19,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 21,
      "oscBLevel": 0.35,
      "oscBDetune": -16,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.11,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dark",
      "noiseAmount": 42,
      "drift": 28,
      "stereoWidth": 94,
      "deepDreamOrbit": true,
      "coherence": 13,
      "decoherence": 38,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 2,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 680,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.8,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.56,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 39,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_timeSkip_Displaced_Seconds",
    "name": "Displaced Seconds",
    "atlasRealm": "timeSkip",
    "collection": "Time Skip",
    "category": "pads",
    "description": "A dim temporal pulse inside a seemingly still atmosphere.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "glass",
      "waveFusion": 54,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 11,
      "voiceSpread": 54,
      "beatTrackingMode": "tempo",
      "beatRate": 0.5,
      "beatTempo": 84,
      "beatDivision": 2,
      "noiseType": "dust",
      "noiseAmount": 16,
      "drift": 17,
      "stereoWidth": 79,
      "deepDreamOrbit": true,
      "coherence": 22,
      "decoherence": 34,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.4,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.9,
      "filterType": "lowpass",
      "cutoff": 1450,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 155,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.34,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 47,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_timeSkip_Forgotten_Minute",
    "name": "Forgotten Minute",
    "atlasRealm": "timeSkip",
    "collection": "Time Skip",
    "category": "pads",
    "description": "The gradual sensation of a lost interval of time.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sawtooth",
      "origin": "hollow",
      "waveFusion": 44,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 19,
      "oscBLevel": 0.35,
      "oscBDetune": 11,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dark",
      "noiseAmount": 25,
      "drift": 17,
      "stereoWidth": 79,
      "deepDreamOrbit": true,
      "coherence": 8,
      "decoherence": 48,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.8,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 940,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.34,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 47,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_timeSkip_Clock_Without_Hands",
    "name": "Clock Without Hands",
    "atlasRealm": "timeSkip",
    "collection": "Time Skip",
    "category": "keys",
    "description": "Bright but irregular-seeming struck synthetic ticks.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "glass",
      "waveFusion": 21,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 11,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 16,
      "drift": 17,
      "stereoWidth": 79,
      "deepDreamOrbit": true,
      "coherence": 22,
      "decoherence": 34,
      "fmAmount": 34,
      "fmRatio": 9.6,
      "fmAttack": 0.01,
      "fmDecay": 0.13,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.01,
      "decay": 0.16,
      "sustain": 0.04,
      "release": 0.48,
      "filterType": "lowpass",
      "cutoff": 5800,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.46,
      "reverbDecay": 5.1,
      "delayMix": 0.24,
      "delayTime": 0.34,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 47,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_timeSkip_Yesterday_Tomorrow",
    "name": "Yesterday Tomorrow",
    "atlasRealm": "timeSkip",
    "collection": "Time Skip",
    "category": "leads",
    "description": "An unstable digital melody that sounds a little out of phase.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "square",
      "waveformB": "sine",
      "origin": "glass",
      "waveFusion": 55,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": -21,
      "voiceSpread": 28,
      "beatTrackingMode": "fixed",
      "beatRate": 0.7,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 16,
      "drift": 17,
      "stereoWidth": 79,
      "deepDreamOrbit": true,
      "coherence": 22,
      "decoherence": 34,
      "fmAmount": 20,
      "fmRatio": 3.7,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.045,
      "decay": 0.72,
      "sustain": 0.73,
      "release": 2.8,
      "filterType": "lowpass",
      "cutoff": 2300,
      "resonance": 2.5,
      "lfoRate": 0.3,
      "lfoAmount": 65,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 5.1,
      "delayMix": 0.2,
      "delayTime": 0.34,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 47,
      "glideEnabled": true,
      "glideTime": 0.28,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_timeSkip_Temporal_Anchor",
    "name": "Temporal Anchor",
    "atlasRealm": "timeSkip",
    "collection": "Time Skip",
    "category": "bass",
    "description": "A forceful, steady low note against the drifting world.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sawtooth",
      "waveformB": "triangle",
      "origin": "glass",
      "waveFusion": 28,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 66,
      "oscBLevel": 0.22,
      "oscBDetune": 11,
      "voiceSpread": 8,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 0,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 47,
      "decoherence": 6,
      "fmAmount": 3,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.01,
      "decay": 0.27,
      "sustain": 0.59,
      "release": 0.47,
      "filterType": "lowpass",
      "cutoff": 1180,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.11,
      "reverbDecay": 2.0,
      "delayMix": 0.05,
      "delayTime": 0.34,
      "delayFeedback": 0.12,
      "masterVolume": 0.15,
      "presence": 47,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_timeSkip_Tape_Jump",
    "name": "Tape Jump",
    "atlasRealm": "timeSkip",
    "collection": "Time Skip",
    "category": "textures",
    "description": "Stylized jump-cut noise and digital time fragments.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "square",
      "waveformB": "trapezoid",
      "origin": "glass",
      "waveFusion": 49,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": 11,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "machine",
      "noiseAmount": 89,
      "drift": 20,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 22,
      "decoherence": 34,
      "fmAmount": 29,
      "fmRatio": 7.8,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.02,
      "decay": 0.39,
      "sustain": 0.38,
      "release": 0.52,
      "filterType": "highpass",
      "cutoff": 1850,
      "resonance": 3.5,
      "lfoRate": 6.8,
      "lfoAmount": 620,
      "lfoDestination": "filter",
      "reverbMix": 0.55,
      "reverbDecay": 5.1,
      "delayMix": 0.19,
      "delayTime": 0.34,
      "delayFeedback": 0.22,
      "masterVolume": 0.08,
      "presence": 47,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_timeSkip_Lost_Frame_Loop",
    "name": "Lost Frame Loop",
    "atlasRealm": "timeSkip",
    "collection": "Time Skip",
    "category": "arpeggiator",
    "description": "Fast thirty-second-note fragments in a cycling order.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "square",
      "origin": "glass",
      "waveFusion": 49,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": 11,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "dust",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 22,
      "decoherence": 34,
      "fmAmount": 22,
      "fmRatio": 7.1,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.01,
      "decay": 0.14,
      "sustain": 0.07,
      "release": 0.33,
      "filterType": "lowpass",
      "cutoff": 3900,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.41,
      "reverbDecay": 5.1,
      "delayMix": 0.4,
      "delayTime": 0.19,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 47,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 4,
      "arpMode": "random",
      "arpGate": 0.32,
      "arpTempo": 109
    }
  },
  {
    "key": "atlas_timeSkip_Unfinished_Hour",
    "name": "Unfinished Hour",
    "atlasRealm": "timeSkip",
    "collection": "Time Skip",
    "category": "pads",
    "description": "A hovering clock-like resonance that never resolves.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "sine",
      "origin": "glass",
      "waveFusion": 63,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 11,
      "voiceSpread": 54,
      "beatTrackingMode": "tempo",
      "beatRate": 0.5,
      "beatTempo": 73,
      "beatDivision": 4,
      "noiseType": "dust",
      "noiseAmount": 16,
      "drift": 17,
      "stereoWidth": 79,
      "deepDreamOrbit": true,
      "coherence": 23,
      "decoherence": 24,
      "fmAmount": 14,
      "fmRatio": 1.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.22,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.5,
      "filterType": "lowpass",
      "cutoff": 1750,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.34,
      "delayFeedback": 0.46,
      "masterVolume": 0.14,
      "presence": 47,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_sensualExperience_Velvet_Gravity",
    "name": "Velvet Gravity",
    "atlasRealm": "sensualExperience",
    "collection": "Sensual Experience",
    "category": "pads",
    "description": "Close, dark velvet warmth with slow inner movement.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sine",
      "origin": "dream",
      "waveFusion": 26,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 26,
      "oscBLevel": 0.35,
      "oscBDetune": 5,
      "voiceSpread": 54,
      "beatTrackingMode": "fixed",
      "beatRate": 0.24,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 9,
      "drift": 11,
      "stereoWidth": 66,
      "deepDreamOrbit": true,
      "coherence": 54,
      "decoherence": 4,
      "fmAmount": 0,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.55,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.7,
      "filterType": "lowpass",
      "cutoff": 1130,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.59,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.43,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_sensualExperience_Soft_Skin_of_Light",
    "name": "Soft Skin of Light",
    "atlasRealm": "sensualExperience",
    "collection": "Sensual Experience",
    "category": "pads",
    "description": "Luminous, gentle closeness with rich smooth harmonics.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "trapezoid",
      "origin": "dream",
      "waveFusion": 44,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": true,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 5,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 4,
      "drift": 11,
      "stereoWidth": 66,
      "deepDreamOrbit": true,
      "coherence": 36,
      "decoherence": 4,
      "fmAmount": 8,
      "fmRatio": 2.0,
      "fmAttack": 1.4,
      "fmDecay": 0.8,
      "fmSustain": 0.26,
      "fmRelease": 0.3,
      "attack": 1.8,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 4.9,
      "filterType": "lowpass",
      "cutoff": 2800,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.43,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_sensualExperience_Warmth_Remembered",
    "name": "Warmth Remembered",
    "atlasRealm": "sensualExperience",
    "collection": "Sensual Experience",
    "category": "keys",
    "description": "A tender resonant strike with a long soft afterglow.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "triangle",
      "waveformB": "sine",
      "origin": "dream",
      "waveFusion": 19,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.28,
      "oscBDetune": 5,
      "voiceSpread": 20,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 0,
      "drift": 11,
      "stereoWidth": 66,
      "deepDreamOrbit": true,
      "coherence": 36,
      "decoherence": 4,
      "fmAmount": 9,
      "fmRatio": 3.1,
      "fmAttack": 0.01,
      "fmDecay": 0.67,
      "fmSustain": 0.04,
      "fmRelease": 0.75,
      "attack": 0.024,
      "decay": 1.2,
      "sustain": 0.18,
      "release": 3.2,
      "filterType": "lowpass",
      "cutoff": 2600,
      "resonance": 1.3,
      "lfoRate": 0.3,
      "lfoAmount": 15,
      "lfoDestination": "filter",
      "reverbMix": 0.46,
      "reverbDecay": 4.6,
      "delayMix": 0.2,
      "delayTime": 0.43,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_sensualExperience_Close_Enough_to_Hear",
    "name": "Close Enough to Hear",
    "atlasRealm": "sensualExperience",
    "collection": "Sensual Experience",
    "category": "leads",
    "description": "An expressive mellow melodic line with gentle pitch transitions.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "trapezoid",
      "waveformB": "sine",
      "origin": "dream",
      "waveFusion": 29,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 13,
      "oscBLevel": 0.32,
      "oscBDetune": 5,
      "voiceSpread": 19,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 9,
      "drift": 11,
      "stereoWidth": 66,
      "deepDreamOrbit": true,
      "coherence": 36,
      "decoherence": 4,
      "fmAmount": 5,
      "fmRatio": 1.4,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.27,
      "decay": 0.72,
      "sustain": 0.84,
      "release": 3.0,
      "filterType": "lowpass",
      "cutoff": 1900,
      "resonance": 2.5,
      "lfoRate": 0.3,
      "lfoAmount": 65,
      "lfoDestination": "filter",
      "reverbMix": 0.43,
      "reverbDecay": 4.6,
      "delayMix": 0.2,
      "delayTime": 0.43,
      "delayFeedback": 0.22,
      "masterVolume": 0.15,
      "presence": 41,
      "glideEnabled": true,
      "glideTime": 0.2,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_sensualExperience_Gentle_Pulse",
    "name": "Gentle Pulse",
    "atlasRealm": "sensualExperience",
    "collection": "Sensual Experience",
    "category": "bass",
    "description": "A low, rounded heartbeat-like electronic foundation.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "dream",
      "waveFusion": 35,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 58,
      "oscBLevel": 0.22,
      "oscBDetune": 5,
      "voiceSpread": 8,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 0,
      "drift": 3,
      "stereoWidth": 25,
      "deepDreamOrbit": false,
      "coherence": 53,
      "decoherence": 4,
      "fmAmount": 3,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 0.07,
      "decay": 0.64,
      "sustain": 0.56,
      "release": 0.7,
      "filterType": "lowpass",
      "cutoff": 790,
      "resonance": 2.2,
      "lfoRate": 0.5,
      "lfoAmount": 0,
      "lfoDestination": "filter",
      "reverbMix": 0.12,
      "reverbDecay": 2.0,
      "delayMix": 0.02,
      "delayTime": 0.43,
      "delayFeedback": 0.12,
      "masterVolume": 0.15,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_sensualExperience_Quiet_Breathing",
    "name": "Quiet Breathing",
    "atlasRealm": "sensualExperience",
    "collection": "Sensual Experience",
    "category": "textures",
    "description": "Soft filtered breath and warmth in a gentle room.",
    "recommendedOctave": "-1 / 0",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "dream",
      "waveFusion": 35,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.16,
      "oscBDetune": 5,
      "voiceSpread": 22,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 74,
      "drift": 20,
      "stereoWidth": 74,
      "deepDreamOrbit": true,
      "coherence": 36,
      "decoherence": 4,
      "fmAmount": 13,
      "fmRatio": 3.5,
      "fmAttack": 0.01,
      "fmDecay": 0.8,
      "fmSustain": 0,
      "fmRelease": 0.3,
      "attack": 1.1,
      "decay": 0.9,
      "sustain": 0.81,
      "release": 3.9,
      "filterType": "highpass",
      "cutoff": 620,
      "resonance": 3.5,
      "lfoRate": 0.4,
      "lfoAmount": 83,
      "lfoDestination": "filter",
      "reverbMix": 0.44,
      "reverbDecay": 4.6,
      "delayMix": 0.19,
      "delayTime": 0.43,
      "delayFeedback": 0.22,
      "masterVolume": 0.11,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  },
  {
    "key": "atlas_sensualExperience_Slow_Circles",
    "name": "Slow Circles",
    "atlasRealm": "sensualExperience",
    "collection": "Sensual Experience",
    "category": "arpeggiator",
    "description": "Relaxed eighth notes tracing a gentle repeating contour.",
    "recommendedOctave": "0 / +1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "triangle",
      "origin": "dream",
      "waveFusion": 35,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 0,
      "oscBLevel": 0.24,
      "oscBDetune": 5,
      "voiceSpread": 15,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 2,
      "drift": 3,
      "stereoWidth": 54,
      "deepDreamOrbit": true,
      "coherence": 36,
      "decoherence": 4,
      "fmAmount": 7,
      "fmRatio": 3.2,
      "fmAttack": 0.01,
      "fmDecay": 0.25,
      "fmSustain": 0.04,
      "fmRelease": 0.3,
      "attack": 0.023,
      "decay": 0.42,
      "sustain": 0.22,
      "release": 0.63,
      "filterType": "lowpass",
      "cutoff": 1900,
      "resonance": 1.7,
      "lfoRate": 0.3,
      "lfoAmount": 30,
      "lfoDestination": "filter",
      "reverbMix": 0.38,
      "reverbDecay": 4.6,
      "delayMix": 0.16,
      "delayTime": 0.43,
      "delayFeedback": 0.22,
      "masterVolume": 0.12,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": true,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "updown",
      "arpGate": 0.8,
      "arpTempo": 70
    }
  },
  {
    "key": "atlas_sensualExperience_Afterglow",
    "name": "Afterglow",
    "atlasRealm": "sensualExperience",
    "collection": "Sensual Experience",
    "category": "pads",
    "description": "A glowing sustained single note whose edges softly disappear.",
    "recommendedOctave": "-2 / -1",
    "engine": "synth",
    "settings": {
      "waveform": "sine",
      "waveformB": "sawtooth",
      "origin": "dream",
      "waveFusion": 21,
      "waveFusionCurve": "smooth",
      "dreamMorphMotion": false,
      "subWaveform": "sine",
      "subLevel": 14,
      "oscBLevel": 0.35,
      "oscBDetune": 5,
      "voiceSpread": 54,
      "beatTrackingMode": "natural",
      "beatRate": 0.5,
      "beatTempo": 120,
      "beatDivision": 1,
      "noiseType": "air",
      "noiseAmount": 9,
      "drift": 6,
      "stereoWidth": 76,
      "deepDreamOrbit": true,
      "coherence": 63,
      "decoherence": 4,
      "fmAmount": 6,
      "fmRatio": 2.6,
      "fmAttack": 1.1,
      "fmDecay": 0.8,
      "fmSustain": 0.17,
      "fmRelease": 0.3,
      "attack": 1.7,
      "decay": 1.45,
      "sustain": 0.85,
      "release": 5,
      "filterType": "lowpass",
      "cutoff": 2350,
      "resonance": 2.1,
      "lfoRate": 0.2,
      "lfoAmount": 118,
      "lfoDestination": "filter",
      "reverbMix": 0.61,
      "reverbDecay": 5.7,
      "delayMix": 0.19,
      "delayTime": 0.43,
      "delayFeedback": 0.22,
      "masterVolume": 0.14,
      "presence": 41,
      "glideEnabled": false,
      "glideTime": 0.12,
      "arpEnabled": false,
      "arpLatch": false,
      "arpRate": 2,
      "arpMode": "up",
      "arpGate": 0.7,
      "arpTempo": 100
    }
  }
];
presetBanks.arpeggiator ||= {};
for (const patch of dreamAtlasPatches) {
  if (!presetBanks[patch.category]) presetBanks[patch.category] = {};
  if (Object.hasOwn(presetBanks[patch.category], patch.key)) throw Error(`Dream Atlas factory preset collision: ${patch.key}`);
  presetBanks[patch.category][patch.key] = patch;
}

// ========================================
// Choir Ah Sample Loader
// ========================================

async function loadChoirAhC3Sample() {
    const ctx = getAudioContext();

    if (choirAhC3Buffer) {
        return choirAhC3Buffer;
    }

    try {
        const response = await fetch(
            "./samples/C3 Ah.m4a"
        );

        if (!response.ok) {
            throw new Error(
                `Failed to load C3 Ah sample: ${response.status}`
            );
        }

        const arrayBuffer =
            await response.arrayBuffer();

        choirAhC3Buffer =
            await ctx.decodeAudioData(arrayBuffer);

        console.log(
            "Choir C3 Ah sample loaded:",
            choirAhC3Buffer.duration,
            "seconds"
        );

        return choirAhC3Buffer;

    } catch (error) {
        console.error(
            "Unable to load Choir C3 Ah sample:",
            error
        );

        return null;
    }
}

// ========================================
// Choir Engine
// ========================================

function stealOldestChoirVoice() {
    if (activeChoirNodes.length >= MAX_CHOIR_VOICES) {
        const oldestVoice = activeChoirNodes.shift();

        if (oldestVoice && oldestVoice.steal) {
            oldestVoice.steal();
        }
    }
}

function createChoirNote(frequency) {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // ========================================
    // Main Choir voice output
    // ========================================

    const choirVoiceOut = ctx.createGain();

    const choirSources = [];
    const choirProcessingNodes = [];

const choirWaveFusionAmount =
    getValue(waveFusionSlider, 50) / 100;

const choirWaveFusionCurve =
    waveFusionCurveSelect?.value || "linear";

const choirWaveFusionShaped =
    shapeWaveFusion(
        choirWaveFusionAmount,
        choirWaveFusionCurve
    );

const choirHumanAhFusionGain =
    ctx.createGain();

const choirHumanAhFusionLevel =
    1.60 - (choirWaveFusionShaped * 1.20);

choirHumanAhFusionGain.gain.setValueAtTime(
    choirHumanAhFusionLevel,
    now
);

choirHumanAhFusionGain.connect(choirVoiceOut);
    
    let choirSampleLoopActive = true;
    let choirSampleLoopTimer = null;

    const activeChoirSampleSegments = [];
// ========================================
// Clean repeated-note retrigger
// ========================================

const repeatedChoirVoice =
    [...activeChoirNodes]
        .reverse()
        .find(
            (voice) =>
                Math.abs(
                    voice.frequency - frequency
                ) < 0.01 &&
                !voice.released
        );

if (repeatedChoirVoice?.steal) {
    repeatedChoirVoice.steal();
}

// Free an old choir voice before constructing
// or scheduling the new one.
stealOldestChoirVoice();

if (choirAhC3Buffer) {
 
    const c3Frequency = 130.8128;

    const samplePlaybackRate =
    frequency / c3Frequency;
   
const sampleStartOffset = 3.18;
const sampleEndOffset = 7.70;
const sampleCrossfadeTime = 0.38;
const sampleRegionDuration =
    sampleEndOffset - sampleStartOffset;

const sampleSegmentDuration =
    sampleRegionDuration / samplePlaybackRate;


// ========================================
// Continuous Ah sample sustain
// ========================================

function scheduleChoirSampleSegment(
    segmentStartTime
) {
    if (!choirSampleLoopActive) {
        return;
    }

    const segmentSource =
        ctx.createBufferSource();

    const segmentGain =
        ctx.createGain();

    segmentSource.buffer =
        choirAhC3Buffer;

    segmentSource.playbackRate.setValueAtTime(
        samplePlaybackRate,
        segmentStartTime
    );

    segmentSource.connect(
        segmentGain
    );

segmentGain.connect(choirHumanAhFusionGain);

    // ----------------------------
    // Crossfade in
    // ----------------------------

    segmentGain.gain.setValueAtTime(
        0.0001,
        segmentStartTime
    );

    segmentGain.gain.linearRampToValueAtTime(
    0.75,
    segmentStartTime +
    sampleCrossfadeTime
);


    // ----------------------------
    // Crossfade out
    // ----------------------------

    const segmentEndTime =
        segmentStartTime +
        sampleSegmentDuration;

    const fadeOutStartTime =
        segmentEndTime -
        sampleCrossfadeTime;

    segmentGain.gain.setValueAtTime(
        0.75,
        fadeOutStartTime
    );

    segmentGain.gain.linearRampToValueAtTime(
    0.0001,
    segmentEndTime
);

    // ----------------------------
    // Play only clean Ah region
    // ----------------------------

    segmentSource.start(
        segmentStartTime,
        sampleStartOffset,
        sampleRegionDuration
    );

    try {
        segmentSource.stop(
            segmentEndTime + 0.02
        );
    } catch (error) {
        // Source may already have a stop time.
    }


    choirSources.push(
        segmentSource
    );

    choirProcessingNodes.push(
        segmentGain
    );

    activeChoirSampleSegments.push({
    source: segmentSource,
    gain: segmentGain
});

segmentSource.addEventListener(
    "ended",
    () => {
        const segmentIndex =
            activeChoirSampleSegments.findIndex(
                (segment) =>
                    segment.source === segmentSource
            );

        if (segmentIndex !== -1) {
            activeChoirSampleSegments.splice(
                segmentIndex,
                1
            );
        }

        try {
            segmentSource.disconnect();
        } catch (error) {
            // Source may already be disconnected.
        }

        try {
            segmentGain.disconnect();
        } catch (error) {
            // Gain may already be disconnected.
        }
    }
);
    
    // ----------------------------
    // Schedule next overlapping Ah
    // ----------------------------

    const nextSegmentTime =
        segmentEndTime -
        sampleCrossfadeTime;

    const schedulingLeadTime = 0.30;

    const timerDelay =
        Math.max(
            0,
            (
                nextSegmentTime -
                ctx.currentTime -
                schedulingLeadTime
            ) * 1000
        );

    choirSampleLoopTimer = setTimeout(
        () => {
            if (
                choirSampleLoopActive
            ) {
                scheduleChoirSampleSegment(
                    nextSegmentTime
                );
            }
        },
        timerDelay
    );
}


// Begin sustained Ah
scheduleChoirSampleSegment(now);
        
        
    console.log(
        "Human Ah sample playing at:",
        frequency
    );
}
    
    
    // ========================================
    // Main Choir voice output
    // ========================================


    const choirAttack = Math.min(
        4.0,
        Math.max(
            0.08,
            getValue(attackSlider, 0.12)
        )
    );

    const choirSustain = Math.min(
        0.95,
        Math.max(
            0.15,
            getValue(sustainSlider, 0.78)
        )
    );

    const choirPeak = 1.5;

    choirVoiceOut.gain.setValueAtTime(
        0.0001,
        now
    );

    choirVoiceOut.gain.linearRampToValueAtTime(
        choirPeak,
        now + choirAttack
    );

    choirVoiceOut.gain.exponentialRampToValueAtTime(
        Math.max(
            0.001,
            choirPeak * choirSustain
        ),
        now + choirAttack + 1.4
    );

const choirPresenceGain =
    ctx.createGain();

const choirPresenceAmount =
    getValue(presenceSlider, 0) / 100;

const choirPresenceLevel =
    1.0 + (choirPresenceAmount * 0.35);

choirPresenceGain.gain.setValueAtTime(
    choirPresenceLevel,
    now
);

const choirPresenceFilter =
    ctx.createBiquadFilter();

choirPresenceFilter.type = "highshelf";

choirPresenceFilter.frequency.setValueAtTime(
    3000,
    now
);

choirPresenceFilter.gain.setValueAtTime(
    choirPresenceAmount * 3.0,
    now
);
    
const choirOrbitPanner =
    ctx.createStereoPanner();

choirOrbitPanner.pan.setValueAtTime(
    0,
    now
);

const choirOrbitLFO =
    ctx.createOscillator();

const choirOrbitGain =
    ctx.createGain();

choirOrbitLFO.type = "sine";

choirOrbitLFO.frequency.setValueAtTime(
    0.08,
    now
);

choirOrbitGain.gain.setValueAtTime(
    deepDreamOrbitCheckbox?.checked
        ? 0.40
        : 0,
    now
);

choirOrbitLFO.connect(
    choirOrbitGain
);

choirOrbitGain.connect(
    choirOrbitPanner.pan
);

choirOrbitLFO.start(now);

choirSources.push(
    choirOrbitLFO
);

choirProcessingNodes.push(
    choirOrbitGain
);

choirVoiceOut.connect(choirPresenceGain);
choirPresenceGain.connect(choirPresenceFilter);
choirPresenceFilter.connect(choirOrbitPanner);

choirOrbitPanner.connect(dryGain);
choirOrbitPanner.connect(reverbNode);
choirOrbitPanner.connect(delayDryGain);
choirOrbitPanner.connect(delayNode);

// ========================================
// Choir Living Texture Layer
// ========================================

let choirTextureSource =
    ctx.createBufferSource();

const choirTextureFilter =
    ctx.createBiquadFilter();

const choirTextureGain =
    ctx.createGain();

// Smooth switching between Choir Living Textures
const choirTextureCrossfadeGain = ctx.createGain();

choirTextureCrossfadeGain.gain.setValueAtTime(
    1.0,
    now
);
    
const choirTextureType =
    noiseTypeSelect?.value || "white";

const choirTextureAmount =
    getValue(noiseAmountSlider, 0) / 100;

// Generate atmospheric texture

choirTextureSource.buffer =
    createNoiseBuffer(
        ctx,
        choirTextureType
    );

choirTextureSource.loop = true;

// Gentle atmospheric filtering

choirTextureFilter.type = "lowpass";

choirTextureFilter.frequency.setValueAtTime(
    4500,
    now
);

choirTextureFilter.Q.setValueAtTime(
    0.6,
    now
);

// Independent texture volume
// Balance atmospheric texture loudness

const choirTextureLevels = {
    white: 0.035,
    air: 0.10,
    dust: 0.14,
    cosmic: 0.12,
    machine: 0.12,
    dark: 0.16
};

const choirTextureLevel =
    choirTextureLevels[choirTextureType] ?? 0.035;

choirTextureGain.gain.setValueAtTime(
    choirTextureAmount * choirTextureLevel,
    now
);

// Texture signal routing

choirTextureSource.connect(choirTextureCrossfadeGain);
choirTextureCrossfadeGain.connect(choirTextureFilter);
choirTextureFilter.connect(choirTextureGain);
choirTextureGain.connect(choirVoiceOut);

// Begin texture playback

choirTextureSource.start(now);

// Register source for lifecycle cleanup

choirSources.push(
    choirTextureSource
);

choirProcessingNodes.push(
    choirTextureCrossfadeGain,
    choirTextureFilter,
    choirTextureGain
);
    
    // ========================================
    // Virtual singer configuration
    // ========================================

    const singerConfigurations = [
    {
        detune: -11,
        pan: -0.34,
        level: 0.8125,
        formantScale: 0.975,
        vibratoRate: 4.55,
        vibratoDepth: 4.2,

        vocalLevel: 0.96,
        bodyLevel: 1.08,
        harmonicLevel: 0.86
    },
    {
        detune: -3,
        pan: -0.11,
        level: 0.764,
        formantScale: 1.0,
        vibratoRate: 4.83,
        vibratoDepth: 3.5,

        vocalLevel: 1.03,
        bodyLevel: 0.97,
        harmonicLevel: 1.04
    },
    {
        detune: 5,
        pan: 0.13,
        level: 0.764,
        formantScale: 1.025,
        vibratoRate: 5.07,
        vibratoDepth: 3.8,

        vocalLevel: 1.0,
        bodyLevel: 1.04,
        harmonicLevel: 0.92
    },
    {
        detune: 12,
        pan: 0.36,
        level: 0.715,
        formantScale: 1.05,
        vibratoRate: 5.31,
        vibratoDepth: 4.4,

        vocalLevel: 1.06,
        bodyLevel: 0.94,
        harmonicLevel: 1.08
    }
];

    // ========================================
// Shared white-noise buffer
// ========================================

if (!choirNoiseBuffer) {
    const noiseBufferLength = Math.max(
        1,
        Math.floor(ctx.sampleRate * 0.5)
    );

    choirNoiseBuffer = ctx.createBuffer(
        1,
        noiseBufferLength,
        ctx.sampleRate
    );

    const noiseData =
        choirNoiseBuffer.getChannelData(0);

    for (
        let sampleIndex = 0;
        sampleIndex < noiseBufferLength;
        sampleIndex += 1
    ) {
        noiseData[sampleIndex] =
            Math.random() * 2 - 1;
    }
}

    if (!choirGlottalWave) {
    const glottalReal = new Float32Array([
        0,
        1.00,
        0.72,
        0.58,
        0.48,
        0.40,
        0.34,
        0.29,
        0.25,
        0.22,
        0.19,
        0.17,
        0.15,
        0.135,
        0.12,
        0.108,
        0.097,
        0.087,
        0.078,
        0.070,
        0.063,
        0.057,
        0.051,
        0.046,
        0.041,
        0.037,
        0.033,
        0.030,
        0.027,
        0.024,
        0.022,
        0.020
    ]);

    const glottalImag = new Float32Array(
        glottalReal.length
    );

    choirGlottalWave = ctx.createPeriodicWave(
        glottalReal,
        glottalImag,
        {
            disableNormalization: false
        }
    );
}
    
    // ========================================
    // Build one virtual singer
    // ========================================

    function createVirtualSinger(configuration, singerIndex) {
        const singerInput = ctx.createGain();
        const singerOutput = ctx.createGain();
        const singerPan = ctx.createStereoPanner();

        const vocalOscillator = ctx.createOscillator();
        const vocalHarmonicOscillator = ctx.createOscillator();

        const vocalOscillatorGain = ctx.createGain();
const vocalHarmonicGain = ctx.createGain();
const vocalHarmonicFilter = ctx.createBiquadFilter();

        const vocalTractShape = ctx.createBiquadFilter();
        const vocalSpectralTilt = ctx.createBiquadFilter();
        const glottalLifeOscillator = ctx.createOscillator();
        const glottalLifeDepth = ctx.createGain();


const vowelResonatorOne = ctx.createBiquadFilter();
const vowelResonatorTwo = ctx.createBiquadFilter();
const vowelResonatorThree = ctx.createBiquadFilter();
        
        
        const vibratoOscillator = ctx.createOscillator();
        const vibratoDepth = ctx.createGain();

        const vocalDriftOscillator = ctx.createOscillator();
        const vocalDriftDepth = ctx.createGain();

        const vocalPulseOscillator = ctx.createOscillator();
        const vocalPulseDepth = ctx.createGain();
        
        const breathSource = ctx.createBufferSource();
        const breathFilter = ctx.createBiquadFilter();
        const breathGain = ctx.createGain();

        const randomDetune =
            (Math.random() * 1.6) - 0.8;

        const singerEntranceDelay =
            0.008 + Math.random() * 0.024;
        
        const randomFormantScale =
            1 + ((Math.random() * 0.012) - 0.006);

        const singerFormantScale =
            configuration.formantScale *
            randomFormantScale;


// ========================================
// Advanced Ah vocal resonator
// ========================================

// Open-mouth body
vowelResonatorOne.type = "peaking";

vowelResonatorOne.frequency.setValueAtTime(
    760 * singerFormantScale,
    now
);

vowelResonatorOne.Q.setValueAtTime(
    4.5,
    now
);

vowelResonatorOne.gain.setValueAtTime(
    12,
    now
);


// Ah vowel identity
vowelResonatorTwo.type = "peaking";

vowelResonatorTwo.frequency.setValueAtTime(
    1100 * singerFormantScale,
    now
);

vowelResonatorTwo.Q.setValueAtTime(
    7.0,
    now
);

vowelResonatorTwo.gain.setValueAtTime(
    10,
    now
);


// Upper vocal presence
vowelResonatorThree.type = "peaking";

vowelResonatorThree.frequency.setValueAtTime(
    2350 * singerFormantScale,
    now
);

vowelResonatorThree.Q.setValueAtTime(
    7.5,
    now
);

vowelResonatorThree.gain.setValueAtTime(
    5,
    now
);

    
        // ========================================
        // Vocal-cord excitation
        // ========================================

vocalOscillator.type = "triangle";

vocalOscillator.frequency.setValueAtTime(
    frequency,
    now
);

vocalOscillator.detune.setValueAtTime(
    configuration.detune + randomDetune,
    now
);

vocalOscillatorGain.gain.setValueAtTime(
    0.12 * configuration.vocalLevel,
    now
);

vocalOscillator.connect(
    vocalOscillatorGain
);

vocalOscillatorGain.connect(
    singerInput
);
     

vocalHarmonicOscillator.connect(
    vocalHarmonicFilter
);

vocalHarmonicFilter.connect(
    vocalHarmonicGain
);

vocalHarmonicGain.connect(
    singerInput
);

// Subtle harmonic excitation

vocalHarmonicOscillator.setPeriodicWave(
    choirGlottalWave
);

vocalHarmonicOscillator.frequency.setValueAtTime(
    frequency,
    now
);

vocalHarmonicOscillator.detune.setValueAtTime(
    configuration.detune +
    randomDetune * 0.25,
    now
);

vocalHarmonicGain.gain.setValueAtTime(
    0.10 * configuration.harmonicLevel,
    now
);

        vocalHarmonicFilter.type = "lowpass";

vocalHarmonicFilter.frequency.setValueAtTime(
    3600 + singerIndex * 90,
    now
);

vocalHarmonicFilter.Q.setValueAtTime(
    0.55,
    now
);


// ========================================
// Vocal spectral tilt
// ========================================

vocalSpectralTilt.type = "lowpass";

vocalSpectralTilt.frequency.setValueAtTime(
    2500,
    now
);

vocalSpectralTilt.Q.setValueAtTime(
    0.45,
    now
);


// ========================================
// Living glottal motion
// ========================================

glottalLifeOscillator.type = "sine";

glottalLifeOscillator.frequency.setValueAtTime(
    0.045 + Math.random() * 0.03,
    now
);

glottalLifeDepth.gain.setValueAtTime(
    140,
    now
);

glottalLifeOscillator.connect(
    glottalLifeDepth
);

glottalLifeDepth.connect(
    vocalSpectralTilt.frequency
);

        
// ========================================
// Shared vocal tract shaping
// ========================================

vocalTractShape.type = "peaking";

vocalTractShape.frequency.setValueAtTime(
    900,
    now
);

vocalTractShape.Q.setValueAtTime(
    0.55,
    now
);

vocalTractShape.gain.setValueAtTime(
    3.5,
    now
);

        
        // ========================================
        // True "Ah" vowel resonances
        // ========================================

    
        
        singerInput.connect(vocalSpectralTilt);
vocalSpectralTilt.connect(vocalTractShape);

vocalTractShape.connect(vowelResonatorOne);

vowelResonatorOne.connect(vowelResonatorTwo);
vowelResonatorTwo.connect(vowelResonatorThree);

vowelResonatorThree.connect(singerOutput);

    


        
// ========================================

        
        // ========================================
        // Natural singer vibrato
        // ========================================

        vibratoOscillator.type = "sine";

        vibratoOscillator.frequency.setValueAtTime(
            configuration.vibratoRate +
            ((Math.random() * 0.12) - 0.06),
            now
        );

        vibratoDepth.gain.setValueAtTime(
            0,
            now
        );

        vibratoDepth.gain.linearRampToValueAtTime(
            configuration.vibratoDepth,
            now + choirAttack + 0.95
        );

        vibratoOscillator.connect(vibratoDepth);

vibratoDepth.connect(
    vocalOscillator.detune
);

        vibratoDepth.connect(
    vocalHarmonicOscillator.detune
);

        
// ========================================
// Micro vocal drift
// ========================================

vocalDriftOscillator.type = "sine";

vocalDriftOscillator.frequency.setValueAtTime(
    0.8 + Math.random() * 1.4,
    now
);

vocalDriftDepth.gain.setValueAtTime(
    0.18,
    now
);

vocalDriftOscillator.connect(vocalDriftDepth);

vocalDriftDepth.connect(
    vocalOscillator.detune
);
        
vocalDriftDepth.connect(
    vocalHarmonicOscillator.detune
);



// ========================================
// Micro vocal pulse
// ========================================

vocalPulseOscillator.type = "sine";

vocalPulseOscillator.frequency.setValueAtTime(
    0.35 + Math.random() * 0.55,
    now
);

vocalPulseDepth.gain.setValueAtTime(
    0.008 + Math.random() * 0.008,
    now
);

vocalPulseOscillator.connect(
    vocalPulseDepth
);

vocalPulseDepth.connect(
    singerOutput.gain
);

        
        // ========================================
        // Slow vowel movement
        // ========================================

        

        // ========================================
        // Breath and aspiration
        // ========================================
        
breathSource.buffer = choirNoiseBuffer;
breathSource.loop = true;

breathFilter.type = "bandpass";

breathFilter.frequency.setValueAtTime(
    1500 + singerIndex * 60,
    now
);

breathFilter.Q.setValueAtTime(
    0.8,
    now
);

breathGain.gain.setValueAtTime(
    0,
    now
);

breathGain.gain.linearRampToValueAtTime(
    0.005,
    now + Math.min(0.4, choirAttack)
);

breathGain.gain.linearRampToValueAtTime(
    0.002,
    now + choirAttack + 0.65
);
// Route aspiration through the same vocal tract
// as the pitched excitation so both components
// share one unified vowel character.
breathSource.connect(breathFilter);
breathFilter.connect(breathGain);
breathGain.connect(singerInput);
        
        // ========================================
        // Singer level and stereo position
        // ========================================

        singerOutput.gain.setValueAtTime(
    0.0001,
    now
);

singerOutput.gain.linearRampToValueAtTime(
    configuration.level,
    now + singerEntranceDelay + 0.035
);

        singerPan.pan.setValueAtTime(
            configuration.pan +
            ((Math.random() * 0.04) - 0.02),
            now
        );

        singerOutput.connect(singerPan);
        singerPan.connect(choirVoiceOut);

        
        vocalOscillator.start(now);
        vocalHarmonicOscillator.start(now);
        vibratoOscillator.start(now);
        vocalDriftOscillator.start(now);
        vocalPulseOscillator.start(now);
        glottalLifeOscillator.start(now);
        breathSource.start(now);

        choirSources.push(
        
        vocalOscillator,
        vocalHarmonicOscillator,
        vibratoOscillator,
        vocalDriftOscillator,
        vocalPulseOscillator,
        glottalLifeOscillator,
        breathSource
        );

        choirProcessingNodes.push(
            singerInput,
            singerOutput,
            singerPan,
            
            vocalOscillatorGain,
            vocalHarmonicGain,
            vocalHarmonicFilter,
            vocalSpectralTilt,
            vocalTractShape,
            vowelResonatorOne,
            vowelResonatorTwo,
            vowelResonatorThree,
            glottalLifeDepth,
            vibratoDepth,
            vocalDriftDepth,
            vocalPulseDepth,
            breathFilter,
            breathGain
        );
    }

    singerConfigurations.forEach(
        (configuration, singerIndex) => {
            createVirtualSinger(
                configuration,
                singerIndex
            );
        }
    );

    choirProcessingNodes.push(
    choirVoiceOut,
    choirHumanAhFusionGain,
    choirPresenceGain,
    choirPresenceFilter,
    choirOrbitPanner
);

    // ========================================
    // Choir lifecycle
    // ========================================

    let choirVoiceCleaned = false;
    let choirVoiceReleased = false;
    let choirCleanupTimer = null;
    let choirVoice = null;

    function removeChoirVoiceReference() {
        const voiceIndex =
            activeChoirNodes.indexOf(choirVoice);

        if (voiceIndex !== -1) {
            activeChoirNodes.splice(
                voiceIndex,
                1
            );
        }
    }

    function stopChoirSources(stopTime) {
    choirSources.forEach((sourceNode) => {
        try {
            sourceNode.stop(stopTime);
        } catch (error) {
            // Source may already have a stop time.
        }
    });
}
    function cleanupChoirVoice() {
        if (choirVoiceCleaned) return;

        choirVoiceCleaned = true;

        if (choirCleanupTimer !== null) {
            clearTimeout(choirCleanupTimer);
            choirCleanupTimer = null;
        }

        choirSources.forEach((sourceNode) => {
            try {
                sourceNode.disconnect();
            } catch (error) {
                // Source was already disconnected.
            }
        });

        choirProcessingNodes.forEach(
            (processingNode) => {
                try {
                    processingNode.disconnect();
                } catch (error) {
                    // Node was already disconnected.
                }
            }
        );

        removeChoirVoiceReference();
    }

    function releaseChoirVoice() {
        
        if (
            choirVoiceCleaned ||
            choirVoiceReleased
        ) {
            return;
        }

        choirVoiceReleased = true;

if (choirVoice) {
    choirVoice.released = true;
}
        

        
        const releaseNow = ctx.currentTime;

const releaseDuration = Math.min(
    8.0,
    Math.max(
        0.8,
        getValue(releaseSlider, 3.8)
    )
);

setTimeout(
    () => {
        choirSampleLoopActive = false;

        if (choirSampleLoopTimer !== null) {
            clearTimeout(
                choirSampleLoopTimer
            );

            choirSampleLoopTimer = null;
        }
    },
    Math.max(
        0,
        (releaseDuration - 0.15) * 1000
    )
);
        
if (
    typeof choirVoiceOut.gain.cancelAndHoldAtTime ===
    "function"
) {
    choirVoiceOut.gain.cancelAndHoldAtTime(
        releaseNow
    );
} else {
    choirVoiceOut.gain.cancelScheduledValues(
        releaseNow
    );

    choirVoiceOut.gain.setValueAtTime(
        Math.max(
            0.0001,
            choirVoiceOut.gain.value
        ),
        releaseNow
    );
}

choirVoiceOut.gain.linearRampToValueAtTime(
    0.0001,
    releaseNow + releaseDuration
);


        
        stopChoirSources(
            releaseNow + releaseDuration + 0.08
        );

        choirCleanupTimer = setTimeout(
            cleanupChoirVoice,
            (releaseDuration + 0.16) * 1000
        );
    }

    function stealChoirVoice() {
        
        if (choirVoiceCleaned) return;

        choirVoiceReleased = true;

if (choirVoice) {
    choirVoice.released = true;
}
        
choirSampleLoopActive = false;

if (choirSampleLoopTimer !== null) {
    clearTimeout(
        choirSampleLoopTimer
    );

    choirSampleLoopTimer = null;
}
        
        const stealNow = ctx.currentTime;
        const fadeDuration = 0.07;

        choirVoiceOut.gain.cancelScheduledValues(
            stealNow
        );

        choirVoiceOut.gain.setValueAtTime(
            Math.max(
                0.0001,
                choirVoiceOut.gain.value
            ),
            stealNow
        );

        choirVoiceOut.gain.exponentialRampToValueAtTime(
            0.0001,
            stealNow + fadeDuration
        );

activeChoirSampleSegments.forEach(
    (segment) => {
        try {
            segment.gain.gain.cancelScheduledValues(
                stealNow
            );

            segment.gain.gain.setValueAtTime(
                Math.max(
                    0.0001,
                    segment.gain.gain.value
                ),
                stealNow
            );

            segment.gain.gain.exponentialRampToValueAtTime(
                0.0001,
                stealNow + 0.07
            );

            segment.source.stop(
                stealNow + 0.09
            );
        } catch (error) {
            // Segment may already be finished.
        }
    }
);
        
        stopChoirSources(
            stealNow + fadeDuration + 0.04
        );

        choirCleanupTimer = setTimeout(
            cleanupChoirVoice,
            150
        );
    }

    choirVoice = {
    frequency,
    released: false,
    humanAhFusionGain: choirHumanAhFusionGain,
    presenceGain: choirPresenceGain,
    presenceFilter: choirPresenceFilter,
    orbitGain: choirOrbitGain,
    textureGain: choirTextureGain,
    textureType: choirTextureType,
    textureCrossfadeGain: choirTextureCrossfadeGain,
    textureSource: choirTextureSource,
    textureFilter: choirTextureFilter,
    textureSources: choirSources,
    textureProcessingNodes: choirProcessingNodes,
    release: releaseChoirVoice,
    steal: stealChoirVoice,
    cleanup: cleanupChoirVoice
};

    activeChoirNodes.push(choirVoice);

startChoirWaveFusionModulation();

return choirVoice;
}


// ========================================
// Piano Engine
// ========================================


function createPianoNote(frequency) {
    const ctx = getAudioContext();
  const now = ctx.currentTime;

  const noteVariation = (Math.random() - 0.5) * 0.004;  

const pitchDrift = (Math.random() - 0.5) * 0.8;

const repeatedVoice = activePianoNodes.find(
    (voice) =>
        Math.abs(voice.frequency - frequency) < 0.01 &&
        !voice.cleaned
);

if (repeatedVoice?.steal) {
    repeatedVoice.steal();
}
    
if (activePianoNodes.length >= MAX_PIANO_VOICES) {
    const oldVoice = activePianoNodes.shift();

    if (oldVoice?.steal) {
        oldVoice.steal();
    }
}
const originSettings = getOriginSettings(
    originSelect ? originSelect.value : "pure"
);
    
const presence =
    getValue(presenceSlider, 0) / 100;

const hammerVariation =
    0.92 + Math.random() * 0.16;
    
const normalizedRange =
    Math.min(1, Math.max(0, (frequency - 80) / 1800));
    
const lowRange = 1 - normalizedRange;
const highRange = normalizedRange;
    
pianoVoicing.stringWarmth =
    1.0 + (presence * 0.35) + (lowRange * 0.18);

pianoVoicing.bodyDepth =
    1.0 + (presence * 0.25) + (lowRange * 0.22);

pianoVoicing.soundboardBloom =
    pianoPresetSoundboardBloom *
    (
        1.0 +
        (presence * 0.35) +
        (lowRange * 0.15)
    );

pianoVoicing.cabinetSize =
    1.0 + (presence * 0.20) + (lowRange * 0.18);

pianoVoicing.duplexShimmer =
    1.0 + (presence * 0.20) + (highRange * 0.28);
    
console.log("NEW CLEAN PIANO CORE ACTIVE");
    
  const voiceOut = ctx.createGain();

const pianoPan = ctx.createStereoPanner();

pianoPan.pan.setValueAtTime(
    (normalizedRange * 1.2) - 0.6,
    now
);

const pianoOrbitLFO = ctx.createOscillator();
const pianoOrbitDepth = ctx.createGain();

pianoOrbitLFO.type = "sine";

pianoOrbitLFO.frequency.setValueAtTime(
    0.035,
    now
);

pianoOrbitDepth.gain.setValueAtTime(
    deepDreamOrbitCheckbox?.checked
        ? 0.16 + (presence * 0.08)
        : 0,
    now
);

pianoOrbitLFO.connect(pianoOrbitDepth);
pianoOrbitDepth.connect(pianoPan.pan);
    
  const basePianoAttack =
    Math.min(
        0.04,
        Math.max(
            0.004,
            getValue(attackSlider, 0.01) * 0.5
        )
    );

const lowNoteAttackProtection =
    frequency < 110
        ? 0.012
        : frequency < 220
            ? 0.008
            : 0;

const pianoAttack =
    Math.max(
        basePianoAttack,
        lowNoteAttackProtection
    );

const pianoDecay =
    Math.min(4.0, Math.max(0.8, getValue(decaySlider, 1.8)));

const pianoSustain =
    Math.min(0.45, Math.max(0.03, getValue(sustainSlider, 0.25)));

const pianoRelease =
    Math.min(5.0, Math.max(1.2, getValue(releaseSlider, 2.8)));

const pianoPeak =
    0.30 + (presence * 0.075);
const pianoTailEnd =
    now + pianoAttack + pianoDecay + pianoRelease;

voiceOut.gain.setValueAtTime(0.0001, now);

voiceOut.gain.linearRampToValueAtTime(
    pianoPeak,
    now + pianoAttack
);

voiceOut.gain.exponentialRampToValueAtTime(
    Math.max(0.001, pianoPeak * pianoSustain),
    now + pianoAttack + pianoDecay
);

voiceOut.gain.exponentialRampToValueAtTime(
    0.001,
    pianoTailEnd
);

const stringA = ctx.createOscillator();
const stringB = ctx.createOscillator();

const hammer = ctx.createOscillator();
    
const boundResonanceA = ctx.createOscillator();
const boundResonanceB = ctx.createOscillator();

const boundResonanceGainA = ctx.createGain();
const boundResonanceGainB = ctx.createGain();

const boundResonanceMorphGainA = ctx.createGain();
const boundResonanceMorphGainB = ctx.createGain();
    
const boundResonanceFilterA = ctx.createBiquadFilter();
const boundResonanceFilterB = ctx.createBiquadFilter();
    
const hammerGain = ctx.createGain();
const hammerFilter = ctx.createBiquadFilter();

const stringAGain = ctx.createGain();
const stringBGain = ctx.createGain();

const sympatheticGain = ctx.createGain();
const sympatheticFilter = ctx.createBiquadFilter();

const pianoTextureSource = ctx.createBufferSource();
const pianoTextureGain = ctx.createGain();
const pianoTextureFilter = ctx.createBiquadFilter();

const pianoTextureType =
    noiseTypeSelect?.value || "white";

const pianoTextureAmount =
    getValue(noiseAmountSlider, 0) / 100;

pianoTextureSource.buffer =
    createNoiseBuffer(ctx, pianoTextureType);

pianoTextureSource.loop = true;

pianoTextureFilter.type = "lowpass";

const pianoTextureCutoffs = {
    white: 4800,
    air: 6200,
    dust: 5600,
    dark: 2400,
    cosmic: 3800,
    machine: 4600
};

const pianoTextureCutoff =
    pianoTextureCutoffs[pianoTextureType] || 4800;

pianoTextureFilter.frequency.setValueAtTime(
    200,
    now
);

pianoTextureFilter.frequency.setTargetAtTime(
    pianoTextureCutoff + (presence * 1200),
    now,
    0.03
);

pianoTextureFilter.Q.setValueAtTime(
    0.6,
    now
);

const pianoTextureLevelBoosts = {
    white: 1.0,
    air: 1.0,
    dust: 1.0,
    dark: 1.15,
    cosmic: 2.4,
    machine: 2.1
};

const pianoTextureLevelBoost =
    pianoTextureLevelBoosts[pianoTextureType] || 1.0;

const pianoTextureLevel =
    pianoTextureAmount *
    0.045 *
    pianoTextureLevelBoost *
    (1.0 + presence * 0.5);

pianoTextureGain.gain.cancelScheduledValues(now);

pianoTextureGain.gain.setValueAtTime(
    0.0001,
    now
);

pianoTextureGain.gain.setTargetAtTime(
    Math.max(0.0001, pianoTextureLevel),
    now,
    0.04
);

pianoTextureGain.gain.exponentialRampToValueAtTime(
    0.001,
    pianoTailEnd
);
    
stringA.type = "sine";
stringB.type = "sine";

    
applyWaveform(
    boundResonanceA,
    waveformSelect?.value || "sine",
    ctx
);

applyWaveform(
    boundResonanceB,
    waveformBSelect?.value || "triangle",
    ctx
);

boundResonanceA.frequency.setValueAtTime(
    frequency,
    now
);

boundResonanceB.frequency.setValueAtTime(
    frequency,
    now
);

boundResonanceFilterA.type = "lowpass";
boundResonanceFilterB.type = "lowpass";

const boundOriginCutoff =
    Math.max(
        700,
        Math.min(
            8000,
            4000 + originSettings.filterShift
        )
    );

const boundOriginResonance =
    Math.max(
        0.3,
        1.5 + originSettings.resonanceBoost
    );

boundResonanceFilterA.frequency.setValueAtTime(
    boundOriginCutoff,
    now
);

boundResonanceFilterB.frequency.setValueAtTime(
    boundOriginCutoff,
    now
);

boundResonanceFilterA.Q.setValueAtTime(
    boundOriginResonance,
    now
);

boundResonanceFilterB.Q.setValueAtTime(
    boundOriginResonance,
    now
);

boundResonanceGainA.gain.setValueAtTime(
    0.0001,
    now
);

boundResonanceGainB.gain.setValueAtTime(
    0.0001,
    now
);

const rawWaveFusion =
    getValue(waveFusionSlider, 50) / 100;

const fusionCurve =
    waveFusionCurveSelect
        ? waveFusionCurveSelect.value
        : "smooth";

const shapedWaveFusion =
    shapeWaveFusion(rawWaveFusion, fusionCurve);

const boundPresenceBoost =
    1.0 + (presence * 0.75);

const boundGainA =
    0.20 *
    boundPresenceBoost *
    Math.cos(
        shapedWaveFusion * Math.PI * 0.5
    );

const boundGainB =
    0.20 *
    boundPresenceBoost *
    Math.sin(
        shapedWaveFusion * Math.PI * 0.5
    );

boundResonanceGainA.gain.linearRampToValueAtTime(
    1.0,
    now + 0.08
);

boundResonanceGainB.gain.linearRampToValueAtTime(
    1.0,
    now + 0.08
);

boundResonanceMorphGainA.gain.setValueAtTime(
    Math.max(0.0001, boundGainA),
    now
);

boundResonanceMorphGainB.gain.setValueAtTime(
    Math.max(0.0001, boundGainB),
    now
);
    
boundResonanceGainA.gain.exponentialRampToValueAtTime(
    0.001,
    pianoTailEnd
);

boundResonanceGainB.gain.exponentialRampToValueAtTime(
    0.001,
    pianoTailEnd
);
    
const notePosition =
    Math.min(1, Math.max(0, (frequency - 80) / 1200));

const lowWeight =
    1 - notePosition;

const detuneAmount =
    0.0007 + (lowWeight * 0.0014);

hammer.type = "sine";

const hammerRatio =
    2.7 + (notePosition * 0.7);

hammer.frequency.setValueAtTime(
    frequency * hammerRatio,
    now
);

hammerFilter.type = "highpass";
hammerFilter.frequency.setValueAtTime(1800, now);
hammerFilter.Q.setValueAtTime(0.35, now);

sympatheticFilter.type = "bandpass";

sympatheticFilter.frequency.setValueAtTime(
    frequency * 2.0,
    now
);

sympatheticFilter.Q.setValueAtTime(1.2, now);

sympatheticGain.gain.setValueAtTime(
    0.004 * pianoVoicing.sympatheticAmount,
    now
);

sympatheticGain.gain.exponentialRampToValueAtTime(
    0.001,
    now + 2.8
);
    
hammerGain.gain.setValueAtTime(0.0001, now);
hammerGain.gain.linearRampToValueAtTime(
    0.012 * hammerVariation,
    now + 0.006
);
hammerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

stringA.frequency.setValueAtTime(
    frequency * (1 - detuneAmount + noteVariation),
    now
);

stringA.detune.setValueAtTime(
    pitchDrift,
    now
);

const inharmonicity =
    1.002 + (notePosition * 0.006);

stringB.frequency.setValueAtTime(
    (frequency * 2.0 * inharmonicity) * (1 + detuneAmount - noteVariation),
    now
);

stringB.detune.setValueAtTime(
    -pitchDrift * 0.6,
    now
);
    
  const stringFundamental =
    0.68 - (notePosition * 0.12);

const stringHarmonic =
    0.09 + (notePosition * 0.08);

stringAGain.gain.setValueAtTime(
    stringFundamental,
    now
);

stringBGain.gain.setValueAtTime(
    stringHarmonic,
    now
);

  const pianoFilter = ctx.createBiquadFilter();
  pianoFilter.type = "lowpass";
  const pianoPresenceCutoff =
  Math.min(
    7200,
    Math.max(
      900,
      4200 +
      originSettings.filterShift +
      (presence * 2200)
    )
  );

pianoFilter.frequency.setValueAtTime(
  Math.max(900, pianoPresenceCutoff * 0.72),
  now
);

pianoFilter.frequency.exponentialRampToValueAtTime(
  pianoPresenceCutoff,
  now + 0.018
);

pianoFilter.Q.setValueAtTime(
    Math.max(0.2, 0.45 + originSettings.resonanceBoost * 0.25),
    now
);
  stringA.connect(stringAGain);
  stringB.connect(stringBGain);

  stringAGain.connect(pianoFilter);
  stringBGain.connect(pianoFilter);

boundResonanceA.connect(boundResonanceFilterA);
boundResonanceFilterA.connect(boundResonanceGainA);
boundResonanceGainA.connect(boundResonanceMorphGainA);
boundResonanceMorphGainA.connect(voiceOut);

boundResonanceB.connect(boundResonanceFilterB);
boundResonanceFilterB.connect(boundResonanceGainB);
boundResonanceGainB.connect(boundResonanceMorphGainB);
boundResonanceMorphGainB.connect(voiceOut);
    
stringAGain.connect(sympatheticFilter);
stringBGain.connect(sympatheticFilter);
sympatheticFilter.connect(sympatheticGain);
sympatheticGain.connect(voiceOut);
    
hammer.connect(hammerFilter);
hammerFilter.connect(hammerGain);
hammerGain.connect(pianoFilter);

pianoTextureSource.connect(pianoTextureFilter);
pianoTextureFilter.connect(pianoTextureGain);
pianoTextureGain.connect(voiceOut);
    
  // Piano signal now blooms through soundboardBloom before voiceOut.

const soundboardBloom = ctx.createGain();

soundboardBloom.gain.setValueAtTime(
    0.0001,
    now
);

soundboardBloom.gain.linearRampToValueAtTime(
  0.035 *
  pianoVoicing.soundboardBloom *
  (1 - presence * 0.18),
  now + 0.018
);
soundboardBloom.gain.exponentialRampToValueAtTime(
    0.001,
    now + 2.8
);

pianoFilter.connect(voiceOut);

pianoFilter.connect(soundboardBloom);
soundboardBloom.connect(voiceOut);
    
voiceOut.connect(pianoPan);

  pianoPan.connect(dryGain);
  pianoPan.connect(reverbNode);
  pianoPan.connect(delayDryGain);
  pianoPan.connect(delayNode);
 
stringA.start(now + 0.0018);
stringB.start(now + 0.0035);

boundResonanceA.start(now + 0.004);
boundResonanceB.start(now + 0.004);

pianoTextureSource.start(now + 0.005);
    
pianoOrbitLFO.start(now);
    
hammer.start(now + 0.001);
    
stringA.stop(pianoTailEnd + 0.1);
stringB.stop(pianoTailEnd + 0.1);
boundResonanceA.stop(pianoTailEnd + 0.1);
boundResonanceB.stop(pianoTailEnd + 0.1);

pianoTextureSource.stop(pianoTailEnd + 0.1);
    
pianoOrbitLFO.stop(pianoTailEnd + 0.1);

hammer.stop(now + 0.09);
    
  let pianoVoiceCleaned = false;
let pianoVoiceStopRequested = false;
let pianoVoiceCleanupTimer = null;

const pianoOscillators = [
    stringA,
    stringB,
    boundResonanceA,
    boundResonanceB,
    pianoTextureSource,
    pianoOrbitLFO,
    hammer
];

const pianoProcessingNodes = [
    hammerGain,
    hammerFilter,

    stringAGain,
    stringBGain,
    pianoFilter,

    sympatheticGain,
    sympatheticFilter,

    boundResonanceGainA,
    boundResonanceGainB,

    boundResonanceMorphGainA,
    boundResonanceMorphGainB,

    boundResonanceFilterA,
    boundResonanceFilterB,

    pianoTextureGain,
    pianoTextureFilter,

    pianoOrbitDepth,
    pianoPan,

    soundboardBloom,
    voiceOut
];

let pianoVoice = null;

function removePianoVoiceReference() {
    const voiceIndex =
        activePianoNodes.indexOf(pianoVoice);

    if (voiceIndex !== -1) {
        activePianoNodes.splice(voiceIndex, 1);
    }

    if (
        activePianoNodes.length === 0 &&
        pianoWaveFusionModulationTimer !== null
    ) {
        clearInterval(
            pianoWaveFusionModulationTimer
        );

        pianoWaveFusionModulationTimer = null;
    }
}

function cleanupPianoVoice() {
    if (pianoVoiceCleaned) return;

    pianoVoiceCleaned = true;

if (pianoVoice) {
    pianoVoice.cleaned = true;
}
   
    if (pianoVoiceCleanupTimer !== null) {
        clearTimeout(pianoVoiceCleanupTimer);
        pianoVoiceCleanupTimer = null;
    }

    pianoOscillators.forEach((node) => {
        if (!node) return;

        try {
            node.onended = null;
            node.disconnect();
        } catch (error) {
            // Node was already disconnected.
        }
    });

    pianoProcessingNodes.forEach((node) => {
        if (!node) return;

        try {
            node.disconnect();
        } catch (error) {
            // Node was already disconnected.
        }
    });

    removePianoVoiceReference();
}

function stealPianoVoice() {
    if (
        pianoVoiceCleaned ||
        pianoVoiceStopRequested
    ) {
        return;
    }

    pianoVoiceStopRequested = true;

    const stealNow = ctx.currentTime;
    const fadeDuration =
    frequency < 110
        ? 0.085
        : frequency < 220
            ? 0.06
            : 0.04;
    
    const stopTime =
    stealNow + fadeDuration + 0.025;

    voiceOut.gain.cancelScheduledValues(
        stealNow
    );

    voiceOut.gain.setValueAtTime(
        Math.max(
            0.0001,
            voiceOut.gain.value
        ),
        stealNow
    );

    voiceOut.gain.exponentialRampToValueAtTime(
        0.0001,
        stealNow + fadeDuration
    );

    pianoTextureGain.gain.cancelScheduledValues(
        stealNow
    );

    pianoTextureGain.gain.setTargetAtTime(
        0.0001,
        stealNow,
        0.012
    );

    pianoOscillators.forEach((node) => {
        if (!node?.stop) return;

        try {
            node.stop(stopTime);
        } catch (error) {
            // Source may already have a stop time.
        }
    });

    pianoVoiceCleanupTimer = setTimeout(
        cleanupPianoVoice,
        (fadeDuration + 0.08) * 1000
    );
}

pianoVoice = {
    frequency,
    cleaned: false,

    boundResonanceMorphGainA,
    boundResonanceMorphGainB,
    
    oscillators: pianoOscillators,
    nodes: pianoProcessingNodes,

    steal: stealPianoVoice,
    cleanup: cleanupPianoVoice
};

activePianoNodes.push(pianoVoice);

const naturalCleanupDelay =
    Math.max(
        0,
        pianoTailEnd -
        ctx.currentTime +
        0.25
    ) * 1000;

pianoVoiceCleanupTimer = setTimeout(
    cleanupPianoVoice,
    naturalCleanupDelay
);

startPianoWaveFusionModulation();
}

function applyPresetSettings(preset) {
    if (!preset) return;
    dbReleaseAllBindings();

    // Preset changes must reset arpeggiator state, never carry over latched
    // notes or a running timer into another sound. Switching presets stays silent.
    stopDreamArp();
    arpHeldNotes.clear();
    arpPlayedOrder = [];
    clearKeyHighlights();
    dreamArpEnabled = preset.arpEnabled === true;
    arpLatchEnabled = preset.arpLatch === true;
    arpRate = Math.max(1, Math.min(4, Number(preset.arpRate ?? 2) || 2));
    arpMode = ["up", "down", "updown", "random", "asPlayed"].includes(preset.arpMode) ? preset.arpMode : "up";
    arpGate = Math.max(0.1, Math.min(1, Number(preset.arpGate ?? .7)));
    arpTempo = Math.max(40, Math.min(220, Number(preset.arpTempo ?? 100)));
    if (dreamArpEnabledCheckbox) dreamArpEnabledCheckbox.checked = dreamArpEnabled;
    if (arpLatchCheckbox) arpLatchCheckbox.checked = arpLatchEnabled;
    if (arpRateSlider) arpRateSlider.value = arpRate;
    if (arpGateSlider) arpGateSlider.value = Math.round(arpGate * 100);
    if (arpModeSelect) arpModeSelect.value = arpMode;
    if (arpTempoSlider) arpTempoSlider.value = arpTempo;
    if (arpRateValue) arpRateValue.textContent = arpRateLabels[arpRate];
    if (arpGateValue) arpGateValue.textContent = `${Math.round(arpGate * 100)}%`;
    if (arpTempoValue) arpTempoValue.textContent = `${Math.round(arpTempo)} BPM`;

    // Legacy factory/user presets are neutral by default. Explicit new
    // resonant-field values are remembered in newly saved user presets.
    if (beatTrackingMode) beatTrackingMode.value = preset.beatTrackingMode ?? "natural";
    if (beatRateSlider) beatRateSlider.value = preset.beatRate ?? 0.5;
    if (beatTempoSlider) beatTempoSlider.value = preset.beatTempo ?? 120;
    if (beatDivisionSelect) beatDivisionSelect.value = preset.beatDivision ?? 1;
    refreshBeatTrackingUI();
    updateActiveSynthOscBDetune();
    updateActiveSynthVoiceSpread();
    currentCoherence = clampResonantValue(preset.coherence ?? 0);
    currentDecoherence = clampResonantValue(preset.decoherence ?? 0);
    if (coherenceSlider) coherenceSlider.value = currentCoherence;
    if (decoherenceSlider) decoherenceSlider.value = currentDecoherence;
    updateResonantFieldDisplay();
    updateActiveResonantFields();

    // Polynomial Rings / Krull Dimension: legacy factory and user presets
    // always reset to a strict bypass, protecting approved sound design.
    setPolynomialRingState({
        enabled: preset.polynomialRingEnabled === true,
        amount: preset.polynomialRingAmount ?? 35,
        degree: preset.polynomialRingDegree ?? 3,
        character: preset.polynomialRingCharacter ?? "hybrid",
        dimension: preset.krullDimension ?? 1
    });

// Dream Binder — Preset FM Resonance
currentFmAmount = Number(preset.fmAmount ?? 0);

// Dream Binder — FM Amount Interface Synchronization
const fmAmountSlider = document.getElementById("fmAmount");
const fmAmountDisplay = document.getElementById("fmAmountValue");

if (fmAmountSlider) {
    fmAmountSlider.value = currentFmAmount;
}

if (fmAmountDisplay) {
    fmAmountDisplay.textContent = `${currentFmAmount}%`;
}
    
// Dream Binder — Preset FM Ratio
currentFmRatio = Number(preset.fmRatio ?? 3.5);

// ========================================
// DREAM BINDER — FM RATIO PRESET SYNC
// ========================================

const fmRatioSlider = document.getElementById("fmRatio");
const fmRatioDisplay = document.getElementById("fmRatioValue");

if (fmRatioSlider) {
    fmRatioSlider.value = currentFmRatio;
}

if (fmRatioDisplay) {
    fmRatioDisplay.textContent = currentFmRatio.toFixed(1);
}
    
// Dream Binder — Preset FM Attack
currentFmAttack = Number(preset.fmAttack ?? 0.01);

// ========================================
// DREAM BINDER — FM ATTACK PRESET SYNC
// ========================================

const fmAttackSlider = document.getElementById("fmAttack");
const fmAttackDisplay = document.getElementById("fmAttackValue");

if (fmAttackSlider) {
    fmAttackSlider.value = currentFmAttack;
}

if (fmAttackDisplay) {
    fmAttackDisplay.textContent = `${currentFmAttack.toFixed(2)} s`;
}
    
// Dream Binder — Preset FM Decay
currentFmDecay = Number(preset.fmDecay ?? 0.8);

// ========================================
// DREAM BINDER — FM DECAY PRESET SYNC
// ========================================

const fmDecaySlider = document.getElementById("fmDecay");
const fmDecayDisplay = document.getElementById("fmDecayValue");

if (fmDecaySlider) {
    fmDecaySlider.value = currentFmDecay;
}

if (fmDecayDisplay) {
    fmDecayDisplay.textContent = `${currentFmDecay.toFixed(2)} s`;
}
    
// Dream Binder — Preset FM Sustain
currentFmSustain = Number(preset.fmSustain ?? 0.0);

// ========================================
// DREAM BINDER — FM SUSTAIN PRESET SYNC
// ========================================

const fmSustainSlider = document.getElementById("fmSustain");
const fmSustainDisplay = document.getElementById("fmSustainValue");

if (fmSustainSlider) {
    fmSustainSlider.value = currentFmSustain;
}

if (fmSustainDisplay) {
    fmSustainDisplay.textContent = `${Math.round(currentFmSustain * 100)}%`;
}
    
// Dream Binder — Preset FM Release
currentFmRelease = Number(preset.fmRelease ?? 0.3);

// ========================================
// DREAM BINDER — FM RELEASE PRESET SYNC
// ========================================

const fmReleaseSlider = document.getElementById("fmRelease");
const fmReleaseDisplay = document.getElementById("fmReleaseValue");

if (fmReleaseSlider) {
    fmReleaseSlider.value = currentFmRelease;
}

if (fmReleaseDisplay) {
    fmReleaseDisplay.textContent = `${currentFmRelease.toFixed(2)} s`;
}
    
    toyPianoKeyClickEnabled =
        preset.mechanicalKeyClick === true;

    // Preset-specific mechanical key-down character
    toyPianoKeyDownGain =
        preset.mechanicalKeyDownGain ?? 0.35;

    toyPianoKeyDownFrequency =
        preset.mechanicalKeyDownFrequency ?? 950;
    
    currentResonanceSource =
        preset.engine || "synth";

    currentEngine =
        currentResonanceSource; // temporary compatibility bridge

    function setControl(control, value) {
        if (
            control &&
            value !== undefined &&
            value !== null
        ) {
            control.value = value;
        }
    }

    function setCheckbox(control, value) {
        if (
            control &&
            value !== undefined &&
            value !== null
        ) {
            control.checked = Boolean(value);
        }
    }

    // ========================================
    // Shared controls
    // These can be used by synth and piano
    // ========================================

    setControl(
        attackSlider,
        preset.attack
    );

    setControl(
        decaySlider,
        preset.decay
    );

    setControl(
        sustainSlider,
        preset.sustain
    );

    setControl(
        releaseSlider,
        preset.release
    );

    setControl(
        originSelect,
        preset.origin
    );

    setControl(
        presenceSlider,
        preset.presence
    );

    setControl(
        waveFusionSlider,
        preset.waveFusion
    );

    setControl(
        waveFusionCurveSelect,
        preset.waveFusionCurve
    );

    setCheckbox(
        dreamMorphMotionCheckbox,
        preset.dreamMorphMotion
    );

    setControl(
        noiseTypeSelect,
        preset.noiseType
    );

    setControl(
        noiseAmountSlider,
        preset.noiseAmount
    );

    setControl(
        driftSlider,
        preset.drift
    );

    setControl(
        stereoWidthSlider,
        preset.stereoWidth
    );

    setCheckbox(
        deepDreamOrbitCheckbox,
        preset.deepDreamOrbit
    );

    setControl(
        reverbMixSlider,
        preset.reverbMix
    );

    setControl(
        reverbDecaySlider,
        preset.reverbDecay
    );

    setControl(
        delayMixSlider,
        preset.delayMix
    );

    setControl(
        delayTimeSlider,
        preset.delayTime
    );

    setControl(
        delayFeedbackSlider,
        preset.delayFeedback
    );

    setControl(
        masterVolume,
        preset.masterVolume
    );

    // ========================================
    // Piano-specific controls
    // ========================================

    if (currentResonanceSource === "piano") {
        pianoPresetSoundboardBloom =
            preset.soundboardBloom ?? 1.0;
    }

    // ========================================
    // Synth-specific controls
    // ========================================

    if (currentResonanceSource === "synth") {
        setControl(
            waveformSelect,
            preset.waveform
        );

        setControl(
            waveformBSelect,
            preset.waveformB
        );

        setControl(
            oscBLevelSlider,
            preset.oscBLevel
        );

        setControl(
            oscBDetuneSlider,
            preset.oscBDetune
        );

        setControl(
            subWaveformSelect,
            preset.subWaveform
        );

        setControl(
            subLevelSlider,
            preset.subLevel
        );

        setControl(
            filterTypeSelect,
            preset.filterType
        );

        setControl(
            cutoffSlider,
            preset.cutoff
        );

        setControl(
            resonanceSlider,
            preset.resonance
        );

        setControl(
            lfoRateSlider,
            preset.lfoRate
        );

        setControl(
            lfoAmountSlider,
            preset.lfoAmount
        );

        setControl(
            lfoDestinationSelect,
            preset.lfoDestination
        );

        setControl(
            voiceSpreadSlider,
            preset.voiceSpread
        );

        setControl(
            glideTimeSlider,
            preset.glideTime
        );

        setCheckbox(
            glideEnabledCheckbox,
            preset.glideEnabled
        );
    }

    // ========================================
    // Apply shared effects to active audio nodes
    // Programmatically changing slider.value does
    // not trigger the slider input listeners.
    // ========================================

    if (audioContext) {
        const now = audioContext.currentTime;

        if (
            masterGain &&
            preset.masterVolume !== undefined
        ) {
            masterGain.gain.setTargetAtTime(
                Number(masterVolume.value),
                now,
                0.01
            );
        }

        if (
            dryGain &&
            reverbWetGain &&
            preset.reverbMix !== undefined
        ) {
            const reverbMix =
                Number(reverbMixSlider.value);

            dryGain.gain.setTargetAtTime(
                1 - reverbMix,
                now,
                0.01
            );

            reverbWetGain.gain.setTargetAtTime(
                reverbMix,
                now,
                0.01
            );
        }

        if (
            reverbNode &&
            preset.reverbDecay !== undefined
        ) {
            reverbNode.buffer =
                createReverbImpulse(
                    audioContext,
                    Number(reverbDecaySlider.value)
                );
        }

        if (
            delayDryGain &&
            delayWetGain &&
            preset.delayMix !== undefined
        ) {
            const delayMix =
                Number(delayMixSlider.value);

            delayDryGain.gain.setTargetAtTime(
                1 - delayMix,
                now,
                0.01
            );

            delayWetGain.gain.setTargetAtTime(
                delayMix,
                now,
                0.01
            );
        }

        if (
            delayNode &&
            preset.delayTime !== undefined
        ) {
            delayNode.delayTime.setTargetAtTime(
                Number(delayTimeSlider.value),
                now,
                0.01
            );
        }

        if (
            delayFeedbackGain &&
            preset.delayFeedback !== undefined
        ) {
            delayFeedbackGain.gain.setTargetAtTime(
                Number(delayFeedbackSlider.value),
                now,
                0.01
            );
        }
    }

    updateValueDisplays();
    stopAllNotes();
    stopActivePianoNodes();
    stopActiveChoirNodes();
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
  // Snapshot the sound rather than only the legacy envelope/filter parameters.
  // Numeric values are serializable to JSON; checked boxes retain booleans.
  const get = (element, fallback = 0) => element ? Number(element.value) : fallback;
  return {
    engine: currentResonanceSource,
    mechanicalKeyClick: toyPianoKeyClickEnabled,
    mechanicalKeyDownGain: toyPianoKeyDownGain,
    mechanicalKeyDownFrequency: toyPianoKeyDownFrequency,
    soundboardBloom: pianoPresetSoundboardBloom,
    waveform: waveformSelect?.value ?? "sine",
    waveformB: waveformBSelect?.value ?? "sawtooth",
    origin: originSelect?.value ?? "pure",
    waveFusion: get(waveFusionSlider, 50),
    waveFusionCurve: waveFusionCurveSelect?.value ?? "smooth",
    dreamMorphMotion: Boolean(dreamMorphMotionCheckbox?.checked),
    subWaveform: subWaveformSelect?.value ?? "sine",
    subLevel: get(subLevelSlider),
    oscBLevel: get(oscBLevelSlider, 0.35),
    oscBDetune: get(oscBDetuneSlider, 7),
    voiceSpread: get(voiceSpreadSlider),
    beatTrackingMode: beatTrackingMode?.value ?? "natural",
    beatRate: get(beatRateSlider, 0.5),
    beatTempo: get(beatTempoSlider, 120),
    beatDivision: get(beatDivisionSelect, 1),
    fmAmount: currentFmAmount,
    fmRatio: currentFmRatio,
    fmAttack: currentFmAttack,
    fmDecay: currentFmDecay,
    fmSustain: currentFmSustain,
    fmRelease: currentFmRelease,
    coherence: currentCoherence,
    decoherence: currentDecoherence,    polynomialRingEnabled: polynomialRingState.enabled,
    polynomialRingAmount: polynomialRingState.amount,
    polynomialRingDegree: polynomialRingState.degree,
    polynomialRingCharacter: polynomialRingState.character,
    krullDimension: polynomialRingState.dimension,

    attack: get(attackSlider, 0.05),
    decay: get(decaySlider, 0.2),
    sustain: get(sustainSlider, 0.7),
    release: get(releaseSlider, 0.5),
    filterType: filterTypeSelect?.value ?? "lowpass",
    cutoff: get(cutoffSlider, 4000),
    resonance: get(resonanceSlider, 1),
    lfoRate: get(lfoRateSlider, 2),
    lfoAmount: get(lfoAmountSlider),
    lfoDestination: lfoDestinationSelect?.value ?? "filter",
    noiseType: noiseTypeSelect?.value ?? "white",
    noiseAmount: get(noiseAmountSlider),
    drift: get(driftSlider),
    stereoWidth: get(stereoWidthSlider),
    deepDreamOrbit: Boolean(deepDreamOrbitCheckbox?.checked),
    glideEnabled: Boolean(glideEnabledCheckbox?.checked),
    glideTime: get(glideTimeSlider, 0.12),
    reverbMix: get(reverbMixSlider, 0.25),
    reverbDecay: get(reverbDecaySlider, 3),
    delayMix: get(delayMixSlider, 0.55),
    delayTime: get(delayTimeSlider, 0.55),
    delayFeedback: get(delayFeedbackSlider, 0.55),
    masterVolume: get(masterVolume, 0.25),
    presence: get(presenceSlider),
    arpEnabled: dreamArpEnabled,
    arpLatch: arpLatchEnabled,
    arpRate: arpRate,
    arpMode: arpMode,
    arpGate: arpGate,
    arpTempo: arpTempo,
    // Performance state (latched keys / held notes) is intentionally not saved.
  };
}

const USER_PRESETS_KEY = "dreamwellNamedPresets"; // Existing key retained: no lost saves.

function getSavedPresets() {
  try {
    const stored = JSON.parse(localStorage.getItem(USER_PRESETS_KEY) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    const result = Object.create(null);
    for (const [name, settings] of Object.entries(stored)) {
      if (name && settings && typeof settings === "object" && !Array.isArray(settings)) {
        result[name] = settings;
      }
    }
    return result;
  } catch (err) {
    showPresetMessage("Saved presets could not be read from this browser.");
    return {};
  }
}

function saveSavedPresets(presets) {
  try {
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
    return true;
  } catch (err) {
    showPresetMessage("Unable to save here. Check browser storage or export your sounds.");
    return false;
  }
}

function validatePresetName(name) {
  const trimmed = String(name ?? "").trim();
  return trimmed.length > 0 && trimmed.length <= 75 &&
    !["__proto__", "constructor", "prototype"].includes(trimmed) ? trimmed : null;
}

saveNamedPresetButton?.addEventListener("click", () => {
  const name = validatePresetName(presetNameInput?.value);
  if (!name) return showPresetMessage("Enter a preset name (up to 75 characters).");
  const presets = getSavedPresets();
  if (Object.hasOwn(presets, name) && !confirm(`Overwrite your saved preset "${name}"?`)) return;
  presets[name] = getCurrentPresetSettings();
  if (!saveSavedPresets(presets)) return;
  selectedUserPresetName = name;
  selectPresetBank("user");
  showPresetMessage(`Saved "${name}" on this device. Export a backup if it's important.`);
});

// User presets can always be loaded from the My Presets tab.
// Keep legacy buttons functional if an older HTML revision contains them.
loadNamedPresetButton?.addEventListener("click", () => {
  const name = savedPresetSelect?.value || selectedUserPresetName;
  const preset = getSavedPresets()[name];
  if (!preset) return showPresetMessage("Choose a saved sound first.");
  applyPresetSettings(preset);
  if (presetNameInput) presetNameInput.value = name;
  showPresetMessage(`Loaded "${name}".`);
});

document.getElementById("renameNamedPreset")?.addEventListener("click", () => {
  if (!selectedUserPresetName) return showPresetMessage("Choose a sound in My Presets to rename.");
  const newName = validatePresetName(presetNameInput?.value);
  if (!newName) return showPresetMessage("Enter a new name (up to 75 characters).");
  if (newName === selectedUserPresetName) return showPresetMessage("Name has not changed.");
  const presets = getSavedPresets();
  if (!Object.hasOwn(presets, selectedUserPresetName)) return showPresetMessage("Saved sound not found.");
  if (Object.hasOwn(presets, newName) && !confirm(`Overwrite the saved sound named "${newName}"?`)) return;
  presets[newName] = presets[selectedUserPresetName];
  delete presets[selectedUserPresetName];
  if (!saveSavedPresets(presets)) return;
  selectedUserPresetName = newName;
  selectPresetBank("user");
  showPresetMessage(`Renamed to "${newName}".`);
});

deleteNamedPresetButton?.addEventListener("click", () => {
  if (!selectedUserPresetName) return showPresetMessage("Choose a sound in My Presets to delete.");
  const name = selectedUserPresetName;
  if (!confirm(`Delete saved sound "${name}"? This cannot be undone.`)) return;
  const presets = getSavedPresets();
  if (!Object.hasOwn(presets, name)) return showPresetMessage("Saved sound not found.");
  delete presets[name];
  if (!saveSavedPresets(presets)) return;
  selectedUserPresetName = null;
  if (presetNameInput) presetNameInput.value = "";
  selectPresetBank("user");
  showPresetMessage(`Deleted "${name}".`);
});

document.getElementById("exportNamedPresets")?.addEventListener("click", () => {
  const data = {format: "dream-binder-user-presets", version: 1, presets: getSavedPresets()};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: "application/json"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Dream_Binder_My_Presets.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  showPresetMessage("Backup download requested. Keep the JSON file somewhere safe.");
});

document.getElementById("importNamedPresets")?.addEventListener("change", async (event) => {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error("File exceeds 1 MB.");
    const contents = JSON.parse(await file.text());
    if (contents?.format !== "dream-binder-user-presets" ||
        contents.version !== 1 || !contents.presets ||
        typeof contents.presets !== "object" || Array.isArray(contents.presets)) {
      throw new Error("Not a Dream Binder preset backup.");
    }
    const imported = Object.entries(contents.presets);
    if (imported.length > 500) throw new Error("Too many presets in this file.");
    const merged = getSavedPresets();
    let count = 0;
    for (const [rawName, settings] of imported) {
      const name = validatePresetName(rawName);
      if (!name || !settings || typeof settings !== "object" || Array.isArray(settings)) continue;
      if (Object.hasOwn(merged, name)) continue; // Keep locally saved sounds intact.
      merged[name] = settings;
      count++;
    }
    if (!saveSavedPresets(merged)) return;
    selectPresetBank("user");
    showPresetMessage(`Imported ${count} new sound${count === 1 ? "" : "s"}. Existing names were kept.`);
  } catch (err) {
    showPresetMessage(`Import failed: ${err.message}`);
  } finally {
    input.value = "";
  }
});

dreamArpEnabledCheckbox.addEventListener("change", () => {
  dreamArpEnabled = dreamArpEnabledCheckbox.checked;
  if (!dreamArpEnabled) {
    stopDreamArp();
    arpHeldNotes.clear();
    arpPlayedOrder = [];
    clearKeyHighlights();
  }
});

arpLatchCheckbox.addEventListener("change", () => {
  arpLatchEnabled = arpLatchCheckbox.checked;

  if (!arpLatchEnabled) {
    const latchedNotes =
      Array.from(arpHeldNotes);

    arpHeldNotes.clear();

    if (dreamArpEnabled) {
      stopDreamArp();
    } else {
      latchedNotes.forEach((noteId) => {
    endInputNote(Number(noteId));
});
    }

    clearKeyHighlights();
  }
});

function refreshPlayingArpClock() {
  if (dreamArpEnabled && arpHeldNotes.size && arpTimer) {
    stopDreamArp();
    startDreamArp();
  }
}
arpRateSlider.addEventListener("input", () => {
  arpRate = Number(arpRateSlider.value);
  arpRateValue.textContent = arpRateLabels[arpRate];
  refreshPlayingArpClock();
});
arpTempoSlider?.addEventListener("input", () => {
  arpTempo = Math.max(40, Math.min(220, Number(arpTempoSlider.value)));
  arpTempoValue.textContent = `${arpTempo} BPM`;
  refreshPlayingArpClock();
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
// Live Synth Waveform Switching
waveformSelect?.addEventListener(
    "change",
    updateActiveSynthWaveforms
);

waveformBSelect?.addEventListener(
    "change",
    updateActiveSynthWaveforms
);

// Live Synth Sub Waveform Selection
subWaveformSelect?.addEventListener(
    "change",
    updateActiveSynthSubWaveform
);

// Live Synth Sub Level Control
subLevelSlider?.addEventListener(
    "input",
    updateActiveSynthSubLevel
);

// Live Synth OSC B Detune
oscBDetuneSlider?.addEventListener(
    "input",
    updateActiveSynthOscBDetune
);

// Live Synth Voice Spread
voiceSpreadSlider?.addEventListener(
    "input",
    updateActiveSynthVoiceSpread
);

// Live Synth LFO Rate
lfoRateSlider?.addEventListener(
    "input",
    updateActiveSynthLFORate
);

// Live Synth LFO Amount
lfoAmountSlider?.addEventListener(
    "input",
    updateActiveSynthLFOAmount
);

// ========================================
// Live Synth LFO Destination Listener
// ========================================

lfoDestinationSelect?.addEventListener(
    "change",
    updateActiveSynthLFODestination
);

renderPresetBank("signature");
updateKeyboardOctave();
updateValueDisplays();


// ========================================
// DREAM BINDER — WEB MIDI / AKAI MPK MINI
// Browser MIDI input is opt-in and affects the existing instrument voice
// functions only. No Piano/Choir DSP, presets or effects are rewritten.
// ========================================
const midiState = {
    access: null, input: null, pressed: new Map(), deferred: new Set(),
    sustain: false, channel: 'all'
};
const midiDeviceSelect = document.getElementById('midiDevice');
const midiChannelSelect = document.getElementById('midiChannel');
const midiStatus = document.getElementById('midiStatus');
function midiSetStatus(message) {
    if (midiStatus) midiStatus.textContent = message;
}
function midiFrequency(noteNumber) {
    return 440 * Math.pow(2, (noteNumber - 69) / 12);
}
function midiKey(channel, noteNumber) { return `${channel}:${noteNumber}`; }
function midiRelease(key) {
    const frequency = midiState.pressed.get(key);
    if (frequency === undefined) return;
    midiState.pressed.delete(key);
    midiState.deferred.delete(key);
    endInputNote(frequency);
}
function midiPanic() {
    for (const key of [...midiState.pressed.keys()]) midiRelease(key);
    midiState.deferred.clear();
    midiState.sustain = false;
    // Clear an active arpeggiator only when latch isn't intentionally on.
    if (dreamArpEnabled && !arpLatchEnabled && arpHeldNotes.size === 0) stopDreamArp();
    midiSetStatus(midiState.input ? `Connected: ${midiState.input.name}` : 'No MIDI device selected');
}
function midiMessage(event) {
    const data = event.data;
    if (!data || data.length < 2) return;
    const status = data[0];
    if (status < 0x80 || status >= 0xf0) return;
    const channel = (status & 0x0f) + 1;
    if (midiState.channel !== 'all' && Number(midiState.channel) !== channel) return;
    const type = status & 0xf0;
    const note = data[1];
    const velocity = data[2] ?? 0;
    const key = midiKey(channel, note);
    if (type === 0x90 && velocity > 0) {
        // Ignore duplicate Note On until Note Off; repeated notes remain playable.
        if (midiState.deferred.has(key)) { midiRelease(key); }
        else if (midiState.pressed.has(key)) return;
        const frequency = midiFrequency(note);
        midiState.pressed.set(key, frequency);
        beginInputNote(frequency);
    } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
        if (midiState.sustain) midiState.deferred.add(key);
        else midiRelease(key);
    } else if (type === 0xb0) {
        if (note === 64) {
            const wasSustained = midiState.sustain;
            midiState.sustain = velocity >= 64;
            if (wasSustained && !midiState.sustain) {
                for (const heldKey of [...midiState.deferred]) midiRelease(heldKey);
            }
        } else if (note === 120 || note === 123) {
            midiPanic();
        }
    }
}
function midiSelectInput(id) {
    if (midiState.input) midiState.input.onmidimessage = null;
    midiPanic();
    midiState.input = null;
    if (!midiState.access || !id) { midiSetStatus('Select a MIDI input'); return; }
    const input = midiState.access.inputs.get(id);
    if (!input || input.state !== 'connected') {
        midiSetStatus('MIDI input unavailable'); return;
    }
    midiState.input = input;
    input.onmidimessage = midiMessage;
    midiSetStatus(`Connected: ${input.name} — play the keys`);
}
function midiRefreshInputs() {
    if (!midiDeviceSelect || !midiState.access) return;
    const selected = midiState.input?.id || midiDeviceSelect.value;
    midiDeviceSelect.replaceChildren(new Option('Select MIDI input', ''));
    for (const input of midiState.access.inputs.values()) {
        if (input.state === 'connected') midiDeviceSelect.add(new Option(input.name || 'MIDI input', input.id));
    }
    if ([...midiDeviceSelect.options].some(option => option.value === selected)) {
        midiDeviceSelect.value = selected;
        if (midiState.input?.id !== selected) midiSelectInput(selected);
    } else {
        midiDeviceSelect.value = '';
        if (midiState.input) midiSelectInput('');
    }
}
async function midiEnable() {
    if (!navigator.requestMIDIAccess) {
        midiSetStatus('Web MIDI unavailable. Use a supported desktop Chromium browser over HTTPS or localhost.');
        return;
    }
    try {
        if (!midiState.access) midiState.access = await navigator.requestMIDIAccess({sysex:false});
        midiState.access.onstatechange = midiRefreshInputs;
        midiRefreshInputs();
        midiSetStatus('MIDI ready — select your MPK mini or other MIDI input');
    } catch (error) {
        midiSetStatus(`MIDI permission not granted: ${error?.message || 'access denied'}`);
    }
}
document.getElementById('midiEnable')?.addEventListener('click', midiEnable);
midiDeviceSelect?.addEventListener('change', () => midiSelectInput(midiDeviceSelect.value));
midiChannelSelect?.addEventListener('change', () => {
    midiPanic();
    midiState.channel = midiChannelSelect.value;
});
document.getElementById('midiPanic')?.addEventListener('click', midiPanic);
window.addEventListener('blur', () => { if (midiState.input) midiPanic(); });


// ============================================================================
// DREAM BINDER · PREMIUM STUDIO / BINDING OF DREAMS · V1
// Keeps every existing synthesis core and factory preset in place.
// All layers are created by existing createNote/createPianoNote/createChoirNote.
// Split: two independent patches across note regions; Layer: sum A+B.
// There is NO spectral morphing, per-note pitch bend, or fully independent
// real-time patch editing in this first Binding implementation.
// ============================================================================
const dbUI = {
    mode: document.getElementById('dbPerformanceMode'),
    A: document.getElementById('dbLayerA'), B: document.getElementById('dbLayerB'),
    balance: document.getElementById('dbBlend'), split: document.getElementById('dbSplitNote'),
    status: document.getElementById('dbBindingStatus')
};
const DB_BINDING_STORAGE = 'dreamBinderBindingsV1';
const dbCapture = { A: null, B: null };
let dbAudioAnalyser = null;
let dbSpectrumFrame = 0;
let dbSpectrumLastAt = 0;
let dbSelectedPresetTitle = 'Dream Pad';
function dbGetMode() { return dbUI.mode?.value || 'off'; }
function dbSetStatus(message) {
    if (dbUI.status) { dbUI.status.textContent = message; dbUI.status.dataset.state = dbGetMode() !== 'off' ? 'active' : 'idle'; }
}
// Two optional starter concepts for demonstrating A/B zones on the MPK Mini.
// These do not modify any original factory or Dream Atlas patches.
const dbPerformanceTemplates = {
    lowBassLead: {
        name:'Low Bass Lead · Performance',engine:'synth',settings:{
          waveform:'sawtooth',waveformB:'sine',origin:'hollow',waveFusion:26,
          oscBLevel:.32,oscBDetune:2,subWaveform:'sine',subLevel:66,
          attack:.025,decay:.48,sustain:.79,release:1.2,
          filterType:'lowpass',cutoff:940,resonance:1.4,voiceSpread:17,
          lfoRate:.13,lfoAmount:22,lfoDestination:'filter',
          noiseType:'dark',noiseAmount:3,drift:3,stereoWidth:18,
          deepDreamOrbit:false,fmAmount:11,fmRatio:1.5,fmAttack:.015,
          fmDecay:.3,fmSustain:.3,fmRelease:.3,coherence:12,decoherence:4,
          polynomialRingEnabled:false,masterVolume:.19,presence:20
        }
    },
    echoDropsPiano: {
        name:'Echo Drops Piano · Performance',engine:'piano',localEcho:true,settings:{
          attack:.018,decay:2.2,sustain:.28,release:3.1,
          origin:'dream',presence:24,waveFusion:10,waveFusionCurve:'smooth',
          dreamMorphMotion:false,noiseType:'air',noiseAmount:0,drift:0,
          stereoWidth:48,deepDreamOrbit:true,masterVolume:.55,
          reverbMix:.36,reverbDecay:4.8,delayMix:.28,delayTime:.34,
          delayFeedback:.34,soundboardBloom:1.4
        }
    }
};
function dbSettingsForLayer(selection) {
    if (!selection) return null;
    if (selection.startsWith('template:')) return dbPerformanceTemplates[selection.slice(9)] || null;
    if (selection === 'capture:A') return dbCapture.A ? {name:'Captured sound A',engine:dbCapture.A.engine || 'synth',settings:dbCapture.A} : null;
    if (selection === 'capture:B') return dbCapture.B ? {name:'Captured sound B',engine:dbCapture.B.engine || 'synth',settings:dbCapture.B} : null;
    const separator = selection.indexOf(':');
    if (separator < 0) return null;
    const bank = selection.slice(0, separator), key = selection.slice(separator + 1);
    if (bank === 'atlas') {
        const patch = dreamAtlasPatches.find(p => p.key === key);
        return patch ? {name: patch.name, engine: patch.engine || 'synth',settings:patch.settings} : null;
    }
    if (bank === 'user') {
        const settings = getSavedPresets()[key];
        return settings ? {name:key, engine:settings.engine || 'synth', settings} : null;
    }
    const patch = presetBanks[bank]?.[key];
    return patch ? {name:patch.name,engine:patch.engine || patch.settings?.engine || 'synth',settings:patch.settings} : null;
}
function dbFillLayerSelectors() {
    const previousA = dbUI.A?.value, previousB = dbUI.B?.value;
    const groups = [
      ['Signature', 'signature'],['Keys / Piano', 'keys'],['Pads', 'pads'],
      ['Leads', 'leads'],['Bass', 'bass'],['Choir', 'choir'],
      ['Textures','textures'],['Arpeggiator','arpeggiator']
    ];
    const applyOptions = select => {
        if (!select) return;
        select.replaceChildren();
        const templates = document.createElement('optgroup'); templates.label = 'Performance Concepts';
        templates.append(new Option('Low Bass Lead · Performance','template:lowBassLead'));
        templates.append(new Option('Echo Drops Piano · Performance','template:echoDropsPiano'));
        select.add(templates);
        const captures = document.createElement('optgroup'); captures.label = 'Current Sound';
        captures.append(new Option('Captured current sound', select === dbUI.A ? 'capture:A' : 'capture:B'));
        select.add(captures);
        for (const [title,key] of groups) {
            const bank = presetBanks[key];
            if (!bank || !Object.keys(bank).length) continue;
            const group = document.createElement('optgroup'); group.label = title;
            for (const [id,patch] of Object.entries(bank)) group.append(new Option(patch.name, `${key}:${id}`));
            select.add(group);
        }
        const atlas = document.createElement('optgroup'); atlas.label = 'Dream Atlas · 104 Sounds';
        for (const patch of dreamAtlasPatches) atlas.append(new Option(`${patch.collection} · ${patch.name}`, `atlas:${patch.key}`));
        select.add(atlas);
        const saved = getSavedPresets();
        if (Object.keys(saved).length) {
            const users = document.createElement('optgroup'); users.label = 'My Presets';
            for (const key of Object.keys(saved)) users.append(new Option(key,`user:${key}`));
            select.add(users);
        }
    };
    applyOptions(dbUI.A); applyOptions(dbUI.B);
    const piano = Object.entries(presetBanks.keys || {}).find(([,patch]) => patch.engine === 'piano');
    if (dbUI.A) dbUI.A.value = previousA && [...dbUI.A.options].some(o=>o.value===previousA) ? previousA : 'template:lowBassLead';
    if (dbUI.B) dbUI.B.value = previousB && [...dbUI.B.options].some(o=>o.value===previousB) ? previousB : 'template:echoDropsPiano';
}
function dbReadSavedBinding() {
    try {
        const data = JSON.parse(localStorage.getItem(DB_BINDING_STORAGE) || '{}');
        for (const side of ['A','B']) if (data.captures?.[side]) dbCapture[side] = data.captures[side];
        if (data.A && dbUI.A && [...dbUI.A.options].some(o=>o.value===data.A)) dbUI.A.value = data.A;
        if (data.B && dbUI.B && [...dbUI.B.options].some(o=>o.value===data.B)) dbUI.B.value = data.B;
        if (dbUI.mode && ['off','layer','split'].includes(data.mode)) dbUI.mode.value = data.mode;
        if (dbUI.balance && Number.isFinite(Number(data.balance))) dbUI.balance.value = Math.max(0,Math.min(100,data.balance));
        if (dbUI.split && Number.isFinite(Number(data.split))) dbUI.split.value = data.split;
    } catch (_) { /* User browser storage may be restricted. */ }
}
function dbStoreBinding() {
    try { localStorage.setItem(DB_BINDING_STORAGE,JSON.stringify({
        A:dbUI.A?.value, B:dbUI.B?.value, mode:dbGetMode(),
        balance:Number(dbUI.balance?.value || 50), split:Number(dbUI.split?.value || 60),captures:dbCapture
    })); } catch (_) { /* Not essential to the instrument. */ }
}
// Snapshot a preset into the EXISTING voice factory without loading a global
// preset (loading a global preset would stop all held notes and reset controls).
// Audio parameters sampled at voice creation remain independent for the note.
function dbApplySilently(settings, engine) {
    const ids = [
      'waveform','waveformB','origin','waveFusion','waveFusionCurve','dreamMorphMotion',
      'subWaveform','subLevel','oscBLevel','oscBDetune','voiceSpread','beatTrackingMode',
      'beatRate','beatTempo','beatDivision','attack','decay','sustain','release',
      'filterType','cutoff','resonance','lfoRate','lfoAmount','lfoDestination',
      'noiseType','noiseAmount','drift','stereoWidth','deepDreamOrbit','glideEnabled',
      'glideTime','presence','reverbMix','reverbDecay','delayMix','delayTime','delayFeedback'
    ];
    for (const id of ids) {
        const element = document.getElementById(id);
        if (!element || settings[id] == null) continue;
        if (element.type === 'checkbox') element.checked = !!settings[id];
        else element.value = settings[id];
    }
    currentResonanceSource = engine;
    currentEngine = engine;
    // Preserve Piano voice character and optional toy-key mechanical behavior.
    pianoPresetSoundboardBloom = Number(settings.soundboardBloom ?? 1);
    toyPianoKeyClickEnabled = settings.mechanicalKeyClick === true;
    toyPianoKeyDownGain = Number(settings.mechanicalKeyDownGain ?? .35);
    toyPianoKeyDownFrequency = Number(settings.mechanicalKeyDownFrequency ?? 950);
    currentFmAmount = Number(settings.fmAmount ?? 0);
    currentFmRatio = Number(settings.fmRatio ?? 3.5);
    currentFmAttack = Number(settings.fmAttack ?? .01);
    currentFmDecay = Number(settings.fmDecay ?? .8);
    currentFmSustain = Number(settings.fmSustain ?? 0);
    currentFmRelease = Number(settings.fmRelease ?? .3);
    currentCoherence = clampResonantValue(settings.coherence ?? 0);
    currentDecoherence = clampResonantValue(settings.decoherence ?? 0);
    polynomialRingState.enabled = settings.polynomialRingEnabled === true;
    polynomialRingState.amount = Number(settings.polynomialRingAmount ?? 35);
    polynomialRingState.degree = Number(settings.polynomialRingDegree ?? 3);
    polynomialRingState.dimension = Number(settings.krullDimension ?? 1);
    polynomialRingState.character = settings.polynomialRingCharacter ?? 'hybrid';
}
function dbWithPreset(patch, callback) {
    const before = getCurrentPresetSettings();
    const savedResonanceSource = currentResonanceSource;
    const savedEngine = currentEngine;
    try {
        dbApplySilently(patch.settings || {}, patch.engine || 'synth');
        return callback();
    } finally {
        dbApplySilently(before,savedResonanceSource);
        currentEngine = savedEngine;
    }
}
function dbLayerWeight(side) {
    if (dbGetMode() === 'split') return .82;
    const t = Math.max(0,Math.min(1,Number(dbUI.balance?.value ?? 50)/100));
    // Equal-power mix, bounded to protect headroom when sounds correlate.
    return .72 * (side === 'A' ? Math.cos(t * Math.PI / 2) : Math.sin(t * Math.PI / 2));
}
function dbInsertGain(ctx, outputNode, gainAmount, processingNodes) {
    if (!outputNode) return null;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainAmount,ctx.currentTime);
    outputNode.disconnect();
    outputNode.connect(gain);
    gain.connect(dryGain);
    gain.connect(reverbNode);
    gain.connect(delayDryGain);
    gain.connect(delayNode);
    if (processingNodes) processingNodes.push(gain);
    return gain;
}
function dbAttachEcho(ctx, entry, patch) {
    // A lightweight per-layer tap for the Echo Drops Piano concept. The
    // original Piano engine and global reverb/delay processing are untouched.
    if (!patch.localEcho || !entry?.gain || !masterGain) return;
    const delay = ctx.createDelay(2);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    delay.delayTime.value = Math.max(.1,Math.min(1,Number(patch.settings?.delayTime || .34)));
    feedback.gain.value = Math.min(.58,Number(patch.settings?.delayFeedback || .34));
    wet.gain.value = .23;
    entry.gain.connect(delay);
    delay.connect(feedback);feedback.connect(delay);
    delay.connect(wet);wet.connect(masterGain);
    const cleanup = [delay,feedback,wet];
    if (entry.voice?.nodes) entry.voice.nodes.push(...cleanup);
    else if (entry.voice?.textureProcessingNodes) entry.voice.textureProcessingNodes.push(...cleanup);
    else entry.extraCleanup = cleanup;
}
function dbCreateBindingVoice(frequency, patch, side) {
    if (!patch) return null;
    return dbWithPreset(patch, () => {
        const ctx = getAudioContext();
        if (patch.engine === 'piano') {
            createPianoNote(frequency);
            const voice = activePianoNodes[activePianoNodes.length-1];
            const output = voice?.nodes?.find(node => node?.pan && typeof node.pan.setValueAtTime === 'function'); // pianoPan, preserves orbit
            const gain = dbInsertGain(ctx, output, dbLayerWeight(side), voice?.nodes);
            const entry={engine:'piano',voice,gain,side};
            dbAttachEcho(ctx,entry,patch);
            return entry;
        }
        if (patch.engine === 'choir') {
            if (!choirAhC3Buffer) return {engine:'choir-pending',side};
            const voice = createChoirNote(frequency);
            const outputs = voice?.textureProcessingNodes;
            const output = outputs?.[outputs.length - 1]; // choirOrbitPanner
            const gain = dbInsertGain(ctx, output, dbLayerWeight(side), outputs);
            const entry={engine:'choir',voice,gain,side};
            dbAttachEcho(ctx,entry,patch);
            return entry;
        }
        const voice = createNote(frequency);
        const gain = dbInsertGain(ctx, voice.stereoPanner,dbLayerWeight(side));
        const entry={engine:'synth',voice,gain,side};
        dbAttachEcho(ctx,entry,patch);
        return entry;
    });
}
function dbStopBindingEntry(frequency, entry) {
    if (!entry) return;
    for (const layer of entry.layers) {
        const voice = layer?.voice;
        if (!voice) continue;
        if (layer.engine === 'synth') {
            // Reuse the exact existing Synth release/cleanup pathway, with no
            // duplicate release DSP or changes to the approved voices.
            const id = String(frequency);
            const old = activeNotes.get(id);
            activeNotes.set(id, voice);
            stopNote(frequency);
            if (old && old !== voice) activeNotes.set(id,old);
        } else if (layer.engine === 'choir') voice.release?.();
        // Piano intentionally uses its original natural tail, just like normal
        // Piano playback. Do not turn the piano into a gated synth.
    }
}
function dbReleaseAllBindings() {
    for (const [key,entry] of [...dbHeldLayers.entries()]) {
        dbHeldLayers.delete(key);
        dbStopBindingEntry(Number(key),entry);
    }
}
function dbCreateVoiceWithAsyncChoir(frequency, patch, side, entry) {
    if (patch?.engine === 'choir' && !choirAhC3Buffer) {
        loadChoirAhC3Sample().then(buffer => {
            if (!buffer || dbHeldLayers.get(String(frequency)) !== entry) return;
            const voice = dbCreateBindingVoice(frequency,patch,side);
            if (voice && voice.engine !== 'choir-pending') entry.layers.push(voice);
        }).catch(()=>dbSetStatus('Choir sample unavailable. Keep the audio asset in your project.'));
        return;
    }
    const voice = dbCreateBindingVoice(frequency,patch,side);
    if (voice && voice.engine !== 'choir-pending') entry.layers.push(voice);
}
function dbBindingPress(frequency) {
    if (dbGetMode() === 'off') return false;
    const key = String(frequency);
    if (dbHeldLayers.has(key)) return true;
    // Existing 3-voice Synth pool is unchanged in single mode. Binding mode
    // has its own conservative polyphony limit for mobile performance.
    const android = /Android/i.test(navigator.userAgent);
    const voiceLimit = dbGetMode() === 'layer' ? (android ? 3 : 5) : (android ? 5 : 8);
    if (dbHeldLayers.size >= voiceLimit) {
        const [oldKey, oldEntry] = dbHeldLayers.entries().next().value;
        dbHeldLayers.delete(oldKey); dbStopBindingEntry(Number(oldKey),oldEntry);
    }
    const entry = {layers:[]}; dbHeldLayers.set(key,entry);
    const note = Math.round(69 + 12 * Math.log2(Math.max(.01,frequency) / 440));
    const targets = dbGetMode() === 'layer' ? ['A','B'] :
        [note < Number(dbUI.split?.value || 60) ? 'A' : 'B'];
    try {
        for (const side of targets) {
            const patch = dbSettingsForLayer(dbUI[side]?.value);
            dbCreateVoiceWithAsyncChoir(frequency,patch,side,entry);
        }
    } catch (error) {
        console.error('Binding of Dreams voice error:',error);
        dbSetStatus('Binding error: review preset selection or audio assets.');
        dbHeldLayers.delete(key); dbStopBindingEntry(frequency,entry);
    }
    setKeyActive(frequency,true);
    return true;
}
function dbBindingRelease(frequency) {
    if (dbGetMode() === 'off') return false;
    const key = String(frequency);
    const entry = dbHeldLayers.get(key);
    if (entry) { dbHeldLayers.delete(key); dbStopBindingEntry(frequency,entry); }
    setKeyActive(frequency,false);
    return true;
}
function dbSyncMode() {
    dbReleaseAllBindings();
    // A latched arpeggiator from Single mode must never keep playing behind
    // a new split/layer performance. Stop the timer without rewriting arp DSP.
    stopDreamArp();
    arpHeldNotes.clear();
    arpPlayedOrder = [];
    refreshLatchedKeyHighlights();
    stopAllNotes();
    stopActivePianoNodes();
    stopActiveChoirNodes();
    const mode = dbGetMode();
    const splitRow = document.querySelector('.db-split-row');
    if (splitRow) splitRow.style.display = mode === 'split' ? 'grid' : 'none';
    if (dbUI.balance) dbUI.balance.disabled = mode !== 'layer';
    if (dbUI.split) dbUI.split.disabled = mode !== 'split';
    const left = dbSettingsForLayer(dbUI.A?.value)?.name || 'Source A';
    const right = dbSettingsForLayer(dbUI.B?.value)?.name || 'Source B';
    dbSetStatus(mode === 'layer' ? `BINDING ACTIVE · ${left} + ${right}. Both patches sound on each key.` :
      mode === 'split' ? `SPLIT ACTIVE · ${left} below ${dbUI.split?.selectedOptions[0]?.textContent || 'C4'} · ${right} from split note upwards.` :
      'SINGLE MODE · Existing instrument engines and their original playback are unchanged.');
    dbStoreBinding();
}
function dbUpdateBlend() {
    const n = Number(dbUI.balance?.value ?? 50);
    const label = document.getElementById('dbBlendValue');
    if (label) label.textContent = `${100-n} / ${n}`;
    for (const entry of dbHeldLayers.values()) {
        for (const layer of entry.layers) {
            if (layer?.gain && audioContext) layer.gain.gain.setTargetAtTime(dbLayerWeight(layer.side),audioContext.currentTime,.024);
        }
    }
    dbStoreBinding();
}
function dbPopulateSplitNotes() {
    if (!dbUI.split) return;
    for (let n=36;n<=84;n++) {
        const labels = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
        const name = `${labels[n % 12]}${Math.floor(n / 12) - 1}`;
        dbUI.split.add(new Option(`${name} · MIDI ${n}`,n));
    }
    dbUI.split.value='60';
}
function dbCaptureSound(side) {
    dbReleaseAllBindings();
    dbCapture[side] = getCurrentPresetSettings();
    dbUI[side].value = `capture:${side}`;
    dbSyncMode();
    dbSetStatus(`CURRENT SOUND CAPTURED INTO SOURCE ${side}. ${dbGetMode()==='off' ? 'Select Bind or Split to audition.' : 'Play notes to audition.'}`);
    dbStoreBinding();
}
function dbRenderGallery() {
    // Seven cinematic art windows. The 13 sound environments and their 104
    // presets remain independently available through the existing filter.
    const target=document.getElementById('dbRealmGallery');
    if (!target) return;
    target.replaceChildren();
    const gateways=[
      ['celestial-dreams','Celestial Dreams'],
      ['lucid-dreaming','Lucid Dreaming'],
      ['ancient-worlds','Ancient Worlds'],
      ['forgotten-realms','Forgotten Realms'],
      ['shadow-encounters','Shadow Encounters'],
      ['dream-distortions','Dream Distortions'],
      ['the-void','The Void']
    ];
    for(const [slug,title] of gateways){
      const card=document.createElement('div');
      card.className='db-realm-card db-realm-card--visual';
      card.setAttribute('role','img');
      card.setAttribute('aria-label',title+' artwork');
      const art=document.createElement('img');
      art.src=`assets/realms/${slug}.webp`;
      art.loading='lazy';
      art.alt='';
      const caption=document.createElement('span');
      caption.textContent=title;
      card.append(art,caption);
      target.append(card);
    }
}

function dbSyncGallery() {
    const active=document.getElementById('dreamAtlasRealm')?.value;
    document.querySelectorAll('.db-realm-card').forEach(button => {
        button.classList.toggle('active',button.dataset.realm===active);
        button.setAttribute('aria-pressed',String(button.dataset.realm===active));
    });
}
function dbUpdateAlgebraStatus() {
    const s=polynomialRingState;
    const element=document.getElementById('dbMathStatus');
    if (element) element.textContent=s.enabled && s.amount>0 && s.dimension>0 ?
      `Polynomial ring active · degree ${s.degree} · dimension ${s.dimension}` :
      `Polynomial field bypassed · dimension ${s.dimension}`;
}
function dbDrawSpectrum(time) {
    // Only ~4 frames per second at rest, about 23 when voices are active.
    const playing=Boolean(audioContext && audioContext.state==='running' &&
        (activeNotes.size || activePianoNodes.length || activeChoirNodes.length || dbHeldLayers.size));
    dbSpectrumFrame=setTimeout(() => requestAnimationFrame(dbDrawSpectrum),document.hidden?600:playing?43:250);
    if (document.hidden) return;
    dbSpectrumLastAt=time;
    const canvas=document.getElementById('dbSpectrumCanvas');
    const context=canvas?.getContext('2d');
    if (!context) return;
    const w=canvas.width,h=canvas.height;
    context.clearRect(0,0,w,h);
    if (audioContext && masterGain && !dbAudioAnalyser) {
        dbAudioAnalyser=audioContext.createAnalyser();
        dbAudioAnalyser.fftSize=1024;
        dbAudioAnalyser.smoothingTimeConstant=.83;
        masterGain.connect(dbAudioAnalyser); // analysis tap; no change to master output route
    }
    context.save();
    const points=[];
    if (dbAudioAnalyser && audioContext.state==='running') {
        const data=new Uint8Array(dbAudioAnalyser.frequencyBinCount);
        dbAudioAnalyser.getByteFrequencyData(data);
        for(let i=0;i<135;i++){
            const t=i/134, bin=Math.min(data.length-1,Math.round(Math.pow(t,1.55)*(data.length-1)));
            const amp=(data[bin]/255);
            points.push([t*w,h*.74-amp*h*.59]);
        }
    } else {
        for(let i=0;i<135;i++){
            const t=i/134;
            const envelope=(.12+.1*Math.sin(t*21))*(1-t);
            points.push([t*w,h*.74-Math.max(0,envelope+Math.sin(t*56)*.027)*h]);
        }
    }
    const grad=context.createLinearGradient(0,0,w,0);
    grad.addColorStop(0,'#61d5f4');grad.addColorStop(.5,'#ba83fd');grad.addColorStop(1,'#e7a0c9');
    context.lineWidth=3.2;context.strokeStyle=grad;context.shadowBlur=14;context.shadowColor='#aa75ff';
    context.beginPath();points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.stroke();
    context.shadowBlur=0;context.lineTo(w,h);context.lineTo(0,h);context.closePath();
    const fill=context.createLinearGradient(0,35,0,h);fill.addColorStop(0,'rgba(167,100,248,.26)');fill.addColorStop(1,'rgba(167,100,248,0)');
    context.fillStyle=fill;context.fill();context.restore();
}
function dbSelectSource(source) {
    if (source==='atlas') {openPresetBrowser();selectPresetBank('atlas');dbSyncGallery();return;}
    if (source==='bindings') {document.getElementById('dbBindingStudio')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    dbReleaseAllBindings();if (dbUI.mode) dbUI.mode.value='off';dbSyncMode();
    currentResonanceSource=source;currentEngine=source;
    document.querySelectorAll('[data-db-nav]').forEach(el => {
        el.classList.toggle('active',el.dataset.dbNav===source);
        if(el.dataset.dbNav===source) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
    });
    document.getElementById('dbSoundArchitecture')?.scrollIntoView({behavior:'smooth',block:'start'});
}
// Init at script end after all existing preset constants and note functions.
dbPopulateSplitNotes();
dbFillLayerSelectors();
dbReadSavedBinding();
dbRenderGallery();
dbSyncMode();
dbUpdateBlend();
dbUpdateAlgebraStatus();
dbSpectrumFrame=requestAnimationFrame(dbDrawSpectrum);
for(const id of ['dbLayerA','dbLayerB','dbSplitNote']) document.getElementById(id)?.addEventListener('change',dbSyncMode);
dbUI.mode?.addEventListener('change',dbSyncMode);
dbUI.balance?.addEventListener('input',dbUpdateBlend);
document.getElementById('dbCaptureA')?.addEventListener('click',()=>dbCaptureSound('A'));
document.getElementById('dbCaptureB')?.addEventListener('click',()=>dbCaptureSound('B'));
document.getElementById('dbAtlasHero')?.addEventListener('click',()=>dbSelectSource('atlas'));
document.getElementById('dbOpenMIDI')?.addEventListener('click',()=>document.getElementById('dbMidiPanel')?.scrollIntoView({behavior:'smooth',block:'center'}));
for(const button of document.querySelectorAll('[data-db-nav]')) button.addEventListener('click',()=>dbSelectSource(button.dataset.dbNav));
document.getElementById('dreamAtlasRealm')?.addEventListener('change',dbSyncGallery);
for(const id of ['polynomialRingEnabled','polynomialRingAmount','polynomialRingDegree','krullDimension','polynomialRingCharacter'])
    document.getElementById(id)?.addEventListener('input',()=>setTimeout(dbUpdateAlgebraStatus,0));
for(const button of document.querySelectorAll('.preset-browser-tab')) button.addEventListener('click',dbSyncGallery);
// Saved user presets become selectable as Binding layers when the browser opens.
document.getElementById('openPresetBrowser')?.addEventListener('click',dbFillLayerSelectors);
window.addEventListener('pagehide', dbReleaseAllBindings);
