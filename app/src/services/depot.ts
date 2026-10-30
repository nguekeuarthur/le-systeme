import type { Depot } from '@/systeme/depot';
import { DepotLocal } from '@/systeme/depotLocal';
import { DepotRayfin } from '@/systeme/depotRayfin';

import { getRayfinClient, isHorsLigne } from './rayfinClient';

/** Base SQL de la Fabric App, ou stockage du navigateur en mode hors ligne. */
export function creerDepot(): Depot {
  return isHorsLigne() ? new DepotLocal() : new DepotRayfin(getRayfinClient());
}
