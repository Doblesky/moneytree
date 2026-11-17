/**
 * Une partie en cours (maquette 7) : patrimoine net réel en euros constants, leviers,
 * avance d'un mois, d'un an ou jusqu'au prochain événement, point de sauvegarde.
 * Le simulateur grandit avec toi : un levier n'apparaît qu'une fois son module terminé.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useEtatProgression } from '../../app/donnees.ts'
import { LEVIERS, type Levier } from '../../content/catalogue.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { valeurTitres, ageDuPeaEnMois } from '../../engine/enveloppes.ts'
import { brutVersNet } from '../../engine/salaire.ts'
import {
  avancer,
  avancerJusquAuProchainEvenement,
  bilan,
  dateDuMois,
  DUREE_PARTIE_MOIS,
  eligibleLep,
  estTerminee,
  modifierPartie,
  modifierVersements,
  periodeRejouee,
  periodeRevelee,
  retirerDuLivret,
  retirerDuPea,
  tauxLivretActuel,
  tauxPrelevementActuel,
  vendreCto,
  type EtatPartie,
  type Versements,
} from '../../engine/simulation.ts'
import { formatMontant, formatPourcentage } from '../../lib/format.ts'
import { levierDebloque, type EtatProgression } from '../../progression/regles.ts'
import { badgesDuSimulateur, debloquerLevier } from '../../storage/apprentissage.ts'
import type { ContenuSauvegarde } from '../../storage/db.ts'
import { enregistrerPartie, supprimerPartie } from '../../storage/partie.ts'
import { Terme } from '../../ui/glossaire.tsx'
import { Graphique } from '../../ui/Graphique.tsx'
import { Icone, type NomIcone } from '../../ui/Icone.tsx'
import { Rosace } from '../../ui/Rosace.tsx'

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function Variation({ valeur, suffixe }: { valeur: number; suffixe: string }) {
  if (Math.abs(valeur) < 0.5) return <span className="texte-secondaire chiffres">Stable {suffixe}</span>
  const gain = valeur > 0
  return (
    <span className={`variation chiffres ${gain ? 'variation--gain' : 'variation--perte'}`}>
      {gain ? '▲' : '▼'} {formatMontant(valeur, { signe: true })} {suffixe}
    </span>
  )
}

export function Partie({ contenu }: { contenu: ContenuSauvegarde }) {
  const p = parametres2026()
  const progression = useEtatProgression()
  const [etat, setEtat] = useState<EtatPartie>(contenu.partie)
  const [point, setPoint] = useState<EtatPartie | null>(contenu.pointDeSauvegarde)
  const [constants, setConstants] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const appliquer = useCallback((suivant: EtatPartie, nouveauPoint: EtatPartie | null = point) => {
    setEtat(suivant)
    setPoint(nouveauPoint)
    void enregistrerPartie(suivant, nouveauPoint)
    void badgesDuSimulateur(suivant.mois)
  }, [point])

  useEffect(() => {
    if (!message) return
    const minuterie = window.setTimeout(() => {
      setMessage(null)
    }, 3000)
    return () => {
      window.clearTimeout(minuterie)
    }
  }, [message])

  const b = bilan(etat, p)
  const date = dateDuMois(etat, etat.mois)
  const historique = etat.historique
  const precedent = historique.at(-2)
  const variation = precedent ? b.netReel - precedent.netReel : 0
  const revelee = periodeRevelee(etat)
  const terminee = estTerminee(etat)
  const debloque = (l: Levier) => (progression ? levierDebloque(progression, l) : false)

  const x = useMemo(() => historique.map((h) => h.mois), [historique])
  const series = useMemo(
    () => [
      {
        valeurs: historique.map((h) => (constants ? h.netReel : h.brut - h.fiscaliteLatente)),
        libelle: 'Patrimoine net',
        aire: true,
      },
    ],
    [historique, constants],
  )
  const libelleX = useCallback(
    (mois: number) => String(dateDuMois(etat, Math.round(mois)).annee),
    [etat],
  )

  return (
    <>
      <header className="entete sur-vert entete--simulateur">
        <Rosace taille={220} className="entete__rosace" />
        <div className="entete__contenu">
          <div className="entete__barre">
            <div className="entete__titres">
              <span className="surtitre surtitre--or chiffres">Bac à sable · mois {etat.mois}</span>
              <h1 className="entete__titre">
                {MOIS[date.mois]} {date.annee}
              </h1>
            </div>
            <button
              type="button"
              className="pastille-sur-vert"
              onClick={() => {
                appliquer(etat, etat)
                setMessage('Point de sauvegarde enregistré.')
              }}
            >
              <Icone nom="signet" taille={16} />
              Point de sauvegarde
            </button>
          </div>
        </div>
      </header>

      <main className="ecran apparition simulateur">
        {message ? (
          <p className="message message--succes" role="status">
            {message}
          </p>
        ) : null}

        {revelee ? (
          <section className="carte carte--importante sur-vert" aria-labelledby="periode-revelee">
            <span className="surtitre surtitre--or">La période révélée</span>
            <h2 id="periode-revelee" className="carte__titre">
              {periodeRejouee(etat)}
            </h2>
            <p className="carte__texte">
              Tu viens de rejouer cette vraie période : krachs, reprises, inflation et taux du Livret A compris.
              {terminee ? ' Les données historiques s’arrêtent ici.' : ' Tu peux continuer tant qu’il reste des données.'}
            </p>
          </section>
        ) : null}

        <section className="carte" aria-labelledby="patrimoine">
          <div className="carte__etiquettes">
            <h2 id="patrimoine" className="carte__surtitre">
              Patrimoine <Terme cle="patrimoine-net-reel">net réel</Terme>
            </h2>
            <button
              type="button"
              className={`etiquette ${constants ? 'etiquette--constants' : 'etiquette--courants'}`}
              aria-pressed={constants}
              onClick={() => {
                setConstants(!constants)
              }}
            >
              {constants ? '€ constants' : '€ courants'}
            </button>
          </div>
          <p className="montant-principal chiffres">{formatMontant(constants ? b.netReel : b.net)}</p>
          <Variation valeur={variation} suffixe="ce mois" />
          <Graphique
            x={x}
            series={series}
            libelleX={libelleX}
            resume={`Patrimoine net ${constants ? 'en euros constants' : 'en euros courants'} : ${formatMontant(constants ? b.netReel : b.net)} au mois ${etat.mois}.`}
          />
          <p className="note-source">
            Net de la <Terme cle="fiscalite-latente">fiscalité latente</Terme> ({formatMontant(b.fiscaliteLatente)}), en
            euros {constants ? 'du départ de la partie' : 'de chaque date'}.
          </p>
        </section>

        <Leviers etat={etat} debloque={debloque} progression={progression} onChange={appliquer} />

        <Comptes etat={etat} />

        {debloque('detailImpot') ? <Impots etat={etat} /> : null}

        <Operations etat={etat} debloque={debloque} onChange={appliquer} onMessage={setMessage} />

        <Journal etat={etat} />

        <section className="section" aria-labelledby="partie-actions">
          <h2 id="partie-actions" className="visuellement-masque">
            Gérer la partie
          </h2>
          {point ? (
            <button
              type="button"
              className="bouton bouton--contour"
              onClick={() => {
                appliquer(point, point)
                setMessage(`Retour au point de sauvegarde (mois ${point.mois}).`)
              }}
            >
              <Icone nom="actualiser" taille={18} />
              Revenir au point de sauvegarde (mois {point.mois})
            </button>
          ) : null}
          <button
            type="button"
            className="lien-debloquer"
            onClick={() => {
              if (window.confirm('Effacer cette partie et en commencer une nouvelle ?')) void supprimerPartie()
            }}
          >
            Nouvelle partie
          </button>
        </section>
      </main>

      <div className="barre-avance" role="group" aria-label="Avancer dans le temps">
        <button type="button" className="bouton bouton--plein" disabled={terminee} onClick={() => {
            appliquer(avancer(etat, p, 1))
          }}>
          +1 mois
        </button>
        <button type="button" className="bouton bouton--contour" disabled={terminee} onClick={() => {
            appliquer(avancer(etat, p, 12))
          }}>
          +1 an
        </button>
        <button
          type="button"
          className="bouton bouton--contour"
          disabled={terminee}
          onClick={() => {
            appliquer(avancerJusquAuProchainEvenement(etat, p))
          }}
        >
          <Icone nom="sauter" taille={18} />
          Événement
        </button>
      </div>
      {etat.mois < DUREE_PARTIE_MOIS ? null : <div className="espace-barre" />}
    </>
  )
}

interface PropsLevier {
  etat: EtatPartie
  debloque: (l: Levier) => boolean
  progression: EtatProgression | undefined
  onChange: (etat: EtatPartie) => void
}

function LigneLevier({
  icone,
  titre,
  sousTitre,
  valeur,
  max,
  pas,
  onChange,
  desactive,
}: {
  icone: NomIcone
  titre: ReactNode
  sousTitre: string
  valeur: number
  max: number
  pas: number
  onChange: (v: number) => void
  desactive?: boolean
}) {
  // Valeur en cours de glissement ; null quand on affiche la valeur enregistrée.
  const [glisse, setGlisse] = useState<number | null>(null)
  const brouillon = glisse ?? valeur
  const valider = () => {
    if (glisse !== null && glisse !== valeur) onChange(glisse)
    setGlisse(null)
  }
  return (
    <div className="levier">
      <span className="levier__icone">
        <Icone nom={icone} taille={20} />
      </span>
      <div className="levier__texte">
        <span className="levier__titre">{titre}</span>
        <span className="texte-secondaire chiffres">{sousTitre}</span>
      </div>
      <input
        type="range"
        className="levier__curseur"
        aria-label={typeof titre === 'string' ? titre : sousTitre}
        min={0}
        max={max}
        step={pas}
        value={brouillon}
        disabled={desactive}
        style={{ '--remplissage': `${(brouillon / max) * 100}%` } as CSSProperties}
        onChange={(e) => {
          setGlisse(Number(e.target.value))
        }}
        onPointerUp={valider}
        onKeyUp={valider}
        onBlur={valider}
      />
    </div>
  )
}

function Leviers({ etat, debloque, onChange }: PropsLevier) {
  const p = parametres2026()
  const salaire = brutVersNet(etat.salaire.brutAnnuel, p['cotisations.salarieCadre'].valeur)
  const [edition, setEdition] = useState(false)
  const [brut, setBrut] = useState(String(Math.round(etat.salaire.brutAnnuel)))
  const [depenses, setDepenses] = useState(String(etat.depensesMensuelles))
  const versement = (cle: keyof Versements) => (v: number) => {
    onChange(modifierVersements(etat, { [cle]: v }))
  }
  const lep = eligibleLep(etat, p)
  const verrouilles = (Object.keys(LEVIERS) as Levier[]).filter((l) => !debloque(l))

  return (
    <section className="carte leviers" aria-labelledby="tes-leviers">
      <div className="carte__etiquettes">
        <h2 id="tes-leviers" className="carte__surtitre">
          Tes leviers
        </h2>
        <span className="texte-secondaire">Versements mensuels</span>
      </div>

      <div className="levier">
        <span className="levier__icone">
          <Icone nom="salaire" taille={20} />
        </span>
        <div className="levier__texte">
          <span className="levier__titre">Salaire net</span>
          <span className="texte-secondaire chiffres">
            {formatMontant(salaire.netAvantImpot / 12)} / mois avant impôt · {formatMontant(etat.salaire.brutAnnuel)} brut
            par an
          </span>
        </div>
        <button
          type="button"
          className="bouton-icone bouton-icone--clair"
          aria-label="Modifier le salaire et les dépenses"
          aria-expanded={edition}
          onClick={() => {
            setEdition(!edition)
          }}
        >
          <Icone nom="crayon" taille={18} />
        </button>
      </div>
      {edition ? (
        <form
          className="edition-salaire"
          onSubmit={(e) => {
            e.preventDefault()
            const nouveauBrut = Number(brut.replace(/\s/g, '').replace(',', '.'))
            const nouvellesDepenses = Number(depenses.replace(/\s/g, '').replace(',', '.'))
            if (nouveauBrut >= 5000 && nouvellesDepenses >= 0) {
              onChange(modifierPartie(etat, { brutAnnuel: nouveauBrut, depensesMensuelles: nouvellesDepenses }))
              setEdition(false)
            }
          }}
        >
          <label>
            Brut annuel (€)
            <input className="champ__saisie champ__saisie--petit chiffres" inputMode="decimal" value={brut} onChange={(e) => {
                setBrut(e.target.value)
              }} />
          </label>
          <label>
            Dépenses par mois (€ du départ)
            <input className="champ__saisie champ__saisie--petit chiffres" inputMode="decimal" value={depenses} onChange={(e) => {
                setDepenses(e.target.value)
              }} />
          </label>
          <button type="submit" className="bouton bouton--contour">
            Appliquer
          </button>
        </form>
      ) : (
        <p className="texte-secondaire levier__note chiffres">
          Dépenses courantes : {formatMontant(etat.depensesMensuelles * etat.indicePrix)} / mois (indexées sur l’inflation)
        </p>
      )}

      <LigneLevier
        icone="bouclier"
        titre={<Terme cle="livret-a">Livret A</Terme>}
        sousTitre={`${formatMontant(etat.versements.livretA)} / mois · taux ${formatPourcentage(tauxLivretActuel(etat, 'livretA'))}`}
        valeur={etat.versements.livretA}
        max={1000}
        pas={10}
        onChange={versement('livretA')}
      />
      <LigneLevier
        icone="courbe"
        titre={<Terme cle="etf">ETF monde</Terme>}
        sousTitre={`${formatMontant(etat.versements.cto)} / mois sur un compte-titres`}
        valeur={etat.versements.cto}
        max={2000}
        pas={10}
        onChange={versement('cto')}
      />
      {debloque('ldds') ? (
        <LigneLevier
          icone="pousse"
          titre={<Terme cle="ldds">LDDS</Terme>}
          sousTitre={`${formatMontant(etat.versements.ldds)} / mois · taux ${formatPourcentage(tauxLivretActuel(etat, 'ldds'))}`}
          valeur={etat.versements.ldds}
          max={1000}
          pas={10}
          onChange={versement('ldds')}
        />
      ) : null}
      {debloque('lep') ? (
        <LigneLevier
          icone="bouclier"
          titre={<Terme cle="lep">LEP</Terme>}
          sousTitre={
            lep
              ? `${formatMontant(etat.versements.lep)} / mois · taux ${formatPourcentage(tauxLivretActuel(etat, 'lep'))}`
              : 'Tes revenus dépassent le plafond : pas de nouveaux versements'
          }
          valeur={etat.versements.lep}
          max={500}
          pas={10}
          desactive={!lep}
          onChange={versement('lep')}
        />
      ) : null}
      {debloque('pea') ? (
        <LigneLevier
          icone="courbe"
          titre={<Terme cle="pea">PEA · ETF monde</Terme>}
          sousTitre={
            etat.pea.cloture
              ? 'Plan clôturé'
              : `${formatMontant(etat.versements.pea)} / mois${etat.pea.ouvertAuMois === null ? ' · s’ouvre au premier versement' : ''}`
          }
          valeur={etat.versements.pea}
          max={2000}
          pas={10}
          desactive={etat.pea.cloture}
          onChange={versement('pea')}
        />
      ) : null}
      {debloque('optionBareme') ? (
        <label className="levier levier--interrupteur">
          <span className="levier__icone">
            <Icone nom="info" taille={20} />
          </span>
          <span className="levier__texte">
            <span className="levier__titre">Option pour le barème</span>
            <span className="texte-secondaire">
              {etat.optionBareme ? 'Plus-values au barème progressif' : 'Plus-values au PFU (par défaut)'}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="interrupteur"
            checked={etat.optionBareme}
            onChange={(e) => {
              onChange(modifierPartie(etat, { optionBareme: e.target.checked }))
            }}
          />
        </label>
      ) : null}

      {verrouilles.length > 0 ? (
        <div className="leviers__verrouilles">
          <span className="texte-secondaire">À débloquer avec les modules</span>
          <div className="puces">
            {verrouilles.map((l) => (
              <button
                key={l}
                type="button"
                className="etiquette etiquette--verrou"
                title={LEVIERS[l].description}
                onClick={() => {
                  if (
                    LEVIERS[l].disponible &&
                    window.confirm(`Débloquer « ${LEVIERS[l].nom} » sans avoir terminé le module ${LEVIERS[l].module} ?`)
                  ) {
                    void debloquerLevier(l)
                  }
                }}
              >
                <Icone nom="cadenas" taille={12} /> {LEVIERS[l].nom} · M{LEVIERS[l].module}
                {LEVIERS[l].disponible ? '' : ' (phase suivante)'}
              </button>
            ))}
          </div>
          <Link to="/parcours" className="lien-debloquer">
            Voir les modules
          </Link>
        </div>
      ) : null}
    </section>
  )
}

function Comptes({ etat }: { etat: EtatPartie }) {
  const p = parametres2026()
  const b = bilan(etat, p)
  const gainCto = valeurTitres(etat.cto, etat.prixPart) - etat.cto.prixDeRevient
  const ligne = (nom: ReactNode, montant: number, detail?: string) => (
    <>
      <span>
        {nom}
        {detail ? <span className="texte-secondaire"> · {detail}</span> : null}
      </span>
      <span className="chiffres">{formatMontant(montant)}</span>
    </>
  )
  return (
    <section className="carte" aria-labelledby="tes-comptes">
      <h2 id="tes-comptes" className="carte__surtitre">
        Tes comptes <span className="texte-secondaire">(€ courants)</span>
      </h2>
      <div className="tableau-comptes">
        {ligne('Compte courant', b.courant)}
        {ligne(<Terme cle="livret-a">Livret A</Terme>, etat.livretA.solde, etat.livretA.interetsCourus > 0.5 ? `+${formatMontant(etat.livretA.interetsCourus)} au 31/12` : undefined)}
        {etat.ldds.solde > 0 ? ligne('LDDS', etat.ldds.solde) : null}
        {etat.lep.solde > 0 ? ligne('LEP', etat.lep.solde) : null}
        {ligne(<Terme cle="cto">Compte-titres</Terme>, b.cto, b.cto > 0 ? `${gainCto >= 0 ? 'plus' : 'moins'}-value ${formatMontant(Math.abs(gainCto))}` : undefined)}
        {etat.pea.ouvertAuMois !== null
          ? ligne(<Terme cle="pea">PEA</Terme>, b.pea, etat.pea.cloture ? 'clôturé' : `ouvert depuis ${Math.floor(ageDuPeaEnMois(etat.pea, etat.mois) / 12)} an(s)`)
          : null}
        <span className="tableau-comptes__total">Total brut</span>
        <span className="tableau-comptes__total chiffres">{formatMontant(b.brut)}</span>
      </div>
    </section>
  )
}

function Impots({ etat }: { etat: EtatPartie }) {
  const p = parametres2026()
  const taux = tauxPrelevementActuel(etat, p)
  return (
    <section className="carte" aria-labelledby="tes-impots">
      <h2 id="tes-impots" className="carte__surtitre">
        Ton impôt
      </h2>
      <div className="tableau-comptes">
        <span>
          <Terme cle={taux.personnalise ? 'taux-de-prelevement' : 'taux-par-defaut'}>
            {taux.personnalise ? 'Taux personnalisé' : 'Taux par défaut'}
          </Terme>
        </span>
        <span className="chiffres">{formatPourcentage(taux.taux, { decimales: 1 })}</span>
        <span>Prélevé à la source depuis le début</span>
        <span className="chiffres">{formatMontant(etat.cumuls.prelevementsSource)}</span>
        <span>Impôt sur le revenu régularisé</span>
        <span className="chiffres">{formatMontant(etat.cumuls.impotRevenu)}</span>
        <span>
          <Terme cle="prelevements-sociaux">Prélèvements sociaux</Terme>
        </span>
        <span className="chiffres">{formatMontant(etat.cumuls.prelevementsSociaux)}</span>
        <span>Frais de l’ETF ({formatPourcentage(etat.fraisAnnuelsEtf)} par an, fictif)</span>
        <span className="chiffres">{formatMontant(etat.cumuls.fraisEtf)}</span>
        <span>Intérêts des livrets reçus</span>
        <span className="chiffres">{formatMontant(etat.cumuls.interets)}</span>
      </div>
      {etat.fiscal.aDeclarer ? (
        <p className="note-source">
          Tes revenus de {etat.fiscal.aDeclarer.annee} seront régularisés en septembre.
        </p>
      ) : null}
    </section>
  )
}

function Operations({
  etat,
  debloque,
  onChange,
  onMessage,
}: {
  etat: EtatPartie
  debloque: (l: Levier) => boolean
  onChange: (etat: EtatPartie) => void
  onMessage: (m: string) => void
}) {
  const p = parametres2026()
  const [montant, setMontant] = useState('1000')
  const somme = Number(montant.replace(/\s/g, '').replace(',', '.'))
  const valide = Number.isFinite(somme) && somme > 0
  const valeurCto = valeurTitres(etat.cto, etat.prixPart)
  const valeurPea = valeurTitres(etat.pea.titres, etat.prixPart)
  const peaJeune = ageDuPeaEnMois(etat.pea, etat.mois) < p['pea.dureeExonerationImpotRevenu'].valeur * 12

  return (
    <details className="carte operations">
      <summary className="carte__surtitre">Opérations ponctuelles</summary>
      <p className="texte-secondaire">Vendre, retirer : chaque décision a ses règles et sa fiscalité.</p>
      <label className="champ__libelle" htmlFor="montant-operation">
        Montant
      </label>
      <div className="champ__boite">
        <input
          id="montant-operation"
          className="champ__saisie chiffres"
          inputMode="decimal"
          value={montant}
          onChange={(e) => {
            setMontant(e.target.value)
          }}
        />
        <span className="champ__unite">€</span>
      </div>
      <div className="operations__boutons">
        <button
          type="button"
          className="bouton bouton--contour"
          disabled={!valide || valeurCto <= 0}
          onClick={() => {
            onChange(vendreCto(etat, somme))
            onMessage('Vente enregistrée : la plus-value sera imposée l’an prochain.')
          }}
        >
          Vendre sur le compte-titres
        </button>
        <button
          type="button"
          className="bouton bouton--contour"
          disabled={!valide || etat.livretA.solde <= 0}
          onClick={() => {
            onChange(retirerDuLivret(etat, 'livretA', somme))
            onMessage('Retrait du Livret A effectué.')
          }}
        >
          Retirer du Livret A
        </button>
        {debloque('pea') && valeurPea > 0 ? (
          <button
            type="button"
            className="bouton bouton--contour"
            disabled={!valide}
            onClick={() => {
              if (
                !peaJeune ||
                window.confirm('Ton PEA a moins de 5 ans : un retrait le clôture et le gain est imposé. Continuer ?')
              ) {
                onChange(retirerDuPea(etat, somme, p))
              }
            }}
          >
            Retirer du PEA
          </button>
        ) : null}
      </div>
    </details>
  )
}

function Journal({ etat }: { etat: EtatPartie }) {
  const [tout, setTout] = useState(false)
  const evenements = [...etat.journal].reverse()
  const affiches = tout ? evenements : evenements.slice(0, 5)
  return (
    <section className="section" aria-labelledby="journal">
      <h2 id="journal" className="section__titre">
        Journal
      </h2>
      <ol className="journal">
        {affiches.map((e, i) => {
          const date = dateDuMois(etat, e.mois)
          return (
            <li key={`${e.mois}-${i}`} className={`journal__evenement journal__evenement--${e.type}`}>
              <span className="journal__date chiffres">
                {MOIS[date.mois]?.slice(0, 4)}. {date.annee}
              </span>
              <span className="journal__titre">{e.titre}</span>
              <span className="texte-secondaire">{e.detail}</span>
            </li>
          )
        })}
      </ol>
      {evenements.length > 5 ? (
        <button
          type="button"
          className="lien-tertiaire"
          onClick={() => {
            setTout(!tout)
          }}
        >
          {tout ? 'Réduire' : `Voir les ${evenements.length} événements`}
        </button>
      ) : null}
    </section>
  )
}
