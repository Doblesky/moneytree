/**
 * Pictogrammes au trait, repris de la planche et des écrans (grille 24 px, trait 1,8,
 * extrémités arrondies). L'engrenage des Réglages n'existe pas dans les maquettes : il est
 * dessiné dans le même style.
 */
const TRACES = {
  accueil: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  parcours: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
    </>
  ),
  simulateur: (
    <>
      <path d="M4 20h16" />
      <path d="M5 16l4.5-4.5 3 3L19 8" />
      <path d="M15 8h4v4" />
    </>
  ),
  carriere: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
      <path d="M3.5 12.5h17" />
    </>
  ),
  reglages: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
      <circle cx="12" cy="12" r="6.6" />
    </>
  ),
  retour: <path d="M15 5l-7 7 7 7" />,
  suivant: <path d="M9 6l6 6-6 6" />,
  cadenas: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  cadenasOuvert: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </>
  ),
  actualiser: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9" />
      <path d="M19.5 4.5V9H15" />
    </>
  ),
  telecharger: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  importer: <path d="M12 16V5M7 9.5l5-5 5 5M5 20h14" />,
  fermer: <path d="M6 6l12 12M18 6L6 18" />,
  coche: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  croix: <path d="M7 7l10 10M17 7L7 17" />,
  lieu: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  bouclier: <path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" />,
  maison: (
    <>
      <path d="M4 11 12 4.5 20 11" />
      <path d="M6 9.5V19.5h12V9.5" />
      <path d="M10 19.5v-5h4v5" />
    </>
  ),
  pousse: (
    <>
      <path d="M12 20v-8" />
      <path d="M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5z" />
      <path d="M12 14c0-3-2.3-5-5.5-5 0 3 2.3 5 5.5 5z" />
    </>
  ),
  livre: (
    <>
      <path d="M4.5 5.5c2.5-1 5-1 7.5.5v13c-2.5-1.5-5-1.5-7.5-.5z" />
      <path d="M19.5 5.5c-2.5-1-5-1-7.5.5v13c2.5-1.5 5-1.5 7.5-.5z" />
    </>
  ),
  loupe: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  signet: <path d="M7 4.5h10v15l-5-3.5-5 3.5z" />,
  sauter: <path d="M6 6l7 6-7 6M17 6v12" />,
  calendrier: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  salaire: (
    <>
      <rect x="3.5" y="6.5" width="17" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  courbe: (
    <>
      <path d="M4 19h16" />
      <path d="M5 15l4-4 3 3 7-7" />
    </>
  ),
  crayon: <path d="M5 19l1-4L16 5l3 3L9 18zM14 7l3 3" />,
  medaille: (
    <>
      <circle cx="12" cy="14" r="5" />
      <path d="M9 9.5 7 3.5h4l1 3 1-3h4l-2 6" />
    </>
  ),
  flamme: <path d="M12 20.5c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5 3.5-8.4 1.4 1.4 2 2.8 2 4 1-1 1.8-2.6 1.8-4.5 2.8 2 4.7 5.2 4.7 8.9 0 3.2-2.4 5.6-6 5.6z" />,
} as const

export type NomIcone = keyof typeof TRACES

interface Props {
  nom: NomIcone
  taille?: number
  epaisseur?: number
}

export function Icone({ nom, taille = 24, epaisseur = 1.8 }: Props) {
  return (
    <svg
      aria-hidden="true"
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none' }}
    >
      {TRACES[nom]}
    </svg>
  )
}
