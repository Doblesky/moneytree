import { EnTete } from '../../ui/EnTete.tsx'
import { Icone } from '../../ui/Icone.tsx'

/** Mode carrière : s'ouvrira après les modules 0 à 2 (cahier des charges). */
export function EcranCarriere() {
  return (
    <>
      <EnTete titre="Carrière" sousTitre="Une année, un choix." />
      <main className="ecran apparition">
        <section className="carte carte--verrouillee" aria-labelledby="carriere-verrouillee">
          <Icone nom="cadenas" />
          <div className="carte__corps">
            <span className="surtitre">Verrouillé</span>
            <h2 id="carriere-verrouillee" className="carte__titre">
              Mode carrière
            </h2>
            <p className="carte__texte">
              S’ouvre après les modules 0 à 2. Chaque année apporte des événements à choix :
              une offre d’emploi, une prime, un krach, une mise en couple.
            </p>
          </div>
        </section>
      </main>
    </>
  )
}
