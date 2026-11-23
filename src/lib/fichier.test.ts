import { describe, expect, it, vi } from 'vitest'
import { partagerFichierTexte } from './fichier.ts'

describe('partage d’un fichier texte', () => {
  it('partage un fichier texte avec le bon nom et le bon contenu', async () => {
    const share = vi.fn<(donnees: ShareData) => Promise<void>>().mockResolvedValue(undefined)
    const resultat = await partagerFichierTexte('remarques.txt', 'Ma remarque', { canShare: () => true, share })

    expect(resultat).toBe('partage')
    const fichier = share.mock.calls[0]?.[0].files?.[0]
    expect(fichier?.name).toBe('remarques.txt')
    expect(fichier?.type).toContain('text/plain')
    expect(await fichier?.text()).toBe('Ma remarque')
  })

  it('signale un partage annulé par l’utilisateur', async () => {
    const share = vi.fn<(donnees: ShareData) => Promise<void>>().mockRejectedValue(new DOMException('Annulé', 'AbortError'))
    expect(await partagerFichierTexte('r.txt', 'x', { canShare: () => true, share })).toBe('annule')
  })

  it('signale un partage refusé par le navigateur', async () => {
    const share = vi.fn<(donnees: ShareData) => Promise<void>>().mockRejectedValue(new DOMException('Refusé', 'NotAllowedError'))
    expect(await partagerFichierTexte('r.txt', 'x', { canShare: () => true, share })).toBe('indisponible')
  })

  it('signale un navigateur sans partage de fichiers', async () => {
    const share = vi.fn<(donnees: ShareData) => Promise<void>>()
    expect(await partagerFichierTexte('r.txt', 'x', {})).toBe('indisponible')
    expect(await partagerFichierTexte('r.txt', 'x', { canShare: () => false, share })).toBe('indisponible')
    expect(share).not.toHaveBeenCalled()
  })
})
