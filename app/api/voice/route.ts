import { env } from 'cloudflare:workers';
import { loadRoom } from '@/db/rooms';
import { initVoice, loadVoice, saveVoice, pruneVoice } from '@/db/voice';
import { allowedGameOrigin, gameCorsHeaders } from '@/lib/yandex-cors';
export const dynamic='force-dynamic';
export function OPTIONS(req:Request){const origin=allowedGameOrigin(req);return origin?new Response(null,{status:204,headers:gameCorsHeaders(origin)}):new Response(null,{status:403})}
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(v);
function iceConfig(){const configured=(env as unknown as Record<string,string>).VOICE_ICE_SERVERS;let extra:RTCIceServer[]=[];if(configured){const parsed=JSON.parse(configured);if(!Array.isArray(parsed)||parsed.length>8)throw Error('voice-config');extra=parsed.filter(s=>s&&typeof s==='object'&&(typeof s.urls==='string'||Array.isArray(s.urls)))}return {iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun.cloudflare.com:3478']},...extra],relayConfigured:extra.some(s=>(Array.isArray(s.urls)?s.urls:[s.urls]).some(u=>/^turns?:/.test(u)))};}
export async function POST(req:Request){
 const origin=req.headers.get('origin');const external=allowedGameOrigin(req);
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(external?gameCorsHeaders(external):{})}});
 try{
 if(origin&&!external&&new URL(origin).origin!==new URL(req.url).origin)return reply({error:'forbidden'},403);
 const text=await req.text();if(text.length>26000)return reply({error:'too-large'},413);let b;try{b=JSON.parse(text)}catch{return reply({error:'invalid'},400)}
 if(!b||!['join','sync','signal','leave'].includes(b.op)||typeof b.code!=='string'||! /^(?:[A-Z0-9]{6}|[A-Z2-9]{7})$/.test(b.code)||!validId(b.playerId)||typeof b.token!=='string'||b.token.length>100||!validId(b.instance))return reply({error:'invalid'},400);
 const room=await loadRoom(b.code);if(!room||room.members[b.playerId]!==await hash(b.token)||!room.seats.some(p=>p.id===b.playerId&&!p.bot))return reply({error:'forbidden'},403);
 const allowed=room.seats.filter(p=>!p.bot&&room.members[p.id]).map(p=>p.id),now=Date.now();
 let loaded=await loadVoice(b.code);if(!loaded){if(b.op!=='join')return reply({error:'rejoin'},409);await initVoice(b.code);loaded=await loadVoice(b.code)}
 for(let retry=0;retry<4;retry++){
  if(!loaded)return reply({error:'unavailable'},503);const {state,revision}=loaded,before=JSON.stringify(state);pruneVoice(state,allowed,now);
  if(b.op==='join'){
   const existing=state.members[b.playerId];if(existing&&existing.instance!==b.instance)return reply({error:'already-connected'},409);
   state.members[b.playerId]={instance:b.instance,muted:!!b.muted,seen:now};
  }else{
   const member=state.members[b.playerId];if(!member||member.instance!==b.instance)return reply({error:'rejoin'},409);
   if(b.op==='leave'){delete state.members[b.playerId];pruneVoice(state,allowed,now)}
   else {if(now-member.seen>4500||member.muted!==!!b.muted){member.seen=now;member.muted=!!b.muted}
    if(b.op==='signal'){
     if(!validId(b.to)||b.to===b.playerId||!allowed.includes(b.to)||!validId(b.toInstance)||!validId(b.call)||!['offer','answer'].includes(b.type)||typeof b.sdp!=='string'||b.sdp.length>22000||!b.sdp.startsWith('v=0')||!b.sdp.includes('m=audio')||b.sdp.includes('m=video'))return reply({error:'invalid-signal'},400);
     if(state.members[b.to]?.instance!==b.toInstance)return reply({error:'peer-left'},409);
     // One elected offerer per pair prevents negotiation collisions.
     if((b.type==='offer'&&b.playerId>b.to)||(b.type==='answer'&&b.playerId<b.to))return reply({error:'invalid-signal'},400);
     const duplicate=state.signals.some(s=>s.from===b.playerId&&s.fromInstance===b.instance&&s.to===b.to&&s.toInstance===b.toInstance&&s.call===b.call&&s.type===b.type);
     if(!duplicate){if(state.signals.filter(s=>s.from===b.playerId&&now-s.created<10000).length>=9)return reply({error:'rate-limit'},429);state.signals.push({id:++state.seq,from:b.playerId,to:b.to,fromInstance:b.instance,toInstance:b.toInstance,call:b.call,type:b.type,sdp:b.sdp,created:now});state.signals=state.signals.slice(-24)}
    }
   }
  }
  if(JSON.stringify(state)!==before&&!await saveVoice(b.code,state,revision)){loaded=await loadVoice(b.code);continue}
  if(b.op==='signal'||b.op==='leave')return reply({ok:true});
  const after=Number.isSafeInteger(b.after)&&b.after>=0?b.after:0;
  return reply({members:state.members,signals:state.signals.filter(s=>s.to===b.playerId&&s.toInstance===b.instance&&s.id>after),cursor:state.seq,...(b.op==='join'?iceConfig():{})});
 }
 return reply({error:'retry'},409);
 }catch{console.error('Voice signalling service unavailable');return reply({error:'unavailable'},503)}
}
