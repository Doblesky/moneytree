/**
 * Premier lancement (cahier des charges, « Premières minutes ») : trois questions (salaire
 * visé, ville, objectif), puis un seul écran : le futur salaire net et ce que deviennent
 * 200 € placés chaque mois pendant 30 ans. Tout reste sur le téléphone.
 */
import { useEffect, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useProfil } from '../../app/donnees.ts'
import { useProjection } from '../../app/useProjection.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { rendementsReels, SOURCES_HISTORIQUE, SERIES, libelleMois } from '../../engine/marches.ts'
import type { GrilleIndiciaire } from '../../data/params/schema.ts'
import { bulletinMensuel, positionStagiaire } from '../../engine/fonctionPublique.ts'
import { brutVersNet, netMensuelVersBrutAnnuel } from '../../engine/salaire.ts'
import { formatMontant, formatNombre } from '../../lib/format.ts'
import {
  estEtapeProf,
  estIdMetier,
  IDS_METIER,
  METIER_PAR_DEFAUT,
  METIERS,
  type EtapeProf,
  type IdMetier,
} from '../../profils/metiers.ts'
import type { Objectif, Profil } from '../../storage/db.ts'
import { modifierProfil } from '../../storage/profil.ts'
import { Graphique } from '../../ui/Graphique.tsx'
import { Icone, type NomIcone } from '../../ui/Icone.tsx'
import { Monogramme } from '../../ui/Monogramme.tsx'
import { Rosace } from '../../ui/Rosace.tsx'

const VILLES = ['Toulouse', 'Paris', 'Lyon', 'Bordeaux'] as const
const SALAIRES_RAPIDES = [36000, 39000, 42000, 46000]

const OBJECTIFS: { id: Objectif; titre: string; detail: string; icone: NomIcone }[] = [
  { id: 'precaution', titre: 'Me constituer une épargne de précaution', detail: 'Avoir de quoi faire face à un imprévu.', icone: 'bouclier' },
  { id: 'immobilier', titre: 'Préparer un achat immobilier', detail: 'Apport, crédit, mensualités : y voir clair.', icone: 'maison' },
  { id: 'long-terme', titre: 'Faire grandir mon épargne sur le long terme', detail: 'Comprendre les marchés et le temps long.', icone: 'pousse' },
  { id: 'comprendre', titre: 'D’abord comprendre comment tout ça marche', detail: 'Les bases, sans pression.', icone: 'livre' },
]

const VERSEMENT_REVELATION = 200
const DUREE_REVELATION_MOIS = 360
const INCREMENTS_ANNEES = [5, 10]

/** Profil prof : où l'on en est, pour rendre les exemples parlants. */
const ETAPES_PROF_CHOIX: { id: EtapeProf; titre: string; detail: string }[] = [
  { id: 'concours', titre: 'Je prépare le concours', detail: 'En licence, ou en reprise d’études.' },
  { id: 'eleve', titre: 'Admis·e : élève fonctionnaire', detail: 'Première année du master M2E, rémunérée.' },
  { id: 'stagiaire', titre: 'Fonctionnaire stagiaire', detail: 'Deuxième année : mi-temps devant élèves.' },
  { id: 'titulaire', titre: 'Déjà titulaire', detail: 'Tu enseignes, et tu veux y voir clair.' },
]

function EnTeteLancement({
  etape,
  onRetour,
  onPasser,
}: {
  etape: number
  onRetour?: (() => void) | undefined
  /** Absent à l'étape du profil : on ne la passe pas. */
  onPasser?: (() => void) | undefined
}) {
  return (
    <header className="lancement__entete">
      <div className="lancement__barre">
        <span className="lancement__marque">
          <Monogramme taille={28} />
          <span className="entete__nom">MoneyTree</span>
        </span>
        {onPasser ? (
          <button type="button" className="lien-discret" onClick={onPasser}>
            Passer
          </button>
        ) : null}
      </div>
      <div className="lancement__progression">
        {onRetour ? (
          <button type="button" className="bouton-icone bouton-icone--clair" aria-label="Question précédente" onClick={onRetour}>
            <Icone nom="retour" epaisseur={2} />
          </button>
        ) : null}
        <span className="surtitre">{etape === 0 ? 'Ton profil' : `Question ${String(etape)} sur 3`}</span>
        <span className="points-etapes" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span key={n} className={n === etape ? 'actif' : n < etape ? 'fait' : ''} />
          ))}
        </span>
      </div>
    </header>
  )
}

