import { Activite } from './Activite.js';
import { Certification } from './Certification.js';
import { Joueur } from './Joueur.js';
import { Oeuvre } from './Oeuvre.js';
import { Quete } from './Quete.js';

export type SystemeSchema = {
  Joueur: Joueur;
  Quete: Quete;
  Oeuvre: Oeuvre;
  Certification: Certification;
  Activite: Activite;
};

export const schema = [Joueur, Quete, Oeuvre, Certification, Activite];
