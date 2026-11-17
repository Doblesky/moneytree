/**
 * Cas d'école sur les marchés : investir en 2007, mars 2020, les frais. Les deux premiers
 * rejouent le vrai MSCI World en euros ; le troisième utilise un rendement fictif.
 */
import { useCallback, useMemo, useState } from 'react'
import { capitalAvecFrais, investir2007, mars2020, type ChoixMars2020 } from '../../engine/casEcole.ts'
import { libelleMois } from '../../engine/marches.ts'
import { formatMontant, formatPourcentage } from '../../lib/format.ts'
import { Choix } from '../../ui/Choix.tsx'
import { Graphique } from '../../ui/Graphique.tsx'
import { Curseur } from '../cours/Calculateurs.tsx'
import { ANNEES_ENTIERES } from '../simulateur/constantes.ts'
import { BoutonDebrief, Debrief, MiseEnSituation } from './communs.tsx'
import { SOURCES } from './sources.ts'

const euros = (v: number) => formatMontant(v)

export function CasInvestir2007() {
  const [choix, setChoix] = useState<'une-fois' | 'etale' | null>(null)
  const [vu, setVu] = useState(false)
  const t = useMemo(() => investir2007(), [])
  const x = useMemo(() => t.mois.map((_, i) => i + 1), [t])
  const libelleX = useCallback((i: number) => (t.mois[Math.round(i) - 1] ?? '').slice(0, 4), [t])
  const finUneFois = t.enUneFois.at(-1) ?? 0
  const finEtale = t.en24Mois.at(-1) ?? 0
  return (
    <>
      <MiseEnSituation titre="20 000 € début 2007">
        <p className="carte__texte">
          Janvier 2007 : tu as 20 000 € à placer sur un ETF MSCI World, pour au moins dix ans. Personne ne sait encore qu’une
          crise financière arrive. Tout investir maintenant, ou étaler sur 24 mois ?
        </p>
        <div className="choix-liste" role="radiogroup" aria-label="Ton choix">
          <Choix choisi={choix === 'une-fois'} onChoisir={() => { setChoix('une-fois') }} titre="Tout investir en janvier 2007" />
          <Choix choisi={choix === 'etale'} onChoisir={() => { setChoix('etale') }} titre="Investir 1/24 chaque mois en 2007 et 2008" />
        </div>
        {vu ? null : <BoutonDebrief id="investir-2007" desactive={choix === null} onVoir={() => { setVu(true) }} />}
      </MiseEnSituation>
      {vu ? (
        <Debrief titre="Fin 2016, avec le vrai MSCI World" modules={[5]} sources={[SOURCES.msci, SOURCES.conseils]}>
          <ul className="liste-resultats chiffres">
            <li className={choix === 'une-fois' ? 'liste-resultats__choisi' : ''}>
              <span>Tout en janvier 2007</span>
              <strong>{euros(finUneFois)}</strong>
            </li>
            <li className={choix === 'etale' ? 'liste-resultats__choisi' : ''}>
              <span>Étalé sur 24 mois</span>
              <strong>{euros(finEtale)}</strong>
            </li>
          </ul>
          <Graphique
            x={x}
            series={[
              { valeurs: t.enUneFois, libelle: 'En une fois' },
              { valeurs: t.en24Mois, libelle: 'Étalé sur 24 mois', couleur: '--or' },
              { valeurs: t.verse24, libelle: 'Versé (étalé)', pointille: true, discret: true },
            ]}
            libelleX={libelleX}
            increments={ANNEES_ENTIERES}
            resume={`Fin 2016 : ${euros(finUneFois)} en une fois, ${euros(finEtale)} en étalant sur 24 mois.`}
          />
          <p className="carte__texte">
            Étaler a acheté une partie des parts pendant la baisse de 2008, moins cher : c’est ce qui a mieux résisté ici.
            Ce n’est pas une règle : quand le marché monte dès le départ, investir en une fois fait mieux, car l’argent
            travaille plus longtemps. Et personne ne sait d’avance lequel des deux arrivera.
          </p>
        </Debrief>
      ) : null}
    </>
  )
}

const LIBELLES_MARS: Record<ChoixMars2020, string> = {
  vendre: 'Tout vendre et attendre',
  tenir: 'Tenir sans rien changer',
  renforcer: 'Renforcer avec 5 000 €',
}

