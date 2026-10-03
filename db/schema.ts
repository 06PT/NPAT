import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const gameRooms = sqliteTable('game_rooms', { code: text('code').primaryKey(), state: text('state').notNull(), revision: integer('revision').notNull().default(0), expires: integer('expires').notNull() }, t => [index('idx_game_rooms_expires').on(t.expires)]);
export const gameRates = sqliteTable('game_rates', { key: text('key').primaryKey(), count: integer('count').notNull(), expires: integer('expires').notNull() }, t => [index('idx_game_rates_expires').on(t.expires)]);
