import { formatMontant } from './lib/format.ts'
import { Icone } from './ui/Icone.tsx'
import { Monogramme } from './ui/Monogramme.tsx'

// Écran provisoire de l'étape 3 : aperçu du thème. Remplacé par la navigation à l'étape 4.
export function App() {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--vert-marque)' }}>
        <Monogramme />
        <h1 className="titre-s">MoneyTree</h1>
      </div>
      <section className="carte">
        <span className="surtitre">Carte standard</span>
        <h2 className="carte__titre">Épargne de précaution</h2>
        <p className="carte__texte">Fond crème clair, filet fin, ombre courte.</p>
        <p className="chiffres" style={{ fontSize: 30, fontWeight: 600 }}>
          {formatMontant(18450)} <span className="variation--perte">▼ {formatMontant(-7200)}</span>
        </p>
        <button type="button" className="bouton bouton--contour">Ouvrir</button>
      </section>
      <section className="carte carte--importante sur-vert">
        <span className="surtitre surtitre--or">Prochaine étape</span>
        <h2 className="carte__titre">Les intérêts composés</h2>
        <button type="button" className="bouton bouton--sur-vert">Reprendre</button>
      </section>
      <section className="carte carte--verrouillee">
        <Icone nom="cadenas" />
        <div className="carte__corps">
          <span className="surtitre">Verrouillé</span>
          <h2 className="carte__titre">Enveloppes</h2>
          <p className="carte__texte">Le même placement, des règles différentes selon l’enveloppe.</p>
        </div>
      </section>
      <button type="button" className="bouton bouton--plein">
        Continuer <Icone nom="suivant" taille={20} epaisseur={2} />
      </button>
    </main>
  )
}
