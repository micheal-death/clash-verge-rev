export interface StableIdentityOrderState {
  order: string[]
  identityByName: Record<string, string>
}

export const createStableIdentityOrderState = (): StableIdentityOrderState => ({
  order: [],
  identityByName: {},
})

export function stabilizeIdentityOrder<T extends { name: string }>(
  items: T[],
  state: StableIdentityOrderState,
  getIdentityKey: (item: T) => string,
) {
  const currentEntries = items.map((item) => ({
    item,
    name: item.name,
    key: getIdentityKey(item),
  }))
  const currentKeys = new Set(currentEntries.map((entry) => entry.key))
  const replacementByOldKey = new Map<string, string>()

  for (const entry of currentEntries) {
    const previousKey = state.identityByName[entry.name]
    if (
      previousKey &&
      previousKey !== entry.key &&
      !currentKeys.has(previousKey)
    ) {
      replacementByOldKey.set(previousKey, entry.key)
    }
  }

  const nextOrder: string[] = []
  const seen = new Set<string>()

  for (const key of state.order) {
    const migratedKey = replacementByOldKey.get(key) ?? key
    if (currentKeys.has(migratedKey) && !seen.has(migratedKey)) {
      nextOrder.push(migratedKey)
      seen.add(migratedKey)
    }
  }

  for (const entry of currentEntries) {
    if (!seen.has(entry.key)) {
      nextOrder.push(entry.key)
      seen.add(entry.key)
    }
  }

  state.order = nextOrder
  state.identityByName = Object.fromEntries(
    currentEntries.map((entry) => [entry.name, entry.key]),
  )

  const orderMap = new Map(nextOrder.map((key, index) => [key, index]))

  return [...items].sort(
    (prev, next) =>
      (orderMap.get(getIdentityKey(prev)) ?? Number.MAX_SAFE_INTEGER) -
      (orderMap.get(getIdentityKey(next)) ?? Number.MAX_SAFE_INTEGER),
  )
}
