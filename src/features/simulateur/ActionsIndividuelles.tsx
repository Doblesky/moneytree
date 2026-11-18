/**
 * Actions individuelles (débloquées par le palier Expert du module 3) : huit sociétés
 * fictives, leurs comptes simplifiés, et des lignes achetées sur le compte-titres. Le
 * modèle est celui du module 5 : seul le risque de marché est rémunéré en moyenne, le risque
 * propre à chaque société (jusqu'à la faillite) ne l'est pas.
 */
import { useState } from 'react'
import { ratios, SOCIETES, societe, valeurLigne, type IdSociete } from '../../engine/actions.ts'
import { acheterTitreVif, vendreTitreVif, type EtatPartie } from '../../engine/simulation.ts'
import { formatMontant, formatNombre, formatPourcentage } from '../../lib/format.ts'
import { Terme } from '../../ui/glossaire.tsx'
import { Curseur } from '../cours/Calculateurs.tsx'

const euros = (v: number) => formatMontant(v)
const millions = (v: number) => `${formatNombre(Math.round(v))} M€`
const cours = (v: number) => formatMontant(v, { decimales: 2 })

function Lignes({ etat, onVendre }: { etat: EtatPartie; onVendre: (id: IdSociete) => void }) {
  if (etat.titresVifs.length === 0) return null
  return (
    <ul className="liste-resultats chiffres">
      {etat.titresVifs.map((l) => {
        const valeur = valeurLigne(l, etat.actions)
        const gain = valeur - l.prixDeRevient
        return (
          <li key={l.societe}>
            <span>
              {societe(l.societe).nom}
              <small className="calculateur__detail">
                {l.quantite} actions · {gain >= 0 ? '+' : '−'}
                {euros(Math.abs(gain))} ({formatPourcentage(l.prixDeRevient > 0 ? gain / l.prixDeRevient : 0, { decimales: 1, signe: true })})
                {etat.actions.faillites.includes(l.societe) ? ' · en faillite' : ''}
              </small>
              <button
                type="button"
                className="lien-tertiaire"
                onClick={() => {
                  onVendre(l.societe)
                }}
              >
                Tout vendre
              </button>
            </span>
            <strong>{euros(valeur)}</strong>
          </li>
        )
      })}
    </ul>
  )
}

export function ActionsIndividuelles({
  etat,
  onChange,
  onMessage,
}: {
  etat: EtatPartie
  onChange: (etat: EtatPartie) => void
  onMessage: (m: string) => void
}) {
  const [choisie, setChoisie] = useState<IdSociete | null>(null)
  const [montant, setMontant] = useState(1000)
  const max = Math.max(100, Math.floor(Math.max(0, etat.courant) / 100) * 100)

  return (
    <section className="carte" aria-labelledby="actions-individuelles">
      <h2 id="actions-individuelles" className="carte__surtitre">
        Actions individuelles
      </h2>
      <p className="texte-secondaire">
        Huit sociétés fictives et leurs comptes simplifiés. Choisis d’après le <Terme cle="per-boursier">PER</Terme>, la
        dette et le <Terme cle="beta">bêta</Terme>, puis compare avec ton ETF.
      </p>
      <Lignes
        etat={etat}
        onVendre={(id) => {
          onChange(vendreTitreVif(etat, id))
          onMessage('Ligne vendue : la plus-value ou la moins-value sera déclarée l’an prochain.')
        }}
      />
      <ul className="liste-societes">
        {SOCIETES.map((x) => {
          const r = ratios(x, etat.actions)
          const ouverte = choisie === x.id
          return (
            <li key={x.id} className={`societe ${ouverte ? 'societe--ouverte' : ''}`}>
              <button
                type="button"
                className="societe__tete"
                aria-expanded={ouverte}
                onClick={() => {
                  setChoisie(ouverte ? null : x.id)
                }}
              >
                <span className="societe__nom">
                  {x.nom}
                  <small className="calculateur__detail">
                    {x.secteur} · {x.zone}
                    {x.eligiblePea ? ' · éligible au PEA' : ''}
                  </small>
                </span>
                <span className="societe__chiffres chiffres">
                  {r.enFaillite ? (
                    <strong className="texte-perte">Faillite</strong>
                  ) : (
                    <>
                      <strong>{cours(r.cours)}</strong>
                      <small className="calculateur__detail">
                        PER {r.per === null ? '—' : formatNombre(r.per, { decimales: 0 })} · dividende{' '}
                        {formatPourcentage(r.rendementDividende, { decimales: 1 })}
                      </small>
                    </>
                  )}
                </span>
              </button>
              {ouverte ? (
                <div className="societe__detail">
                  <p className="texte-secondaire">{x.description}</p>
                  <div className="calculateur__lignes chiffres">
                    <span>Chiffre d’affaires</span>
                    <span>{millions(r.chiffreAffaires)}</span>
                    <span>
                      <Terme cle="ebe">Excédent brut d’exploitation</Terme>
                    </span>
                    <span>{millions(r.ebe)}</span>
                    <span>Résultat net</span>
                    <span>{millions(r.resultatNet)}</span>
                    <span>
                      <Terme cle="capitaux-propres">Capitaux propres</Terme>
                    </span>
                    <span>{millions(r.capitauxPropres)}</span>
                    <span>Dette nette</span>
                    <span>
                      {millions(r.detteNette)} ({formatNombre(r.endettement, { decimales: 1 })} × les capitaux propres)
                    </span>
                    <span>
                      <Terme cle="bpa">Bénéfice par action</Terme>
                    </span>
                    <span>{cours(r.bpa)}</span>
                    <span>Capitalisation</span>
                    <span>{millions(r.capitalisation)}</span>
                    <span>
                      <Terme cle="beta">Bêta</Terme>
                    </span>
                    <span>{formatNombre(x.beta, { decimales: 1 })}</span>
                  </div>
                  {r.enFaillite ? null : (
                    <>
                      <Curseur libelle="Montant à investir" valeur={Math.min(montant, max)} min={100} max={max} pas={100} format={euros} onChange={setMontant} />
                      <button
                        type="button"
                        className="bouton bouton--plein"
                        onClick={() => {
                          const resultat = acheterTitreVif(etat, x.id, Math.min(montant, max))
                          if (resultat.refus) onMessage(resultat.refus)
                          else {
                            onChange(resultat.etat)
                            onMessage(`Actions ${x.nom} achetées sur ton compte-titres.`)
                          }
                        }}
                      >
                        Acheter {x.nom}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
      <p className="note-source">
        Sociétés et comptes fictifs, en millions d’euros. Hypothèses du jeu : le cours suit le marché selon le bêta, plus un
        aléa propre à chaque société ; les sociétés endettées peuvent faire faillite ; dividendes réinvestis dans le cours. Dans
        le simulateur, les actions s’achètent sur le compte-titres, sans frais de courtage.
      </p>
    </section>
  )
}
