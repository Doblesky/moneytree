/**
 * Création d'une carrière : salaire de départ, ville et logement (loyer médian des
 * observatoires des loyers), dépenses hors loyer, mode de marché.
 */
import { useId, useState } from 'react'
import { useCarrieres, useEtatProgression, useProfil } from '../../app/donnees.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { nouvelleGraine } from '../../engine/aleatoire.ts'
import {
  creerCarriere,
  DUREE_CARRIERE_ANNEES,
  estVille,
  loyerAuM2,
  loyerMedian,
  VILLES,
  type Ville,
} from '../../engine/carriere.ts'
import { nombreDeDepartsPossibles, SERIES } from '../../engine/marches.ts'
import { brutVersNet } from '../../engine/salaire.ts'
import { formatMontant } from '../../lib/format.ts'
import { levierDebloque } from '../../progression/regles.ts'
import { creerSauvegardeCarriere } from '../../storage/carriere.ts'
import { Choix } from '../../ui/Choix.tsx'
import { lireMontant } from '../simulateur/constantes.ts'

export function NouvelleCarriere({ onCreee, onAnnuler }: { onCreee: () => void; onAnnuler?: (() => void) | undefined }) {
  const p = parametres2026()
  const profil = useProfil()
  const progression = useEtatProgression()
  const carrieres = useCarrieres()
  const [nom, setNom] = useState<string | null>(null)
  const [brut, setBrut] = useState<string | null>(null)
  const [ville, setVille] = useState<Ville | null>(null)
  const [surface, setSurface] = useState('30')
  const [depenses, setDepenses] = useState('900')
  const monteCarlo = progression ? levierDebloque(progression, 'monteCarlo') : false
  const [mode, setMode] = useState<'historique' | 'monte-carlo' | null>(null)
  const ids = { nom: useId(), brut: useId(), surface: useId(), depenses: useId() }

  const modeChoisi = mode ?? (monteCarlo ? 'monte-carlo' : 'historique')
  const villeChoisie: Ville = ville ?? (estVille(profil?.ville) ? profil.ville : 'Toulouse')
  const nomTexte = nom ?? `Carrière ${(carrieres?.length ?? 0) + 1}`
  const brutTexte =
    brut ?? String(Math.round(profil?.salaireViseBrutAnnuel ?? p['insertion.ingenieurs.salaireBrutAnnuelMedianHorsPrimes'].valeur))
  const valeurs = { brut: lireMontant(brutTexte), surface: lireMontant(surface), depenses: lireMontant(depenses) }
  const valide =
    valeurs.brut >= 15000 &&
    valeurs.brut <= 300000 &&
    valeurs.surface >= 9 &&
    valeurs.surface <= 200 &&
    valeurs.depenses >= 0
  const loyer = valide ? loyerMedian(villeChoisie, valeurs.surface, p) : 0
  const net = valide ? brutVersNet(valeurs.brut, p['cotisations.salarieCadre'].valeur).netAvantImpot / 12 : 0
  const derniersDeparts = nombreDeDepartsPossibles(DUREE_CARRIERE_ANNEES * 12)
  const anneesHistoriques = `${SERIES.mois[0]?.slice(0, 4) ?? ''} à ${SERIES.mois[Math.max(0, derniersDeparts - 1)]?.slice(0, 4) ?? ''}`

  async function commencer() {
    if (!valide) return
    const carriere = creerCarriere(
      {
        brutAnnuel: valeurs.brut,
        ville: villeChoisie,
        surface: Math.round(valeurs.surface),
        depensesHorsLoyer: valeurs.depenses,
        graine: nouvelleGraine(),
        mode: modeChoisi,
        calendrier: { annee: new Date().getFullYear() + 1, mois: 0 },
      },
      p,
    )
    await creerSauvegardeCarriere(nomTexte.trim() || 'Carrière sans nom', carriere)
    onCreee()
  }

  return (
    <>
      <section className="carte" aria-labelledby="nouvelle-carriere">
        <span className="surtitre">Nouvelle carrière</span>
        <h2 id="nouvelle-carriere" className="carte__titre">
          Tes vingt prochaines années
        </h2>
        <p className="carte__texte">
          Chaque année, un événement à choix. Le salaire net, l’impôt, l’allocation chômage et les loyers suivent les
          règles et les données officielles ; les montants des événements sont des chiffres du jeu.
        </p>
        <div className="champ">
          <label htmlFor={ids.nom} className="champ__libelle">
            Nom de la carrière
          </label>
          <div className="champ__boite">
            <input
              id={ids.nom}
              className="champ__saisie"
              value={nomTexte}
              maxLength={40}
              onChange={(e) => {
                setNom(e.target.value)
              }}
            />
          </div>
        </div>
        <div className="champ">
          <label htmlFor={ids.brut} className="champ__libelle">
            Salaire brut annuel visé
          </label>
          <div className="champ__boite">
            <input
              id={ids.brut}
              className="champ__saisie chiffres"
              inputMode="decimal"
              value={brutTexte}
              onChange={(e) => {
                setBrut(e.target.value)
              }}
            />
            <span className="champ__unite">€ brut / an</span>
          </div>
          {valide ? (
            <p className="champ__aide chiffres">
              Soit {formatMontant(net)} net par mois avant impôt. Médiane des jeunes ingénieurs (enquête CGE 2026) :{' '}
              {formatMontant(p['insertion.ingenieurs.salaireBrutAnnuelMedianHorsPrimes'].valeur)} brut, hors primes.
            </p>
          ) : null}
        </div>
      </section>

      <section className="carte" aria-labelledby="ville-carriere">
        <h2 id="ville-carriere" className="carte__titre">
          Où commences-tu ?
        </h2>
        <div className="choix-liste" role="radiogroup" aria-label="Ville">
          {VILLES.map((v) => (
            <Choix
              key={v}
              choisi={villeChoisie === v}
              onChoisir={() => {
                setVille(v)
              }}
              titre={v}
              detail={`Loyer médian : ${formatMontant(loyerAuM2(v, p), { decimales: 1 })} le m² hors charges`}
            />
          ))}
        </div>
        <div className="champ">
          <label htmlFor={ids.surface} className="champ__libelle">
            Surface de ton logement
          </label>
          <div className="champ__boite">
            <input
              id={ids.surface}
              className="champ__saisie chiffres"
              inputMode="decimal"
              value={surface}
              onChange={(e) => {
                setSurface(e.target.value)
              }}
            />
            <span className="champ__unite">m²</span>
          </div>
          {valide ? (
            <p className="champ__aide chiffres">
              Loyer au niveau médian : {formatMontant(loyer)} par mois hors charges (observatoires des loyers).
            </p>
          ) : null}
        </div>
        <div className="champ">
          <label htmlFor={ids.depenses} className="champ__libelle">
            Autres dépenses par mois <span className="etiquette etiquette--fictif">Hypothèse</span>
          </label>
          <div className="champ__boite">
            <input
              id={ids.depenses}
              className="champ__saisie chiffres"
              inputMode="decimal"
              value={depenses}
              onChange={(e) => {
                setDepenses(e.target.value)
              }}
            />
            <span className="champ__unite">€ / mois</span>
          </div>
          <p className="champ__aide">Charges, courses, transport, loisirs… Elles suivront l’inflation.</p>
        </div>
      </section>

      <section className="carte" aria-labelledby="marche-carriere">
        <h2 id="marche-carriere" className="carte__titre">
          Comment bougent les marchés ?
        </h2>
        <div className="choix-liste" role="radiogroup" aria-label="Mode de marché">
          <Choix
            choisi={modeChoisi === 'historique'}
            onChoisir={() => {
              setMode('historique')
            }}
            titre="Historique"
            detail={`Vingt vraies années de marché, avec un départ tiré entre ${anneesHistoriques}, révélées à la fin.`}
          />
          <Choix
            choisi={modeChoisi === 'monte-carlo'}
            onChoisir={() => {
              setMode('monte-carlo')
            }}
            titre="Monte Carlo"
            detail="Des blocs de douze mois réels recollés au hasard : un avenir possible parmi d’autres."
            verrou={monteCarlo ? undefined : 'Avec le module 3 · Marchés financiers'}
          />
        </div>
        <button
          type="button"
          className="bouton bouton--plein"
          disabled={!valide}
          onClick={() => {
            void commencer()
          }}
        >
          Commencer ma carrière
        </button>
        {onAnnuler ? (
          <button type="button" className="bouton bouton--contour" onClick={onAnnuler}>
            Revenir à ma carrière
          </button>
        ) : null}
      </section>
    </>
  )
}
