// Web Audio API Sound Synthesizer — all sounds generated programmatically
const GameAudio = (() => {
  let ctx = null;

  function getContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  function flap() {
    const c = getContext();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(650, c.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.1);
  }

  function score() {
    const c = getContext();
    // First tone
    const osc1 = c.createOscillator();
    const gain1 = c.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, c.currentTime);
    gain1.gain.setValueAtTime(0.12, c.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
    osc1.connect(gain1);
    gain1.connect(c.destination);
    osc1.start(c.currentTime);
    osc1.stop(c.currentTime + 0.1);

    // Second tone (higher, delayed)
    const osc2 = c.createOscillator();
    const gain2 = c.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1175, c.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.001, c.currentTime);
    gain2.gain.setValueAtTime(0.12, c.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
    osc2.connect(gain2);
    gain2.connect(c.destination);
    osc2.start(c.currentTime + 0.08);
    osc2.stop(c.currentTime + 0.2);
  }

  function die() {
    const c = getContext();
    // Descending tone
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.3);
    gain.gain.setValueAtTime(0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.4);

    // Noise burst
    const bufferSize = c.sampleRate * 0.15;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const bandpass = c.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(800, c.currentTime);
    bandpass.Q.setValueAtTime(1, c.currentTime);
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.15, c.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(c.destination);
    noise.start(c.currentTime);
    noise.stop(c.currentTime + 0.15);
  }

  function swoosh() {
    const c = getContext();
    const bufferSize = c.sampleRate * 0.2;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const bandpass = c.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(500, c.currentTime);
    bandpass.frequency.exponentialRampToValueAtTime(3000, c.currentTime + 0.15);
    bandpass.Q.setValueAtTime(2, c.currentTime);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(c.destination);
    noise.start(c.currentTime);
    noise.stop(c.currentTime + 0.2);
  }

  return { flap, score, die, swoosh };
})();
