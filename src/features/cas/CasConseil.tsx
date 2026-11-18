/**
 * Cas de conseil client (palier Professionnel) : le dossier d'un client fictif, cinq
 * décisions, puis un débrief corrigé comme un examen.
 */
import { useState } from 'react'
import { casParId, estIdCas } from '../../content/cas.ts'
import { casConseilParId } from '../../content/casConseil.ts'
import type { Question } from '../../content/schema.ts'
import { typographie } from '../../content/texte.ts'
import { examenReussi, melangerChoix } from '../../progression/examens.ts'
import { terminerCas } from '../../storage/profil.ts'
import { Icone } from '../../ui/Icone.tsx'
import { Correction, Deroulement, type ReponseExamen } from '../examen/Deroulement.tsx'
import { Debrief } from './communs.tsx'

/** Seuil d'un dossier « réussi », comme à l'examen AMF. */
const SEUIL_DOSSIER = 0.8

export function CasConseilVue({ id }: { id: string }) {
  const cas = casConseilParId(id)
  const [etape, setEtape] = useState<'dossier' | 'decisions' | 'debrief'>('dossier')
  const [reponses, setReponses] = useState<ReponseExamen[]>([])
  // Choix mélangés à chaque tentative : dans les données, la bonne réponse est toujours la première.
  const [questions, setQuestions] = useState<Question[]>([])
  if (!cas || !estIdCas(id)) return null
  const infos = casParId(id)

  if (etape === 'decisions') {
    return (
      <Deroulement
        titre={infos.titre}
        questions={questions}
        onQuitter={() => {
          setEtape('dossier')
        }}
        onFini={(r) => {
          setReponses(r)
          setEtape('debrief')
          void terminerCas(id)
        }}
      />
    )
  }

  if (etape === 'debrief') {
    const justes = reponses.filter((r) => r.juste).length
    const reussi = examenReussi(justes, reponses.length, SEUIL_DOSSIER)
    return (
      <>
        <Debrief
          titre={reussi ? `Dossier réussi : ${String(justes)} / ${String(reponses.length)}` : `À retravailler : ${String(justes)} / ${String(reponses.length)}`}
          modules={infos.modules}
          sources={[]}
        >
          <p className="carte__texte">
            {reussi
              ? 'Tes recommandations tiennent la route : tu as raisonné comme un conseiller.'
              : 'Comme à l’examen, il faut 80 % de bonnes décisions. Relis la correction : chaque erreur renvoie à sa source.'}
          </p>
        </Debrief>
        <section className="section" aria-labelledby="cas-correction">
          <h2 id="cas-correction" className="section__titre">
            Correction
          </h2>
          <Correction reponses={reponses} />
        </section>
        <button
          type="button"
          className="bouton bouton--contour"
          onClick={() => {
            setEtape('dossier')
          }}
        >
          Reprendre le dossier
        </button>
      </>
    )
  }

  return (
    <>
      <section className="carte" aria-labelledby="dossier-client">
        <span className="surtitre surtitre--or">Dossier client · exemple fictif</span>
        <h2 id="dossier-client" className="carte__titre">
          {infos.titre}
        </h2>
        {cas.dossier.map((paragraphe) => (
          <p key={paragraphe} className="carte__texte">
            {typographie(paragraphe)}
          </p>
        ))}
        <blockquote className="cas__demande">{typographie(cas.demande)}</blockquote>
      </section>
      <p className="texte-secondaire">
        {cas.questions.length} décisions à prendre, sans correction avant la fin. Il faut 80 % de bonnes décisions, comme
        à l’examen AMF.
      </p>
      <button
        type="button"
        className="bouton bouton--plein"
        onClick={() => {
          setQuestions(cas.questions.map((x) => melangerChoix(x, Math.random)))
          setEtape('decisions')
        }}
      >
        Conseiller ce client
        <Icone nom="suivant" taille={20} epaisseur={2} />
      </button>
    </>
  )
}
