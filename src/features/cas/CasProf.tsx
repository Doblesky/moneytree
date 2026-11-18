/**
 * Cas d'école du profil prof : premier traitement, affectation loin de chez soi, temps
 * partiel, hors classe. Les règles viennent des paramètres officiels ; les loyers, dépenses
 * et frais de déménagement sont des hypothèses, réglées par le joueur.
 */
import { useState } from 'react'
import { useProfil } from '../../app/donnees.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { estVille, loyerMedian, sourceLoyer, VILLES, type Ville } from '../../engine/carriere.ts'
import { budgetPremierTraitement, comparerAffectation, coutTempsPartiel, effetHorsClasse } from '../../engine/casEcoleProf.ts'
import { formatMontant } from '../../lib/format.ts'
import { Choix } from '../../ui/Choix.tsx'
import { Curseur, Resultat } from '../cours/Calculateurs.tsx'
import { BoutonDebrief, Debrief, MiseEnSituation } from './communs.tsx'
import { SOURCES } from './sources.ts'

const euros = (v: number) => formatMontant(v)

export function CasPremierTraitement() {
  const p = parametres2026()
  const profil = useProfil()
  const ville: Ville = estVille(profil?.ville) ? profil.ville : 'Toulouse'
  const [surface, setSurface] = useState(22)
  const [autres, setAutres] = useState(600)
  const [vu, setVu] = useState(false)
  const loyer = loyerMedian(ville, surface, p)
  const b = budgetPremierTraitement({ loyer, autresDepenses: autres }, p)
  const moisPrecaution = b.reste > 0 ? Math.ceil(b.precaution.basse / b.reste) : null
  return (
    <>
      <MiseEnSituation titre="Ton budget d’élève fonctionnaire">
        <p className="carte__texte chiffres">
          Concours réussi : tu entres en M1 à {ville}, payé·e à l’indice majoré minimum de la fonction publique, soit{' '}
          {euros(b.netMensuel)} net par mois avant impôt. Le loyer médian du logement que tu choisis :{' '}
          {euros(loyer)} par mois hors charges.
        </p>
        <div className="calculateur">
          <Curseur libelle="Surface du logement" valeur={surface} min={12} max={50} pas={1} format={(v) => `${v} m²`} onChange={setSurface} />
          <Curseur libelle="Autres dépenses par mois (hypothèse)" valeur={autres} min={200} max={1200} pas={50} format={euros} onChange={setAutres} />
          <Resultat libelle="Reste chaque mois" valeur={euros(b.reste)} detail="Après impôt, loyer et dépenses" />
        </div>
        {vu ? null : (
          <BoutonDebrief
            id="premier-traitement"
            onVoir={() => {
              setVu(true)
            }}
          />
        )}
      </MiseEnSituation>
      {vu ? (
        <Debrief
          titre="Épargner dès le M1 ?"
          modules={[0, 11, 2]}
          sources={[SOURCES.statutCertifies, SOURCES.remunerationFp, SOURCES.cotisationsFp, sourceLoyer(ville, p), SOURCES.precaution, SOURCES.lep]}
        >
          <div className="calculateur__lignes chiffres">
            <span>Net avant impôt</span>
            <span>{euros(b.netMensuel)}</span>
            <span>Impôt sur le revenu (moyenne mensuelle)</span>
            <span>−{euros(b.impotMensuel)}</span>
            <span>Loyer</span>
            <span>−{euros(loyer)}</span>
            <span>Autres dépenses</span>
            <span>−{euros(autres)}</span>
            <span>Reste</span>
            <span>{euros(b.reste)}</span>
          </div>
          <p className="carte__texte chiffres">
            La paie d’élève est versée à condition d’être assidu·e : une épargne de précaution de 3 à 6 mois, soit{' '}
            {euros(b.precaution.basse)} à {euros(b.precaution.haute)}, reste la première étape.{' '}
            {moisPrecaution === null
              ? 'Avec ce budget, rien ne reste : c’est lui qu’il faut revoir d’abord.'
              : `En épargnant tout le reste, le bas de la fourchette est atteint en ${String(moisPrecaution)} mois.`}
          </p>
          <p className="carte__texte chiffres">
            Une année complète en M1 donne un revenu imposable d’environ {euros(b.revenuFiscalEstime)} après la déduction
            de 10 %.{' '}
            {b.sousPlafondLep
              ? `C’est sous le plafond du LEP (${euros(p['lep.plafondRevenuFiscalReference1Part'].valeur)} pour une part) : dès que ton avis d’impôt le montre, ce livret mieux rémunéré peut t’être ouvert.`
              : 'C’est au-dessus du plafond du LEP.'}
          </p>
        </Debrief>
      ) : null}
    </>
  )
}

