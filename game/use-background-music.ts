'use client';
import { useEffect, useRef } from 'react';

// The bundled recording is already attenuated to 12% amplitude so that
// the quiet level also holds on phones that ignore HTMLMediaElement.volume.
export function useBackgroundMusic(enabled:boolean){
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const enabledRef=useRef(enabled);
 enabledRef.current=enabled;
 useEffect(()=>{
  const audio=new Audio('/audio/business-background.mp3');
  audio.loop=true;
  audio.preload='none';
  audioRef.current=audio;
  const sync=()=>{
   if(!enabledRef.current||document.hidden){audio.pause();return}
   if(audio.paused)void audio.play().catch(()=>{/* Retry on the next user gesture if autoplay is blocked. */});
  };
  document.addEventListener('pointerdown',sync,{passive:true});
  document.addEventListener('keydown',sync);
  document.addEventListener('visibilitychange',sync);
  return()=>{
   document.removeEventListener('pointerdown',sync);
   document.removeEventListener('keydown',sync);
   document.removeEventListener('visibilitychange',sync);
   audio.pause();audio.removeAttribute('src');audio.load();audioRef.current=null;
  };
 },[]);
 useEffect(()=>{
  const audio=audioRef.current;if(!audio)return;
  if(!enabled||document.hidden)audio.pause();
  else if(audio.paused)void audio.play().catch(()=>{/* First tap unlocks playback. */});
 },[enabled]);
}
