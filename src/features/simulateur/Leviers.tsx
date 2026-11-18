/**
 * Les leviers de la partie. Un levier n'apparaît qu'une fois son module terminé (ou
 * débloqué quand même) : l'interface ne montre jamais un réglage dont tu n'as pas vu le principe.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { useProfil } from '../../app/donnees.ts'
import { METIERS, metierDe } from '../../profils/metiers.ts'
import { LEVIERS, type Levier } from '../../content/catalogue.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { brutVersNet } from '../../engine/salaire.ts'
import {
  eligibleLep,
  modifierEpargneSalariale,
  modifierPartie,
  modifierPartUniteDeCompte,
  modifierVersements,
  pointsDeCotisation,
  tauxFondsEurosActuel,
  tauxLivretActuel,
  type EtatPartie,
  type Versements,
} from '../../engine/simulation.ts'
import { formatMontant, formatPourcentage } from '../../lib/format.ts'
import { debloquerLevier } from '../../storage/apprentissage.ts'
import { Terme } from '../../ui/glossaire.tsx'
import { Icone } from '../../ui/Icone.tsx'
import { lireMontant } from './constantes.ts'
import { LigneLevier } from './LigneLevier.tsx'

interface Props {
  etat: EtatPartie
  debloque: (l: Levier) => boolean
  onChange: (etat: EtatPartie) => void
  /** En mode carrière, le salaire et les dépenses changent par les événements, pas à la main. */
  salaireModifiable?: boolean
}

