import { authenticated, date, entity, text, uuid } from '@microsoft/rayfin-core';

/** Profil du joueur : un seul par compte. */
@entity()
@authenticated('*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Joueur {
  @uuid() id!: string;
  @text({ min: 1, max: 40 }) nom!: string;
  @date() creeLe!: Date;
  @text({ max: 128 }) user_id!: string;
}
