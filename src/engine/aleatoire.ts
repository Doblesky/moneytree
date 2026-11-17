/**
 * Générateur pseudo-aléatoire reproductible (mulberry32). Son état tient dans un entier
 * 32 bits : il se sauvegarde avec la partie, et une même graine redonne exactement la
 * même suite de tirages (augmentations, période historique, trajectoires Monte Carlo).
 */
export class Aleatoire {
  private etatInterne: number

  constructor(graine: number) {
    this.etatInterne = graine >>> 0
  }

  /** État courant, à sauvegarder pour reprendre la suite des tirages plus tard. */
  get etat(): number {
    return this.etatInterne
  }

  /** Nombre uniforme dans [0, 1). */
  suivant(): number {
    this.etatInterne = (this.etatInterne + 0x6d2b79f5) >>> 0
    let t = this.etatInterne
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Entier uniforme dans [0, max). */
  entier(max: number): number {
    return Math.floor(this.suivant() * max)
  }

  /** Tirage d'une loi normale centrée réduite (méthode de Box-Muller). */
  normal(): number {
    const u = 1 - this.suivant() // dans (0, 1] : évite log(0)
    const v = this.suivant()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
}

/** Graine tirée au hasard pour une nouvelle partie. */
export function nouvelleGraine(): number {
  return Math.floor(Math.random() * 2 ** 32) >>> 0
}
