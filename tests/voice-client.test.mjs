import { strict as assert } from 'node:assert';
import ts from 'typescript';
import { readFile,writeFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'voice-client-'));
const source=(await readFile('game/voice-client.ts','utf8')).replace("'./voice-effects'","'./effects.mjs'").replace("'./voice-noise'","'./noise.mjs'");
await writeFile(join(dir,'effects.mjs'),ts.transpileModule(await readFile('game/voice-effects.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
await writeFile(join(dir,'client.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
await writeFile(join(dir,'noise.mjs'),ts.transpileModule(await readFile('game/voice-noise.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {VoiceClient}=await import(pathToFileURL(join(dir,'client.mjs')));
const {VoiceNoise}=await import(pathToFileURL(join(dir,'noise.mjs')));
const {VoiceEffects}=await import(pathToFileURL(join(dir,'effects.mjs')));
const track=()=>({enabled:true,stopped:false,stop(){this.stopped=true;},kind:'audio'});
const stream=t=>({getTracks:()=>[t],getAudioTracks:()=>[t]});
let getMedia, apiJoin, calls=[];
const events=new EventTarget();
globalThis.window={isSecureContext:true,RTCPeerConnection:class{},addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:(constraints)=>{assert.equal(constraints.audio.autoGainControl,false);return getMedia()},enumerateDevices:async()=>[],addEventListener(){},removeEventListener(){}}}});
globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);return body.op==='join'?apiJoin(body):Response.json({members:{},signals:[],cursor:0})};
const session={code:'ABCDEFG',playerId:'player',token:'secret'};
let state;
const make=()=>new VoiceClient(session,s=>{state=s});
try{
 const t1=track();getMedia=async()=>stream(t1);apiJoin=async()=>Response.json({members:{},signals:[],cursor:0,iceServers:[]});
 const c1=make();await c1.join();assert.equal(state.status,'joined');assert.equal(t1.enabled,true);
 c1.toggleMute();assert.equal(t1.enabled,false);assert.equal(state.muted,true);
 c1.toggleMute();assert.equal(t1.enabled,true);
 await c1.close();assert.equal(t1.stopped,true);assert.equal(calls.at(-1).op,'leave');
 // Leaving while the permission prompt is open must never keep a newly granted track alive.
 let permission;const t2=track();getMedia=()=>new Promise(resolve=>permission=resolve);
 const c2=make();const waiting=c2.join();c2.close();permission(stream(t2));await waiting;assert.equal(t2.stopped,true);
 // Leaving while the server registers the participant must clean up both sides.
 let register;const t3=track();getMedia=async()=>stream(t3);apiJoin=()=>new Promise(resolve=>register=resolve);
 const c3=make();const registering=c3.join();await new Promise(resolve=>setImmediate(resolve));const leaving=c3.close();
 register(Response.json({members:{},signals:[],cursor:0,iceServers:[]}));await registering;await leaving;assert.equal(t3.stopped,true);assert.equal(calls.at(-1).op,'leave');
 // A revoked room session releases the microphone, even after user consent.
 const t4=track();getMedia=async()=>stream(t4);apiJoin=async()=>Response.json({error:'forbidden'},{status:403});
 const c4=make();await c4.join();assert.equal(state.status,'off');assert.equal(state.error,'forbidden');assert.equal(t4.stopped,true);
 // Permission rejection remains explicit and does not register a participant.
 const before=calls.filter(c=>c.op==='join').length;getMedia=async()=>{throw new DOMException('denied','NotAllowedError')};
 const c5=make();await c5.join();assert.equal(state.error,'NotAllowedError');assert.equal(calls.filter(c=>c.op==='join').length,before);
 // Device change failures keep the original track; successful changes stop it.
 const old=track(),replacement=track();getMedia=async()=>stream(old);apiJoin=async()=>Response.json({members:{},signals:[],cursor:0,iceServers:[]});
 const c6=make();await c6.join();getMedia=async()=>{throw Error('missing')};await c6.selectDevice('headset');assert.equal(old.stopped,false);
 getMedia=async()=>stream(replacement);await c6.selectDevice('headset');assert.equal(old.stopped,true);assert.equal(replacement.stopped,false);c6.close();assert.equal(replacement.stopped,true);
 // Muting gates the microphone, processed track and every sender, then restores them.
 const raw=track(),processed=track(),senderTrack=track();getMedia=async()=>stream(raw);
 const c7=make();await c7.join();let gateMuted=false;
 c7.effects={stream:stream(processed),setMuted(v){gateMuted=v;processed.enabled=!v;},close(){processed.stop();}};
 c7.outgoing=c7.effects.stream;
 let plays=0,pauses=0;const remote={muted:false,play:async()=>{plays++;},pause(){pauses++;},srcObject:null,remove(){}};
 const pc={getSenders:()=>[{track:senderTrack}],close(){}};
 c7.peers.set('friend',{pc,audio:remote});
 c7.toggleMute();assert.equal(raw.enabled,false);assert.equal(processed.enabled,false);assert.equal(senderTrack.enabled,false);assert.equal(gateMuted,true);
 c7.toggleMute();assert.equal(raw.enabled,true);assert.equal(processed.enabled,true);assert.equal(senderTrack.enabled,true);
 c7.toggleSpeakers();assert.equal(remote.muted,true);assert.ok(pauses>0);const mutedPlays=plays;await c7.unlock();assert.equal(plays,mutedPlays);
 c7.toggleSpeakers();assert.equal(remote.muted,false);assert.ok(plays>mutedPlays);
 // Mute must also win against a play promise that resolves late.
 let playDone;remote.play=()=>new Promise(resolve=>playDone=resolve);const playing=c7.unlock();await new Promise(resolve=>setImmediate(resolve));
 c7.toggleSpeakers();playDone();await playing;assert.equal(remote.muted,true);
 await c7.close();assert.equal(raw.stopped,true);assert.equal(processed.stopped,true);
 console.log('PASS mute regression: raw + processed + sender gates, speaker pause/resume, unlock while muted, late playback race.');
 // Natural mode bypasses the effect graph; replaceTrack must reach every peer.
 const raw8=track(),fxTrack=track();getMedia=async()=>stream(raw8);const c8=make();await c8.join();
 assert.equal(c8.outgoing,c8.stream);assert.equal(c8.effects,undefined);
 c8.context={state:'running',resume:async()=>{},close:async()=>{}};c8.snapshot.effectsAvailable=true;
 let renders=0,fxMuted=false;const fxStream=stream(fxTrack);
 const originalCreate=VoiceEffects.create;
 VoiceEffects.create=async()=>{renders++;return {stream:fxStream,setEffect(){},setMuted(v){fxMuted=v;fxTrack.enabled=!v},replaceInput(){},close(){fxTrack.stop()}}};
 const senders=[0,1].map(()=>({track:raw8,async replaceTrack(t){this.track=t}}));
 for(let i=0;i<2;i++)c8.peers.set('peer'+i,{pc:{getSenders:()=>[senders[i]],close(){}},audio:{pause(){},remove(){}}});
 for(const effect of ['girl','child','man']){await c8.selectEffect(effect);assert.equal(state.effect,effect);assert.ok(senders.every(s=>s.track===fxTrack));assert.equal(state.effectError,false)}
 assert.equal(renders,1);
 c8.toggleMute();assert.equal(raw8.enabled,false);assert.equal(fxTrack.enabled,false);assert.equal(fxMuted,true);
 await c8.selectEffect('natural');assert.ok(senders.every(s=>s.track===raw8));assert.equal(raw8.enabled,false);assert.equal(fxTrack.enabled,false);
 c8.toggleMute();assert.equal(raw8.enabled,true);assert.equal(fxTrack.enabled,false,'Inactive effect stays muted');
 // A failed effect must retain the raw track, not silently transmit a dead stream.
 c8.effects=undefined;VoiceEffects.create=async()=>{throw Error('worklet blocked')};await c8.selectEffect('girl');assert.equal(state.effect,'natural');assert.equal(state.effectError,true);assert.ok(senders.every(s=>s.track===raw8));assert.equal(raw8.enabled,true);
 // A selected effect is not advertised or sent before worklet acknowledgement.
 let acknowledge;let disposed=0;
 VoiceEffects.create=async()=>({stream:fxStream,setEffect(){return new Promise(resolve=>{acknowledge=resolve})},setMuted(v){fxTrack.enabled=!v},replaceInput(){},close(){disposed++}});
 const applying=c8.selectEffect('child');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(state.effect,'natural');assert.ok(senders.every(s=>s.track===raw8));
 acknowledge();await applying;assert.equal(state.effect,'child');assert.ok(senders.every(s=>s.track===fxTrack));
 c8.effects.setEffect=async()=>{throw Error('effect-not-applied')};await c8.selectEffect('man');
 assert.equal(state.effect,'natural');assert.equal(state.effectError,true);assert.equal(c8.effects,undefined);assert.equal(disposed,1);assert.ok(senders.every(s=>s.track===raw8));
 VoiceEffects.create=originalCreate;await c8.close();
 const ui=await readFile('components/voice-chat.tsx','utf8');assert.ok(!ui.includes('masterMuted'),'Music settings cannot disable the voice toggle');
 console.log('PASS routing regression: direct natural track, all peers receive girl/child/man tracks, natural restoration, mute during switch, failed effect fallback, independent voice controls.');
 // Noise cleaning is a base stream; effects layer on it and mute still governs both.
 const raw9=track(),clean9=track(),effect9=track();getMedia=async()=>stream(raw9);const c9=make();await c9.join();
 c9.context={state:'running',sampleRate:48000,resume:async()=>{},close:async()=>{}};c9.snapshot.effectsAvailable=true;
 const cleaned=stream(clean9),changed=stream(effect9);let cleanedInput,fxInput;
 const noiseFactory=VoiceNoise.create,effectFactory=VoiceEffects.create;
 VoiceNoise.create=async(_ctx,input)=>{cleanedInput=input;return {stream:cleaned,setMuted(v){clean9.enabled=!v;},replaceInput(s){cleanedInput=s;},close(){clean9.stop();}}};
 VoiceEffects.create=async(_ctx,input)=>{fxInput=input;return {stream:changed,setEffect(){},setMuted(v){effect9.enabled=!v;},replaceInput(s){fxInput=s;},close(){effect9.stop();}}};
 const s9={track:raw9,async replaceTrack(t){this.track=t;}};c9.peers.set('friend',{pc:{getSenders:()=>[s9],close(){}},audio:{pause(){},remove(){}}});
 await c9.setNoise(true);assert.equal(state.noiseActive,true);assert.equal(s9.track,clean9);assert.equal(cleanedInput,c9.stream);
 await c9.selectEffect('girl');assert.equal(fxInput,cleaned);assert.equal(s9.track,effect9);assert.equal(state.noiseActive,true,'Effect change must preserve noise status');
 c9.toggleMute();assert.equal(raw9.enabled,false);assert.equal(clean9.enabled,false);assert.equal(effect9.enabled,false);
 await c9.selectEffect('natural');assert.equal(s9.track,clean9);assert.equal(clean9.enabled,false);
 c9.toggleMute();assert.equal(clean9.enabled,true);
 await c9.setNoise(false);assert.equal(s9.track,raw9);assert.equal(clean9.stopped,true);assert.equal(state.noiseActive,false);
 VoiceNoise.create=async()=>{throw Error('unavailable')};await c9.setNoise(true);assert.equal(s9.track,raw9);assert.equal(state.noiseError,true);assert.equal(raw9.enabled,true);
 VoiceNoise.create=noiseFactory;VoiceEffects.create=effectFactory;await c9.close();
 console.log('PASS noise routing: raw → cleaned → effect → cleaned → raw, mute/unmute across both processors, cleanup, unavailable model fallback.');
 console.log('PASS voice lifecycle: explicit consent, mute track, leave cleanup, permission race, join race, denied/revoked access, safe microphone replacement. No real audio hardware was used.');
}finally{await rm(dir,{recursive:true,force:true})}