export function CasAffectationLoin() {
  const p = parametres2026()
  const [ville, setVille] = useState<Ville>('Paris')
  const [demenagement, setDemenagement] = useState(1500)
  const [trajets, setTrajets] = useState(250)
  const [zoneTendue, setZoneTendue] = useState(true)
  const [choix, setChoix] = useState<'demenager' | 'trajets' | null>(null)
  const [vu, setVu] = useState(false)
  const nouveauLoyer = loyerMedian(ville, 25, p)
  const r = comparerAffectation({ fraisDemenagement: demenagement, nouveauLoyer, zoneTendue, trajetsMensuels: trajets }, p)
  return (
    <>
      <MiseEnSituation titre="Ta première affectation est loin">
        <p className="carte__texte chiffres">
          Le mouvement t’affecte dans une autre académie. Pour un 25 m² à {ville}, le loyer médian est de {euros(nouveauLoyer)}{' '}
          par mois. Tu peux déménager, ou garder ton logement et faire la route.
        </p>
        <div className="choix-liste" role="radiogroup" aria-label="Ville d’affectation">
          {VILLES.map((v) => (
            <Choix
              key={v}
              choisi={ville === v}
              onChoisir={() => {
                setVille(v)
              }}
              titre={v}
            />
          ))}
        </div>
        <div className="calculateur">
          <Curseur libelle="Déménagement (hypothèse)" valeur={demenagement} min={300} max={4000} pas={100} format={euros} onChange={setDemenagement} />
          <Curseur libelle="Trajets par mois si tu ne déménages pas (hypothèse)" valeur={trajets} min={50} max={800} pas={25} format={euros} onChange={setTrajets} />
        </div>
        <Choix
          choisi={zoneTendue}
          onChoisir={() => {
            setZoneTendue(!zoneTendue)
          }}
          titre="La commune est en zone tendue (« zone ALUR »)"
          detail="Le plafond de l’AIP passe alors de 700 € à 1 500 €. À vérifier sur le site de l’AIP."
        />
        <div className="choix-liste" role="radiogroup" aria-label="Ta décision">
          <Choix
            choisi={choix === 'demenager'}
            onChoisir={() => {
              setChoix('demenager')
            }}
            titre="Déménager"
          />
          <Choix
            choisi={choix === 'trajets'}
            onChoisir={() => {
              setChoix('trajets')
            }}
            titre="Garder ton logement et faire la route"
          />
        </div>
        {vu ? null : (
          <BoutonDebrief
            id="affectation-loin"
            desactive={choix === null}
            onVoir={() => {
              setVu(true)
            }}
          />
        )}
      </MiseEnSituation>
      {vu ? (
        <Debrief
          titre="Ce que coûte chaque option"
          modules={[12, 15, 14]}
          sources={[SOURCES.mutations, SOURCES.aip, SOURCES.fraisReels, sourceLoyer(ville, p)]}
        >
          <div className="calculateur__lignes chiffres">
            <span>Installation : déménagement, premier loyer, dépôt de garantie</span>
            <span>{euros(r.coutInstallation)}</span>
            <span>Aide à l’installation (AIP), au plus</span>
            <span>−{euros(r.aip)}</span>
            <span>Reste à ta charge pour t’installer</span>
            <span>{euros(r.resteInstallation)}</span>
            <span>Trajets sur un an, sans déménager</span>
            <span>{euros(r.trajetsAnnuels)}</span>
          </div>
          <p className="carte__texte">
            L’AIP rembourse une partie des frais d’une première affectation, dans la limite des dépenses réellement payées,
            si ton revenu fiscal de référence ne dépasse pas {euros(p['aip.plafondRfr1Part'].valeur)} pour une part. Délais :
            24 mois après l’affectation, 12 mois après la signature du bail.
          </p>
          <p className="carte__texte">
            Les trajets domicile-travail, et une double résidence qui n’est pas de convenance personnelle, peuvent entrer
            dans tes frais réels : tu renonces alors à la déduction de 10 %, et tu gardes les justificatifs trois ans.
            Enfin, chaque année de séparation d’un conjoint rapporte des points au mouvement : le choix du logement peut aussi
            jouer sur ta prochaine mutation.
          </p>
        </Debrief>
      ) : null}
    </>
  )
}

