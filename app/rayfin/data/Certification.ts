import { authenticated, date, entity, text, uuid } from '@microsoft/rayfin-core';

/** Certification obtenue : chacune fait monter le rang de chasseur. */
@entity()
@authenticated('*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Certification {
  @uuid() id!: string;
  @text({ min: 2, max: 20 }) code!: string;
  @text({ max: 120, optional: true }) intitule?: string;
  @date() obtenueLe!: Date;
  @text({ max: 128 }) user_id!: string;
}
