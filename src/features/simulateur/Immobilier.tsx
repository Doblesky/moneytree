/**
 * Immobilier du simulateur (débloqué par le module 6) : tes biens, leur crédit, et un
 * formulaire d'achat qui montre en direct ce que dirait la banque (frais, mensualité, taux
 * d'effort, règles du HCSF, usure).
 */
import { useState } from 'react'
import { parametres2026 } from '../../data/params/index.ts'
import { assuranceMensuelle } from '../../engine/immobilier.ts'
import { acheterBien, etudierAchat, vendreBien, type AchatBien, type EtatPartie } from '../../engine/simulation.ts'
import { formatMontant, formatPourcentage } from '../../lib/format.ts'
import { Choix } from '../../ui/Choix.tsx'
import { Terme } from '../../ui/glossaire.tsx'
import { Curseur } from '../cours/Calculateurs.tsx'

const euros = (v: number) => formatMontant(v)

function Biens({ etat, onVendre }: { etat: EtatPartie; onVendre: (id: number) => void }) {
  if (etat.biens.length === 0) return null
  return (
    <ul className="liste-resultats chiffres">
      {etat.biens.map((b) => (
        <li key={b.id}>
          <span>
            {b.nom}
            {b.usage === 'locatif' ? ' · location nue' : ''}
            <small className="calculateur__detail">
              Acheté {euros(b.prixAchat)}
              {b.credit
                ? ` · reste ${euros(b.credit.capitalRestant)} à rembourser, ${euros(b.credit.mensualite + assuranceMensuelle(b.credit))} par mois`
                : ' · sans crédit'}
              {b.usage === 'locatif' ? ` · loyer ${euros(b.loyerMensuel * etat.indicePrix)} par mois` : ''}
            </small>
            <button
              type="button"
              className="lien-tertiaire"
              onClick={() => {
                onVendre(b.id)
              }}
            >
              Vendre au prix du marché
            </button>
          </span>
          <strong>{euros(b.valeur)}</strong>
        </li>
      ))}
    </ul>
  )
}

