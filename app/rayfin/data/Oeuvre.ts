import {
  authenticated,
  boolean,
  date,
  entity,
  int,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

/** Anime, manga ou livre suivi par le joueur. */
@entity()
@authenticated('*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Oeuvre {
  @uuid() id!: string;
  @set('anime', 'manga', 'livre') type!: 'anime' | 'manga' | 'livre';
  @set('papier', 'en_ligne') format!: 'papier' | 'en_ligne';
  @set('episode', 'chapitre', 'tome', 'page') unite!:
    | 'episode'
    | 'chapitre'
    | 'tome'
    | 'page';
  @text({ min: 1, max: 120 }) titre!: string;
  @int({ min: 0 }) progression!: number;
  @int({ min: 1 }) total!: number;
  @boolean() terminee!: boolean;
  @date({ optional: true }) termineeLe?: Date;
  @date() creeLe!: Date;
  @text({ max: 128 }) user_id!: string;
}
