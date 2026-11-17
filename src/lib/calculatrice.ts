/**
 * Évaluation d'une expression de la mini-calculatrice des quiz, sans `eval` : analyse
 * descendante récursive des quatre opérations, des parenthèses et du pourcentage.
 *
 * - virgule ou point décimal ; espaces ignorés (« 10 000 » = 10000) ;
 * - × ou * pour multiplier, ÷ ou / pour diviser, − ou - pour soustraire ;
 * - « 30 % » vaut 0,3 : « 3000 × 30 % » = 900.
 *
 * Renvoie null si l'expression est incomplète, invalide, ou divise par zéro.
 */

type Jeton = { type: 'nombre'; valeur: number } | { type: 'op'; valeur: '+' | '-' | '*' | '/' | '%' | '(' | ')' }

function decouper(expression: string): Jeton[] | null {
  const texte = expression
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/[×xX]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
  const jetons: Jeton[] = []
  let i = 0
  while (i < texte.length) {
    const c = texte.charAt(i)
    if (/[0-9.,]/.test(c)) {
      let fin = i
      while (fin < texte.length && /[0-9.,]/.test(texte.charAt(fin))) fin++
      const brut = texte.slice(i, fin).replace(',', '.')
      if ((brut.match(/\./g) ?? []).length > 1 || brut === '.') return null
      jetons.push({ type: 'nombre', valeur: Number(brut) })
      i = fin
    } else if ('+-*/%()'.includes(c)) {
      jetons.push({ type: 'op', valeur: c as '+' | '-' | '*' | '/' | '%' | '(' | ')' })
      i++
    } else {
      return null
    }
  }
  return jetons
}

export function evaluerExpression(expression: string): number | null {
  const jetons = decouper(expression)
  if (!jetons || jetons.length === 0) return null
  let position = 0
  const regarder = () => jetons[position]
  const estOp = (valeur: string) => {
    const j = regarder()
    return j?.type === 'op' && j.valeur === valeur
  }

  function primaire(): number | null {
    const j = regarder()
    if (!j) return null
    if (j.type === 'nombre') {
      position++
      return j.valeur
    }
    if (j.valeur === '(') {
      position++
      const v = expressionComplete()
      if (v === null || !estOp(')')) return null
      position++
      return v
    }
    return null
  }

  function facteur(): number | null {
    if (estOp('-')) {
      position++
      const v = facteur()
      return v === null ? null : -v
    }
    if (estOp('+')) {
      position++
      return facteur()
    }
    let v = primaire()
    while (v !== null && estOp('%')) {
      position++
      v /= 100
    }
    return v
  }

  function terme(): number | null {
    let v = facteur()
    while (v !== null && (estOp('*') || estOp('/'))) {
      const op = regarder()
      position++
      const droite = facteur()
      if (droite === null) return null
      if (op?.type === 'op' && op.valeur === '/') {
        if (droite === 0) return null
        v /= droite
      } else {
        v *= droite
      }
    }
    return v
  }

  function expressionComplete(): number | null {
    let v = terme()
    while (v !== null && (estOp('+') || estOp('-'))) {
      const op = regarder()
      position++
      const droite = terme()
      if (droite === null) return null
      v = op?.type === 'op' && op.valeur === '-' ? v - droite : v + droite
    }
    return v
  }

  const resultat = expressionComplete()
  if (resultat === null || position !== jetons.length || !Number.isFinite(resultat)) return null
  return resultat
}

/** Résultat à reporter dans le champ de réponse : deux décimales au plus, virgule française. */
export function resultatEnTexte(valeur: number): string {
  const arrondi = Math.round(valeur * 100) / 100
  return String(Object.is(arrondi, -0) ? 0 : arrondi).replace('.', ',')
}
