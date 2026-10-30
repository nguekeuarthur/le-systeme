import { authenticated, entity, int, set, text, uuid } from '@microsoft/rayfin-core';

/** Objectif de la quête quotidienne (la progression du jour vient du journal). */
@entity()
@authenticated('*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Quete {
  @uuid() id!: string;
  @set('sport', 'lecture', 'anime', 'manga') categorie!:
    | 'sport'
    | 'lecture'
    | 'anime'
    | 'manga';
  @text({ min: 1, max: 40 }) libelle!: string;
  @int({ min: 1 }) objectif!: number;
  @int({ min: 1 }) pas!: number;
  @int() ordre!: number;
  @text({ max: 128 }) user_id!: string;
}
