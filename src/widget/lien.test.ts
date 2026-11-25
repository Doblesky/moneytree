import { describe, expect, it } from 'vitest'
import { IDS_METIER, METIERS } from '../profils/metiers.ts'
import {
  encoderPaquet,
  encoderPaquetBorne,
  estAndroid,
  LIMITE_LIEN,
  lienIntent,
  retirerParamAbsent,
  TAILLE_MAX_DECODEE,
  urlRepli,
} from './lien.ts'
import { construirePaquet, type PaquetWidget } from './paquet.ts'

async function decoder(donnees: string): Promise<unknown> {
  const base64 = donnees.replace(/-/g, '+').replace(/_/g, '/')
  const binaire = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  const octets = Uint8Array.from(binaire, (c) => c.charCodeAt(0))
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return JSON.parse(await new Response(flux).text())
}

function paquetComplet(metier: (typeof IDS_METIER)[number]): PaquetWidget {
  return construirePaquet(
    {
      metier,
      modeExpert: false,
      leviersForces: [],
      modules: METIERS[metier].modules.map((moduleId) => ({ moduleId, paliersMaitrises: 5 })),
    },
    10,
  )
}

describe('lienIntent', () => {
  it('vise le compagnon avec un repli encodé', () => {
    expect(lienIntent('abc', 'https://x/#/a')).toBe(
      'intent://sync?d=abc#Intent;scheme=moneytree-widget;package=io.github.doblesky.moneytree.widget;S.browser_fallback_url=https%3A%2F%2Fx%2F%23%2Fa;end',
    )
  })
})

describe('urlRepli', () => {
  it('ajoute le paramètre dans le fragment', () => {
    expect(urlRepli('https://d.io/m/#/parcours/0/1', 42)).toBe('https://d.io/m/#/parcours/0/1?widget-absent=42')
  })
  it('complète une recherche existante du fragment', () => {
    expect(urlRepli('https://d.io/m/#/parcours/0/1?carte=2', 42)).toBe(
      'https://d.io/m/#/parcours/0/1?carte=2&widget-absent=42',
    )
  })
  it('crée un fragment s’il n’y en a pas', () => {
    expect(urlRepli('https://d.io/m/', 42)).toBe('https://d.io/m/#/?widget-absent=42')
  })
})

describe('retirerParamAbsent', () => {
  it('retire le paramètre seul', () => {
    expect(retirerParamAbsent('#/parcours/0/1?widget-absent=42')).toBe('#/parcours/0/1')
  })
  it('garde les autres paramètres', () => {
    expect(retirerParamAbsent('#/a?carte=2&widget-absent=42')).toBe('#/a?carte=2')
  })
  it('renvoie null sans le paramètre', () => {
    expect(retirerParamAbsent('#/a')).toBeNull()
  })
})

describe('estAndroid', () => {
  it('reconnaît Android et pas Windows', () => {
    expect(estAndroid('Mozilla/5.0 (Linux; Android 14; 23013RK75C) Chrome/156.0.0.0 Mobile')).toBe(true)
    expect(estAndroid('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0.0.0')).toBe(false)
  })
})

describe('encoderPaquetBorne', () => {
  it('garde le texte complet quand le paquet tient', async () => {
    const paquet = construirePaquet(
      { metier: 'ingenieur', modeExpert: false, leviersForces: [], modules: [{ moduleId: 0, paliersMaitrises: 1 }] },
      10,
    )
    const { donnees, nbCartes } = await encoderPaquetBorne(paquet)
    expect(nbCartes).toBe(paquet.cartes.length)
    expect(await decoder(donnees)).toEqual(paquet)
  })

  it('ne garde que le premier paragraphe quand le paquet complet dépasse la limite', async () => {
    const paquet = paquetComplet('prof-second-degre')
    expect((await encoderPaquet(paquet)).length).toBeGreaterThan(LIMITE_LIEN)
    const { donnees, nbCartes } = await encoderPaquetBorne(paquet)
    expect(donnees.length).toBeLessThanOrEqual(LIMITE_LIEN)
    expect(nbCartes).toBe(paquet.cartes.length)
    const recu = (await decoder(donnees)) as PaquetWidget
    expect(recu.cartes.map((c) => c.texte)).toEqual(paquet.cartes.map((c) => c.texte.split('\n\n')[0]))
  })

  it('retire des cartes en dernier recours', async () => {
    let graine = 1
    const bruit = (n: number) =>
      Array.from({ length: n }, () => {
        // xorshift 32 bits : un texte qui ne se compresse presque pas.
        graine ^= graine << 13
        graine ^= graine >>> 17
        graine ^= graine << 5
        graine >>>= 0
        return String.fromCharCode(97 + (graine % 26))
      }).join('')
    const base = paquetComplet('ingenieur')
    const modele = base.cartes[0]
    if (!modele) throw new Error('aucune carte')
    const enorme: PaquetWidget = {
      ...base,
      cartes: Array.from({ length: 400 }, (_, i) => ({ ...modele, id: `m0-p1-c${i}`, texte: bruit(400) })),
    }
    const { donnees, nbCartes } = await encoderPaquetBorne(enorme)
    expect(donnees.length).toBeLessThanOrEqual(LIMITE_LIEN)
    expect(nbCartes).toBeLessThan(400)
    expect(((await decoder(donnees)) as PaquetWidget).cartes).toHaveLength(nbCartes)
  })
})

describe('encoderPaquet', () => {
  it('fait l’aller-retour en base64url', async () => {
    const paquet = paquetComplet('ingenieur')
    const donnees = await encoderPaquet(paquet)
    expect(donnees).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await decoder(donnees)).toEqual(paquet)
  })

  it.each(IDS_METIER)('tient dans les limites avec tous les paliers maîtrisés (%s)', async (metier) => {
    const paquet = paquetComplet(metier)
    const octets = new TextEncoder().encode(JSON.stringify(paquet)).length
    const donnees = await encoderPaquet(paquet)
    console.info(`${metier} : ${paquet.cartes.length} cartes, ${octets} octets, ${donnees.length} caractères encodés`)
    expect(octets).toBeLessThan(TAILLE_MAX_DECODEE)
    expect(donnees.length).toBeLessThan(150_000)
  })
})
