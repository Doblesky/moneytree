/**
 * Monogramme MoneyTree, version simplifiée de la planche (« sous 64 px : trois cernes,
 * traits épais »). Un arbre dont la couronne est faite de cernes de croissance.
 * Il prend la couleur du texte courant (currentColor).
 */
const CERNES = [
  'M88.0 50.0L85.9 53.2L85.0 56.3L85.2 60.0L84.6 63.8L81.9 66.7L77.5 68.0L73.1 68.6L69.6 70.0L66.2 72.4L62.2 74.4L57.8 74.4L53.8 72.4L50.4 70.0L46.9 68.6L42.5 68.0L38.1 66.7L35.4 63.8L34.8 60.0L35.0 56.3L34.1 53.2L32.0 50.0L30.5 46.3L31.5 42.8L34.8 40.0L38.4 37.9L40.8 35.4L42.5 32.0L45.1 28.8L49.1 27.2L53.8 27.6L58.0 28.6L62.0 28.6L66.2 27.6L70.9 27.2L74.9 28.8L77.5 32.0L79.2 35.4L81.6 37.9L85.2 40.0L88.5 42.8L89.5 46.3Z',
  'M78.5 50.0L77.1 52.1L76.5 54.2L76.6 56.6L76.3 59.1L74.4 61.0L71.5 61.9L68.6 62.3L66.3 63.2L64.1 64.8L61.5 66.1L58.5 66.1L55.9 64.8L53.7 63.2L51.4 62.3L48.5 61.9L45.6 61.0L43.7 59.1L43.4 56.6L43.5 54.2L42.9 52.1L41.5 50.0L40.5 47.6L41.2 45.2L43.4 43.4L45.7 42.0L47.3 40.3L48.5 38.1L50.2 36.0L52.8 35.0L55.9 35.2L58.7 35.8L61.3 35.8L64.1 35.2L67.2 35.0L69.8 36.0L71.5 38.1L72.7 40.3L74.3 42.0L76.6 43.4L78.8 45.2L79.5 47.6Z',
  'M69.0 50.0L68.3 51.0L68.0 52.0L68.1 53.2L67.9 54.4L67.0 55.3L65.6 55.8L64.2 56.0L63.1 56.4L62.0 57.2L60.7 57.8L59.3 57.8L58.0 57.2L56.9 56.4L55.8 56.0L54.4 55.8L53.0 55.3L52.1 54.4L51.9 53.2L52.0 52.0L51.7 51.0L51.0 50.0L50.6 48.8L50.9 47.7L51.9 46.8L53.1 46.1L53.9 45.3L54.4 44.2L55.2 43.2L56.5 42.7L58.0 42.8L59.4 43.1L60.6 43.1L62.0 42.8L63.5 42.7L64.8 43.2L65.6 44.2L66.1 45.3L66.9 46.1L68.1 46.8L69.1 47.7L69.4 48.8Z',
]

interface Props {
  taille?: number
  /** Texte lu par les lecteurs d'écran ; absent, le monogramme est décoratif. */
  libelle?: string
}

export function Monogramme({ taille = 28, libelle }: Props) {
  const accessibilite = libelle
    ? { role: 'img', 'aria-label': libelle }
    : { 'aria-hidden': true as const }
  return (
    <svg width={taille} height={taille} viewBox="0 0 120 120" {...accessibilite}>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="5" />
      {CERNES.map((d) => (
        <path
          key={d.slice(0, 12)}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="4.2"
          strokeLinejoin="round"
        />
      ))}
      <circle cx="60" cy="50" r="3.4" fill="currentColor" />
      <path
        d="M55.5 72 C56.5 79 56 85 52 91 L46 94 L74 94 L68 91 C64 85 63.5 79 64.5 72 Z"
        fill="currentColor"
      />
      <path d="M38 97 H82" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}
