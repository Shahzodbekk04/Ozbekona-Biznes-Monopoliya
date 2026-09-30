import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'biznes-api-'));
const sql=new DatabaseSync(':memory:');
sql.exec(await readFile('drizzle/0000_simple_thor_girl.sql','utf8'));
sql.exec(await readFile('drizzle/0001_unique_marten_broadcloak.sql','utf8'));
globalThis.__testEnv = {
 DB: {
  prepare(statement) {
   return {
    bind(...params) {
     return {
      async first() { return sql.prepare(statement).get(...params); },
      async run() { const r=sql.prepare(statement).run(...params); return {meta:{changes:r.changes}}; }
     };
    }
   };
  }
 }
};

for(const [input,output] of [['game/engine.ts','engine.mjs'],['db/rooms.ts','db.mjs'],['db/voice.ts','voice-db.mjs'],['app/api/rooms/route.ts','rooms.mjs'],['app/api/voice/route.ts','voice.mjs']]){
 let source=await readFile(input,'utf8');source=source.replace("import { env } from 'cloudflare:workers';","const env = globalThis.__testEnv;").replaceAll("'@/game/engine'","'./engine.mjs'").replaceAll("'@/db/rooms'","'./db.mjs'").replaceAll("'@/db/voice'","'./voice-db.mjs'");
 await writeFile(join(dir,output),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
}
const {POST:roomPost}=await import(pathToFileURL(join(dir,'rooms.mjs')));
const {POST:voicePost}=await import(pathToFileURL(join(dir,'voice.mjs')));
const call=async(post,body,origin='https://game.test')=>{const r=await post(new Request('https://game.test/api/test',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}));return {status:r.status,...await r.json()}};
const room=b=>call(roomPost,b), voice=b=>call(voicePost,b);
try{
 const host=(await room({op:'create',code:'UZ2026',name:'Host'})).session;
 const guest=(await room({op:'join',code:host.code,name:'Guest'})).session;
 const third=(await room({op:'join',code:host.code,name:'Third'})).session;
 const original=(await room({op:'sync',...host})).room;
 const low=host.playerId<guest.playerId?host:guest,high=low===host?guest:host;
 const a={...low,instance:'one'},b={...high,instance:'two'},c={...third,instance:'three'};
 assert.equal((await voice({op:'join',...a,token:'wrong'})).status,403);
 assert.equal((await call(voicePost,{op:'join',...a},'https://attacker.test')).status,403);
 const ja=await voice({op:'join',...a});assert.equal(ja.status,200);assert.equal(ja.relayConfigured,false);assert.ok(ja.iceServers.length);
 assert.equal((await voice({op:'join',...a})).status,200);
 assert.equal((await voice({op:'join',...a,instance:'other-tab'})).error,'already-connected');
 assert.equal((await voice({op:'join',...b})).status,200);
 await voice({op:'join',...c});
 const offer={op:'signal',...a,to:b.playerId,toInstance:b.instance,call:'call1',type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'};
 assert.equal((await voice(offer)).status,200);
 assert.equal((await voice(offer)).status,200);
 const bv=await voice({op:'sync',...b,after:0});assert.equal(bv.signals.length,1);assert.equal(bv.signals[0].from,a.playerId);
 assert.equal((await voice({op:'sync',...b,after:bv.cursor})).signals.length,0);
 assert.equal((await voice({op:'sync',...c,after:0})).signals.length,0);
 assert.equal((await voice({op:'sync',...a,after:0})).signals.length,0);
 assert.equal((await voice({...offer,sdp:'v=0 m=audio m=video'})).status,400);
 assert.equal((await voice({...offer,sdp:'audio recording'})).status,400);
 assert.equal((await voice({...offer,sdp:'v=0 m=audio '+ 'x'.repeat(26000)})).status,413);
 assert.equal((await voice({...offer,...b,to:a.playerId,toInstance:a.instance})).status,400);
 const answer={...offer,...b,to:a.playerId,toInstance:a.instance,type:'answer'};
 assert.equal((await voice(answer)).status,200);
 assert.equal((await voice({op:'sync',...a})).signals[0].type,'answer');
 await voice({op:'sync',...b,muted:true});assert.equal((await voice({op:'sync',...a})).members[b.playerId].muted,true);
 assert.equal((await room({op:'sync',...host})).room.revision,original.revision);
 assert.equal((await voice({op:'leave',...b})).status,200);
 assert.equal((await voice({...offer,call:'call2'})).error,'peer-left');
 const left=await voice({op:'sync',...a});assert.ok(!left.members[b.playerId]);assert.equal(left.signals.length,0);
 assert.equal((await voice({op:'join',...b,instance:'new-generation'})).status,200);
 assert.equal((await voice({op:'sync',...b})).error,'rejoin');
 assert.equal((await voice(offer)).error,'peer-left');
 for(let i=0;i<9;i++) assert.equal((await voice({...offer,toInstance:'new-generation',call:'rate'+i})).status,200);
 assert.equal((await voice({...offer,toInstance:'new-generation',call:'rate-extra'})).status,429);
 // Presence expiry and stale SDP are pruned on the next room operation.
 const stored=sql.prepare('SELECT data FROM voice_rooms WHERE code=?').get(a.code);const state=JSON.parse(stored.data);
 state.members[b.playerId].seen=Date.now()-21000;
 sql.prepare('UPDATE voice_rooms SET data=? WHERE code=?').run(JSON.stringify(state),a.code);
 const pruned=await voice({op:'sync',...a});assert.ok(!pruned.members[b.playerId]);
 assert.equal(JSON.parse(sql.prepare('SELECT data FROM voice_rooms WHERE code=?').get(a.code).data).signals.length,0);
 globalThis.__testEnv.VOICE_ICE_SERVERS=JSON.stringify([{urls:'turn:relay.example.test:3478',username:'test',credential:'test-only'}]);
 assert.equal((await voice({op:'join',...b})).relayConfigured,true);
 // Revoking a game member also revokes voice permissions.
 const gameRow=JSON.parse(sql.prepare('SELECT data FROM game_rooms WHERE code=?').get(a.code).data);delete gameRow.members[a.playerId];
 sql.prepare('UPDATE game_rooms SET data=? WHERE code=?').run(JSON.stringify(gameRow),a.code);
 assert.equal((await voice({op:'sync',...a})).status,403);
 console.log('PASS voice API: auth, origin, room isolation, private signals, duplicate delivery, cursor, mute, generation guards, expiry, rate limit, TURN config, revoked membership, game state unchanged.');
}finally{sql.close();await rm(dir,{recursive:true,force:true})}