export function Immobilier({
  etat,
  onChange,
  onMessage,
  loyerActuel = 0,
}: {
  etat: EtatPartie
  onChange: (etat: EtatPartie, achat: AchatBien | null) => void
  onMessage: (m: string) => void
  /** Loyer actuel en euros du départ, retiré des dépenses si tu achètes ta résidence principale. */
  loyerActuel?: number
}) {
  const p = parametres2026()
  const proprietaire = etat.biens.some((b) => b.usage === 'residence-principale')
  const [usage, setUsage] = useState<AchatBien['usage']>(proprietaire ? 'locatif' : 'residence-principale')
  const [prix, setPrix] = useState(200000)
  const [apport, setApport] = useState(20000)
  const [annees, setAnnees] = useState(25)
  const [taux, setTaux] = useState(Math.round(p['credit.tauxMoyenNouveauxCreditsHabitat'].valeur * 10000) / 100)
  const [assurance, setAssurance] = useState(0.3)
  const [charges, setCharges] = useState(100)
  const [taxe, setTaxe] = useState(900)
  const [loyer, setLoyer] = useState(700)
  const [vacance, setVacance] = useState(5)
  const [ouvert, setOuvert] = useState(false)

  const achat: AchatBien = {
    usage,
    nom: usage === 'residence-principale' ? 'Résidence principale' : `Bien loué ${etat.biens.filter((b) => b.usage === 'locatif').length + 1}`,
    prix,
    apport,
    dureeMois: annees * 12,
    tauxCredit: taux / 100,
    tauxAssurance: assurance / 100,
    chargesMensuelles: charges,
    taxeFonciereAnnuelle: taxe,
    loyerMensuel: usage === 'locatif' ? loyer : 0,
    vacance: usage === 'locatif' ? vacance / 100 : 0,
    loyerQuitte: usage === 'residence-principale' ? loyerActuel : 0,
  }
  const etude = etudierAchat(etat, p, achat)

  return (
    <section className="carte" aria-labelledby="immobilier">
      <h2 id="immobilier" className="carte__surtitre">
        Immobilier
      </h2>
      <Biens
        etat={etat}
        onVendre={(id) => {
          onChange(vendreBien(etat, id), null)
          onMessage('Bien vendu : le crédit est soldé et le reste arrive sur ton compte.')
        }}
      />
      {ouvert ? (
        <div className="achat-bien">
          <div className="choix-liste" role="radiogroup" aria-label="Usage du bien">
            <Choix
              choisi={usage === 'residence-principale'}
              onChoisir={() => {
                setUsage('residence-principale')
              }}
              titre="Ta résidence principale"
              detail={loyerActuel > 0 ? `Tu ne paies plus ton loyer de ${euros(loyerActuel * etat.indicePrix)}.` : 'Ton loyer sort de tes dépenses.'}
              verrou={proprietaire ? 'Tu en as déjà une' : undefined}
            />
            <Choix
              choisi={usage === 'locatif'}
              onChoisir={() => {
                setUsage('locatif')
              }}
              titre="Un bien à louer vide"
              detail="Loyers imposés comme revenus fonciers."
            />
          </div>
          <div className="calculateur">
            <Curseur libelle="Prix du bien (hors frais)" valeur={prix} min={50000} max={800000} pas={5000} format={euros} onChange={setPrix} />
            <Curseur libelle="Apport (compte et livrets)" valeur={apport} min={0} max={200000} pas={1000} format={euros} onChange={setApport} />
            <Curseur libelle="Durée du crédit" valeur={annees} min={5} max={30} pas={1} format={(v) => `${v} ans`} onChange={setAnnees} />
            <Curseur
              libelle="Taux du crédit"
              valeur={taux}
              min={1}
              max={7}
              pas={0.05}
              format={(v) => formatPourcentage(v / 100, { decimales: 2 })}
              onChange={setTaux}
            />
            <Curseur
              libelle="Assurance emprunteur par an (hypothèse)"
              valeur={assurance}
              min={0}
              max={1}
              pas={0.05}
              format={(v) => formatPourcentage(v / 100, { decimales: 2 })}
              onChange={setAssurance}
            />
            <Curseur libelle="Charges et entretien par mois (hypothèse)" valeur={charges} min={0} max={600} pas={10} format={euros} onChange={setCharges} />
            <Curseur libelle="Taxe foncière par an (hypothèse)" valeur={taxe} min={0} max={4000} pas={50} format={euros} onChange={setTaxe} />
            {usage === 'locatif' ? (
              <>
                <Curseur libelle="Loyer hors charges par mois" valeur={loyer} min={200} max={3000} pas={10} format={euros} onChange={setLoyer} />
                <Curseur libelle="Vacance locative (hypothèse)" valeur={vacance} min={0} max={30} pas={1} format={(v) => `${v} %`} onChange={setVacance} />
              </>
            ) : null}
          </div>
          <div className="calculateur__lignes chiffres">
            <span>
              <Terme cle="frais-de-notaire">Frais d’acquisition</Terme>
            </span>
            <span>{euros(etude.frais)}</span>
            <span>Somme empruntée</span>
            <span>{euros(etude.capitalEmprunte)}</span>
            <span>Mensualité, assurance comprise</span>
            <span>{euros(etude.mensualiteAvecAssurance)}</span>
            <span>
              <Terme cle="taux-effort">Taux d’effort</Terme>
            </span>
            <span>{formatPourcentage(etude.tauxEffort, { decimales: 1 })}</span>
          </div>
          {etude.motifs.length > 0 ? (
            <div className="message message--erreur" role="status">
              <strong>La banque refuserait :</strong>
              <ul>
                {etude.motifs.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="note-source">
            Frais d’acquisition dans l’ancien : droits de mutation (primo-accédant : sans la hausse de 2025) et émoluments du
            notaire, hors débours. Taux par défaut : taux moyen des nouveaux crédits à l’habitat publié par la Banque de France.
            La valeur du bien suit ensuite l’indice Notaires-Insee des prix des logements anciens.
          </p>
          <button
            type="button"
            className="bouton bouton--plein"
            disabled={etude.motifs.length > 0}
            onClick={() => {
              const r = acheterBien(etat, p, achat)
              if (r.refus.length === 0) {
                onChange(r.etat, achat)
                onMessage(usage === 'residence-principale' ? 'Te voilà propriétaire de ta résidence principale.' : 'Bien acheté : les loyers arrivent chaque mois.')
                setOuvert(false)
              }
            }}
          >
            Acheter
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="bouton bouton--contour"
          onClick={() => {
            setOuvert(true)
          }}
        >
          Étudier un achat
        </button>
      )}
    </section>
  )
}
