import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('game_rooms',{
 code:text('code').primaryKey(),
 data:text('data').notNull(),
 revision:integer('revision').notNull().default(0),
 updatedAt:integer('updated_at').notNull(),
});
// Transient WebRTC negotiation metadata only; no audio recordings.
export const voiceRooms=sqliteTable('voice_rooms',{
 code:text('code').primaryKey(),
 data:text('data').notNull(),
 revision:integer('revision').notNull().default(0),
 updatedAt:integer('updated_at').notNull(),
});