export function Leviers({ etat, debloque, onChange, salaireModifiable = true }: Props) {
  const p = parametres2026()
  const profil = useProfil()
  const salaire = brutVersNet(etat.salaire.brutAnnuel, pointsDeCotisation(etat, p))
  const [edition, setEdition] = useState(false)
  const [brut, setBrut] = useState(String(Math.round(etat.salaire.brutAnnuel)))
  const [depenses, setDepenses] = useState(String(etat.depensesMensuelles))
  const versement = (cle: keyof Versements) => (v: number) => {
    onChange(modifierVersements(etat, { [cle]: v }))
  }
  const lep = eligibleLep(etat, p)
  const fondsEuros = tauxFondsEurosActuel(etat)
  const annee = etat.fiscal.anneeEnCours
  const plafondPer = annee.plafondPer > 0 ? annee.plafondPer : p['per.plafondDeductionMin'].valeur * etat.indicePrix
  // Un levier sans objet pour le profil (l'épargne salariale d'un fonctionnaire) n'apparaît pas.
  const absents = METIERS[metierDe(profil)].leviersAbsents
  const verrouilles = (Object.keys(LEVIERS) as Levier[]).filter(
    (l) => !debloque(l) && l !== 'monteCarlo' && l !== 'scenarios' && !absents.includes(l),
  )

  return (
    <section className="carte leviers" aria-labelledby="tes-leviers">
      <div className="carte__etiquettes">
        <h2 id="tes-leviers" className="carte__surtitre">
          Tes leviers
        </h2>
        <span className="texte-secondaire">Versements mensuels</span>
      </div>

      <div className="levier">
        <span className="levier__icone">
          <Icone nom="salaire" taille={20} />
        </span>
        <div className="levier__texte">
          <span className="levier__titre">{etat.emploi.enPoste ? 'Salaire net' : 'En recherche d’emploi'}</span>
          <span className="texte-secondaire chiffres">
            {etat.emploi.enPoste
              ? `${formatMontant(salaire.netAvantImpot / 12)} / mois avant impôt · ${formatMontant(etat.salaire.brutAnnuel)} brut par an`
              : `Reprise prévue dans ${etat.emploi.moisRechercheRestants} mois${etat.emploi.droitsAre ? ', allocation chômage en attendant' : ', sans allocation'}`}
          </span>
        </div>
        {salaireModifiable ? (
          <button
            type="button"
            className="bouton-icone bouton-icone--clair"
            aria-label="Modifier le salaire et les dépenses"
            aria-expanded={edition}
            onClick={() => {
              setEdition(!edition)
            }}
          >
            <Icone nom="crayon" taille={18} />
          </button>
        ) : null}
      </div>
      {edition && salaireModifiable ? (
        <form
          className="edition-salaire"
          onSubmit={(e) => {
            e.preventDefault()
            const nouveauBrut = lireMontant(brut)
            const nouvellesDepenses = lireMontant(depenses)
            if (nouveauBrut >= 5000 && nouvellesDepenses >= 0) {
              onChange(modifierPartie(etat, { brutAnnuel: nouveauBrut, depensesMensuelles: nouvellesDepenses }))
              setEdition(false)
            }
          }}
        >
          <label>
            Brut annuel (€)
            <input
              className="champ__saisie champ__saisie--petit chiffres"
              inputMode="decimal"
              value={brut}
              onChange={(e) => {
                setBrut(e.target.value)
              }}
            />
          </label>
          <label>
            Dépenses par mois (€ du départ)
            <input
              className="champ__saisie champ__saisie--petit chiffres"
              inputMode="decimal"
              value={depenses}
              onChange={(e) => {
                setDepenses(e.target.value)
              }}
            />
          </label>
          <button type="submit" className="bouton bouton--contour">
            Appliquer
          </button>
        </form>
      ) : (
        <p className="texte-secondaire levier__note chiffres">
          Dépenses courantes : {formatMontant(etat.depensesMensuelles * etat.indicePrix)} / mois (indexées sur l’inflation)
        </p>
      )}

      <LigneLevier
        icone="bouclier"
        titre={<Terme cle="livret-a">Livret A</Terme>}
        libelle="Livret A"
        sousTitre={`${formatMontant(etat.versements.livretA)} / mois · taux ${formatPourcentage(tauxLivretActuel(etat, 'livretA'))}`}
        valeur={etat.versements.livretA}
        max={1000}
        pas={10}
        onChange={versement('livretA')}
      />
      <LigneLevier
        icone="courbe"
        titre={<Terme cle="etf">ETF monde</Terme>}
        libelle="ETF monde sur un compte-titres"
        sousTitre={`${formatMontant(etat.versements.cto)} / mois sur un compte-titres`}
        valeur={etat.versements.cto}
        max={2000}
        pas={10}
        onChange={versement('cto')}
      />
      {debloque('ldds') ? (
        <LigneLevier
          icone="pousse"
          titre={<Terme cle="ldds">LDDS</Terme>}
          libelle="LDDS"
          sousTitre={`${formatMontant(etat.versements.ldds)} / mois · taux ${formatPourcentage(tauxLivretActuel(etat, 'ldds'))}`}
          valeur={etat.versements.ldds}
          max={1000}
          pas={10}
          onChange={versement('ldds')}
        />
      ) : null}
      {debloque('lep') ? (
        <LigneLevier
          icone="bouclier"
          titre={<Terme cle="lep">LEP</Terme>}
          libelle="LEP"
          sousTitre={
            lep
              ? `${formatMontant(etat.versements.lep)} / mois · taux ${formatPourcentage(tauxLivretActuel(etat, 'lep'))}`
              : 'Tes revenus dépassent le plafond : pas de nouveaux versements'
          }
          valeur={etat.versements.lep}
          max={500}
          pas={10}
          desactive={!lep}
          onChange={versement('lep')}
        />
      ) : null}
      {debloque('pea') ? (
        <LigneLevier
          icone="courbe"
          titre={<Terme cle="pea">PEA · ETF monde</Terme>}
          libelle="PEA"
          sousTitre={
            etat.pea.cloture
              ? 'Plan clôturé'
              : `${formatMontant(etat.versements.pea)} / mois${etat.pea.ouvertAuMois === null ? ' · s’ouvre au premier versement' : ''}`
          }
          valeur={etat.versements.pea}
          max={2000}
          pas={10}
          desactive={etat.pea.cloture}
          onChange={versement('pea')}
        />
      ) : null}
      {debloque('assuranceVie') ? (
        <>
          <LigneLevier
            icone="bouclier"
            titre={<Terme cle="assurance-vie">Assurance-vie</Terme>}
            libelle="Assurance-vie"
            sousTitre={`${formatMontant(etat.versements.assuranceVie)} / mois · fonds en euros ${formatPourcentage(fondsEuros.taux)}${fondsEuros.estime ? ' (estimé)' : ''}`}
            valeur={etat.versements.assuranceVie}
            max={2000}
            pas={10}
            onChange={versement('assuranceVie')}
          />
          <LigneLevier
            icone="courbe"
            titre={<Terme cle="unites-de-compte">Part en unités de compte</Terme>}
            libelle="Part de l’assurance-vie en unités de compte"
            sousTitre={`${formatPourcentage(etat.partUniteDeCompte, { decimales: 0 })} en ETF monde, le reste en fonds en euros · frais ${formatPourcentage(etat.fraisAnnuelsUc)} par an (hypothèse)`}
            valeur={Math.round(etat.partUniteDeCompte * 100)}
            max={100}
            pas={10}
            onChange={(v) => {
              onChange(modifierPartUniteDeCompte(etat, v / 100))
            }}
          />
        </>
      ) : null}
      {debloque('per') ? (
        <LigneLevier
          icone="calendrier"
          titre={<Terme cle="per">PER</Terme>}
          libelle="PER"
          sousTitre={`${formatMontant(etat.versements.per)} / mois · déduit cette année : ${formatMontant(annee.versementsPerDeduits)} sur ${formatMontant(plafondPer)}`}
          valeur={etat.versements.per}
          max={2000}
          pas={10}
          onChange={versement('per')}
        />
      ) : null}
      {debloque('epargneSalariale') ? <EpargneSalariale etat={etat} onChange={onChange} /> : null}
      {debloque('optionBareme') ? (
        <label className="levier levier--interrupteur">
          <span className="levier__icone">
            <Icone nom="info" taille={20} />
          </span>
          <span className="levier__texte">
            <span className="levier__titre">Option pour le barème</span>
            <span className="texte-secondaire">
              {etat.optionBareme ? 'Plus-values au barème progressif' : 'Plus-values au PFU (par défaut)'}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="interrupteur"
            checked={etat.optionBareme}
            onChange={(e) => {
              onChange(modifierPartie(etat, { optionBareme: e.target.checked }))
            }}
          />
        </label>
      ) : null}

      {verrouilles.length > 0 ? (
        <div className="leviers__verrouilles">
          <span className="texte-secondaire">À débloquer avec les modules</span>
          <div className="puces">
            {verrouilles.map((l) => (
              <button
                key={l}
                type="button"
                className="etiquette etiquette--verrou"
                title={LEVIERS[l].description}
                onClick={() => {
                  if (
                    LEVIERS[l].disponible &&
                    window.confirm(
                      (LEVIERS[l].palier ?? 1) > 1
                        ? `Débloquer « ${LEVIERS[l].nom} » sans avoir maîtrisé le palier ${String(LEVIERS[l].palier)} du module ${String(LEVIERS[l].module)} ?`
                        : `Débloquer « ${LEVIERS[l].nom} » sans avoir terminé le module ${String(LEVIERS[l].module)} ?`,
                    )
                  ) {
                    void debloquerLevier(l)
                  }
                }}
              >
                <Icone nom="cadenas" taille={12} /> {LEVIERS[l].nom} · M{LEVIERS[l].module}
                {(LEVIERS[l].palier ?? 1) > 1 ? ` palier ${String(LEVIERS[l].palier)}` : ''}
                {LEVIERS[l].disponible ? '' : ' (phase suivante)'}
              </button>
            ))}
          </div>
          <Link to="/parcours" className="lien-debloquer">
            Voir les modules
          </Link>
        </div>
      ) : null}
    </section>
  )
}