export function CasMars2020() {
  const [choix, setChoix] = useState<ChoixMars2020 | null>(null)
  const [vu, setVu] = useState(false)
  const r = useMemo(() => mars2020(), [])
  const x = useMemo(() => r.mois.map((_, i) => i), [r])
  const libelleX = useCallback((i: number) => libelleMois(r.mois[Math.round(i)] ?? '').replace(/^\S+ /, ''), [r])
  const baisse = formatPourcentage(Math.abs(r.baisseMars), { decimales: 1 })
  return (
    <>
      <MiseEnSituation titre={`Mars 2020 : −${baisse} en un mois`}>
        <p className="carte__texte chiffres">
          Fin février 2020, ton portefeuille d’ETF monde vaut 20 000 €. En mars, la pandémie fait plonger les marchés : le
          MSCI World en euros perd {baisse} sur le mois, et ton portefeuille tombe à {euros(r.valeurFinMars)}. Les gros
          titres parlent de panique. Fin mars, que fais-tu ?
        </p>
        <div className="choix-liste" role="radiogroup" aria-label="Ton choix">
          {(Object.keys(LIBELLES_MARS) as ChoixMars2020[]).map((c) => (
            <Choix
              key={c}
              choisi={choix === c}
              onChoisir={() => { setChoix(c) }}
              titre={LIBELLES_MARS[c]}
              detail={c === 'renforcer' ? 'Pris sur une épargne disponible, au-delà de ta précaution.' : undefined}
            />
          ))}
        </div>
        {vu ? null : <BoutonDebrief id="mars-2020" desactive={choix === null} onVoir={() => { setVu(true) }} />}
      </MiseEnSituation>
      {vu ? (
        <Debrief titre="Fin 2021, avec le vrai MSCI World" modules={[5]} sources={[SOURCES.msci, SOURCES.conseils]}>
          <ul className="liste-resultats chiffres">
            {(Object.keys(LIBELLES_MARS) as ChoixMars2020[]).map((c) => (
              <li key={c} className={choix === c ? 'liste-resultats__choisi' : ''}>
                <span>
                  {LIBELLES_MARS[c]}
                  <small className="calculateur__detail">{euros(r.verse[c])} investis au total</small>
                </span>
                <strong>{euros(r.valeurs[c])}</strong>
              </li>
            ))}
          </ul>
          <Graphique
            x={x}
            series={[
              { valeurs: r.series.renforcer, libelle: 'Renforcer', couleur: '--or' },
              { valeurs: r.series.tenir, libelle: 'Tenir' },
              { valeurs: r.series.vendre, libelle: 'Vendre', pointille: true },
            ]}
            libelleX={libelleX}
            increments={[3, 6, 12]}
            resume={`Fin 2021 : ${euros(r.valeurs.vendre)} en vendant, ${euros(r.valeurs.tenir)} en tenant, ${euros(r.valeurs.renforcer)} en renforçant.`}
          />
          <p className="carte__texte">
            L’AMF prévient : « Vouloir obtenir une rentabilité rapide en essayant de jouer avec les fluctuations à court terme
            des marchés, c’est souvent faire de mauvais choix. » Vendre fin mars a figé la perte ; la reprise est venue
            sans prévenir. Renforcer n’a de sens qu’avec de l’argent dont tu n’auras pas besoin, épargne de précaution mise à
            part. Le passé ne garantit pas que la prochaine reprise sera aussi rapide.
          </p>
          <p className="note-source">Simplification : vente sans impôt ni frais ; l’argent vendu reste sur un compte.</p>
        </Debrief>
      ) : null}
    </>
  )
}

export function CasFrais() {
  const [rendement, setRendement] = useState(5)
  const [choix, setChoix] = useState<'fonds' | 'etf' | null>(null)
  const [vu, setVu] = useState(false)
  const mensuel = 200
  const fonds = useMemo(() => capitalAvecFrais({ mensuel, annees: 30, rendement: rendement / 100, frais: 0.02 }), [rendement])
  const etf = useMemo(() => capitalAvecFrais({ mensuel, annees: 30, rendement: rendement / 100, frais: 0.002 }), [rendement])
  const x = useMemo(() => fonds.map((_, i) => i * 12), [fonds])
  const libelleX = useCallback((m: number) => `${Math.round(m / 12)} ans`, [])
  const finFonds = fonds.at(-1) ?? 0
  const finEtf = etf.at(-1) ?? 0
  return (
    <>
      <MiseEnSituation titre="200 € par mois pendant 30 ans">
        <p className="carte__texte">
          Ton banquier te propose un fonds actions monde géré, à 2 % de frais par an. Un ETF qui suit le même genre d’indice
          coûte 0,2 % par an. Même rendement avant frais, fictif ci-dessous.
        </p>
        <div className="calculateur">
          <Curseur libelle="Rendement fictif avant frais" valeur={rendement} min={0} max={8} pas={0.5} format={(v) => formatPourcentage(v / 100)} onChange={setRendement} />
        </div>
        <div className="choix-liste" role="radiogroup" aria-label="Ton choix">
          <Choix choisi={choix === 'fonds'} onChoisir={() => { setChoix('fonds') }} titre="Le fonds géré à 2 %" />
          <Choix choisi={choix === 'etf'} onChoisir={() => { setChoix('etf') }} titre="L’ETF à 0,2 %" />
        </div>
        {vu ? null : <BoutonDebrief id="frais" desactive={choix === null} onVoir={() => { setVu(true) }} />}
      </MiseEnSituation>
      {vu ? (
        <Debrief titre="Ce que coûtent 1,8 point de frais" modules={[5]} sources={[SOURCES.frais]}>
          <ul className="liste-resultats chiffres">
            <li className={choix === 'etf' ? 'liste-resultats__choisi' : ''}>
              <span>ETF à 0,2 %</span>
              <strong>{euros(finEtf)}</strong>
            </li>
            <li className={choix === 'fonds' ? 'liste-resultats__choisi' : ''}>
              <span>Fonds à 2 %</span>
              <strong>{euros(finFonds)}</strong>
            </li>
          </ul>
          <Graphique
            x={x}
            series={[
              { valeurs: etf, libelle: 'ETF à 0,2 %' },
              { valeurs: fonds, libelle: 'Fonds à 2 %', couleur: '--or' },
            ]}
            libelleX={libelleX}
            increments={[60, 120]}
            resume={`Après 30 ans : ${euros(finEtf)} avec l’ETF, ${euros(finFonds)} avec le fonds.`}
          />
          <p className="carte__texte chiffres">
            Pour {euros(mensuel * 12 * 30)} versés, l’écart atteint {euros(finEtf - finFonds)} :{' '}
            {formatPourcentage((finEtf - finFonds) / Math.max(1, finEtf), { decimales: 0 })} du capital de l’ETF. Les frais
            se composent année après année, comme les intérêts. Pour l’AMF, leur impact sur le rendement « n’est pas
            négligeable ».
          </p>
        </Debrief>
      ) : null}
    </>
  )
}