export function EcranLancement() {
  const profil = useProfil()
  // Attend le profil : on reprend les réponses déjà données si l'on revoit l'introduction.
  if (profil === undefined) return null
  return <Questions profil={profil} />
}

function estObjectif(texte: string | undefined): texte is Objectif {
  return OBJECTIFS.some((o) => o.id === texte)
}

function Questions({ profil }: { profil: Profil }) {
  const naviguer = useNavigate()
  const p = parametres2026()
  const points = p['cotisations.salarieCadre'].valeur
  // Étape 0 : le profil, puis trois questions. Une installation existante revoit son choix.
  const [etape, setEtape] = useState(0)
  const [metier, setMetier] = useState<IdMetier | null>(estIdMetier(profil.metier) ? profil.metier : null)
  const [etapeProf, setEtapeProf] = useState<EtapeProf>(estEtapeProf(profil.etapeProf) ? profil.etapeProf : 'concours')
  const prof = metier === 'prof-second-degre'
  const [mode, setMode] = useState<'brut' | 'net'>('brut')
  const [saisie, setSaisie] = useState(String(Math.round(profil.salaireViseBrutAnnuel ?? 42000)))
  const [ville, setVille] = useState<string>(profil.ville ?? 'Toulouse')
  const [recherche, setRecherche] = useState('')
  const [objectif, setObjectif] = useState<Objectif>(estObjectif(profil.objectif) ? profil.objectif : 'long-terme')
  const idSalaire = useId()
  const idVille = useId()

  useEffect(() => {
    document.title = 'Bienvenue · MoneyTree'
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [etape])

  const montantSaisi = Number(saisie.replace(/\s/g, '').replace(',', '.'))
  const saisieValide = Number.isFinite(montantSaisi) && montantSaisi > 0
  const brutAnnuel = saisieValide
    ? mode === 'brut'
      ? montantSaisi
      : netMensuelVersBrutAnnuel(montantSaisi, points)
    : 0

  async function terminer(passer: boolean) {
    const reponses = prof ? { etapeProf, ville, objectif } : { salaireViseBrutAnnuel: Math.round(brutAnnuel), ville, objectif }
    await modifierProfil({
      lancementTermine: true,
      metier: metier ?? METIER_PAR_DEFAUT,
      ...(passer ? {} : reponses),
    })
    await naviguer(passer ? '/' : '/parcours/0/1', { replace: true })
  }

  const passer = () => {
    void terminer(true)
  }

  if (etape === 4) {
    return prof ? (
      <RevelationProf etape={etapeProf} onCommencer={() => void terminer(false)} />
    ) : (
      <Revelation brutAnnuel={brutAnnuel} onCommencer={() => void terminer(false)} />
    )
  }

  return (
    <div className="lancement">
      <EnTeteLancement
        etape={etape}
        onRetour={
          etape > 0
            ? () => {
                setEtape(etape - 1)
              }
            : undefined
        }
        onPasser={etape > 0 ? passer : undefined}
      />
      <main className="lancement__contenu apparition" key={etape}>
        {etape === 0 ? (
          <>
            <h1 className="titre-question">Pour quel métier veux-tu apprendre ?</h1>
            <p className="texte-secondaire">
              Les bases de la finance sont les mêmes pour tout le monde ; les exemples, les chiffres, les cas d’école et le
              mode carrière suivent ton métier. Tu pourras changer dans les réglages.
            </p>
            <div className="choix-liste" role="radiogroup" aria-label="Profils">
              {IDS_METIER.map((id) => {
                const m = METIERS[id]
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={metier === id}
                    className="choix choix--grand"
                    onClick={() => {
                      setMetier(id)
                    }}
                  >
                    <span className="choix__icone">
                      <Icone nom={m.icone} taille={20} />
                    </span>
                    <span className="choix__texte">
                      <span className="choix__titre">{m.libelle}</span>
                      <span className="texte-secondaire">{m.detail}</span>
                    </span>
                    <span className="choix__coche" aria-hidden="true">
                      {metier === id ? <Icone nom="coche" taille={14} epaisseur={3} /> : null}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="note-confidentialite">
              <Icone nom="bouclier" taille={18} />
              Ton choix reste sur ton téléphone.
            </p>
          </>
        ) : null}

        {etape === 1 && prof ? (
          <>
            <h1 className="titre-question">Où en es-tu ?</h1>
            <p className="texte-secondaire">
              Depuis la session 2026, on passe le concours dès la licence, puis deux années de formation rémunérées.
            </p>
            <div className="choix-liste" role="radiogroup" aria-label="Étape du parcours">
              {ETAPES_PROF_CHOIX.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={etapeProf === e.id}
                  className="choix choix--grand"
                  onClick={() => {
                    setEtapeProf(e.id)
                  }}
                >
                  <span className="choix__texte">
                    <span className="choix__titre">{e.titre}</span>
                    <span className="texte-secondaire">{e.detail}</span>
                  </span>
                  <span className="choix__coche" aria-hidden="true">
                    {etapeProf === e.id ? <Icone nom="coche" taille={14} epaisseur={3} /> : null}
                  </span>
                </button>
              ))}
            </div>
            <p className="note-confidentialite">
              <Icone nom="bouclier" taille={18} />
              Tes réponses restent sur ton téléphone. Elles servent seulement à rendre les exemples parlants.
            </p>
          </>
        ) : null}

        {etape === 1 && !prof ? (
          <>
            <h1 className="titre-question">Quel salaire vises-tu à la sortie de l’école ?</h1>
            <p className="texte-secondaire">Une estimation suffit. Tu pourras la changer à tout moment.</p>
            <div className="bascule" role="radiogroup" aria-label="Type de salaire">
              {(['brut', 'net'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  className="bascule__option"
                  onClick={() => {
                    if (m === mode) return
                    if (saisieValide) {
                      setSaisie(
                        String(
                          Math.round(m === 'net' ? brutVersNet(brutAnnuel, points).netAvantImpot / 12 : brutAnnuel),
                        ),
                      )
                    }
                    setMode(m)
                  }}
                >
                  {m === 'brut' ? 'Brut annuel' : 'Net mensuel'}
                </button>
              ))}
            </div>
            <div className="champ">
              <label htmlFor={idSalaire} className="champ__libelle">
                Salaire visé
              </label>
              <div className="champ__boite">
                <input
                  id={idSalaire}
                  className="champ__saisie chiffres"
                  inputMode="decimal"
                  autoComplete="off"
                  value={saisie}
                  onChange={(e) => {
                    setSaisie(e.target.value)
                  }}
                />
                <span className="champ__unite">{mode === 'brut' ? '€ brut / an' : '€ net / mois'}</span>
              </div>
              {mode === 'brut' ? (
                <div className="puces" aria-label="Montants rapides">
                  {SALAIRES_RAPIDES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`puce ${montantSaisi === s ? 'puce--active' : ''}`}
                      onClick={() => {
                        setSaisie(String(s))
                      }}
                    >
                      {formatNombre(s / 1000)} k
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="champ__aide">
                Repère : à la sortie d’une école d’ingénieurs, le salaire médian est de{' '}
                {formatMontant(p['insertion.ingenieurs.salaireBrutAnnuelMedianHorsPrimes'].valeur)} brut par an hors
                primes (enquête insertion de la CGE, 2026).
              </p>
            </div>
            <p className="note-confidentialite">
              <Icone nom="bouclier" taille={18} />
              Tes réponses restent sur ton téléphone. Elles servent seulement à rendre les exemples parlants.
            </p>
          </>
        ) : null}

        {etape === 2 ? (
          <>
            <h1 className="titre-question">
              {prof ? 'Dans quelle ville aimerais-tu enseigner ?' : 'Dans quelle ville vas-tu travailler ?'}
            </h1>
            <p className="texte-secondaire">
              {prof
                ? 'Ton affectation dépendra du mouvement (module Mutations), mais le coût du logement change beaucoup ce qu’il te reste à la fin du mois.'
                : 'Le coût du logement change beaucoup ce qu’il te reste à la fin du mois.'}
            </p>
            <div className="champ">
              <label htmlFor={idVille} className="champ__libelle">
                Ville
              </label>
              <div className="champ__boite">
                <Icone nom="loupe" taille={20} />
                <input
                  id={idVille}
                  className="champ__saisie"
                  placeholder="Rechercher une ville"
                  autoComplete="address-level2"
                  value={recherche}
                  onChange={(e) => {
                    setRecherche(e.target.value)
                    if (e.target.value.trim()) setVille(e.target.value.trim())
                  }}
                />
              </div>
            </div>
            <span className="surtitre">Suggestions</span>
            <div className="choix-liste" role="radiogroup" aria-label="Villes">
              {VILLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={ville === v}
                  className="choix"
                  onClick={() => {
                    setVille(v)
                    setRecherche('')
                  }}
                >
                  <Icone nom="lieu" taille={20} />
                  <span className="choix__titre">{v}</span>
                  <span className="choix__coche" aria-hidden="true">
                    {ville === v ? <Icone nom="coche" taille={14} epaisseur={3} /> : null}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="lien-tertiaire"
              onClick={() => {
                setVille('')
                setEtape(3)
              }}
            >
              Je ne sais pas encore
            </button>
          </>
        ) : null}

        {etape === 3 ? (
          <>
            <h1 className="titre-question">Quel est ton objectif principal ?</h1>
            <p className="texte-secondaire">Il oriente l’ordre des modules. Tu pourras en ajouter d’autres plus tard.</p>
            <div className="choix-liste" role="radiogroup" aria-label="Objectifs">
              {OBJECTIFS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={objectif === o.id}
                  className="choix choix--grand"
                  onClick={() => {
                    setObjectif(o.id)
                  }}
                >
                  <span className="choix__icone">
                    <Icone nom={o.icone} taille={20} />
                  </span>
                  <span className="choix__texte">
                    <span className="choix__titre">{o.titre}</span>
                    <span className="texte-secondaire">{o.detail}</span>
                  </span>
                  <span className="choix__coche" aria-hidden="true">
                    {objectif === o.id ? <Icone nom="coche" taille={14} epaisseur={3} /> : null}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </main>
      <footer className="lancement__pied">
        <button
          type="button"
          className="bouton bouton--plein"
          disabled={
            (etape === 0 && metier === null) ||
            (etape === 1 && !prof && (!saisieValide || brutAnnuel < 5000 || brutAnnuel > 1_000_000))
          }
          onClick={() => {
            setEtape(etape + 1)
          }}
        >
          {etape === 3 ? 'Voir ce que ça donne' : 'Continuer'}
          <Icone nom="suivant" taille={20} epaisseur={2} />
        </button>
        <p className="texte-secondaire lancement__mention">
          {etape === 0
            ? 'Ensuite, trois questions, une minute.'
            : etape === 1
            ? 'Trois questions, une minute.'
            : etape === 2
              ? 'Tu pourras changer de ville dans le mode carrière.'
              : 'Aucun conseil personnalisé : l’appli t’apprend à décider.'}
        </p>
      </footer>
    </div>
  )
}

function Revelation({ brutAnnuel, onCommencer }: { brutAnnuel: number; onCommencer: () => void }) {
  const p = parametres2026()
  const salaire = brutVersNet(brutAnnuel, p['cotisations.salarieCadre'].valeur)

  useEffect(() => {
    document.title = 'Ton futur salaire · MoneyTree'
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="revelation">
      <header className="revelation__entete sur-vert">
        <Rosace taille={260} className="revelation__rosace" />
        <div className="revelation__marque">
          <Monogramme taille={26} />
          <span className="entete__nom">MoneyTree</span>
        </div>
        <span className="surtitre surtitre--or">D’après tes réponses</span>
        <h1 className="revelation__titre">
          Ton futur salaire <span className="souligne">net</span>
        </h1>
        <p className="revelation__montant chiffres">
          {formatMontant(salaire.netAvantImpot / 12)} <span>/ mois</span>
        </p>
        <p className="texte-secondaire">
          avant impôt, pour {formatMontant(brutAnnuel)} brut par an (cadre, calcul calé sur le simulateur de l’Urssaf)
        </p>
      </header>
      <main className="revelation__contenu">
        <CarteProjection />
      </main>
      <PiedRevelation onCommencer={onCommencer} />
    </div>
  )
}

/** Mois passés en classe normale pour atteindre un échelon, sans bonification. */
function moisAvantEchelon(echelon: number, grille: GrilleIndiciaire): number {
  return grille.slice(0, echelon - 1).reduce((s, e) => s + (e.dureeMois ?? 0), 0)
}

/** Révélation du profil prof : la paie à chaque étape du parcours, puis la projection. */
function RevelationProf({ etape, onCommencer }: { etape: EtapeProf; onCommencer: () => void }) {
  const p = parametres2026()
  const grille = p['certifies.grilleClasseNormale'].valeur
  const eleve = bulletinMensuel({ statut: 'eleve', position: { grade: 'classe-normale', echelon: 1 } }, p)
  const stagiaire = bulletinMensuel({ statut: 'stagiaire', position: positionStagiaire(p) }, p)
  // Dix ans après le 1er échelon, sans bonification : l'échelon atteint selon les durées du statut.
  const echelonDixAns = grille.filter((e) => moisAvantEchelon(e.echelon, grille) <= 120).at(-1)?.echelon ?? 1
  const dixAns = bulletinMensuel({ statut: 'titulaire', position: { grade: 'classe-normale', echelon: echelonDixAns } }, p)
  const engagement = p['m2e.engagementServirAnnees'].valeur
  const lignes = [
    { titre: 'Élève fonctionnaire (M1)', detail: `Indice majoré ${String(eleve.indiceMajore)}, sans prime`, net: eleve.netAvantImpot },
    {
      titre: 'Stagiaire (M2), puis titulaire',
      detail: '1er échelon, avec l’ISOE et la prime d’attractivité (hypothèse pour le stagiaire)',
      net: stagiaire.netAvantImpot,
    },
    {
      titre: 'Dix ans plus tard',
      detail: `${String(echelonDixAns)}e échelon de la classe normale, sans coup de pouce`,
      net: dixAns.netAvantImpot,
    },
  ]
  const ouverture: Record<EtapeProf, string> = {
    concours: 'Si tu réussis le concours',
    eleve: 'Ton parcours',
    stagiaire: 'Ton parcours',
    titulaire: 'Le parcours d’un certifié',
  }

  useEffect(() => {
    document.title = 'Ton parcours de prof · MoneyTree'
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="revelation">
      <header className="revelation__entete sur-vert">
        <Rosace taille={260} className="revelation__rosace" />
        <div className="revelation__marque">
          <Monogramme taille={26} />
          <span className="entete__nom">MoneyTree</span>
        </div>
        <span className="surtitre surtitre--or">{ouverture[etape]}</span>
        <h1 className="revelation__titre">
          Ton premier traitement <span className="souligne">net</span>
        </h1>
        <p className="revelation__montant chiffres">
          {formatMontant(eleve.netAvantImpot)} <span>/ mois</span>
        </p>
        <p className="texte-secondaire">
          dès la première année de master, avant impôt et avant la cotisation santé obligatoire
        </p>
      </header>
      <main className="revelation__contenu">
        <section className="carte apparition" aria-labelledby="revelation-parcours">
          <h2 id="revelation-parcours" className="carte__titre">
            Une paie à chaque étape
          </h2>
          {lignes.map((l) => (
            <div key={l.titre} className="ligne">
              <div className="ligne__libelle">
                <span className="ligne__titre">{l.titre}</span>
                <span className="texte-secondaire">{l.detail}</span>
              </div>
              <strong className="chiffres">{formatMontant(l.net)}</strong>
            </div>
          ))}
          <p className="carte__texte">
            En échange de ces deux années payées, tu t’engages à servir {engagement} ans comme prof après ta titularisation.
            Le module « Devenir prof » détaille chaque étape.
          </p>
          <p className="note-source">
            Nets mensuels avant impôt, dans une commune sans indemnité de résidence, au point d’indice en vigueur. Textes :
            décrets n° 72-581, 85-1148 et 2017-789, fiche Service-Public F468.
          </p>
        </section>
        <CarteProjection />
      </main>
      <PiedRevelation onCommencer={onCommencer} />
    </div>
  )
}

function PiedRevelation({ onCommencer }: { onCommencer: () => void }) {
  return (
    <footer className="lancement__pied">
      <button type="button" className="bouton bouton--plein" onClick={onCommencer}>
        Commencer le module 0
        <Icone nom="suivant" taille={20} epaisseur={2} />
      </button>
      <p className="texte-secondaire lancement__mention">Éducatif uniquement, aucun conseil d’investissement.</p>
    </footer>
  )
}

/** Ce que deviennent 200 € placés chaque mois pendant 30 ans, sur l'historique réel. */
function CarteProjection() {
  const options = useMemo(
    () => ({
      versementMensuel: VERSEMENT_REVELATION,
      mois: DUREE_REVELATION_MOIS,
      rendements: rendementsReels(),
      trajectoires: 1000,
      bloc: 12,
    }),
    [],
  )
  const projection = useProjection(options)

  const series = useMemo(
    () =>
      projection
        ? [
            { valeurs: projection.p10, libelle: '1 cas sur 10 en dessous', couleur: '--vert-marque', discret: true },
            { valeurs: projection.p90, libelle: '1 cas sur 10 au-dessus', couleur: '--vert-marque', discret: true },
            { valeurs: projection.p50, libelle: 'Médiane', couleur: '--vert-marque', annotee: true },
            { valeurs: projection.verse, libelle: 'Versé', couleur: '--encre-secondaire', pointille: true },
          ]
        : [],
    [projection],
  )
  const libelleAnnee = useMemo(() => (x: number) => (x === 0 ? 'Début' : `${x} ans`), [])

  return (
    <section className="carte apparition" aria-labelledby="revelation-question">
      <div className="carte__etiquettes">
        <span className="etiquette etiquette--constants">€ constants</span>
      </div>
      <h2 id="revelation-question" className="carte__titre">
        Et si tu plaçais 200 € par mois pendant 30 ans ?
      </h2>
      {projection ? (
        <>
          <Graphique
            x={projection.annees}
            series={series}
            bande={[0, 1]}
            libelleX={libelleAnnee}
            increments={INCREMENTS_ANNEES}
            resume={`Après 30 ans, pour 72 000 € versés : 1 cas sur 10 sous ${formatMontant(projection.final.p10)}, la moitié au-dessus de ${formatMontant(projection.final.p50)}, 1 cas sur 10 au-dessus de ${formatMontant(projection.final.p90)}.`}
          />
          <div className="legende">
            <span>
              <span className="legende__trait" /> Médiane : {formatMontant(projection.final.p50)}
            </span>
            <span>
              <span className="legende__bande" /> 8 scénarios sur 10 : {formatMontant(projection.final.p10)} à{' '}
              {formatMontant(projection.final.p90)}
            </span>
            <span>
              <span className="legende__pointille" /> Versé : {formatMontant(projection.final.verse)}
            </span>
          </div>
          <p className="carte__texte">
            Dans la moitié des scénarios simulés, tu dépasses{' '}
            <strong className="chiffres">{formatMontant(projection.final.p50)}</strong> en euros d’aujourd’hui. Ce
            n’est pas une prédiction : c’est une fourchette.
          </p>
        </>
      ) : (
        <p className="carte__texte" role="status">
          Calcul de 1 000 trajectoires…
        </p>
      )}
      <p className="note-source">
        1 000 scénarios construits en recollant des années tirées au hasard dans l’historique réel du{' '}
        {SOURCES_HISTORIQUE.actionsMonde.libelle} ({libelleMois(SERIES.mois[0] ?? '')} –{' '}
        {libelleMois(SERIES.mois.at(-1) ?? '')}), corrigé de l’inflation (Insee). Avant frais et impôts.
      </p>
    </section>
  )
}
