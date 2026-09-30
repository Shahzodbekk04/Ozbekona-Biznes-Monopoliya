import {strict as assert} from 'node:assert';
import ts from 'typescript';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'biznes-languages-'));
try{
 for(const name of ['engine','localization']){let source=await readFile(`game/${name}.ts`,'utf8');source=source.replaceAll("'./engine'","'./engine.mjs'");await writeFile(join(dir,`${name}.mjs`),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
 const {newGame,BOARD,act,actor,botAction}=await import(pathToFileURL(join(dir,'engine.mjs')));
 const {formatMoney,tileName,tokenName,cardCopy,levelName,groupName,localizedLog}=await import(pathToFileURL(join(dir,'localization.mjs')));
 assert.equal(formatMoney(15000000,'USD','en'),'$1,250');assert.equal(formatMoney(15000000,'RUB','en'),'100,000 ₽');assert.equal(formatMoney(15000000,'UZS','en'),'15,000,000 UZS');
 for(const lang of ['uz','ru','en']){for(const tile of BOARD){assert.ok(tileName(tile,lang));assert.ok(tileName(tile,lang,true))}for(let i=0;i<20;i++)assert.ok(tokenName(i,lang));for(let i=0;i<16;i++){assert.ok(cardCopy(i,lang).title);assert.ok(cardCopy(i,lang).text)}for(let i=0;i<5;i++)assert.ok(levelName(i,lang));for(let i=0;i<8;i++)assert.ok(groupName(i,lang))}
 let state=newGame([{name:'Shahzod',bot:false},{name:'Aziz',bot:true}]);const snapshot=structuredClone(state);
 for(const currency of ['UZS','RUB','USD'])for(const p of state.players)formatMoney(p.cash,currency,'en');assert.deepEqual(state,snapshot,'Display currency must not mutate balances');
 state.players[0].pos=1;state.phase='purchase';state=act(state,{type:'buy'},'p0');const buy=state.log.at(-1);assert.equal(buy.event.key,'buy');assert.equal(buy.event.amount,BOARD[1].price);assert.match(localizedLog(buy,state,'en','USD'),/bought Chorsu Bazaar for \$50/);assert.match(localizedLog(buy,state,'ru','RUB'),/4\s000 ₽/);assert.equal(localizedLog({...buy,event:undefined},state,'en','USD'),localizedLog(buy,state,'en','USD'),'Old saves must translate amounts too');
 let seed=50;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};state=newGame([{name:'A',bot:true},{name:'B',bot:true}],rng);
 for(let i=0;i<600&&state.phase!=='won';i++){state=act(state,botAction(state),actor(state),rng);for(const entry of state.log){assert.ok(entry.event,'New events must carry localization data');for(const lang of ['ru','en']){const rendered=localizedLog(entry,state,lang,'USD');assert.ok(rendered&&!rendered.includes('Earlier game record')&&!rendered.includes('Запись предыдущей'));}}}
 console.log('PASS: 3 languages, 40 spaces, 20 pieces, all cards and levels; 3 display currencies; unchanged balances; translated live game events.');
}finally{await rm(dir,{recursive:true,force:true})}
