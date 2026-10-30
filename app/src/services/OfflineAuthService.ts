import type { AuthUser, IAuthService } from './IAuthService';

const CLE_SESSION = 'le-systeme.session-locale';
const JOUEUR_LOCAL: AuthUser = { id: 'joueur-local', email: 'joueur@local', name: 'Joueur' };

/**
 * Mode hors ligne : aucun backend Rayfin n'est configuré (pas encore de
 * `rayfin up`). Pas de compte, les données restent dans ce navigateur.
 */
export class OfflineAuthService implements IAuthService {
  readonly fabricAuthEnabled = false;

  async signIn(): Promise<AuthUser> {
    localStorage.setItem(CLE_SESSION, '1');
    return JOUEUR_LOCAL;
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(CLE_SESSION);
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return localStorage.getItem(CLE_SESSION) ? JOUEUR_LOCAL : null;
  }

  async initEmbeddedAuth(): Promise<AuthUser | null> {
    return null;
  }
}
