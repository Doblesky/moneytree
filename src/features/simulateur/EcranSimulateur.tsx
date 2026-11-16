import { EnTete } from '../../ui/EnTete.tsx'

/** Simulateur (bac à sable) : arrive en phase 1. */
export function EcranSimulateur() {
  return (
    <>
      <EnTete titre="Simulateur" sousTitre="Ton bac à sable, mois après mois." />
      <main className="ecran apparition">
        <section className="carte" aria-labelledby="simulateur-vide">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span className="surtitre">Bientôt</span>
            <span className="etiquette etiquette--constants">€ constants</span>
          </div>
          <h2 id="simulateur-vide" className="carte__titre">
            Tes dix premières années
          </h2>
          <p className="carte__texte">
            Salaire, impôt, Livret A, PEA et compte-titres, rejoués sur l’historique réel des
            marchés. Les résultats s’afficheront en euros constants, corrigés de l’inflation.
          </p>
        </section>
      </main>
    </>
  )
}
