import { writeFileSync } from 'node:fs';
import path from 'node:path';

// Generate a high-octane 130 BPM tactical battlefield combat soundtrack (Dhurandhar war-beat style)
// Stereo, 44.1 kHz, 16-bit PCM WAV (which browsers play flawlessly as audio/mp3 or audio/wav)
const sampleRate = 44100;
const bpm = 130;
const beatDuration = 60 / bpm; // ~0.4615s per beat
const totalBars = 8;
const durationSeconds = totalBars * 4 * beatDuration; // ~14.76 seconds loop
const totalSamples = Math.floor(sampleRate * durationSeconds);

const buffer = Buffer.alloc(44 + totalSamples * 2 * 2); // 44 byte header + 16-bit stereo

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + totalSamples * 4, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // PCM chunk size
buffer.writeUInt16LE(1, 20); // format = 1 (PCM)
buffer.writeUInt16LE(2, 22); // channels = 2 (stereo)
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 4, 28); // byte rate
buffer.writeUInt16LE(4, 32); // block align
buffer.writeUInt16LE(16, 34); // bits per sample
buffer.write('data', 36);
buffer.writeUInt32LE(totalSamples * 4, 40);

// Procedural audio synthesis for intense Dhurandhar combat war-beat
let offset = 44;

for (let i = 0; i < totalSamples; i++) {
  const t = i / sampleRate;
  const currentBeat = (t / beatDuration) % (totalBars * 4);
  const beatFraction = (t / beatDuration) % 1;
  const barFraction = (t / (beatDuration * 4)) % 1;

  let left = 0;
  let right = 0;

  // 1. Heavy 808 Sub-bass kick on every beat (1, 2, 3, 4) with extra syncopation on and-of-3
  const isKick = beatFraction < 0.28 || ((currentBeat % 2 === 1) && beatFraction > 0.45 && beatFraction < 0.7);
  if (isKick) {
    const kickAge = beatFraction < 0.28 ? beatFraction : (beatFraction - 0.45);
    const kickFreq = 140 * Math.exp(-kickAge * 18) + 42; // punchy pitch envelope
    const kickEnv = Math.exp(-kickAge * 12);
    const kickVal = Math.sin(2 * Math.PI * kickFreq * t) * kickEnv * 0.75;
    left += kickVal;
    right += kickVal;
  }

  // 2. War snare / metallic clap on beats 2 & 4
  const beatIndex = Math.floor(currentBeat) % 4;
  if (beatIndex === 1 || beatIndex === 3) {
    if (beatFraction < 0.2) {
      const snareEnv = Math.exp(-beatFraction * 22);
      const noise = (Math.random() * 2 - 1) * snareEnv * 0.4;
      const tone = Math.sin(2 * Math.PI * 220 * t) * snareEnv * 0.25;
      left += (noise + tone) * 0.9;
      right += (noise + tone) * 1.1;
    }
  }

  // 3. Fast aggressive hi-hats (16th notes)
  const sixteenth = (t / (beatDuration / 4)) % 1;
  if (sixteenth < 0.08) {
    const hatEnv = Math.exp(-sixteenth * 45);
    const hat = (Math.random() * 2 - 1) * hatEnv * 0.18;
    left += hat * 1.1;
    right += hat * 0.9;
  }

  // 4. Dhurandhar-style dramatic brass / synth war horns (minor progression: D -> F -> G -> A)
  const chordNotes = [
    [146.83, 220.00, 293.66], // D minor
    [174.61, 220.00, 349.23], // F major
    [196.00, 246.94, 392.00], // G
    [220.00, 277.18, 440.00], // A
  ];
  const chordIndex = Math.floor((currentBeat / 8)) % chordNotes.length;
  const chord = chordNotes[chordIndex];
  
  // Dramatic pulse on each bar
  const hornEnv = Math.min(1, barFraction * 4) * Math.exp(-barFraction * 2.2);
  let hornVal = 0;
  for (let n = 0; n < chord.length; n++) {
    // Sawtooth-like brass harmonic
    hornVal += (Math.sin(2 * Math.PI * chord[n] * t) + 0.5 * Math.sin(2 * Math.PI * chord[n] * 2 * t)) * 0.08;
  }
  left += hornVal * hornEnv * 1.2;
  right += hornVal * hornEnv * 0.8;

  // Master limiting & soft saturation
  left = Math.max(-0.95, Math.min(0.95, left * 0.85));
  right = Math.max(-0.95, Math.min(0.95, right * 0.85));

  const sampleL = Math.floor(left * 32767);
  const sampleR = Math.floor(right * 32767);

  buffer.writeInt16LE(sampleL, offset);
  buffer.writeInt16LE(sampleR, offset + 2);
  offset += 4;
}

const outMp3 = path.resolve('public/audio/dhurandhar.mp3');
const outWav = path.resolve('public/audio/dhurandhar.wav');

writeFileSync(outMp3, buffer);
writeFileSync(outWav, buffer);
console.log('Successfully generated Dhurandhar audio track:');
console.log('  ->', outMp3, `(${buffer.length} bytes)`);
console.log('  ->', outWav, `(${buffer.length} bytes)`);
