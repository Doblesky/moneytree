import { useEffect, useId, useState } from 'react'
import { GLOSSAIRE } from '../../content/catalogue.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { useGlossaire } from '../../ui/contexteGlossaire.ts'
import { Icone } from '../../ui/Icone.tsx'

/** Le glossaire commun aux cours et au simulateur, en entier. */
export function EcranGlossaire() {
  const { ouvrir } = useGlossaire()
  const [filtre, setFiltre] = useState('')
  const id = useId()
  const normaliser = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const entrees = Object.entries(GLOSSAIRE)
    .filter(([, e]) => normaliser(`${e.terme} ${e.definition}`).includes(normaliser(filtre)))
    .sort(([, a], [, b]) => a.terme.localeCompare(b.terme, 'fr'))

  useEffect(() => {
    document.title = 'Glossaire · MoneyTree'
  }, [])

  return (
    <>
      <EnTete titre="Glossaire" sousTitre={`${Object.keys(GLOSSAIRE).length} mots, les mêmes partout dans l’appli.`} retour />
      <main className="ecran apparition">
        <div className="champ">
          <label htmlFor={id} className="visuellement-masque">
            Chercher un mot
          </label>
          <div className="champ__boite">
            <Icone nom="loupe" taille={20} />
            <input
              id={id}
              className="champ__saisie"
              placeholder="Chercher un mot"
              value={filtre}
              onChange={(e) => {
                setFiltre(e.target.value)
              }}
            />
          </div>
        </div>
        <ul className="liste-glossaire">
          {entrees.map(([cle, e]) => (
            <li key={cle}>
              <button
                type="button"
                className="ligne-glossaire"
                onClick={() => {
                  ouvrir(cle)
                }}
              >
                <span className="ligne__titre">{e.terme}</span>
                <span className="texte-secondaire">{e.definition}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
