import { useMemo } from 'react'

export type SelectionOverrides = Record<string, string>

export type RuntimeProxyGroupBase = {
  name: string
  now?: string
}

export const EMPTY_SELECTION_OVERRIDES: SelectionOverrides = {}

export function applySelectionOverride<T extends RuntimeProxyGroupBase>(
  group: T,
  selectionOverrides: SelectionOverrides,
) {
  const nextNow = selectionOverrides[group.name]

  return nextNow && group.now !== nextNow
    ? ({ ...group, now: nextNow } as T)
    : group
}

export function useRuntimeProxyGroups<T extends RuntimeProxyGroupBase>(
  groups: readonly (T | null | undefined)[] | null | undefined,
  global: T | null | undefined,
  selectionOverrides: SelectionOverrides = EMPTY_SELECTION_OVERRIDES,
) {
  const runtimeGroups = useMemo(
    () =>
      (groups ?? [])
        .filter((group): group is T => !!group)
        .map((group) => applySelectionOverride(group, selectionOverrides)),
    [groups, selectionOverrides],
  )
  const runtimeGlobal = useMemo(
    () =>
      global ? applySelectionOverride(global, selectionOverrides) : undefined,
    [global, selectionOverrides],
  )

  return { runtimeGroups, runtimeGlobal }
}
