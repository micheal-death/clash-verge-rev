import yaml from 'js-yaml'

export interface ManualProxyDocument {
  prepend: IProxyConfig[]
  append: IProxyConfig[]
  delete: string[]
}

export interface ManualGroupDocument {
  prepend: IProxyGroupConfig[]
  append: IProxyGroupConfig[]
  delete: string[]
}

const isPlainObject = (item: unknown): item is Record<string, unknown> =>
  !!item && typeof item === 'object' && !Array.isArray(item)

const getPolicyItemName = (item: unknown) => {
  if (typeof item === 'string') return item.trim()
  if (!item || typeof item !== 'object') return ''

  const name = (item as { name?: unknown }).name
  return typeof name === 'string' ? name.trim() : ''
}

const normalizePolicyDeleteNames = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(value.map(getPolicyItemName).filter((name) => name.length > 0)),
      )
    : []

const toProxyItems = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (item): item is IProxyConfig =>
          isPlainObject(item) && getPolicyItemName(item).length > 0,
      )
    : []

const toGroupItems = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (item): item is IProxyGroupConfig =>
          isPlainObject(item) && getPolicyItemName(item).length > 0,
      )
    : []

export const normalizeManualProxyDocument = (
  data: string,
): ManualProxyDocument => {
  const obj = yaml.load(data) as Partial<ManualProxyDocument> | null
  return {
    prepend: toProxyItems(obj?.prepend),
    append: toProxyItems(obj?.append),
    delete: normalizePolicyDeleteNames(obj?.delete),
  }
}

export const normalizeManualGroupDocument = (
  data: string,
): ManualGroupDocument => {
  const obj = yaml.load(data) as Partial<ManualGroupDocument> | null
  return {
    prepend: toGroupItems(obj?.prepend),
    append: toGroupItems(obj?.append),
    delete: normalizePolicyDeleteNames(obj?.delete),
  }
}
