import 'fake-indexeddb/auto'
import { Dexie } from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { creerBase, VERSION_SCHEMA, type BaseMoneyTree } from './db.ts'
import {
  analyserFichierExport,
  exporterDonnees,
  importerDonnees,
  nomFichierExport,
  serialiserExport,
} from './exportImport.ts'
import {
  ajouterNote,
  listerNotes,
  marquerNote,
  nomFichierNotes,
  supprimerNote,
  texteNotesPourClaude,
} from './notes.ts'
import { lireProfil, modifierProfil } from './profil.ts'

let base: BaseMoneyTree
let compteur = 0

beforeEach(async () => {
  compteur += 1
  base = creerBase(`moneytree-test-${compteur}`)
  await base.open()
})

afterEach(async () => {
  await base.delete()
})

async function remplirAvecDonneesDeTest(b: BaseMoneyTree) {
  await modifierProfil({ modeExpert: true, ville: 'Toulouse' }, b)
  await b.progression.bulkPut([
    { moduleId: 0, paliersMaitrises: 2, majLe: '2026-11-16T10:00:00.000Z' },
    { moduleId: 1, paliersMaitrises: 0, majLe: '2026-11-16T11:00:00.000Z' },
  ])
  await b.sauvegardes.add({
    nom: 'Partie test',
    creeLe: '2026-11-16T12:00:00.000Z',
    majLe: '2026-11-16T12:30:00.000Z',
    etat: { mois: 3, patrimoine: [1, 2, 3], drapeaux: { a: true } },
  })
}

describe('schéma Dexie', () => {
  it('est en version 3 avec la table des remarques', () => {
    expect(VERSION_SCHEMA).toBe(3)
    expect(base.verno).toBe(VERSION_SCHEMA)
    expect(base.tables.map((t) => t.name).sort()).toEqual([
      'journees',
      'notes',
      'profil',
      'progression',
      'reponses',
      'sauvegardes',
    ])
  })

  it('garde les données d’une base en version 2 lors de la mise à jour', async () => {
    const nom = `moneytree-migration-${compteur}`
    const ancienne = new Dexie(nom)
    ancienne.version(1).stores({ profil: 'id', progression: 'moduleId', sauvegardes: '++id, majLe' })
    ancienne.version(2).stores({ reponses: 'questionId, prochaineRevision', journees: 'date' })
    await ancienne.open()
    await ancienne.table('profil').put({
      id: 'moi',
      creeLe: '2026-11-16T10:00:00.000Z',
      majLe: '2026-11-16T10:00:00.000Z',
      modeExpert: true,
    })
    ancienne.close()

    const migree = creerBase(nom)
    await migree.open()
    expect((await lireProfil(migree)).modeExpert).toBe(true)
    expect(await migree.notes.count()).toBe(0)
    await migree.delete()
  })
})

describe('remarques', () => {
  it('ajoute, ignore le vide, marque, remet à traiter et supprime', async () => {
    expect(await ajouterNote('   ', base)).toBeNull()
    const id = await ajouterNote('  Expliquer « hors débours »  ', base, new Date('2026-11-23T12:00:00.000Z'))
    if (id === null) throw new Error('note non créée')
    expect((await listerNotes(base))[0]?.texte).toBe('Expliquer « hors débours »')

    await marquerNote(id, true, base, new Date('2026-11-24T12:00:00.000Z'))
    expect((await listerNotes(base))[0]?.traiteeLe).toBe('2026-11-24T12:00:00.000Z')
    await marquerNote(id, false, base)
    expect((await listerNotes(base))[0]).not.toHaveProperty('traiteeLe')

    await supprimerNote(id, base)
    expect(await base.notes.count()).toBe(0)
  })

  it('prépare pour Claude les seules remarques à traiter, de la plus ancienne à la plus récente', () => {
    const texte = texteNotesPourClaude([
      { id: 3, texte: 'Récente', creeLe: '2026-11-23T12:00:00.000Z' },
      { id: 2, texte: 'Déjà faite', creeLe: '2026-11-22T12:00:00.000Z', traiteeLe: '2026-11-23T08:00:00.000Z' },
      { id: 1, texte: 'Ancienne', creeLe: '2026-11-21T12:00:00.000Z' },
    ])
    expect(texte).toContain('1. (21/11/2026) Ancienne')
    expect(texte).toContain('2. (23/11/2026) Récente')
    expect(texte).not.toContain('Déjà faite')
  })

  it('nomme le fichier envoyé sur Drive avec le jour local', () => {
    expect(nomFichierNotes(new Date(2026, 10, 3, 23, 30))).toBe('moneytree-remarques-2026-11-03.txt')
  })
})

