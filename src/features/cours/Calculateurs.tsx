/**
 * Mini-calculateurs des cartes de cours. Ceux qui touchent à des règles réelles (brut →
 * net, impôt, livrets) utilisent le moteur et les paramètres officiels ; les autres
 * illustrent un principe avec des taux fictifs, signalés comme tels.
 */
import { Fragment, useId, useMemo, useState, type CSSProperties, type JSX } from 'react'
import type { NomCalculateur } from '../../content/schema.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { economiePer, impositionGainParEnveloppe, valeurApresFrais } from '../../engine/calculs.ts'
import { coutCredit, fraisAcquisitionAncien, mensualiteCredit } from '../../engine/immobilier.ts'
import { calculerIR, impotParPart, nombreDeParts, parametresIR } from '../../engine/impots.ts'
import { brutVersNet } from '../../engine/salaire.ts'
import { formatMontant, formatNombre, formatPourcentage } from '../../lib/format.ts'

interface PropsCurseur {
  libelle: string
  valeur: number
  min: number
  max: number
  pas: number
  format: (v: number) => string
  onChange: (v: number) => void
}

export function Curseur({ libelle, valeur, min, max, pas, format, onChange }: PropsCurseur) {
  const id = useId()
  return (
    <div className="curseur">
      <div className="curseur__ligne">
        <label htmlFor={id}>{libelle}</label>
        <output htmlFor={id} className="chiffres">
          {format(valeur)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={pas}
        value={valeur}
        style={{ '--remplissage': `${((valeur - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(e) => {
          onChange(Number(e.target.value))
        }}
      />
    </div>
  )
}

export function Resultat({ libelle, valeur, detail }: { libelle: string; valeur: string; detail?: string }) {
  return (
    <div className="calculateur__resultat">
      <span>{libelle}</span>
      <strong className="chiffres">{valeur}</strong>
      {detail ? <span className="texte-secondaire chiffres">{detail}</span> : null}
    </div>
  )
}

const euros = (v: number) => formatMontant(v)
const pourcent = (v: number) => formatPourcentage(v / 100)

function InteretsComposes() {
  const [versement, setVersement] = useState(200)
  const [annees, setAnnees] = useState(30)
  const [taux, setTaux] = useState(4)
  const { final, verse } = useMemo(() => {
    const r = taux / 100 / 12
    let valeur = 0
    for (let m = 0; m < annees * 12; m++) valeur = valeur * (1 + r) + versement
    return { final: valeur, verse: versement * annees * 12 }
  }, [versement, annees, taux])
  const partGains = final > 0 ? (final - verse) / final : 0
  return (
    <>
      <Curseur libelle="Versement mensuel" valeur={versement} min={50} max={1000} pas={50} format={euros} onChange={setVersement} />
      <Curseur libelle="Durée" valeur={annees} min={1} max={40} pas={1} format={(v) => `${v} ans`} onChange={setAnnees} />
      <Curseur libelle="Rendement fictif par an" valeur={taux} min={0} max={8} pas={0.5} format={pourcent} onChange={setTaux} />
      <Resultat libelle={`Au bout de ${annees} ans`} valeur={euros(final)} />
      <div className="barre-proportion" aria-hidden="true">
        <span style={{ width: `${(1 - partGains) * 100}%` }} />
      </div>
      <div className="calculateur__legende chiffres">
        <span>Versé {euros(verse)}</span>
        <span>Gains {euros(final - verse)}</span>
      </div>
    </>
  )
}

function BrutNet() {
  const p = parametres2026()
  const [brut, setBrut] = useState(42000)
  const s = brutVersNet(brut, p['cotisations.salarieCadre'].valeur)
  return (
    <>
      <Curseur libelle="Salaire brut annuel" valeur={brut} min={25000} max={90000} pas={1000} format={euros} onChange={setBrut} />
      <Resultat libelle="Net avant impôt" valeur={`${euros(s.netAvantImpot / 12)} / mois`} detail={`${euros(s.netAvantImpot)} par an`} />
      <div className="calculateur__legende chiffres">
        <span>Cotisations : {euros(s.cotisations / 12)} / mois ({formatPourcentage(s.cotisations / s.brut, { decimales: 1 })} du brut)</span>
        <span>Net imposable : {euros(s.netImposable / 12)} / mois</span>
      </div>
      <p className="note-source">Cadre en CDI à temps plein, calcul calé sur le simulateur officiel de l’Urssaf.</p>
    </>
  )
}

function Inflation() {
  const [montant, setMontant] = useState(1000)
  const [inflation, setInflation] = useState(5)
  const [annees, setAnnees] = useState(1)
  const constant = montant / (1 + inflation / 100) ** annees
  return (
    <>
      <Curseur libelle="Montant" valeur={montant} min={100} max={10000} pas={100} format={euros} onChange={setMontant} />
      <Curseur libelle="Inflation fictive par an" valeur={inflation} min={0} max={10} pas={0.5} format={pourcent} onChange={setInflation} />
      <Curseur libelle="Durée" valeur={annees} min={1} max={40} pas={1} format={(v) => `${v} an${v > 1 ? 's' : ''}`} onChange={setAnnees} />
      <Resultat libelle="Pouvoir d’achat, en euros d’aujourd’hui" valeur={euros(constant)} detail={`${euros(montant)} en euros courants`} />
    </>
  )
}

function RendementReel() {
  const [rendement, setRendement] = useState(4)
  const [inflation, setInflation] = useState(3)
  const reel = ((1 + rendement / 100) / (1 + inflation / 100) - 1) * 100
  return (
    <>
      <Curseur libelle="Rendement fictif" valeur={rendement} min={0} max={10} pas={0.25} format={pourcent} onChange={setRendement} />
      <Curseur libelle="Inflation fictive" valeur={inflation} min={0} max={10} pas={0.25} format={pourcent} onChange={setInflation} />
      <Resultat
        libelle="Rendement réel"
        valeur={formatPourcentage(reel / 100, { decimales: 2, signe: true })}
        detail={`Approximation : ${formatPourcentage((rendement - inflation) / 100, { decimales: 2, signe: true })}`}
      />
    </>
  )
}

function Regle72() {
  const [taux, setTaux] = useState(6)
  const exact = Math.log(2) / Math.log(1 + taux / 100)
  return (
    <>
      <Curseur libelle="Taux annuel fictif" valeur={taux} min={1} max={12} pas={0.5} format={pourcent} onChange={setTaux} />
      <Resultat
        libelle="Temps pour doubler"
        valeur={`≈ ${formatNombre(72 / taux, { decimales: 1 })} ans`}
        detail={`Calcul exact : ${formatNombre(exact, { decimales: 1 })} ans`}
      />
    </>
  )
}

function Bareme() {
  const p = parametres2026()
  const pIR = parametresIR(p)
  const [revenu, setRevenu] = useState(31500)
  const lignes = pIR.bareme.map((t, i) => {
    const bas = pIR.bareme[i - 1]?.jusqua ?? 0
    const haut = t.jusqua ?? Number.POSITIVE_INFINITY
    const assiette = Math.max(0, Math.min(revenu, haut) - bas)
    return { taux: t.taux, assiette, impot: assiette * t.taux }
  })
  const total = impotParPart(revenu, pIR.bareme)
  return (
    <>
      <Curseur libelle="Revenu imposable (1 part)" valeur={revenu} min={5000} max={200000} pas={500} format={euros} onChange={setRevenu} />
      <table className="tableau-bareme chiffres">
        <thead>
          <tr>
            <th scope="col">Tranche</th>
            <th scope="col">Assiette</th>
            <th scope="col">Impôt</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.taux} className={l.assiette > 0 ? '' : 'tableau-bareme__vide'}>
              <th scope="row">{formatPourcentage(l.taux)}</th>
              <td>{euros(l.assiette)}</td>
              <td>{euros(l.impot)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Resultat libelle="Impôt brut (avant décote)" valeur={euros(total)} detail={`Taux moyen : ${formatPourcentage(total / revenu, { decimales: 1 })}`} />
    </>
  )
}

function Impot() {
  const p = parametres2026()
  const pIR = parametresIR(p)
  const [salaires, setSalaires] = useState(35000)
  const d = calculerIR({ foyer: { situation: 'celibataire', enfantsACharge: 0 }, salaires: [salaires] }, pIR)
  return (
    <>
      <Curseur libelle="Salaires nets imposables par an" valeur={salaires} min={10000} max={150000} pas={500} format={euros} onChange={setSalaires} />
      <div className="calculateur__lignes chiffres">
        <span>Revenu net imposable</span>
        <span>{euros(d.revenuNetImposable)}</span>
        <span>Impôt brut</span>
        <span>{euros(d.droitsSimples)}</span>
        {d.decote > 0 ? (
          <>
            <span>Décote</span>
            <span>−{euros(d.decote)}</span>
          </>
        ) : null}
        <span>Tranche marginale</span>
        <span>{formatPourcentage(d.tauxMarginal)}</span>
        <span>Taux moyen</span>
        <span>{formatPourcentage(d.tauxMoyen, { decimales: 1 })}</span>
      </div>
      <Resultat libelle="Impôt à payer" valeur={euros(d.impotNet)} />
      <p className="note-source">Personne seule, barème des revenus 2025 (loi de finances pour 2026).</p>
    </>
  )
}

function QuotientFamilial() {
  const p = parametres2026()
  const pIR = parametresIR(p)
  const [revenu, setRevenu] = useState(63000)
  const [couple, setCouple] = useState(true)
  const [enfants, setEnfants] = useState(1)
  const foyer = { situation: couple ? ('couple' as const) : ('celibataire' as const), enfantsACharge: enfants }
  // Salaires qui donnent ce revenu net imposable après la déduction de 10 %.
  const d = calculerIR({ foyer, salaires: [revenu / 0.9] }, pIR)
  return (
    <>
      <Curseur libelle="Revenu net imposable du foyer" valeur={revenu} min={10000} max={250000} pas={1000} format={euros} onChange={setRevenu} />
      <Curseur libelle="Enfants à charge" valeur={enfants} min={0} max={4} pas={1} format={(v) => String(v)} onChange={setEnfants} />
      <label className="case">
        <input
          type="checkbox"
          checked={couple}
          onChange={(e) => {
            setCouple(e.target.checked)
          }}
        />
        Couple marié ou pacsé
      </label>
      <div className="calculateur__lignes chiffres">
        <span>Parts</span>
        <span>{formatNombre(nombreDeParts(foyer), { decimales: nombreDeParts(foyer) % 1 ? 1 : 0 })}</span>
        <span>Revenu par part</span>
        <span>{euros(d.revenuNetImposable / d.parts)}</span>
        {d.plafonnementQuotientFamilial > 0 ? (
          <>
            <span>Plafonnement</span>
            <span>+{euros(d.plafonnementQuotientFamilial)}</span>
          </>
        ) : null}
      </div>
      <Resultat libelle="Impôt brut du foyer" valeur={euros(d.droitsSimples)} />
    </>
  )
}

function LivretA() {
  const p = parametres2026()
  const taux = p['livretA.taux'].valeur
  const [montant, setMontant] = useState(5000)
  return (
    <>
      <Curseur libelle="Somme placée toute l’année" valeur={montant} min={100} max={p['livretA.plafond'].valeur} pas={100} format={euros} onChange={setMontant} />
      <Resultat libelle={`Intérêts sur un an à ${formatPourcentage(taux)}`} valeur={euros(montant * taux)} detail="Sans impôt ni prélèvements sociaux" />
    </>
  )
}

function PfuBareme() {
  const p = parametres2026()
  const [gain, setGain] = useState(1000)
  const [tmi, setTmi] = useState(11)
  const ps = gain * p['prelevementsSociaux.tauxGeneral'].valeur
  const pfu = gain * p['pfu.tauxImpotRevenu'].valeur
  const bareme = gain * (tmi / 100)
  const economieCsg = gain * p['prelevementsSociaux.csgDeductibleBareme'].valeur * (tmi / 100)
  return (
    <>
      <Curseur libelle="Plus-value" valeur={gain} min={100} max={20000} pas={100} format={euros} onChange={setGain} />
      <Curseur libelle="Ta tranche marginale" valeur={tmi} min={0} max={45} pas={1} format={pourcent} onChange={setTmi} />
      <div className="calculateur__lignes chiffres">
        <span>PFU : impôt + prélèvements sociaux</span>
        <span>{euros(pfu + ps)}</span>
        <span>Barème : impôt + prélèvements sociaux</span>
        <span>{euros(bareme + ps)}</span>
        <span>CSG déductible l’année suivante (barème)</span>
        <span>−{euros(economieCsg)}</span>
      </div>
      <p className="note-source">
        Estimation simple : en réalité, la plus-value peut te faire changer de tranche. Choisis 0 %, 11 %, 30 %, 41 % ou 45 %.
      </p>
    </>
  )
}

function PerEconomie() {
  const p = parametres2026()
  const [salaires, setSalaires] = useState(45000)
  const [versement, setVersement] = useState(2000)
  const r = economiePer({ foyer: { situation: 'celibataire', enfantsACharge: 0 }, salaires: [salaires], versement }, p)
  return (
    <>
      <Curseur libelle="Salaires nets imposables par an" valeur={salaires} min={15000} max={150000} pas={1000} format={euros} onChange={setSalaires} />
      <Curseur libelle="Versement sur le PER" valeur={versement} min={0} max={15000} pas={250} format={euros} onChange={setVersement} />
      <div className="calculateur__lignes chiffres">
        <span>Plafond de déduction</span>
        <span>{euros(r.plafond)}</span>
        <span>Part déduite</span>
        <span>{euros(r.deduit)}</span>
        <span>Impôt sans versement</span>
        <span>{euros(r.impotSans)}</span>
        <span>Impôt avec versement</span>
        <span>{euros(r.impotAvec)}</span>
      </div>
      <Resultat
        libelle="Impôt économisé cette année"
        valeur={euros(r.economie)}
        detail={`Tranche marginale avant versement : ${formatPourcentage(r.tauxMarginal)}`}
      />
      <p className="note-source">
        Personne seule, mêmes salaires l’année précédente, sans plafond reporté. L’impôt est reporté, pas effacé : la part
        déduite sera imposée à la sortie.
      </p>
    </>
  )
}

function FiscaliteEnveloppes() {
  const p = parametres2026()
  const [gain, setGain] = useState(10000)
  const [couple, setCouple] = useState(false)
  const r = impositionGainParEnveloppe(gain, p, { couple })
  const lignes = [
    { libelle: 'Compte-titres (PFU)', i: r.cto },
    { libelle: 'PEA de plus de 5 ans', i: r.pea },
    { libelle: 'Assurance-vie de plus de 8 ans', i: r.assuranceVie },
  ]
  return (
    <>
      <Curseur libelle="Gain sorti" valeur={gain} min={500} max={50000} pas={500} format={euros} onChange={setGain} />
      <label className="case">
        <input
          type="checkbox"
          checked={couple}
          onChange={(e) => {
            setCouple(e.target.checked)
          }}
        />
        Couple marié ou pacsé (abattement de l’assurance-vie doublé)
      </label>
      <div className="calculateur__lignes chiffres">
        {lignes.map((l) => (
          <Fragment key={l.libelle}>
            <span>
              {l.libelle}
              <small className="calculateur__detail">
                impôt {euros(l.i.impotRevenu)} · prélèvements sociaux {euros(l.i.prelevementsSociaux)}
              </small>
            </span>
            <span>{euros(l.i.total)}</span>
          </Fragment>
        ))}
      </div>
      <p className="note-source">
        Gain sorti en une fois, sans autre rachat sur l’assurance-vie dans l’année et avec moins de 150 000 € de primes.
      </p>
    </>
  )
}

function Frais() {
  const [rendement, setRendement] = useState(5)
  const [fraisEntree, setFraisEntree] = useState(2)
  const [fraisAnnuels, setFraisAnnuels] = useState(1.8)
  const [fraisFixes, setFraisFixes] = useState(10)
  const [annees, setAnnees] = useState(5)
  const r = valeurApresFrais({
    montant: 1000,
    rendement: rendement / 100,
    fraisEntree: fraisEntree / 100,
    fraisAnnuels: fraisAnnuels / 100,
    fraisFixes,
    annees,
  })
  return (
    <>
      <Curseur libelle="Rendement brut fictif par an" valeur={rendement} min={0} max={8} pas={0.5} format={pourcent} onChange={setRendement} />
      <Curseur libelle="Frais d’entrée" valeur={fraisEntree} min={0} max={5} pas={0.5} format={pourcent} onChange={setFraisEntree} />
      <Curseur libelle="Frais annuels (gestion et garde)" valeur={fraisAnnuels} min={0} max={3} pas={0.1} format={(v) => formatPourcentage(v / 100, { decimales: 1 })} onChange={setFraisAnnuels} />
      <Curseur libelle="Tenue de compte par an" valeur={fraisFixes} min={0} max={20} pas={1} format={euros} onChange={setFraisFixes} />
      <Curseur libelle="Durée" valeur={annees} min={1} max={30} pas={1} format={(v) => `${v} an${v > 1 ? 's' : ''}`} onChange={setAnnees} />
      <div className="calculateur__lignes chiffres">
        <span>Sans frais</span>
        <span>{euros(r.sansFrais)}</span>
        <span>Manque à gagner dû aux frais</span>
        <span>{euros(r.fraisPayes)}</span>
      </div>
      <Resultat
        libelle="Ce que tu récupères"
        valeur={euros(r.avecFrais)}
        detail={`Rendement net : ${formatPourcentage(r.rendementNet, { decimales: 1 })} par an`}
      />
      <p className="note-source">
        1 000 € placés une fois. Réglages de départ : l’exemple de l’AMF (1,5 % de frais de gestion et 0,30 % de droits
        de garde par an), retrouvé à un euro près selon l’ordre des calculs.
      </p>
    </>
  )
}

function Credit() {
  const p = parametres2026()
  const [capital, setCapital] = useState(200000)
  const [annees, setAnnees] = useState(25)
  const [taux, setTaux] = useState(Math.round(p['credit.tauxMoyenNouveauxCreditsHabitat'].valeur * 10000) / 100)
  const mensualite = mensualiteCredit(capital, taux / 100, annees * 12)
  const cout = coutCredit(capital, taux / 100, 0, annees * 12)
  return (
    <>
      <Curseur libelle="Somme empruntée" valeur={capital} min={20000} max={500000} pas={5000} format={euros} onChange={setCapital} />
      <Curseur libelle="Durée" valeur={annees} min={5} max={25} pas={1} format={(v) => `${v} ans`} onChange={setAnnees} />
      <Curseur libelle="Taux nominal" valeur={taux} min={0.5} max={6} pas={0.05} format={(v) => formatPourcentage(v / 100, { decimales: 2 })} onChange={setTaux} />
      <Resultat libelle="Mensualité, hors assurance" valeur={euros(mensualite)} detail={`Intérêts sur toute la durée : ${euros(cout.interets)}`} />
      <p className="note-source">Taux de départ : taux moyen des nouveaux crédits à l’habitat publié par la Banque de France.</p>
    </>
  )
}

function FraisNotaire() {
  const p = parametres2026()
  const [prix, setPrix] = useState(200000)
  const [primo, setPrimo] = useState(true)
  const f = fraisAcquisitionAncien(prix, p, { primoAccedant: primo })
  return (
    <>
      <Curseur libelle="Prix du logement ancien" valeur={prix} min={50000} max={800000} pas={5000} format={euros} onChange={setPrix} />
      <label className="case">
        <input
          type="checkbox"
          checked={primo}
          onChange={(e) => {
            setPrimo(e.target.checked)
          }}
        />
        Premier achat de ta résidence principale
      </label>
      <div className="calculateur__lignes chiffres">
        <span>Droits de mutation (département à {formatPourcentage(f.droitDepartemental, { decimales: 1 })})</span>
        <span>{euros(f.droitsMutation)}</span>
        <span>Contribution de sécurité immobilière</span>
        <span>{euros(f.contributionSecurite)}</span>
        <span>Émoluments du notaire, TVA comprise</span>
        <span>{euros(f.emolumentsTTC)}</span>
      </div>
      <Resultat libelle="Frais d’acquisition" valeur={euros(f.total)} detail={`Soit ${formatPourcentage(f.total / prix, { decimales: 1 })} du prix, hors débours`} />
    </>
  )
}

const CALCULATEURS: Record<NomCalculateur, () => JSX.Element> = {
  'interets-composes': InteretsComposes,
  'brut-net': BrutNet,
  inflation: Inflation,
  'rendement-reel': RendementReel,
  'regle-72': Regle72,
  bareme: Bareme,
  impot: Impot,
  'quotient-familial': QuotientFamilial,
  'livret-a': LivretA,
  'pfu-bareme': PfuBareme,
  'per-economie': PerEconomie,
  'fiscalite-enveloppes': FiscaliteEnveloppes,
  frais: Frais,
  credit: Credit,
  'frais-notaire': FraisNotaire,
}

export function Calculateur({ nom }: { nom: NomCalculateur }) {
  const Composant = CALCULATEURS[nom]
  return (
    <div className="calculateur">
      <Composant />
    </div>
  )
}
