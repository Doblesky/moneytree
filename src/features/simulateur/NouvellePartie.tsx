/**
 * Création d'une partie : profil de départ et mode de marché (historique, Monte Carlo après
 * le module 3, scénarios de crise après le module 5).
 */
import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useEtatProgression, useParties, useProfil } from '../../app/donnees.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { nouvelleGraine } from '../../engine/aleatoire.ts'
import { nombreDeDepartsPossibles, SERIES } from '../../engine/marches.ts'
import { SCENARIOS, type ModeMarche, type Scenario } from '../../engine/modesMarche.ts'
import { brutVersNet } from '../../engine/salaire.ts'
import { creerPartie, DUREE_PARTIE_MOIS } from '../../engine/simulation.ts'
import { formatMontant } from '../../lib/format.ts'
import { levierDebloque } from '../../progression/regles.ts'
import { creerSauvegarde } from '../../storage/partie.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { Icone } from '../../ui/Icone.tsx'
import { lireMontant } from './constantes.ts'

function Choix({
  choisi,
  onChoisir,
  titre,
  detail,
  verrou,
}: {
  choisi: boolean
  onChoisir: () => void
  titre: string
  detail?: string
  verrou?: string | undefined
}) {
  return (
    <button type="button" role="radio" aria-checked={choisi} className="choix" disabled={Boolean(verrou)} onClick={onChoisir}>
      <span className="choix__texte">
        <span className="choix__titre">{titre}</span>
        {detail ? <span className="texte-secondaire">{detail}</span> : null}
        {verrou ? (
          <span className="texte-secondaire">
            <Icone nom="cadenas" taille={12} /> {verrou}
          </span>
        ) : null}
      </span>
      <span className="choix__coche" aria-hidden="true">
        {choisi ? <Icone nom="coche" taille={14} epaisseur={3} /> : null}
      </span>
    </button>
  )
}

