import { act, actor, botAction, newGame, type Action } from '@/game/engine';
import { insertRoom, loadRoom, publicRoom, saveRoom } from '@/db/rooms';
import { allowedGameOrigin, gameCorsHeaders } from '@/lib/yandex-cors';
export const dynamic='force-dynamic';
const rng=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export function OPTIONS(req:Request){const origin=allowedGameOrigin(req);return origin?new Response(null,{status:204,headers:gameCorsHeaders(origin)}):new Response(null,{status:403})}
function validToken(value:unknown){if(value===undefined)return 0;if(!Number.isInteger(value)||Number(value)<0||Number(value)>19)throw Error('Figurani tanlang (1–20).');return Number(value)}
function validName(value:unknown){if(typeof value!=='string'||!value.trim()||value.length>24)throw Error('Ismingizni kiriting (1–24 belgi).');return value.trim()}
export async function POST(req:Request){
 const origin=req.headers.get('origin');const external=allowedGameOrigin(req);
 const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(external?gameCorsHeaders(external):{})}});
 try{
 if(origin&&!external&&new URL(origin).origin!==new URL(req.url).origin)return respond({error:'Ruxsat berilmadi.'},403);
 const body=await req.text();if(body.length>4096)return respond({error:'So‘rov juda katta.'},413);
 const b=JSON.parse(body), now=Date.now();
 if(typeof b.code==='string'&&/^[A-Za-z0-9]+$/.test(b.code))b.code=b.code.toUpperCase();
 if(b.op==='create'){
  const name=validName(b.name),playerId=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
  if(typeof b.code!=='string'||! /^[A-Z0-9]{6}$/.test(b.code))return respond({error:'6 ta harf yoki raqamdan iborat kod kiriting.'},400);
  const code=b.code;
  const room={code,host:playerId,seats:[{id:playerId,name,bot:false,token:validToken(b.figure)}],members:{[playerId]:await hash(token)},state:null,revision:0,lastAction:now,seen:{[playerId]:now}};
  if(!await insertRoom(room))return respond({error:'Bu kod oxirgi 24 soatda ishlatilgan. Boshqa kod tanlang.'},409);
  return respond({room:publicRoom(room),session:{code,token,playerId}},201);
 }
 if(typeof b.code!=='string'||! /^(?:[A-Z0-9]{6}|[A-Z2-9]{7})$/.test(b.code))return respond({error:'Xona kodini tekshiring.'},400);
 const room=await loadRoom(b.code);if(!room)return respond({error:'Xona topilmadi. Kodni tekshiring.'},404);
 const revision=room.revision;
 if(b.op==='join'){
  const name=validName(b.name);if(room.state)return respond({error:'Bu xonada o‘yin allaqachon boshlangan.'},409);if(room.seats.length>=4)return respond({error:'Xona to‘la (4 o‘yinchi).'},409);
  const playerId=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();room.seats.push({id:playerId,name,bot:false,token:validToken(b.figure)});room.members[playerId]=await hash(token);room.seen[playerId]=now;
  if(!await saveRoom(room,revision))return respond({error:'Xona yangilandi. Qayta qo‘shiling.'},409);
  return respond({room:publicRoom(room),session:{code:room.code,token,playerId}});
 }
 if(typeof b.playerId!=='string'||typeof b.token!=='string'||b.token.length>100||room.members[b.playerId]!==await hash(b.token))return respond({error:'Xonaga kirish huquqi yo‘q. Qayta qo‘shiling.'},403);
 if(b.op==='sync'){
  let changed=false;if(now-(room.seen[b.playerId]??0)>12000){room.seen[b.playerId]=now;changed=true}
  if(room.state&&room.state.phase!=='won'){
   const id=actor(room.state),player=room.state.players.find(p=>p.id===id)!;
   if(player.bot&&now-room.lastAction>=3200){room.state=act(room.state,botAction(room.state),id,rng);room.lastAction=now;changed=true}
  }
  if(changed&&!await saveRoom(room,revision)){const latest=await loadRoom(b.code);return respond({room:publicRoom(latest!)})}
  return respond({room:publicRoom(room)});
 }
 if(b.op==='figure'){
  const figure=validToken(b.figure),seat=room.seats.find(p=>p.id===b.playerId);if(!seat||seat.bot)return respond({error:'O‘yinchi topilmadi.'},403);seat.token=figure;if(room.state){const player=room.state.players.find(p=>p.id===b.playerId);if(player)player.token=figure;room.state.revision++}
 }else if(b.op==='bot'){
  if(b.playerId!==room.host||room.state||room.seats.length>=4)return respond({error:'Bot qo‘shib bo‘lmaydi.'},400);
  room.seats.push({id:crypto.randomUUID(),name:['Bot · Aziz','Bot · Madina','Bot · Sardor'][Math.max(0,room.seats.filter(p=>p.bot).length)],bot:true,token:Array.from({length:20},(_,i)=>i).find(i=>!room.seats.some(p=>p.token===i))??0});
 }else if(b.op==='removeBot'){
  if(b.playerId!==room.host||room.state)return respond({error:'Bu amal mumkin emas.'},403);
  room.seats=room.seats.filter(p=>p.id!==b.seat||!p.bot);
 }else if(b.op==='start'){
  if(b.playerId!==room.host||room.state||room.seats.length<2)return respond({error:'Boshlash uchun kamida 2 o‘yinchi kerak.'},400);
  room.state=newGame(room.seats,rng);room.lastAction=now;
 }else if(b.op==='takeover'){
  if(b.playerId!==room.host||!room.state||typeof b.seat!=='string'||b.seat===b.playerId)return respond({error:'Bu amal mumkin emas.'},403);
  if(now-(room.seen[b.seat]??now)<60000)return respond({error:'O‘yinchi yaqinda onlayn edi. 60 soniya kuting.'},409);
  const p=room.state.players.find(p=>p.id===b.seat);if(!p||p.bot)return respond({error:'O‘yinchi topilmadi.'},400);p.bot=true;const seat=room.seats.find(p=>p.id===b.seat);if(seat)seat.bot=true;delete room.members[b.seat];room.state.revision++;
 }else if(b.op==='action'){
  if(!room.state)return respond({error:'O‘yin boshlanmagan.'},400);
  if(b.gameRevision!==room.state.revision)return respond({error:'O‘yin yangilandi. Amalni qayta tanlang.',room:publicRoom(room)},409);
  if(room.state.players.find(p=>p.id===b.playerId)?.bot)return respond({error:'Navbat botga topshirilgan.'},403);
  const a=b.action;if(!a||typeof a.type!=='string')return respond({error:'Amalni tanlang.'},400);
  room.state=act(room.state,{type:a.type,tile:a.tile} as Action,b.playerId,rng);room.lastAction=now;
 }else return respond({error:'Noma’lum so‘rov.'},400);
 if(!await saveRoom(room,revision)){const latest=await loadRoom(b.code);return respond({error:'Xona yangilandi. Qayta urinib ko‘ring.',room:publicRoom(latest!)},409)}
 return respond({room:publicRoom(room)});
}catch(error){const message=error instanceof Error?error.message:'Xatolik';if(/D1|SQLITE|database|binding|JSON|Unexpected/i.test(message)){console.error('Room service error',message);return respond({error:'Xona bilan aloqa uzildi. Birozdan keyin qayta urinib ko‘ring.'},503)}return respond({error:message},400)}}
