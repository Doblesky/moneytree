/**
 * Création d'une partie : profil de départ et mode de marché. En phase 1, seul le mode
 * historique existe : une vraie période de dix ans, tirée au hasard ou choisie, révélée à
 * la fin. Monte Carlo et scénarios arrivent en phase 2.
 */
import { useId, useState } from 'react'
import { useProfil } from '../../app/donnees.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { nouvelleGraine } from '../../engine/aleatoire.ts'
import { nombreDeDepartsPossibles, SERIES } from '../../engine/marches.ts'
import { brutVersNet } from '../../engine/salaire.ts'
import { creerPartie, DUREE_PARTIE_MOIS } from '../../engine/simulation.ts'
import { formatMontant } from '../../lib/format.ts'
import { enregistrerPartie } from '../../storage/partie.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { Icone } from '../../ui/Icone.tsx'

function lire(texte: string): number {
  const n = Number(texte.replace(/[\s\u202F\u00A0]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : Number.NaN
}

export function NouvellePartie() {
  const profil = useProfil()
  const p = parametres2026()
  const [brut, setBrut] = useState<string | null>(null)
  const [depenses, setDepenses] = useState('1500')
  const [epargne, setEpargne] = useState('0')
  const [hausse, setHausse] = useState('1')
  const [periode, setPeriode] = useState<'hasard' | 'choisie'>('hasard')
  const departs = nombreDeDepartsPossibles(DUREE_PARTIE_MOIS)
  const anneesPossibles = [...new Set(SERIES.mois.slice(0, departs).map((m) => m.slice(0, 4)))]
  const [annee, setAnnee] = useState(anneesPossibles[0] ?? '2001')
  const ids = { brut: useId(), depenses: useId(), epargne: useId(), hausse: useId(), annee: useId() }

  const brutTexte = brut ?? String(Math.round(profil?.salaireViseBrutAnnuel ?? 42000))
  const valeurs = {
    brut: lire(brutTexte),
    depenses: lire(depenses),
    epargne: lire(epargne),
    hausse: lire(hausse) / 100,
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
    const indice = periode === 'choisie' ? SERIES.mois.indexOf(`${annee}-01`) : undefined
    const maintenant = new Date()
    const partie = creerPartie({
      brutAnnuel: valeurs.brut,
      depensesMensuelles: valeurs.depenses,
      tresorerieInitiale: valeurs.epargne,
      hausseReelleAnnuelle: valeurs.hausse,
      graine: nouvelleGraine(),
      calendrier: { annee: maintenant.getFullYear() + 1, mois: 0 },
      versements: { livretA: 150, cto: 200 },
      ...(indice !== undefined && indice >= 0 ? { debutHistorique: indice } : {}),
    })
    await enregistrerPartie(partie, null)
  }

  return (
    <>
      <EnTete titre="Simulateur" sousTitre="Tes dix premières années, sur une vraie période de marché." />
      <main className="ecran apparition">
        <section className="carte" aria-labelledby="nouvelle-partie">
          <span className="surtitre">Nouvelle partie</span>
          <h2 id="nouvelle-partie" className="carte__titre">
            Ton profil de départ
          </h2>
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
            <p className="champ__aide">Loyer, courses, transport, loisirs… Elles suivront l’inflation de la période rejouée.</p>
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
            Historique
          </h2>
          <p className="carte__texte">
            Les marchés, l’inflation et les taux des livrets rejouent une vraie période de dix ans (MSCI World en euros,
            Insee, Banque de France). Tu ne sais pas laquelle : comme dans la vraie vie, tu traverses les krachs sans savoir
            quand ils s’arrêtent.
          </p>
          <div className="choix-liste" role="radiogroup" aria-label="Période">
            <button
              type="button"
              role="radio"
              aria-checked={periode === 'hasard'}
              className="choix"
              onClick={() => {
                setPeriode('hasard')
              }}
            >
              <span className="choix__titre">Tirée au hasard, révélée à la fin</span>
              <span className="choix__coche" aria-hidden="true">
                {periode === 'hasard' ? <Icone nom="coche" taille={14} epaisseur={3} /> : null}
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={periode === 'choisie'}
              className="choix"
              onClick={() => {
                setPeriode('choisie')
              }}
            >
              <span className="choix__titre">Choisir l’année de départ</span>
              <span className="choix__coche" aria-hidden="true">
                {periode === 'choisie' ? <Icone nom="coche" taille={14} epaisseur={3} /> : null}
              </span>
            </button>
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
          <div className="modes-a-venir">
            <span className="etiquette etiquette--verrou">
              <Icone nom="cadenas" taille={12} /> Monte Carlo · M3
            </span>
            <span className="etiquette etiquette--verrou">
              <Icone nom="cadenas" taille={12} /> Scénarios · phase 2
            </span>
          </div>
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
