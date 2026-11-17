/**
 * Graphiques (uPlot) au style de la planche : trait de 2 px, aire à 8 %, grille discrète,
 * libellés à l'encre, dernier point annoté. Une série seule n'a pas de légende : le titre
 * de la carte la nomme. Le graphique est doublé d'un résumé texte pour les lecteurs d'écran.
 */
import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { montantCourt } from '../lib/format.ts'

function couleur(variable: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || '#1e3a2b'
}

function avecOpacite(hex: string, opacite: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacite})`
}

interface SerieGraphique {
  valeurs: (number | null)[]
  /** Variable CSS de la couleur du trait. */
  couleur?: string
  /** Trait pointillé (par exemple, le total versé). */
  pointille?: boolean
  aire?: boolean
  libelle: string
}

interface Props {
  x: number[]
  series: SerieGraphique[]
  /** Bande remplie entre deux séries (indices dans `series`). */
  bande?: [number, number]
  /** Libellé de l'axe des abscisses pour une valeur x. */
  libelleX: (x: number) => string
  hauteur?: number
  resume: string
  annoterDernier?: boolean
}

export function Graphique({ x, series, bande, libelleX, hauteur = 190, resume, annoterDernier = true }: Props) {
  const conteneur = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = conteneur.current
    if (!element) return
    const encre = couleur('--encre-secondaire')
    const filet = couleur('--filet')
    const options: uPlot.Options = {
      width: element.clientWidth,
      height: hauteur,
      legend: { show: false },
      cursor: { show: false },
      padding: [12, 8, 0, 0],
      scales: { x: { time: false } },
      axes: [
        {
          stroke: encre,
          grid: { show: false },
          ticks: { show: false },
          font: '11px Inter, system-ui, sans-serif',
          values: (_u, valeurs) => valeurs.map((v) => libelleX(v)),
          space: 60,
        },
        {
          stroke: encre,
          grid: { stroke: filet, width: 1 },
          ticks: { show: false },
          font: '11px Inter, system-ui, sans-serif',
          values: (_u, valeurs) => valeurs.map((v) => montantCourt(v)),
          size: 44,
          space: 36,
        },
      ],
      series: [
        {},
        ...series.map((s) => {
          const trait = couleur(s.couleur ?? '--vert-marque')
          return {
            label: s.libelle,
            stroke: trait,
            width: s.pointille ? 1.5 : 2,
            dash: s.pointille ? [4, 4] : undefined,
            fill: s.aire ? avecOpacite(trait, 0.08) : undefined,
            points: { show: false },
          }
        }),
      ],
      bands: bande
        ? [{ series: [bande[1] + 1, bande[0] + 1], fill: avecOpacite(couleur('--vert-marque'), 0.12) }]
        : undefined,
      hooks: annoterDernier
        ? {
            draw: [
              (u: uPlot) => {
                const principale = series.findIndex((s) => !s.pointille)
                const valeurs = series[principale]?.valeurs ?? []
                const i = valeurs.length - 1
                const y = valeurs[i]
                const xi = x[i]
                if (y === null || y === undefined || xi === undefined) return
                const ctx = u.ctx
                const px = u.valToPos(xi, 'x', true)
                const py = u.valToPos(y, 'y', true)
                ctx.save()
                ctx.fillStyle = couleur('--vert-marque')
                ctx.beginPath()
                ctx.arc(px, py, 4 * devicePixelRatio, 0, 2 * Math.PI)
                ctx.fill()
                ctx.restore()
              },
            ],
          }
        : undefined,
    }
    const donnees = [x, ...series.map((s) => s.valeurs)] as uPlot.AlignedData
    const graphique = new uPlot(options, donnees, element)
    const observateur = new ResizeObserver(() => {
      graphique.setSize({ width: element.clientWidth, height: hauteur })
    })
    observateur.observe(element)
    return () => {
      observateur.disconnect()
      graphique.destroy()
    }
  }, [x, series, bande, libelleX, hauteur, annoterDernier])

  return (
    <figure className="graphique">
      <div ref={conteneur} className="graphique__zone" aria-hidden="true" />
      <figcaption className="visuellement-masque">{resume}</figcaption>
    </figure>
  )
}