describe('profil et mode expert', () => {
  it('renvoie un profil par défaut sans rien écrire', async () => {
    const profil = await lireProfil(base)
    expect(profil.modeExpert).toBe(false)
    expect(await base.profil.count()).toBe(0)
  })

  it('enregistre le mode expert', async () => {
    await modifierProfil({ modeExpert: true }, base)
    expect((await lireProfil(base)).modeExpert).toBe(true)
    await modifierProfil({ modeExpert: false }, base)
    expect((await lireProfil(base)).modeExpert).toBe(false)
  })
})

describe('export et import JSON', () => {
  it('exporte toutes les tables avec l’en-tête attendu', async () => {
    await remplirAvecDonneesDeTest(base)
    const date = new Date('2026-11-16T20:00:00.000Z')
    const exp = await exporterDonnees(base, date)
    expect(exp.application).toBe('MoneyTree')
    expect(exp.formatExport).toBe(3)
    expect(exp.versionSchema).toBe(VERSION_SCHEMA)
    expect(exp.exporteLe).toBe('2026-11-16T20:00:00.000Z')
    expect(exp.tables.profil).toHaveLength(1)
    expect(exp.tables.progression).toHaveLength(2)
    expect(exp.tables.sauvegardes).toHaveLength(1)
    expect(exp.tables.reponses).toHaveLength(0)
    expect(exp.tables.journees).toHaveLength(0)
  })

  it('restaure exactement les données après un aller-retour', async () => {
    await remplirAvecDonneesDeTest(base)
    const texte = serialiserExport(await exporterDonnees(base))

    // Les données changent après l'export…
    await modifierProfil({ modeExpert: false, ville: 'Lyon' }, base)
    await base.progression.put({ moduleId: 5, paliersMaitrises: 5, majLe: '2026-11-17T00:00:00.000Z' })
    await base.sauvegardes.clear()

    // … puis l'import les remet dans l'état exporté.
    const analyse = analyserFichierExport(texte)
    expect(analyse.ok).toBe(true)
    if (!analyse.ok) return
    expect(analyse.resume).toMatchObject({ profil: true, modules: 2, sauvegardes: 1 })
    await importerDonnees(analyse.donnees, base)

    const apres = await exporterDonnees(base)
    const attendu = JSON.parse(texte) as { tables: unknown }
    expect(apres.tables).toEqual(attendu.tables)
    expect((await lireProfil(base)).ville).toBe('Toulouse')
  })

  it('importe un export vide en effaçant les données', async () => {
    const vide = serialiserExport(await exporterDonnees(base))
    await remplirAvecDonneesDeTest(base)
    const analyse = analyserFichierExport(vide)
    if (!analyse.ok) throw new Error(analyse.erreur)
    await importerDonnees(analyse.donnees, base)
    expect(await base.profil.count()).toBe(0)
    expect(await base.sauvegardes.count()).toBe(0)
  })

  it('refuse les fichiers invalides sans toucher aux données', async () => {
    await remplirAvecDonneesDeTest(base)
    const valide = JSON.parse(serialiserExport(await exporterDonnees(base))) as Record<string, unknown>

    const cas: [string, string][] = [
      ['pas du JSON', 'n’est pas un fichier JSON valide'],
      [JSON.stringify({ application: 'AutreAppli' }), 'ne vient pas de MoneyTree'],
      [JSON.stringify([1, 2]), 'ne vient pas de MoneyTree'],
      [JSON.stringify({ ...valide, versionSchema: VERSION_SCHEMA + 1 }), 'version plus récente'],
      [JSON.stringify({ ...valide, tables: { profil: [] } }), 'incomplet ou abîmé'],
      [
        JSON.stringify({
          ...valide,
          tables: {
            profil: [],
            progression: [{ moduleId: 120, paliersMaitrises: 0, majLe: '2026-11-16T10:00:00.000Z' }],
            sauvegardes: [],
          },
        }),
        'progression',
      ],
    ]
    for (const [texte, message] of cas) {
      const analyse = analyserFichierExport(texte)
      expect(analyse.ok).toBe(false)
      if (!analyse.ok) expect(analyse.erreur).toContain(message)
    }

    expect(await base.progression.count()).toBe(2)
    expect((await lireProfil(base)).modeExpert).toBe(true)
  })

  it('importe encore un fichier exporté par la phase 0 (format 1)', () => {
    const ancien = {
      application: 'MoneyTree',
      formatExport: 1,
      versionSchema: 1,
      exporteLe: '2026-11-16T20:00:00.000Z',
      tables: {
        profil: [
          {
            id: 'moi',
            creeLe: '2026-11-16T10:00:00.000Z',
            majLe: '2026-11-16T10:00:00.000Z',
            modeExpert: false,
          },
        ],
        progression: [],
        sauvegardes: [],
      },
    }
    const analyse = analyserFichierExport(JSON.stringify(ancien))
    expect(analyse.ok).toBe(true)
    if (!analyse.ok) return
    expect(analyse.donnees.formatExport).toBe(3)
    expect(analyse.donnees.tables.reponses).toEqual([])
    expect(analyse.donnees.tables.journees).toEqual([])
    expect(analyse.donnees.tables.notes).toEqual([])
  })

  it('importe encore un fichier au format 2, sans remarques', async () => {
    const actuel = JSON.parse(serialiserExport(await exporterDonnees(base))) as {
      tables: Record<string, unknown>
    }
    delete actuel.tables.notes
    const analyse = analyserFichierExport(JSON.stringify({ ...actuel, formatExport: 2, versionSchema: 2 }))
    expect(analyse.ok).toBe(true)
    if (analyse.ok) expect(analyse.donnees.tables.notes).toEqual([])
  })

  it('exporte et restaure les remarques', async () => {
    await ajouterNote('Revoir le module 6', base, new Date('2026-11-23T12:00:00.000Z'))
    const analyse = analyserFichierExport(serialiserExport(await exporterDonnees(base)))
    if (!analyse.ok) throw new Error(analyse.erreur)
    expect(analyse.resume.notes).toBe(1)
    await base.notes.clear()
    await importerDonnees(analyse.donnees, base)
    expect((await listerNotes(base))[0]?.texte).toBe('Revoir le module 6')
  })

  it('nomme le fichier avec la date locale', () => {
    expect(nomFichierExport(new Date(2026, 10, 16, 23, 59))).toBe('moneytree-2026-11-16.json')
    expect(nomFichierExport(new Date(2027, 0, 5))).toBe('moneytree-2027-01-05.json')
  })
})

describe('export du réglage du widget', () => {
  const widget = {
    actif: true,
    intervalleMinutes: 15,
    derniereSignature: '0a1b2c3d',
    dernierEnvoiLe: '2026-11-25T11:00:00.000Z',
    nbCartes: 42,
  } as const

  it('l’export avec widget se réimporte', async () => {
    await modifierProfil({ widget }, base)
    const analyse = analyserFichierExport(serialiserExport(await exporterDonnees(base)))
    if (!analyse.ok) throw new Error(analyse.erreur)
    await modifierProfil({ widget: { actif: false, intervalleMinutes: 10 } }, base)
    await importerDonnees(analyse.donnees, base)
    expect((await lireProfil(base)).widget).toEqual(widget)
  })

  it('refuse une durée de rotation inconnue', async () => {
    await modifierProfil({ widget }, base)
    const brut = JSON.parse(serialiserExport(await exporterDonnees(base))) as {
      tables: { profil: { widget: { intervalleMinutes: number } }[] }
    }
    const profil = brut.tables.profil[0]
    if (!profil) throw new Error('profil absent')
    profil.widget.intervalleMinutes = 7
    expect(analyserFichierExport(JSON.stringify(brut)).ok).toBe(false)
  })
})
