import { env } from 'cloudflare:workers';
import { Room } from '@/game/room';
export type StoredRoom=Room&{members:Record<string,string>};
function db(){if(!env.DB)throw Error('Xonalar xizmati vaqtincha ishlamayapti.');return env.DB}
export async function loadRoom(code:string){const row=await db().prepare('SELECT data FROM game_rooms WHERE code = ?').bind(code).first<{data:string}>();return row?JSON.parse(row.data) as StoredRoom:null}
export async function insertRoom(room:StoredRoom){
 const now=Date.now();
 // One atomic claim: concurrent creates cannot both succeed. A room remains
 // reserved until 24 hours after its last activity, even if everyone leaves.
 const result=await db().prepare(`INSERT INTO game_rooms (code, data, revision, updated_at) VALUES (?, ?, ?, ?)
 ON CONFLICT(code) DO UPDATE SET data=excluded.data, revision=excluded.revision, updated_at=excluded.updated_at
 WHERE game_rooms.updated_at <= ?`).bind(room.code,JSON.stringify(room),room.revision,now,now-86400000).run();
 return result.meta.changes===1;
}
export async function saveRoom(room:StoredRoom,expected:number){room.revision=expected+1;const r=await db().prepare("UPDATE game_rooms SET data = ?, revision = ?, updated_at = ? WHERE code = ? AND revision = ? AND json_extract(data, '$.host') = ?").bind(JSON.stringify(room),room.revision,Date.now(),room.code,expected,room.host).run();return r.meta.changes===1}
export function publicRoom(room:StoredRoom):Room{const {members:_,...visible}=room;return {...visible,state:visible.state?{...visible.state,decks:[[],[]]}:null}}
