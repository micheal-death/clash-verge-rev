import { nanoid } from 'nanoid'

export const POLICY_ID_KEY = 'x-verge-id'

export type PolicyKind = 'proxy' | 'group'
export type PolicyIdentityKind =
  | `manual-${PolicyKind}`
  | `runtime-${PolicyKind}`
export type PolicyIdentityMap = Record<string, string>

type PolicyItem = object & { name?: string }

export const getPolicyId = (item: unknown) => {
  if (!item || typeof item !== 'object') return ''

  const id = (item as Record<string, unknown>)[POLICY_ID_KEY]
  return typeof id === 'string' ? id.trim() : ''
}

export const createPolicyId = () => nanoid()

export const ensurePolicyId = <T extends PolicyItem>(item: T): T => {
  if (getPolicyId(item)) return item

  return {
    ...item,
    [POLICY_ID_KEY]: createPolicyId(),
  } as T
}

export const withNewPolicyId = <T extends PolicyItem>(item: T): T =>
  ({
    ...item,
    [POLICY_ID_KEY]: createPolicyId(),
  }) as T

export const ensurePolicyIds = <T extends PolicyItem>(items: T[]) => {
  let changed = false
  const next = items.map((item) => {
    if (getPolicyId(item)) return item
    changed = true
    return ensurePolicyId(item)
  })

  return { items: next, changed }
}

export const stripPolicyMetadata = <T extends PolicyItem>(item: T): T => {
  if (!getPolicyId(item)) return item

  const { [POLICY_ID_KEY]: _id, ...rest } = item as T & Record<string, unknown>
  return rest as T
}

export const getPolicyIdentity = (item: unknown, kind: PolicyIdentityKind) => {
  const id = getPolicyId(item)
  if (id) return `${kind}:${id}`

  const name =
    item && typeof item === 'object'
      ? (item as { name?: unknown }).name
      : undefined

  return typeof name === 'string' && name
    ? `${kind}:name:${name}`
    : `${kind}:unknown`
}

export const getPolicyIdentityMap = <T extends PolicyItem>(
  items: T[],
  kind: PolicyIdentityKind,
): PolicyIdentityMap =>
  Object.fromEntries(
    items
      .map((item) => [
        typeof item.name === 'string' ? item.name : '',
        getPolicyIdentity(item, kind),
      ])
      .filter((entry): entry is [string, string] => !!entry[0] && !!entry[1]),
  )

export const getPolicyIdMap = <T extends PolicyItem>(items: T[]) =>
  Object.fromEntries(
    items
      .map((item) => [
        typeof item.name === 'string' ? item.name : '',
        getPolicyId(item),
      ])
      .filter((entry): entry is [string, string] => !!entry[0] && !!entry[1]),
  )

export const renamePolicyReferences = <T extends { proxies?: string[] }>(
  item: T,
  oldName: string,
  newName: string,
) => {
  if (!Array.isArray(item.proxies) || !item.proxies.includes(oldName)) {
    return item
  }

  return {
    ...item,
    proxies: item.proxies.map((policy) =>
      policy === oldName ? newName : policy,
    ),
  }
}
