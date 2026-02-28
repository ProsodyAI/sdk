import { describe, it, expect } from 'vitest';
import { createWavBuffer } from '@/wav';

describe('createWavBuffer', () => {
  it('starts with RIFF header', () => {
    const samples = new Int16Array([0, 100, -100]);
    const buf = createWavBuffer(samples, 16000, 1, 16);
    const view = new DataView(buf);
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(riff).toBe('RIFF');
  });

  it('contains WAVE format marker', () => {
    const buf = createWavBuffer(new Int16Array([0]), 16000, 1, 16);
    const view = new DataView(buf);
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(wave).toBe('WAVE');
  });

  it('encodes correct sample rate', () => {
    const buf = createWavBuffer(new Int16Array([0]), 44100, 1, 16);
    const view = new DataView(buf);
    expect(view.getUint32(24, true)).toBe(44100);
  });

  it('encodes correct number of channels', () => {
    const buf = createWavBuffer(new Int16Array([0, 0]), 16000, 2, 16);
    const view = new DataView(buf);
    expect(view.getUint16(22, true)).toBe(2);
  });

  it('has correct total size', () => {
    const samples = new Int16Array(100);
    const buf = createWavBuffer(samples, 16000, 1, 16);
    expect(buf.byteLength).toBe(44 + 100 * 2);
  });

  it('encodes correct data chunk size', () => {
    const samples = new Int16Array(50);
    const buf = createWavBuffer(samples, 16000, 1, 16);
    const view = new DataView(buf);
    expect(view.getUint32(40, true)).toBe(50 * 2);
  });

  it('preserves sample values', () => {
    const samples = new Int16Array([1234, -5678, 32767, -32768]);
    const buf = createWavBuffer(samples, 16000, 1, 16);
    const view = new DataView(buf);
    expect(view.getInt16(44, true)).toBe(1234);
    expect(view.getInt16(46, true)).toBe(-5678);
    expect(view.getInt16(48, true)).toBe(32767);
    expect(view.getInt16(50, true)).toBe(-32768);
  });
});
