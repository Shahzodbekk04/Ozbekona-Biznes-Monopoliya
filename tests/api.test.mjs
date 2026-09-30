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

for(const [input,output] of [['game/engine.ts','engine.mjs'],['db/rooms.ts','db.mjs'],['app/api/rooms/route.ts','route.mjs']]){
 let source=await readFile(input,'utf8');source=source.replace("import { env } from 'cloudflare:workers';","const env = globalThis.__testEnv;").replaceAll("'@/game/engine'","'./engine.mjs'").replaceAll("'@/db/rooms'","'./db.mjs'");
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 await writeFile(join(dir,output),js);
}
const {POST}=await import(pathToFileURL(join(dir,'route.mjs')));
const api=async(body)=>{const r=await POST(new Request('https://game.test/api/rooms',{method:'POST',headers:{'Origin':'https://game.test'},body:JSON.stringify(body)}));return {status:r.status,...await r.json()}};
try{
 const a=await api({op:'create',code:'001234',name:'Shahzod',figure:19});assert.equal(a.status,201);assert.equal(a.room.seats.length,1);assert.ok(!a.room.members);assert.equal(a.session.code,'001234');
 assert.equal(a.room.seats[0].token,19);const host=a.session,code=host.code;
 assert.equal((await api({op:'create',code,name:'Duplicate'})).status,409);
 for(const invalid of ['12345','1234567','12!456','АБ1234','UZ 123',123456,undefined])assert.equal((await api({op:'create',code:invalid,name:'Invalid'})).status,400);
 const alpha=await api({op:'create',code:'uz2026',name:'Letters'});assert.equal(alpha.status,201);assert.equal(alpha.session.code,'UZ2026');assert.equal((await api({op:'join',code:'uZ2026',name:'Friend'})).status,200);assert.equal((await api({op:'create',code:'UZ2026',name:'Duplicate case'})).status,409);
 const race=await Promise.all([api({op:'create',code:'999999',name:'One'}),api({op:'create',code:'999999',name:'Two'})]);assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
 const winner=race.find(r=>r.status===201);assert.equal((await api({op:'sync',...winner.session})).room.host,winner.session.playerId);
 const b=await api({op:'join',code,name:'Do‘st',figure:12});assert.equal(b.status,200);const guest=b.session;assert.equal(b.room.seats[1].token,12);
 const denied=await api({op:'sync',...host,token:'wrong'});assert.equal(denied.status,403);
 const tooEarly=await api({op:'start',...guest});assert.equal(tooEarly.status,400);
 const bot=await api({op:'bot',...host});assert.equal(bot.room.seats.length,3);
 const started=await api({op:'start',...host});assert.equal(started.room.state.players.length,3);assert.deepEqual(started.room.state.decks,[[],[]]);assert.equal(started.room.state.players[0].token,19);assert.equal(started.room.state.players[1].token,12);
 const invalidTurn=await api({op:'action',...guest,gameRevision:0,action:{type:'roll'}});assert.equal(invalidTurn.status,400);
 const first=await api({op:'action',...host,gameRevision:0,action:{type:'roll',dice:[6,6]}});assert.equal(first.status,200);assert.equal(first.room.state.revision,1);
 const duplicate=await api({op:'action',...host,gameRevision:0,action:{type:'roll'}});assert.equal(duplicate.status,409);
 const sync=await api({op:'sync',...guest});assert.deepEqual(sync.room.state,first.room.state);
 const figure=await api({op:'figure',...guest,figure:18});assert.equal(figure.status,200);assert.equal(figure.room.state.players[1].token,18);assert.equal(figure.room.state.players[0].token,19);const sharedFigure=await api({op:'sync',...host});assert.equal(sharedFigure.room.state.players[1].token,18);const invalidFigure=await api({op:'figure',...guest,figure:20});assert.equal(invalidFigure.status,400);
 const late=await api({op:'join',code,name:'Kechikkan'});assert.equal(late.status,409);
 const cross=await POST(new Request('https://game.test/api/rooms',{method:'POST',headers:{'Origin':'https://other.test'},body:JSON.stringify({op:'create',name:'X'})}));assert.equal(cross.status,403);
 const c=await api({op:'create',code:'654321',name:'Concurrent'});
 const joins=await Promise.all([api({op:'join',code:c.session.code,name:'One'}),api({op:'join',code:c.session.code,name:'Two'})]);assert.ok(joins.some(r=>r.status===200));const check=await api({op:'sync',...c.session});assert.equal(check.room.seats.length,1+joins.filter(r=>r.status===200).length);
 const legacy=await api({op:'create',code:'000000',name:'Legacy'});const data=JSON.parse(sql.prepare('SELECT data FROM game_rooms WHERE code=?').get('000000').data);data.code='ABCDEFG';sql.prepare('UPDATE game_rooms SET code=?,data=? WHERE code=?').run('ABCDEFG',JSON.stringify(data),'000000');assert.equal((await api({op:'join',code:'ABCDEFG',name:'Old invite'})).status,200);
 // The database claim must enforce cooldown across all clients and restarts.
 const day=86400000,clock=Date.now,now=clock();Date.now=()=>now;
 const dayRoom=await api({op:'create',code:'DAY123',name:'Day one'});
 const {loadRoom,saveRoom}=await import(pathToFileURL(join(dir,'db.mjs')));const staleRoom=await loadRoom('DAY123');
 sql.prepare('UPDATE game_rooms SET updated_at=? WHERE code=?').run(now-day+1,'DAY123');
 assert.equal((await api({op:'create',code:'day123',name:'Too soon'})).status,409);
 sql.prepare('UPDATE game_rooms SET updated_at=? WHERE code=?').run(now-day,'DAY123');
 const reclaimed=await Promise.all([api({op:'create',code:'DAY123',name:'New one'}),api({op:'create',code:'day123',name:'New two'})]);
 assert.deepEqual(reclaimed.map(r=>r.status).sort(),[201,409]);
 assert.equal((await api({op:'sync',...dayRoom.session})).status,403,'Old credentials cannot access a reused room');
 assert.equal(await saveRoom(staleRoom,0),false,'A delayed write cannot overwrite a new room with the same revision');
 assert.equal((await api({op:'sync',...reclaimed.find(r=>r.status===201).session})).status,200);
 Date.now=clock;
 console.log('PASS custom codes: letters/digits, case normalization, leading zeros, invalid symbols, atomic 24-hour reuse, stale-session rejection, concurrent conflicts, legacy invitations.');
 console.log('PASS API: create, join, bot, start, authentication, turn guard, revision guard, shared state, hidden deck, late join, origin, concurrent writes.');
}finally{sql.close();await rm(dir,{recursive:true,force:true})}
