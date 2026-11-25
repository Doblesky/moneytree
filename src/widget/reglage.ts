/** Réglage du widget Android, rangé dans le profil (champ facultatif `widget`). */
import { db, type BaseMoneyTree, type Profil, type ReglageWidget } from '../storage/db.ts'
import { lireProfil, modifierProfil } from '../storage/profil.ts'

const PAR_DEFAUT: ReglageWidget = { actif: false, intervalleMinutes: 10 }

export function reglageWidget(profil: Profil): ReglageWidget {
  return { ...PAR_DEFAUT, ...profil.widget }
}

/** Modifie le réglage ; réactiver le widget efface « compagnon introuvable ». */
export async function modifierReglageWidget(
  modif: Partial<ReglageWidget>,
  base: BaseMoneyTree = db,
): Promise<ReglageWidget> {
  return base.transaction('rw', base.profil, async () => {
    const nouveau: ReglageWidget = { ...reglageWidget(await lireProfil(base)), ...modif }
    if (modif.actif === true) delete nouveau.introuvableLe
    await modifierProfil({ widget: nouveau }, base)
    return nouveau
  })
}

export async function noterEnvoi(
  signature: string,
  nbCartes: number,
  maintenant: Date,
  base: BaseMoneyTree = db,
): Promise<void> {
  await modifierReglageWidget({ derniereSignature: signature, nbCartes, dernierEnvoiLe: maintenant.toISOString() }, base)
}

export async function noterIntrouvable(maintenant: Date, base: BaseMoneyTree = db): Promise<void> {
  await modifierReglageWidget({ introuvableLe: maintenant.toISOString() }, base)
}
