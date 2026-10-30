import { authenticated, date, entity, int, set, text, uuid } from '@microsoft/rayfin-core';

/**
 * Journal des actions du joueur. Niveau, expérience et caractéristiques
 * sont recalculés à partir de ce journal ; il n'est jamais modifié.
 */
@entity()
@authenticated('*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Activite {
  @uuid() id!: string;
  @set('sport', 'lecture', 'anime', 'manga', 'oeuvre', 'certification', 'quete')
  categorie!:
    | 'sport'
    | 'lecture'
    | 'anime'
    | 'manga'
    | 'oeuvre'
    | 'certification'
    | 'quete';
  @set('minute', 'page', 'episode', 'chapitre', 'tome', 'aucune') unite!:
    | 'minute'
    | 'page'
    | 'episode'
    | 'chapitre'
    | 'tome'
    | 'aucune';
  @int({ min: 0 }) quantite!: number;
  @int({ min: 0 }) xp!: number;
  @text({ max: 160 }) libelle!: string;
  @date() faiteLe!: Date;
  /** Appareil qui a saisi l'action : l'écran rejoue les actions venues d'ailleurs. */
  @text({ max: 40 }) appareil!: string;
  @text({ max: 128 }) user_id!: string;
}
