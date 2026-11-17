import type { ReactNode } from 'react'
import { parametres2026 } from '../../data/params/index.ts'
import { ageDuPeaEnMois, disponiblePee, valeurTitres } from '../../engine/enveloppes.ts'
import { bilan, tauxPrelevementActuel, type EtatPartie } from '../../engine/simulation.ts'
import { formatMontant, formatPourcentage } from '../../lib/format.ts'
import { Terme } from '../../ui/glossaire.tsx'

function Ligne({ nom, montant, detail }: { nom: ReactNode; montant: number; detail?: string | undefined }) {
  return (
    <>
      <span>
        {nom}
        {detail ? <span className="texte-secondaire"> · {detail}</span> : null}
      </span>
      <span className="chiffres">{formatMontant(montant)}</span>
    </>
  )
}

/** Tes comptes, en euros courants. */
export function Comptes({ etat }: { etat: EtatPartie }) {
  const p = parametres2026()
  const b = bilan(etat, p)
  const gainCto = valeurTitres(etat.cto, etat.prixPart) - etat.cto.prixDeRevient
  const ans = (mois: number) => `${Math.floor(mois / 12)} an${mois >= 24 ? 's' : ''}`
  const av = etat.assuranceVie
  return (
    <section className="carte" aria-labelledby="tes-comptes">
      <h2 id="tes-comptes" className="carte__surtitre">
        Tes comptes <span className="texte-secondaire">(€ courants)</span>
      </h2>
      <div className="tableau-comptes">
        <Ligne nom="Compte courant" montant={b.courant} />
        <Ligne
          nom={<Terme cle="livret-a">Livret A</Terme>}
          montant={etat.livretA.solde}
          detail={etat.livretA.interetsCourus > 0.5 ? `+${formatMontant(etat.livretA.interetsCourus)} au 31/12` : undefined}
        />
        {etat.ldds.solde > 0 ? <Ligne nom="LDDS" montant={etat.ldds.solde} /> : null}
        {etat.lep.solde > 0 ? <Ligne nom="LEP" montant={etat.lep.solde} /> : null}
        <Ligne
          nom={<Terme cle="cto">Compte-titres</Terme>}
          montant={b.cto}
          detail={b.cto > 0 ? `${gainCto >= 0 ? 'plus' : 'moins'}-value ${formatMontant(Math.abs(gainCto))}` : undefined}
        />
        {etat.pea.ouvertAuMois !== null ? (
          <Ligne
            nom={<Terme cle="pea">PEA</Terme>}
            montant={b.pea}
            detail={etat.pea.cloture ? 'clôturé' : `ouvert depuis ${ans(ageDuPeaEnMois(etat.pea, etat.mois))}`}
          />
        ) : null}
        {av.ouvertAuMois !== null ? (
          <Ligne
            nom={<Terme cle="assurance-vie">Assurance-vie</Terme>}
            montant={b.assuranceVie}
            detail={`dont fonds en euros ${formatMontant(av.fondsEuros.solde)} · ouverte depuis ${ans(etat.mois - av.ouvertAuMois)}`}
          />
        ) : null}
        {b.per > 0 ? (
          <Ligne
            nom={<Terme cle="per">PER</Terme>}
            montant={b.per}
            detail={`bloqué jusqu’à la retraite · ${formatMontant(etat.per.versementsDeduits)} déduits`}
          />
        ) : null}
        {b.pee > 0 ? (
          <Ligne
            nom={<Terme cle="pee">PEE</Terme>}
            montant={b.pee}
            detail={`disponible : ${formatMontant(disponiblePee(etat.pee, etat.prixPart, etat.mois))}`}
          />
        ) : null}
        <span className="tableau-comptes__total">Total brut</span>
        <span className="tableau-comptes__total chiffres">{formatMontant(b.brut)}</span>
      </div>
    </section>
  )
}

/** Ton impôt et tes frais, depuis le début de la partie. */
export function Impots({ etat }: { etat: EtatPartie }) {
  const p = parametres2026()
  const taux = tauxPrelevementActuel(etat, p)
  const c = etat.cumuls
  return (
    <section className="carte" aria-labelledby="tes-impots">
      <h2 id="tes-impots" className="carte__surtitre">
        Ton impôt et tes frais
      </h2>
      <div className="tableau-comptes">
        <span>
          <Terme cle={taux.personnalise ? 'taux-de-prelevement' : 'taux-par-defaut'}>
            {taux.personnalise ? 'Taux personnalisé' : 'Taux par défaut'}
          </Terme>
        </span>
        <span className="chiffres">{formatPourcentage(taux.taux, { decimales: 1 })}</span>
        <Ligne nom="Prélevé à la source depuis le début" montant={c.prelevementsSource} />
        <Ligne nom="Impôt sur le revenu régularisé" montant={c.impotRevenu} />
        <Ligne nom={<Terme cle="prelevements-sociaux">Prélèvements sociaux</Terme>} montant={c.prelevementsSociaux} />
        {c.csgCrdsEpargneSalariale > 0 ? (
          <Ligne nom="CSG et CRDS sur l’épargne salariale" montant={c.csgCrdsEpargneSalariale} />
        ) : null}
        <Ligne nom={`Frais des ETF (${formatPourcentage(etat.fraisAnnuelsEtf)} par an, fictif)`} montant={c.fraisEtf} />
        {c.fraisUc > 0 ? <Ligne nom="Frais du contrat d’assurance-vie" montant={c.fraisUc} /> : null}
        <Ligne nom="Intérêts des livrets reçus" montant={c.interets} />
        {c.interetsFondsEuros > 0 ? <Ligne nom="Intérêts du fonds en euros (nets)" montant={c.interetsFondsEuros} /> : null}
        {c.abondement > 0 ? <Ligne nom="Abondement de l’employeur reçu" montant={c.abondement} /> : null}
        {c.interessement > 0 ? <Ligne nom="Intéressement et participation reçus" montant={c.interessement} /> : null}
      </div>
      {etat.fiscal.aDeclarer ? (
        <p className="note-source">Tes revenus de {etat.fiscal.aDeclarer.annee} seront régularisés en septembre.</p>
      ) : null}
    </section>
  )
}
