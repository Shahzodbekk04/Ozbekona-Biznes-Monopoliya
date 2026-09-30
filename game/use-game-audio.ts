'use client';
import { useCallback, useEffect, useRef } from 'react';

/** One unlocked audio context for all game effects, including every token step. */
export function useGameAudio(enabled: boolean, chatting: boolean) {
  const context = useRef<AudioContext | null>(null), master = useRef<GainNode | null>(null);
  const settings = useRef({ enabled, chatting }); settings.current = { enabled, chatting };
  const unlock = useCallback(() => {
    if (!settings.current.enabled) return;
    try {
      if (!context.current || context.current.state === 'closed') {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        context.current = new Ctx(); master.current = context.current.createGain(); master.current.connect(context.current.destination);
      }
      master.current!.gain.value = settings.current.chatting ? .25 : 1;
      if (context.current.state === 'suspended') void context.current.resume().catch(() => {});
    } catch { /* Browsers without audio still run the game. */ }
  }, []);
  useEffect(() => {
    document.addEventListener('pointerdown', unlock, { passive: true }); document.addEventListener('keydown', unlock);
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); void context.current?.close().catch(() => {}); context.current = null; master.current = null; };
  }, [unlock]);
  useEffect(() => { if (master.current) master.current.gain.value = enabled ? chatting ? .25 : 1 : 0; }, [enabled, chatting]);
  return useCallback((kind: string, step = 0) => {
    if (!settings.current.enabled || document.hidden) return;
    unlock(); const ctx = context.current, output = master.current;
    if (!ctx || !output || ctx.state !== 'running') return;
    const count = kind === 'step' ? 1 : kind === 'land' ? 2 : kind === 'jail' ? 8 : kind === 'dice' ? 7 : 3;
    for (let i = 0; i < count; i++) {
      const oscillator = ctx.createOscillator(), envelope = ctx.createGain(), start = ctx.currentTime + i * .065;
      const duration = kind === 'step' ? .075 : kind === 'land' ? .18 : .1;
      oscillator.type = kind === 'step' || kind === 'dice' ? 'triangle' : 'sine';
      const frequency = kind === 'step' ? [523, 659, 784, 880][step % 4] : kind === 'land' ? [880, 1175][i] : kind === 'jail' ? i % 2 ? 850 : 550 : kind === 'dice' ? 130 + Math.random() * 170 : 700 + i * 240;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (kind === 'step') oscillator.frequency.exponentialRampToValueAtTime(frequency * .7, start + duration);
      envelope.gain.setValueAtTime(.0001, start); envelope.gain.exponentialRampToValueAtTime(kind === 'step' ? .023 : .035, start + .006); envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(envelope); envelope.connect(output); oscillator.start(start); oscillator.stop(start + duration + .01);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    }
  }, [unlock]);
}