export function NouvellePartie() {
  const naviguer = useNavigate()
  const profil = useProfil()
  const progression = useEtatProgression()
  const parties = useParties()
  const p = parametres2026()
  const [nom, setNom] = useState<string | null>(null)
  const [brut, setBrut] = useState<string | null>(null)
  const [depenses, setDepenses] = useState('1500')
  const [epargne, setEpargne] = useState('0')
  const [hausse, setHausse] = useState('1')
  const [mode, setMode] = useState<ModeMarche>('historique')
  const [periode, setPeriode] = useState<'hasard' | 'choisie'>('hasard')
  const [scenario, setScenario] = useState<Scenario>('krach')
  const departs = nombreDeDepartsPossibles(DUREE_PARTIE_MOIS)
  const anneesPossibles = [...new Set(SERIES.mois.slice(0, departs).map((m) => m.slice(0, 4)))]
  const [annee, setAnnee] = useState(anneesPossibles[0] ?? '2001')
  const ids = { nom: useId(), brut: useId(), depenses: useId(), epargne: useId(), hausse: useId(), annee: useId() }

  const monteCarlo = progression ? levierDebloque(progression, 'monteCarlo') : false
  const scenarios = progression ? levierDebloque(progression, 'scenarios') : false
  const nomTexte = nom ?? `Partie ${(parties?.length ?? 0) + 1}`
  const brutTexte = brut ?? String(Math.round(profil?.salaireViseBrutAnnuel ?? 42000))
  const valeurs = {
    brut: lireMontant(brutTexte),
    depenses: lireMontant(depenses),
    epargne: lireMontant(epargne),
    hausse: lireMontant(hausse) / 100,
  }
  const valide =
    valeurs.brut >= 5000 &&
    valeurs.brut <= 1_000_000 &&
    valeurs.depenses >= 0 &&
    valeurs.epargne >= 0 &&
    valeurs.hausse >= -0.05 &&
    valeurs.hausse <= 0.1
  const net = valide ? brutVersNet(valeurs.brut, p['cotisations.salarieCadre'].valeur).netAvantImpot / 12 : 0

  async function commencer() {
    if (!valide) return
    const indice = mode === 'historique' && periode === 'choisie' ? SERIES.mois.indexOf(`${annee}-01`) : undefined
    const maintenant = new Date()
    const partie = creerPartie({
      brutAnnuel: valeurs.brut,
      depensesMensuelles: valeurs.depenses,
      tresorerieInitiale: valeurs.epargne,
      hausseReelleAnnuelle: valeurs.hausse,
      graine: nouvelleGraine(),
      calendrier: { annee: maintenant.getFullYear() + 1, mois: 0 },
      versements: { livretA: 150, cto: 200 },
      mode,
      scenario,
      ...(indice !== undefined && indice >= 0 ? { debutHistorique: indice } : {}),
    })
    await creerSauvegarde(nomTexte.trim() || 'Partie sans nom', partie)
    await naviguer('/simulateur', { replace: true })
  }

  return (
    <>
      <EnTete titre="Nouvelle partie" sousTitre="Tes dix premières années, sur une vraie période de marché." />
      <main className="ecran apparition">
        {parties && parties.length > 0 ? (
          <Link to="/simulateur/parties" className="lien-tertiaire">
            <Icone nom="retour" taille={16} epaisseur={2} />
            Mes parties ({parties.length})
          </Link>
        ) : null}
        <section className="carte" aria-labelledby="nouvelle-partie">
          <span className="surtitre">Nouvelle partie</span>
          <h2 id="nouvelle-partie" className="carte__titre">
            Ton profil de départ
          </h2>
          <div className="champ">
            <label htmlFor={ids.nom} className="champ__libelle">
              Nom de la partie
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
              Salaire brut annuel
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
              <p className="champ__aide chiffres">Soit {formatMontant(net)} net par mois avant impôt (cadre).</p>
            ) : null}
          </div>
          <div className="champ">
            <label htmlFor={ids.depenses} className="champ__libelle">
              Dépenses courantes par mois <span className="etiquette etiquette--fictif">Hypothèse</span>
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
            <p className="champ__aide">Loyer, courses, transport, loisirs… Elles suivront l’inflation de la période jouée.</p>
          </div>
          <div className="champ">
            <label htmlFor={ids.epargne} className="champ__libelle">
              Argent sur ton compte au départ
            </label>
            <div className="champ__boite">
              <input
                id={ids.epargne}
                className="champ__saisie chiffres"
                inputMode="decimal"
                value={epargne}
                onChange={(e) => {
                  setEpargne(e.target.value)
                }}
              />
              <span className="champ__unite">€</span>
            </div>
          </div>
          <div className="champ">
            <label htmlFor={ids.hausse} className="champ__libelle">
              Hausse de salaire au-delà de l’inflation <span className="etiquette etiquette--fictif">Hypothèse</span>
            </label>
            <div className="champ__boite">
              <input
                id={ids.hausse}
                className="champ__saisie chiffres"
                inputMode="decimal"
                value={hausse}
                onChange={(e) => {
                  setHausse(e.target.value)
                }}
              />
              <span className="champ__unite">% par an</span>
            </div>
            <p className="champ__aide">
              Chaque janvier, ton brut suit l’inflation des 12 derniers mois, plus cette hausse, plus un peu de hasard.
            </p>
          </div>
        </section>

        <section className="carte" aria-labelledby="mode-marche">
          <span className="surtitre">Mode de marché</span>
          <h2 id="mode-marche" className="carte__titre">
            Comment bougent les marchés ?
          </h2>
          <div className="choix-liste" role="radiogroup" aria-label="Mode de marché">
            <Choix
              choisi={mode === 'historique'}
              onChoisir={() => {
                setMode('historique')
              }}
              titre="Historique"
              detail="Une vraie période de dix ans (MSCI World en euros, Insee, Banque de France, ACPR), révélée à la fin."
            />
            <Choix
              choisi={mode === 'monte-carlo'}
              onChoisir={() => {
                setMode('monte-carlo')
              }}
              titre="Monte Carlo"
              detail="Des blocs de douze mois réels recollés au hasard : une trajectoire possible parmi d’autres, sur trente ans."
              verrou={monteCarlo ? undefined : 'Avec le module 3 · Marchés financiers'}
            />
            <Choix
              choisi={mode === 'scenario'}
              onChoisir={() => {
                setMode('scenario')
              }}
              titre="Scénario de crise"
              detail="Des chocs imposés pour tester la robustesse de ta stratégie."
              verrou={scenarios ? undefined : 'Avec le module 5 · Stratégies'}
            />
          </div>

          {mode === 'historique' ? (
            <>
              <div className="choix-liste" role="radiogroup" aria-label="Période">
                <Choix
                  choisi={periode === 'hasard'}
                  onChoisir={() => {
                    setPeriode('hasard')
                  }}
                  titre="Période tirée au hasard, révélée à la fin"
                />
                <Choix
                  choisi={periode === 'choisie'}
                  onChoisir={() => {
                    setPeriode('choisie')
                  }}
                  titre="Choisir l’année de départ"
                />
              </div>
              {periode === 'choisie' ? (
                <div className="champ">
                  <label htmlFor={ids.annee} className="champ__libelle">
                    Les marchés de janvier…
                  </label>
                  <select
                    id={ids.annee}
                    className="champ__select"
                    value={annee}
                    onChange={(e) => {
                      setAnnee(e.target.value)
                    }}
                  >
                    {anneesPossibles.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </>
          ) : null}

          {mode === 'scenario' ? (
            <div className="choix-liste" role="radiogroup" aria-label="Scénario">
              {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
                <Choix
                  key={s}
                  choisi={scenario === s}
                  onChoisir={() => {
                    setScenario(s)
                  }}
                  titre={`${SCENARIOS[s].nom}${SCENARIOS[s].reel ? '' : ' (chocs fictifs)'}`}
                  detail={SCENARIOS[s].description}
                />
              ))}
            </div>
          ) : null}
        </section>
        <button type="button" className="bouton bouton--plein" disabled={!valide} onClick={() => void commencer()}>
          Commencer la partie
          <Icone nom="suivant" taille={20} epaisseur={2} />
        </button>
        <p className="texte-secondaire mention-educative">
          Le simulateur rejoue et modélise, il ne prédit rien. Les rendements passés ne garantissent pas les rendements
          futurs.
        </p>
      </main>
    </>
  )
}