export function CasTempsPartiel() {
  const p = parametres2026()
  const [echelon, setEchelon] = useState(5)
  const [vu, setVu] = useState(false)
  const indiceFin = p['certifies.grilleHorsClasse'].valeur.at(-1)?.indiceMajore ?? 0
  const r = coutTempsPartiel({ grade: 'classe-normale', echelon }, indiceFin, p)
  return (
    <>
      <MiseEnSituation titre="Un jour libre par semaine">
        <p className="carte__texte">
          Tu envisages de passer à 80 % pendant cinq ans. Ta paie baisse, mais de combien ? Et ta retraite ?
        </p>
        <div className="calculateur">
          <Curseur libelle="Ton échelon (classe normale)" valeur={echelon} min={1} max={11} pas={1} format={(v) => (v === 1 ? '1er' : `${String(v)}e`)} onChange={setEchelon} />
          <Resultat libelle="Net à temps plein" valeur={`${euros(r.netPlein)} / mois`} />
        </div>
        {vu ? null : (
          <BoutonDebrief
            id="temps-partiel"
            onVoir={() => {
              setVu(true)
            }}
          />
        )}
      </MiseEnSituation>
      {vu ? (
        <Debrief titre="Le vrai coût du temps partiel" modules={[14, 8]} sources={[SOURCES.tempsPartielFp, SOURCES.retraiteFp, SOURCES.cotisationsFp]}>
          <div className="calculateur__lignes chiffres">
            <span>Net à temps plein</span>
            <span>{euros(r.netPlein)}</span>
            <span>Net à 80 % (6/7 de la paie)</span>
            <span>{euros(r.netPartiel)}</span>
            <span>Perte chaque mois</span>
            <span>−{euros(r.perteMensuelle)}</span>
            <span>Surcotisation, si tu la choisis</span>
            <span>−{euros(r.surcoutSurcotisation)} / mois</span>
          </div>
          <p className="carte__texte chiffres">
            Tu travailles 20 % de moins pour environ {Math.round((r.perteMensuelle / r.netPlein) * 100)} % de net en moins :
            à 80 %, la paie est de 6/7, pas de 80 %.
          </p>
          <p className="carte__texte chiffres">
            Pour la retraite, ces cinq ans comptent en entier dans ta durée d’assurance, mais pour 4 ans dans le calcul de la
            pension. Sur une carrière complète finie au sommet de la hors classe, la pension de base passerait de{' '}
            {euros(r.pensionSans)} à {euros(r.pensionAvec)} brut par mois, chaque mois de ta retraite. La surcotisation
            efface cette perte, au plus 4 trimestres, contre le surcoût affiché.
          </p>
        </Debrief>
      ) : null}
    </>
  )
}

export function CasHorsClasse() {
  const p = parametres2026()
  const [vu, setVu] = useState(false)
  const r = effetHorsClasse(p)
  return (
    <>
      <MiseEnSituation titre="Promouvable à la hors classe">
        <p className="carte__texte">
          Après deux ans au 9e échelon, tu deviens promouvable à la hors classe. Admettons que ta promotion arrive quand tu
          es au 11e et dernier échelon de la classe normale : qu’est-ce que ça change ?
        </p>
        {vu ? null : (
          <BoutonDebrief
            id="hors-classe"
            onVoir={() => {
              setVu(true)
            }}
          />
        )}
      </MiseEnSituation>
      {vu ? (
        <Debrief titre="Ce que la hors classe change" modules={[8, 11]} sources={[SOURCES.statutCertifies, SOURCES.grillesEnseignants, SOURCES.retraiteFp]}>
          <div className="calculateur__lignes chiffres">
            <span>Net au 11e échelon de la classe normale</span>
            <span>{euros(r.netClasseNormale)}</span>
            <span>Net au {r.echelonArrivee}e échelon de la hors classe</span>
            <span>{euros(r.netHorsClasse)}</span>
            <span>Pension de base, sommet de la classe normale</span>
            <span>{euros(r.pensionClasseNormale)}</span>
            <span>Pension de base, sommet de la hors classe</span>
            <span>{euros(r.pensionHorsClasse)}</span>
          </div>
          <p className="carte__texte">
            La promotion te classe à l’échelon d’indice égal ou immédiatement supérieur au tien, et ta grille continue de
            monter. Mais l’effet le plus durable est sur la retraite : la pension de base se calcule sur le traitement
            indiciaire détenu depuis au moins six mois, sans les primes. La prime d’attractivité, elle, n’existe pas hors de
            la classe normale, et elle est déjà nulle au 10e échelon.
          </p>
          <p className="carte__texte">
            Pensions calculées pour une carrière complète, au taux de 75 % et sans décote : un ordre de grandeur, pas une
            estimation personnelle. Le simulateur officiel de ta caisse de retraite reste la référence.
          </p>
        </Debrief>
      ) : null}
    </>
  )
}
