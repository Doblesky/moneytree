/**
 * Une carrière en cours (maquette 9) : année et âge, score, patrimoine net réel, taux
 * d'épargne, objectifs, jauge de sang-froid, puis l'événement de l'année et ses choix.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEtatProgression } from '../../app/donnees.ts'
import type { Levier } from '../../content/catalogue.ts'
import { parametres2026 } from '../../data/params/index.ts'
import {
  ageActuel,
  apresOperationImmobiliere,
  avancerAnnee,
  choisir,
  estCarriereTerminee,
  objectifs,
  score,
  tauxEpargne,
  type ChoixCarriere,
  type EtatCarriere,
} from '../../engine/carriere.ts'
import { bilan, dateDuMois, periodeRejouee, type EtatPartie } from '../../engine/simulation.ts'
import { formatMontant, formatPourcentage } from '../../lib/format.ts'
import { levierDebloque } from '../../progression/regles.ts'
import { enregistrerCarriere } from '../../storage/carriere.ts'
import { Terme } from '../../ui/glossaire.tsx'
import { Graphique } from '../../ui/Graphique.tsx'
import { Icone } from '../../ui/Icone.tsx'
import { Rosace } from '../../ui/Rosace.tsx'
import { ANNEES_ENTIERES, MOIS } from '../simulateur/constantes.ts'
import { Journal } from '../simulateur/Journal.tsx'
import { Immobilier } from '../simulateur/Immobilier.tsx'
import { Leviers } from '../simulateur/Leviers.tsx'
import { LienCasEcole } from '../cas/EcranCas.tsx'
import { Variation } from '../simulateur/LigneLevier.tsx'

const LETTRES: Record<ChoixCarriere['id'], string> = { a: 'A', b: 'B', c: 'C' }

function Jauge({ valeur }: { valeur: number }) {
  return (
    <div className="jauge">
      <div className="jauge__ligne">
        <span className="jauge__titre">
          <Icone nom="bouclier" taille={18} />
          Jauge de sang-froid
        </span>
        <span className="chiffres">{Math.round(valeur)} / 100</span>
      </div>
      <div
        className="jauge__barre"
        role="meter"
        aria-label="Sang-froid"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(valeur)}
      >
        <span className="jauge__remplissage" style={{ width: `${Math.max(0, Math.min(100, valeur))}%` }} />
      </div>
      <span className="texte-secondaire">Elle baisse si tu vends dans la panique.</span>
    </div>
  )
}

export function PartieCarriere({
  id,
  nom,
  initiale,
  onNouvelle,
}: {
  id: number
  nom: string
  initiale: EtatCarriere
  onNouvelle: () => void
}) {
  const p = parametres2026()
  const progression = useEtatProgression()
  const [c, setC] = useState<EtatCarriere>(initiale)
  const [message, setMessage] = useState<string | null>(null)

  const appliquer = useCallback(
    (suivant: EtatCarriere) => {
      setC(suivant)
      void enregistrerCarriere(id, suivant)
    },
    [id],
  )

  useEffect(() => {
    document.title = `${nom} · MoneyTree`
  }, [nom])

  const partie = c.partie
  const b = bilan(partie, p)
  const s = score(c, p)
  const objs = objectifs(c, p)
  const atteints = objs.filter((o) => o.atteint).length
  const date = dateDuMois(partie, Math.max(0, partie.mois))
  const terminee = estCarriereTerminee(c)
  const debloque = (l: Levier) => (progression ? levierDebloque(progression, l) : false)
  const depart = partie.historique[0]?.netReel ?? 0
  const derniers = c.bilans.slice(-2)
  const variation =
    derniers.length === 0 ? 0 : (derniers.at(-1)?.netReel ?? 0) - (derniers.length === 2 ? (derniers[0]?.netReel ?? 0) : depart)

  const x = useMemo(() => [0, ...c.bilans.map((bl) => bl.annee * 12)], [c.bilans])
  const series = useMemo(
    () => [{ valeurs: [depart, ...c.bilans.map((bl) => bl.netReel)], libelle: 'Patrimoine net réel', aire: true }],
    [c.bilans, depart],
  )
  const libelleX = useCallback((mois: number) => String(dateDuMois(partie, Math.round(mois)).annee), [partie])

  const changerLeviers = (suivante: EtatPartie) => {
    // Le joueur reprend la main : une pause des versements en cours s'arrête.
    appliquer({ ...c, partie: suivante, versementsSuspendus: null, repriseVersementsAuMois: null })
  }

  return (
    <>
      <header className="entete sur-vert entete--simulateur">
        <Rosace taille={220} className="entete__rosace" />
        <div className="entete__contenu">
          <div className="entete__barre">
            <div className="entete__titres">
              <span className="surtitre surtitre--or">Mode carrière · {nom}</span>
              <h1 className="entete__titre chiffres">
                {terminee ? 'Fin de carrière' : `Année ${date.annee}`} · {ageActuel(c)} ans
              </h1>
            </div>
            <div className="score-entete chiffres">
              <span className="score-entete__libelle">Score</span>
              <span className="score-entete__valeur">{s.total}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="ecran apparition simulateur">
        <section className="carte carriere-stats" aria-labelledby="ta-partie">
          <div className="carriere-stats__entete">
            <h2 id="ta-partie" className="carte__surtitre">
              Ta partie
            </h2>
            <span className="etiquette etiquette--constants">€ constants</span>
          </div>
          <div className="stat">
            <span className="stat__libelle">
              <Terme cle="patrimoine-net-reel">Patrimoine net réel</Terme>
            </span>
            <span className="stat__valeur chiffres">{formatMontant(b.netReel)}</span>
            <Variation valeur={variation} suffixe="sur l’année" />
          </div>
          <div className="stat">
            <span className="stat__libelle">Taux d’épargne</span>
            <span className="stat__valeur chiffres">{formatPourcentage(tauxEpargne(partie), { decimales: 0 })}</span>
            <span className="stat__detail">du net</span>
          </div>
          <div className="stat">
            <span className="stat__libelle">Objectifs</span>
            <span className="stat__valeur chiffres">{atteints} sur 3</span>
            <span className="stat__detail">atteint{atteints > 1 ? 's' : ''}</span>
          </div>
          <Jauge valeur={c.sangFroid} />
        </section>

        {c.evenement ? (
          <>
            <section className="carte carte--importante sur-vert" aria-labelledby="evenement">
              <span className="surtitre surtitre--or">
                {c.evenement.type === 'krach' ? 'Événement en cours d’année' : 'Événement de l’année'}
              </span>
              <h2 id="evenement" className="carte__titre">
                {c.evenement.titre}
              </h2>
              <p className="carte__texte chiffres">{c.evenement.texte}</p>
            </section>
            <div className="reponses" role="group" aria-label="Tes choix">
              {c.evenement.choix.map((choix) => (
                <button
                  key={choix.id}
                  type="button"
                  className="reponse"
                  onClick={() => {
                    appliquer(choisir(c, choix.id, p))
                  }}
                >
                  <span className="reponse__lettre">{LETTRES[choix.id]}</span>
                  <span className="choix__texte">
                    <span className="reponse__texte">{choix.titre}</span>
                    <span className="texte-secondaire chiffres">{choix.detail}</span>
                  </span>
                  <Icone nom="suivant" taille={20} epaisseur={2} />
                </button>
              ))}
            </div>
          </>
        ) : terminee ? (
          <section className="carte carte--importante sur-vert" aria-labelledby="fin-carriere">
            <span className="surtitre surtitre--or">Vingt ans déjà</span>
            <h2 id="fin-carriere" className="carte__titre chiffres">
              Score final : {s.total} / 1 000
            </h2>
            <p className="carte__texte chiffres">
              Patrimoine {s.patrimoine} / 400 · épargne {s.epargne} / 200 · objectifs {s.objectifs} / 300 · sang-froid{' '}
              {s.sangFroid} / 100.
            </p>
            <p className="carte__texte">Tu as traversé {periodeRejouee(partie)}.</p>
            <button type="button" className="bouton bouton--sur-vert" onClick={onNouvelle}>
              Nouvelle carrière
            </button>
          </section>
        ) : (
          <section className="carte" aria-labelledby="annee-suivante">
            {c.resultat ? (
              <>
                <span className="surtitre">Ton choix</span>
                <h2 id="annee-suivante" className="carte__titre">
                  {c.resultat.titre}
                </h2>
                <p className="carte__texte chiffres">{c.resultat.texte}</p>
              </>
            ) : (
              <h2 id="annee-suivante" className="carte__titre">
                Une année calme
              </h2>
            )}
            <button
              type="button"
              className="bouton bouton--plein"
              onClick={() => {
                appliquer(avancerAnnee(c, p))
              }}
            >
              Avancer d’un an
            </button>
          </section>
        )}

        <section className="carte" aria-labelledby="objectifs">
          <h2 id="objectifs" className="carte__surtitre">
            Tes objectifs
          </h2>
          <ul className="liste-conditions">
            {objs.map((o) => (
              <li key={o.cle} className={o.atteint ? 'fait' : ''}>
                <Icone nom={o.atteint ? 'coche' : 'cadenas'} taille={16} />
                <span>
                  <strong>{o.titre}</strong> · <span className="chiffres">{o.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {c.bilans.length > 0 ? (
          <section className="carte" aria-labelledby="trajectoire">
            <h2 id="trajectoire" className="carte__surtitre">
              Ta trajectoire
            </h2>
            <Graphique
              x={x}
              series={series}
              libelleX={libelleX}
              increments={ANNEES_ENTIERES}
              resume={`Patrimoine net réel en fin d’année : ${formatMontant(b.netReel)} après ${c.bilans.length} an${c.bilans.length > 1 ? 's' : ''}.`}
            />
          </section>
        ) : null}

        {c.versementsSuspendus && c.repriseVersementsAuMois !== null ? (
          <p className="message" role="status">
            Tes versements sont en pause jusqu’en {MOIS[dateDuMois(partie, c.repriseVersementsAuMois).mois]}{' '}
            {dateDuMois(partie, c.repriseVersementsAuMois).annee}. Modifier un levier les relance tout de suite.
          </p>
        ) : null}
        {terminee ? null : (
          <Leviers etat={partie} debloque={debloque} onChange={changerLeviers} salaireModifiable={false} />
        )}

        {message ? (
          <p className="message message--succes" role="status">
            {message}
          </p>
        ) : null}
        {!terminee && debloque('immobilier') ? (
          <Immobilier
            etat={partie}
            loyerActuel={c.loyer}
            onChange={(suivante) => {
              appliquer(apresOperationImmobiliere(c, suivante, p))
            }}
            onMessage={setMessage}
          />
        ) : null}

        {c.choix.length > 0 ? (
          <section className="carte" aria-labelledby="tes-choix">
            <h2 id="tes-choix" className="carte__surtitre">
              Tes choix
            </h2>
            <ol className="journal">
              {[...c.choix].reverse().map((ch, i) => (
                <li key={`${ch.annee}-${ch.type}-${i}`} className="journal__evenement">
                  <span className="journal__date chiffres">Année {ch.annee}</span>
                  <span className="journal__titre">{ch.titre}</span>
                  <span className="texte-secondaire">{ch.choix}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <Journal etat={partie} />

        <LienCasEcole />

        <p className="note-source">
          Les montants des événements (offres, primes, pannes, dépenses d’un enfant, durée d’une recherche d’emploi) sont des
          chiffres du jeu. Le salaire net, l’impôt, l’allocation chômage et les loyers médians suivent les règles et les
          données officielles.
        </p>
        {terminee ? null : (
          <button type="button" className="bouton bouton--contour" onClick={onNouvelle}>
            Nouvelle carrière
          </button>
        )}
      </main>
    </>
  )
}
