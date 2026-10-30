import { SystemePage } from '@/pages/SystemePage';

/**
 * Une seule page : l'intro sert d'écran de connexion, et aucune donnée
 * n'est lue avant que le joueur soit connecté (voir SystemePage).
 */
function App() {
  return <SystemePage />;
}

export default App;