function EpargneSalariale({ etat, onChange }: { etat: EtatPartie; onChange: (etat: EtatPartie) => void }) {
  const p = parametres2026()
  const es = etat.epargneSalariale
  const plafondLegal = p['epargneSalariale.abondementPeeMax'].valeur
  return (
    <div className="epargne-salariale">
      <LigneLevier
        icone="carriere"
        titre={<Terme cle="pee">PEE</Terme>}
        libelle="PEE, versement volontaire"
        sousTitre={`${formatMontant(etat.versements.pee)} / mois de versement volontaire, bloqué 5 ans`}
        valeur={etat.versements.pee}
        max={1000}
        pas={10}
        onChange={(v) => {
          onChange(modifierVersements(etat, { pee: v }))
        }}
      />
      <p className="texte-secondaire epargne-salariale__titre">
        Règles de ton entreprise <span className="etiquette etiquette--fictif">Hypothèses</span>
      </p>
      <LigneLevier
        icone="pousse"
        titre={<Terme cle="abondement">Abondement</Terme>}
        libelle="Taux d’abondement de l’employeur"
        sousTitre={`${formatPourcentage(es.abondementTaux, { decimales: 0 })} de tes versements, jusqu’à ${formatMontant(es.abondementPlafond)} par an`}
        valeur={Math.round(es.abondementTaux * 100)}
        max={300}
        pas={25}
        onChange={(v) => {
          onChange(modifierEpargneSalariale(etat, { abondementTaux: v / 100 }))
        }}
      />
      <LigneLevier
        icone="pousse"
        titre="Plafond d’abondement"
        sousTitre={`${formatMontant(es.abondementPlafond)} par an (maximum légal : ${formatMontant(plafondLegal)})`}
        valeur={es.abondementPlafond}
        max={Math.floor(plafondLegal)}
        pas={100}
        onChange={(v) => {
          onChange(modifierEpargneSalariale(etat, { abondementPlafond: v }))
        }}
      />
      <LigneLevier
        icone="medaille"
        titre={<Terme cle="interessement">Intéressement et participation</Terme>}
        libelle="Intéressement et participation annuels"
        sousTitre={`${formatMontant(es.interessementAnnuel)} brut par an, versés en juin`}
        valeur={es.interessementAnnuel}
        max={10000}
        pas={250}
        onChange={(v) => {
          onChange(modifierEpargneSalariale(etat, { interessementAnnuel: v }))
        }}
      />
      <label className="levier levier--interrupteur">
        <span className="levier__icone">
          <Icone nom="cadenas" taille={20} />
        </span>
        <span className="levier__texte">
          <span className="levier__titre">Placer l’intéressement sur le PEE</span>
          <span className="texte-secondaire">
            {es.placerInteressement ? 'Exonéré d’impôt, bloqué 5 ans' : 'Perçu tout de suite, imposable'}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="interrupteur"
          checked={es.placerInteressement}
          onChange={(e) => {
            onChange(modifierEpargneSalariale(etat, { placerInteressement: e.target.checked }))
          }}
        />
      </label>
    </div>
  )
}
