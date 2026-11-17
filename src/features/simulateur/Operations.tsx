import { useState } from 'react'
import type { Levier } from '../../content/catalogue.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { ageDuPeaEnMois, disponiblePee, valeurAssuranceVie, valeurTitres } from '../../engine/enveloppes.ts'
import {
  racheterDeLAssuranceVie,
  retirerDuLivret,
  retirerDuPea,
  retirerDuPee,
  vendreCto,
  type EtatPartie,
} from '../../engine/simulation.ts'
import { lireMontant } from './constantes.ts'

/** Vendre, retirer, racheter : chaque décision a ses règles et sa fiscalité. */
export function Operations({
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
  const somme = lireMontant(montant)
  const valide = Number.isFinite(somme) && somme > 0
  const valeurCto = valeurTitres(etat.cto, etat.prixPart)
  const valeurPea = valeurTitres(etat.pea.titres, etat.prixPart)
  const peaJeune = ageDuPeaEnMois(etat.pea, etat.mois) < p['pea.dureeExonerationImpotRevenu'].valeur * 12
  const valeurAv = valeurAssuranceVie(etat.assuranceVie, etat.prixPart)
  const peeDisponible = disponiblePee(etat.pee, etat.prixPart, etat.mois)

  return (
    <details className="carte operations">
      <summary className="carte__surtitre">Opérations ponctuelles</summary>
      <p className="texte-secondaire">Vendre, retirer, racheter : chaque décision a ses règles et sa fiscalité.</p>
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
        {debloque('assuranceVie') && valeurAv > 0 ? (
          <button
            type="button"
            className="bouton bouton--contour"
            disabled={!valide}
            onClick={() => {
              onChange(racheterDeLAssuranceVie(etat, somme, p))
            }}
          >
            Racheter sur l’assurance-vie
          </button>
        ) : null}
        {debloque('epargneSalariale') && peeDisponible > 0 ? (
          <button
            type="button"
            className="bouton bouton--contour"
            disabled={!valide}
            onClick={() => {
              onChange(retirerDuPee(etat, somme, p))
            }}
          >
            Retirer du PEE (sommes débloquées)
          </button>
        ) : null}
      </div>
    </details>
  )
}
