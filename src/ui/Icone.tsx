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
  telecharger: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  importer: <path d="M12 16V5M7 9.5l5-5 5 5M5 20h14" />,
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
