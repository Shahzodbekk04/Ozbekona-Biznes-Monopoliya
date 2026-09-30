import { env } from 'cloudflare:workers';
import type { VoiceState } from '@/game/voice-types';
function db(){if(!env.DB)throw Error('unavailable');return env.DB}
export async function loadVoice(code:string){const row=await db().prepare('SELECT data, revision FROM voice_rooms WHERE code = ?').bind(code).first<{data:string;revision:number}>();return row?{state:JSON.parse(row.data) as VoiceState,revision:row.revision}:null}
export async function initVoice(code:string){await db().prepare('INSERT OR IGNORE INTO voice_rooms (code,data,revision,updated_at) VALUES (?,?,0,?)').bind(code,JSON.stringify({members:{},signals:[],seq:0}),Date.now()).run()}
export async function saveVoice(code:string,state:VoiceState,revision:number){const result=await db().prepare('UPDATE voice_rooms SET data = ?, revision = ?, updated_at = ? WHERE code = ? AND revision = ?').bind(JSON.stringify(state),revision+1,Date.now(),code,revision).run();return result.meta.changes===1}
export function pruneVoice(state:VoiceState,allowed:string[],now:number){state.members=Object.fromEntries(Object.entries(state.members).filter(([id,m])=>allowed.includes(id)&&now-m.seen<20000));state.signals=state.signals.filter(s=>now-s.created<45000&&state.members[s.from]?.instance===s.fromInstance&&state.members[s.to]?.instance===s.toInstance).slice(-24)}
