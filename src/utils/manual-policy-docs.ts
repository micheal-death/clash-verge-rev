import yaml from 'js-yaml'

import type {
  ManualGroupDocument,
  ManualProxyDocument,
} from './manual-policy-normalize'
import {
  createPolicyId,
  ensurePolicyIds,
  getPolicyId,
  getPolicyIdentityMap,
  POLICY_ID_KEY,
  renamePolicyReferences,
} from './policy-metadata'

export {
  normalizeManualGroupDocument,
  normalizeManualProxyDocument,
} from './manual-policy-normalize'
export type { ManualGroupDocument, ManualProxyDocument }

export const getManualProxyNames = (document: ManualProxyDocument) =>
  Array.from(
    new Set(
      [...document.prepend, ...document.append]
        .map((proxy) => proxy.name)
        .filter(Boolean),
    ),
  )

export const getManualGroupNames = (document: ManualGroupDocument) =>
  Array.from(
    new Set(
      [...document.prepend, ...document.append]
        .map((group) => group.name)
        .filter(Boolean),
    ),
  )

export const getManualProxyIdentityMap = (document: ManualProxyDocument) =>
  getPolicyIdentityMap(
    [...document.prepend, ...document.append],
    'manual-proxy',
  )

export const getManualGroupIdentityMap = (document: ManualGroupDocument) =>
  getPolicyIdentityMap(
    [...document.prepend, ...document.append],
    'manual-group',
  )

export const mergeNames = (...nameLists: string[][]) =>
  Array.from(new Set(nameLists.flat()))

export const mergeMaps = <T extends Record<string, string>>(...maps: T[]) =>
  Object.assign({}, ...maps) as T

export const getManualProxyDialerMap = (document: ManualProxyDocument) =>
  Object.fromEntries(
    [...document.prepend, ...document.append]
      .map((proxy) => [proxy.name, (proxy as IProxyBaseConfig)['dialer-proxy']])
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' &&
          !!entry[0] &&
          typeof entry[1] === 'string' &&
          !!entry[1],
      ),
  )

const renameManualProxyDialerReference = (
  proxy: IProxyConfig,
  oldName: string,
  newName: string,
) => {
  if ((proxy as IProxyBaseConfig)['dialer-proxy'] !== oldName) return proxy

  return {
    ...proxy,
    'dialer-proxy': newName,
  }
}

export const renameManualProxyDialerReferences = (
  document: ManualProxyDocument,
  oldName: string,
  newName: string,
): ManualProxyDocument => {
  if (oldName === newName) return document

  return {
    prepend: document.prepend.map((proxy) =>
      renameManualProxyDialerReference(proxy, oldName, newName),
    ),
    append: document.append.map((proxy) =>
      renameManualProxyDialerReference(proxy, oldName, newName),
    ),
    delete: document.delete,
  }
}

export const dumpManualProxyDocument = (document: ManualProxyDocument) =>
  yaml.dump(
    {
      prepend: document.prepend,
      append: document.append,
      delete: document.delete,
    },
    { forceQuotes: true },
  )

export const dumpManualGroupDocument = (document: ManualGroupDocument) =>
  yaml.dump(
    {
      prepend: document.prepend,
      append: document.append,
      delete: document.delete,
    },
    { forceQuotes: true },
  )

export const getDuplicatedPolicyName = (
  name: string,
  existingNames: string[],
) => {
  const existing = new Set(existingNames)
  const base = `${name} copy`
  if (!existing.has(base)) return base

  let index = 2
  while (existing.has(`${base} ${index}`)) index += 1
  return `${base} ${index}`
}

export const groupDependsOn = (
  dependencyMap: Map<string, string[]>,
  startName: string,
  targetName: string,
) => {
  const visited = new Set<string>()
  const stack = [startName]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue

    visited.add(current)

    for (const dependency of dependencyMap.get(current) ?? []) {
      if (dependency === targetName) return true
      stack.push(dependency)
    }
  }

  return false
}

const manualGroupHasDynamicPolicies = (group: IProxyGroupConfig) =>
  (Array.isArray(group.use) && group.use.length > 0) ||
  group['include-all'] === true ||
  group['include-all-proxies'] === true ||
  group['include-all-providers'] === true

const removePolicyFromManualGroup = (
  group: IProxyGroupConfig,
  policyName: string,
) => {
  if (!Array.isArray(group.proxies) || !group.proxies.includes(policyName)) {
    return group
  }

  const proxies = group.proxies.filter((proxy) => proxy !== policyName)
  return {
    ...group,
    proxies:
      proxies.length > 0 || manualGroupHasDynamicPolicies(group)
        ? proxies
        : ['DIRECT'],
  }
}

export const removePolicyFromManualGroups = (
  document: ManualGroupDocument,
  policyName: string,
): ManualGroupDocument => ({
  prepend: document.prepend.map((group) =>
    removePolicyFromManualGroup(group, policyName),
  ),
  append: document.append.map((group) =>
    removePolicyFromManualGroup(group, policyName),
  ),
  delete: document.delete,
})

const renamePolicyInManualGroup = (
  group: IProxyGroupConfig,
  oldName: string,
  newName: string,
) => renamePolicyReferences(group, oldName, newName)

export const renamePolicyInManualGroups = (
  document: ManualGroupDocument,
  oldName: string,
  newName: string,
): ManualGroupDocument => {
  if (oldName === newName) return document

  return {
    prepend: document.prepend.map((group) =>
      renamePolicyInManualGroup(group, oldName, newName),
    ),
    append: document.append.map((group) =>
      renamePolicyInManualGroup(group, oldName, newName),
    ),
    delete: document.delete,
  }
}

const ensurePolicyIdsWithNameCache = <T extends { name?: string }>(
  items: T[],
  idCache?: Record<string, string>,
) => {
  if (!idCache) return ensurePolicyIds(items)

  let changed = false
  const next = items.map((item) => {
    const existingId = getPolicyId(item)
    const name = typeof item.name === 'string' ? item.name : ''
    if (existingId) {
      if (name) idCache[name] = existingId
      return item
    }

    const id = name && idCache[name] ? idCache[name] : createPolicyId()
    if (name) idCache[name] = id
    changed = true
    return {
      ...item,
      [POLICY_ID_KEY]: id,
    } as T
  })

  return { items: next, changed }
}

export const ensureManualProxyDocumentIds = (
  document: ManualProxyDocument,
  idCache?: Record<string, string>,
): { document: ManualProxyDocument; changed: boolean } => {
  const prepend = ensurePolicyIdsWithNameCache(document.prepend, idCache)
  const append = ensurePolicyIdsWithNameCache(document.append, idCache)

  return {
    document: {
      prepend: prepend.items,
      append: append.items,
      delete: document.delete,
    },
    changed: prepend.changed || append.changed,
  }
}

export const ensureManualGroupDocumentIds = (
  document: ManualGroupDocument,
  idCache?: Record<string, string>,
): { document: ManualGroupDocument; changed: boolean } => {
  const prepend = ensurePolicyIdsWithNameCache(document.prepend, idCache)
  const append = ensurePolicyIdsWithNameCache(document.append, idCache)

  return {
    document: {
      prepend: prepend.items,
      append: append.items,
      delete: document.delete,
    },
    changed: prepend.changed || append.changed,
  }
}
