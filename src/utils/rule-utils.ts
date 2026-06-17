import yaml from 'js-yaml'

import type {
  EffectiveManualRuleSection,
  EffectivePolicyOption,
  EffectivePolicySource,
  EffectivePolicyType,
  EffectiveRuleRow,
} from '@/types/effective-profile'

import type {
  ManualGroupDocument,
  ManualProxyDocument,
} from './manual-policy-docs'

export type RuleSource = 'prepend' | 'runtime' | 'append'
export type ManualRuleSource = Exclude<RuleSource, 'runtime'>
export type RuleDialogKind = 'standard' | 'logical' | 'ruleset'

export interface ManualRuleItem {
  raw: string
  enabled: boolean
}

export interface ManualRulesDocument {
  prepend: ManualRuleItem[]
  append: ManualRuleItem[]
  delete: string[]
}

export interface RuntimeRuleInput {
  type: string
  payload?: string | null
  proxy: string
}

export interface ParsedRule {
  type: string
  value: string
  policy: string
  noResolve: boolean
}

export interface RuleForm {
  type: string
  value: string
  policy: string
  noResolve: boolean
}

export interface RulePresetRouteState {
  rulePreset?: {
    type?: string
    value?: string
    policy?: string
    noResolve?: boolean
  }
}

export interface RulePresetDialogState {
  kind: RuleDialogKind
  form: RuleForm
}

export interface LogicalRuleItem {
  id: string
  type: string
  value: string
  noResolve: boolean
}

interface RuleDedupEntry {
  list: string[]
  index: number
  noResolve: boolean
}

interface ManualRuleDedupEntry {
  list: ManualRuleItem[]
  index: number
  noResolve: boolean
}

export const standardRuleTypes = [
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'DOMAIN-REGEX',
  'GEOSITE',
  'GEOIP',
  'SRC-GEOIP',
  'IP-ASN',
  'SRC-IP-ASN',
  'IP-CIDR',
  'IP-CIDR6',
  'SRC-IP-CIDR',
  'IP-SUFFIX',
  'SRC-IP-SUFFIX',
  'SRC-PORT',
  'DST-PORT',
  'IN-PORT',
  'DSCP',
  'PROCESS-NAME',
  'PROCESS-PATH',
  'PROCESS-NAME-REGEX',
  'PROCESS-PATH-REGEX',
  'NETWORK',
  'UID',
  'IN-TYPE',
  'IN-USER',
  'IN-NAME',
  'SUB-RULE',
  'MATCH',
]

export const logicalRuleTypes = ['AND', 'OR', 'NOT']
export const rulesetRuleTypes = ['RULE-SET']
export const logicalSubruleTypes = [
  ...standardRuleTypes.filter((type) => type !== 'MATCH'),
  ...logicalRuleTypes,
  ...rulesetRuleTypes,
]
export const networkRuleValues = ['TCP', 'UDP']

export const noResolveRuleTypes = new Set([
  'GEOIP',
  'IP-ASN',
  'IP-CIDR',
  'IP-CIDR6',
  'IP-SUFFIX',
  'RULE-SET',
])

export const ruleTypeExamples: Record<string, string> = {
  DOMAIN: 'example.com',
  'DOMAIN-SUFFIX': 'example.com',
  'DOMAIN-KEYWORD': 'example',
  'DOMAIN-REGEX': 'example.*',
  GEOSITE: 'youtube / CN / geolocation-!cn',
  GEOIP: 'CN',
  'SRC-GEOIP': 'CN',
  'IP-ASN': '13335',
  'SRC-IP-ASN': '9808',
  'IP-CIDR': '127.0.0.0/8',
  'IP-CIDR6': '2620:0:2d0:200::7/32',
  'SRC-IP-CIDR': '192.168.1.201/32',
  'IP-SUFFIX': '8.8.8.8/24',
  'SRC-IP-SUFFIX': '192.168.1.201/8',
  'SRC-PORT': '7777',
  'DST-PORT': '80',
  'IN-PORT': '7897',
  DSCP: '4',
  'PROCESS-NAME': 'curl',
  'PROCESS-PATH': '/usr/bin/wget',
  'PROCESS-NAME-REGEX': '.*telegram.*',
  'PROCESS-PATH-REGEX': '.*bin/wget',
  NETWORK: 'udp',
  UID: '1001',
  'IN-TYPE': 'SOCKS/HTTP',
  'IN-USER': 'mihomo',
  'IN-NAME': 'ss',
  'SUB-RULE': '(NETWORK,tcp)',
  'RULE-SET': 'provider-name',
  AND: '((DOMAIN,example.com),(NETWORK,UDP))',
  OR: '((DOMAIN,example.com),(NETWORK,UDP))',
  NOT: '((DOMAIN,example.com))',
}

export const runtimeRuleTypeMap: Record<string, string> = {
  Domain: 'DOMAIN',
  DomainSuffix: 'DOMAIN-SUFFIX',
  DomainKeyword: 'DOMAIN-KEYWORD',
  DomainRegex: 'DOMAIN-REGEX',
  GeoSite: 'GEOSITE',
  GeoIP: 'GEOIP',
  SrcGeoIP: 'SRC-GEOIP',
  IPASN: 'IP-ASN',
  SrcIPASN: 'SRC-IP-ASN',
  IPCIDR: 'IP-CIDR',
  SrcIPCIDR: 'SRC-IP-CIDR',
  IPSuffix: 'IP-SUFFIX',
  SrcIPSuffix: 'SRC-IP-SUFFIX',
  SrcPort: 'SRC-PORT',
  DstPort: 'DST-PORT',
  InPort: 'IN-PORT',
  InUser: 'IN-USER',
  InName: 'IN-NAME',
  InType: 'IN-TYPE',
  ProcessName: 'PROCESS-NAME',
  ProcessPath: 'PROCESS-PATH',
  ProcessNameRegex: 'PROCESS-NAME-REGEX',
  ProcessPathRegex: 'PROCESS-PATH-REGEX',
  Match: 'MATCH',
  RuleSet: 'RULE-SET',
  Network: 'NETWORK',
  DSCP: 'DSCP',
  Uid: 'UID',
  SubRules: 'SUB-RULE',
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
}

export const emptyManualRules = (): ManualRulesDocument => ({
  prepend: [],
  append: [],
  delete: [],
})

export const createManualRuleItem = (
  raw: string,
  enabled = true,
): ManualRuleItem => ({
  raw,
  enabled,
})

export const cloneManualRules = (
  document: ManualRulesDocument,
): ManualRulesDocument => ({
  prepend: document.prepend.map((item) => ({ ...item })),
  append: document.append.map((item) => ({ ...item })),
  delete: [...document.delete],
})

const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

const getPolicyItemName = (item: unknown) => {
  if (typeof item === 'string') return item.trim()
  if (!item || typeof item !== 'object') return ''

  const name = (item as { name?: unknown }).name
  return typeof name === 'string' ? name.trim() : ''
}

export const normalizePolicyDeleteNames = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(value.map(getPolicyItemName).filter((name) => name.length > 0)),
      )
    : []

const getManualRuleRawFromUnknown = (item: unknown) => {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return ''

  const ruleItem = item as {
    raw?: unknown
    rule?: unknown
    value?: unknown
  }

  if (typeof ruleItem.raw === 'string') return ruleItem.raw
  if (typeof ruleItem.rule === 'string') return ruleItem.rule
  if (typeof ruleItem.value === 'string') return ruleItem.value

  return ''
}

export const getProfileRuleRaws = (data: string | undefined): string[] => {
  if (!data) return []

  try {
    const obj = yaml.load(data) as Record<string, unknown> | null
    const value = obj?.rules
    return Array.isArray(value)
      ? value
          .map(getManualRuleRawFromUnknown)
          .filter((raw) => raw.trim().length > 0)
      : []
  } catch {
    return []
  }
}

const getManualRuleEnabledFromUnknown = (item: unknown) => {
  if (!item || typeof item !== 'object') return true

  const enabled = (item as { enabled?: unknown }).enabled
  return enabled !== false
}

const toManualRuleItems = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const raw = getManualRuleRawFromUnknown(item).trim()
        return raw
          ? [createManualRuleItem(raw, getManualRuleEnabledFromUnknown(item))]
          : []
      })
    : []

const dumpManualRuleItem = (item: ManualRuleItem) =>
  item.enabled ? item.raw : { rule: item.raw, enabled: false }

export const normalizeManualRules = (data: string): ManualRulesDocument => {
  const obj = yaml.load(data) as Partial<ManualRulesDocument> | null
  return {
    prepend: toManualRuleItems(obj?.prepend),
    append: toManualRuleItems(obj?.append),
    delete: toStringArray(obj?.delete),
  }
}

export const dumpManualRules = (document: ManualRulesDocument) =>
  yaml.dump(
    {
      prepend: document.prepend.map(dumpManualRuleItem),
      append: document.append.map(dumpManualRuleItem),
      delete: document.delete,
    },
    { forceQuotes: true },
  )

export const parseRuleRaw = (raw: string): ParsedRule => {
  const parts = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const type = parts.shift()?.toUpperCase() ?? ''
  const noResolve = parts.at(-1)?.toLowerCase() === 'no-resolve'

  if (noResolve) parts.pop()

  const policy = parts.pop() ?? ''

  return {
    type,
    value: parts.join(','),
    policy,
    noResolve,
  }
}

export const isMatchRule = (rule: Pick<ParsedRule, 'type'>) =>
  rule.type.trim().toUpperCase() === 'MATCH'

export const isMatchRuleRaw = (raw: string) => isMatchRule(parseRuleRaw(raw))

export const normalizeRuleValue = (type: string, value: string): string => {
  const normalizedType = type.trim().toUpperCase()
  const trimmedValue = value.trim()

  if (isGeoipRule(normalizedType)) return trimmedValue.toUpperCase()
  if (normalizedType === 'NETWORK') return trimmedValue.toUpperCase()
  if (logicalRuleTypes.includes(normalizedType)) {
    return normalizeLogicalRuleValue(normalizedType, trimmedValue)
  }

  return trimmedValue
}

export const buildParsedRuleRaw = (rule: ParsedRule) => {
  const type = rule.type.trim().toUpperCase()
  const policy = rule.policy.trim()
  const value =
    type === 'MATCH' ? '' : normalizeRuleValue(type, rule.value.trim())
  const base = value ? `${type},${value},${policy}` : `${type},${policy}`

  return rule.noResolve && noResolveRuleTypes.has(type)
    ? `${base},no-resolve`
    : base
}

export const buildRuleRaw = (form: RuleForm) =>
  buildParsedRuleRaw({
    type: form.type,
    value: form.value,
    policy: form.policy,
    noResolve: form.noResolve,
  })

export const renameRulePolicyRaw = (
  raw: string,
  oldName: string,
  newName: string,
) => {
  const parsed = parseRuleRaw(raw)
  if (!parsed.type || parsed.policy !== oldName) return raw

  return buildParsedRuleRaw({
    ...parsed,
    policy: newName,
  })
}

export const runtimeRuleToRaw = (rule: {
  type: string
  payload?: string | null
  proxy: string
}) => {
  const type = runtimeRuleTypeMap[rule.type] ?? rule.type.toUpperCase()
  const payload = rule.payload?.trim()

  return payload ? `${type},${payload},${rule.proxy}` : `${type},${rule.proxy}`
}

export const getRuleIdentitySignature = (rule: ParsedRule) =>
  [
    rule.type.trim().toUpperCase(),
    normalizeRuleValue(rule.type, rule.value),
    rule.policy.trim(),
  ].join('\n')

export const getRawRuleIdentitySignature = (raw: string) => {
  const parsed = parseRuleRaw(raw)
  return parsed.type && parsed.policy
    ? getRuleIdentitySignature(parsed)
    : raw.trim()
}

export const normalizeRuleRaw = (raw: string) => {
  const parsed = parseRuleRaw(raw)

  if (!parsed.type || !parsed.policy) return raw.trim()

  return buildParsedRuleRaw(parsed)
}

export const sanitizeRuleList = (
  list: string[],
  seen = new Map<string, RuleDedupEntry>(),
) => {
  const next: string[] = []

  list.forEach((raw) => {
    const normalizedRaw = normalizeRuleRaw(raw)
    if (!normalizedRaw) return

    const parsed = parseRuleRaw(normalizedRaw)
    const signature =
      parsed.type && parsed.policy
        ? getRuleIdentitySignature(parsed)
        : normalizedRaw.trim()
    const existing = seen.get(signature)

    if (existing) {
      if (!existing.noResolve && parsed.noResolve) {
        existing.list[existing.index] = normalizedRaw
        existing.noResolve = true
      }
      return
    }

    seen.set(signature, {
      list: next,
      index: next.length,
      noResolve: parsed.noResolve,
    })
    next.push(normalizedRaw)
  })

  return next
}

export const sanitizeManualRuleList = (
  list: ManualRuleItem[],
  seen = new Map<string, ManualRuleDedupEntry>(),
) => {
  const next: ManualRuleItem[] = []

  list.forEach((item) => {
    const normalizedRaw = normalizeRuleRaw(item.raw)
    if (!normalizedRaw) return

    const parsed = parseRuleRaw(normalizedRaw)
    const signature =
      parsed.type && parsed.policy
        ? getRuleIdentitySignature(parsed)
        : normalizedRaw.trim()
    const existing = seen.get(signature)

    if (existing) {
      const existingItem = existing.list[existing.index]

      if (!existing.noResolve && parsed.noResolve) {
        existingItem.raw = normalizedRaw
        existing.noResolve = true
      }

      if (!existingItem.enabled && item.enabled) {
        existingItem.enabled = true
      }

      return
    }

    seen.set(signature, {
      list: next,
      index: next.length,
      noResolve: parsed.noResolve,
    })
    next.push(createManualRuleItem(normalizedRaw, item.enabled))
  })

  return next
}

export const sanitizeManualRules = (
  document: ManualRulesDocument,
): ManualRulesDocument => {
  const manualSeen = new Map<string, ManualRuleDedupEntry>()
  const prepend = sanitizeManualRuleList(document.prepend, manualSeen)
  const append = sanitizeManualRuleList(document.append, manualSeen)
  const disabledRules = [...prepend, ...append]
    .filter((item) => !item.enabled)
    .map((item) => item.raw)

  return {
    prepend,
    append,
    delete: sanitizeRuleList([...document.delete, ...disabledRules]),
  }
}

export const makeSearchText = (row: ParsedRule, source: string, raw: string) =>
  [row.type, row.value, row.policy, source, raw].join(' ')

export interface BuildEffectivePolicyOptionsOptions {
  builtinPolicies?: string[]
  baseProfileData?: string
  manualProxies?: ManualProxyDocument
  manualGroups?: ManualGroupDocument
  runtimeProxyNames?: string[]
  runtimeGroupNames?: string[]
}

const getProfileSequenceNames = (data: string | undefined, field: string) => {
  if (!data) return []

  try {
    const obj = yaml.load(data) as Record<string, unknown> | null
    const value = obj?.[field]
    return Array.isArray(value)
      ? value.map(getPolicyItemName).filter((name) => name.length > 0)
      : []
  } catch {
    return []
  }
}

const addEffectivePolicyOption = (
  options: EffectivePolicyOption[],
  seen: Set<string>,
  name: string,
  source: EffectivePolicySource,
  type: EffectivePolicyType,
) => {
  const normalizedName = name.trim()
  if (!normalizedName || seen.has(normalizedName)) return

  seen.add(normalizedName)
  options.push({
    name: normalizedName,
    source,
    type,
    available: true,
  })
}

export const buildEffectivePolicyOptions = ({
  builtinPolicies = [],
  baseProfileData,
  manualProxies = { prepend: [], append: [], delete: [] },
  manualGroups = { prepend: [], append: [], delete: [] },
  runtimeProxyNames = [],
  runtimeGroupNames = [],
}: BuildEffectivePolicyOptionsOptions): EffectivePolicyOption[] => {
  const options: EffectivePolicyOption[] = []
  const seen = new Set<string>()
  const deletedProxyNames = new Set(manualProxies.delete)
  const deletedGroupNames = new Set(manualGroups.delete)

  builtinPolicies.forEach((name) =>
    addEffectivePolicyOption(options, seen, name, 'builtin', 'builtin'),
  )

  getProfileSequenceNames(baseProfileData, 'proxies')
    .filter((name) => !deletedProxyNames.has(name))
    .forEach((name) =>
      addEffectivePolicyOption(options, seen, name, 'base', 'proxy'),
    )

  getProfileSequenceNames(baseProfileData, 'proxy-groups')
    .filter((name) => !deletedGroupNames.has(name))
    .forEach((name) =>
      addEffectivePolicyOption(options, seen, name, 'base', 'group'),
    )

  ;[...manualProxies.prepend, ...manualProxies.append]
    .map(getPolicyItemName)
    .forEach((name) =>
      addEffectivePolicyOption(options, seen, name, 'manual', 'proxy'),
    )

  ;[...manualGroups.prepend, ...manualGroups.append]
    .map(getPolicyItemName)
    .forEach((name) =>
      addEffectivePolicyOption(options, seen, name, 'manual', 'group'),
    )

  runtimeProxyNames
    .filter((name) => !deletedProxyNames.has(name))
    .forEach((name) =>
      addEffectivePolicyOption(options, seen, name, 'runtime', 'proxy'),
    )

  runtimeGroupNames
    .filter((name) => !deletedGroupNames.has(name))
    .forEach((name) =>
      addEffectivePolicyOption(options, seen, name, 'runtime', 'group'),
    )

  return options
}

interface ManualRuleRowInput {
  item: ManualRuleItem
  manualSection: EffectiveManualRuleSection
  manualIndex: number
}

export type ManualEffectiveRuleRow = EffectiveRuleRow & {
  source: 'manual'
  manualSection: EffectiveManualRuleSection
  manualIndex: number
}

const createEffectiveRuleRow = (
  parsed: ParsedRule,
  row: Omit<
    EffectiveRuleRow,
    keyof ParsedRule | 'effectiveIndex' | 'searchText'
  >,
  searchSource: string,
): EffectiveRuleRow => ({
  ...parsed,
  ...row,
  effectiveIndex: -1,
  searchText: makeSearchText(parsed, searchSource, row.raw),
})

const createManualEffectiveRuleRow = ({
  item,
  manualSection,
  manualIndex,
}: ManualRuleRowInput): ManualEffectiveRuleRow => {
  const parsed = parseRuleRaw(item.raw)

  return {
    ...createEffectiveRuleRow(
      parsed,
      {
        id: `${manualSection}:${manualIndex}:${item.raw}`,
        raw: item.raw,
        enabled: item.enabled,
        source: 'manual',
        manualSection,
        manualIndex,
        locked: false,
        editable: true,
        deletable: true,
        canToggle: true,
        canChangePolicy: true,
        writeTarget:
          manualSection === 'prepend' ? 'rules-prepend' : 'rules-append',
      },
      'manual',
    ),
    source: 'manual',
    manualSection,
    manualIndex,
  }
}

const createOverlayDeleteRuleRow = (
  raw: string,
  index: number,
): EffectiveRuleRow => {
  const parsed = parseRuleRaw(raw)

  return createEffectiveRuleRow(
    parsed,
    {
      id: `delete:${index}:${raw}`,
      raw,
      enabled: false,
      source: 'overlay-delete',
      locked: false,
      editable: true,
      deletable: false,
      canToggle: true,
      canChangePolicy: true,
      writeTarget: 'rules-delete',
    },
    'runtime',
  )
}

const createBaseRuleRow = (raw: string, index: number): EffectiveRuleRow => {
  const parsed = parseRuleRaw(raw)

  return createEffectiveRuleRow(
    parsed,
    {
      id: `base:${index}:${raw}`,
      raw,
      enabled: true,
      source: 'base',
      baseRaw: raw,
      baseIndex: index,
      locked: false,
      editable: true,
      deletable: true,
      canToggle: true,
      canChangePolicy: true,
      writeTarget: 'rules-delete',
    },
    'runtime',
  )
}

const createRuntimeRuleRow = (
  rule: RuntimeRuleInput,
  index: number,
): EffectiveRuleRow => {
  const raw = runtimeRuleToRaw(rule)
  const parsed = parseRuleRaw(raw)

  return createEffectiveRuleRow(
    parsed,
    {
      id: `runtime:${index}:${raw}`,
      raw,
      enabled: true,
      source: 'runtime',
      locked: false,
      editable: true,
      deletable: true,
      canToggle: true,
      canChangePolicy: true,
      writeTarget: 'rules-delete',
    },
    'runtime',
  )
}

export const isEffectiveManualRuleRow = (
  row: EffectiveRuleRow,
): row is ManualEffectiveRuleRow => row.source === 'manual'

export const isEffectiveRuntimeRuleRow = (row: EffectiveRuleRow) =>
  row.source === 'runtime'

export const isEffectiveOverlayDeleteRuleRow = (row: EffectiveRuleRow) =>
  row.source === 'overlay-delete'

export const isEffectiveConfigRuleRow = (row: EffectiveRuleRow) =>
  row.source === 'base' ||
  row.source === 'runtime' ||
  isEffectiveOverlayDeleteRuleRow(row)

export const isEffectiveFallbackRuleRow = (row: EffectiveRuleRow) =>
  row.writeTarget === 'rules-fallback'

export const shouldShowEffectiveRuleRow = (
  row: EffectiveRuleRow,
  options: { showDisabledConfigRules?: boolean } = {},
) =>
  options.showDisabledConfigRules === true ||
  !isEffectiveOverlayDeleteRuleRow(row)

export interface BuildEffectiveRuleRowsOptions {
  manualRules: ManualRulesDocument
  baseRules?: string[]
  runtimeRules: RuntimeRuleInput[]
  pendingRuntimeSuppressedSignatures?: ReadonlySet<string>
}

const markFinalFallbackRule = (
  rows: EffectiveRuleRow[],
): EffectiveRuleRow[] => {
  let fallbackIndex = -1

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].enabled && isMatchRule(rows[index])) {
      fallbackIndex = index
      break
    }
  }

  return rows.map((row, effectiveIndex) => {
    const indexedRow = {
      ...row,
      effectiveIndex,
    }

    if (effectiveIndex !== fallbackIndex) return indexedRow

    return {
      ...indexedRow,
      locked: true,
      deletable: false,
      canToggle: false,
      canChangePolicy: true,
      writeTarget: 'rules-fallback',
    }
  })
}

export const buildEffectiveRuleRows = ({
  manualRules,
  baseRules = [],
  runtimeRules,
  pendingRuntimeSuppressedSignatures = new Set(),
}: BuildEffectiveRuleRowsOptions): EffectiveRuleRow[] => {
  const manualRows = [
    ...manualRules.prepend.map((item, manualIndex) =>
      createManualEffectiveRuleRow({
        item,
        manualSection: 'prepend',
        manualIndex,
      }),
    ),
    ...manualRules.append.map((item, manualIndex) =>
      createManualEffectiveRuleRow({
        item,
        manualSection: 'append',
        manualIndex,
      }),
    ),
  ]
  const manualSignatures = new Set(
    manualRows.map((row) => getRawRuleIdentitySignature(row.raw)),
  )
  const deletedSignatures = new Set(
    manualRules.delete.map(getRawRuleIdentitySignature),
  )
  const deletedRows = manualRules.delete
    .filter((raw) => !manualSignatures.has(getRawRuleIdentitySignature(raw)))
    .map(createOverlayDeleteRuleRow)
  const baseRows = baseRules.map(createBaseRuleRow).filter((row) => {
    const signature = getRuleIdentitySignature(row)
    return !manualSignatures.has(signature) && !deletedSignatures.has(signature)
  })
  const baseSignatures = new Set(
    baseRows.map((row) => getRuleIdentitySignature(row)),
  )
  const runtimeRows = runtimeRules.map(createRuntimeRuleRow).filter((row) => {
    const signature = getRuleIdentitySignature(row)
    return (
      !manualSignatures.has(signature) &&
      !baseSignatures.has(signature) &&
      !deletedSignatures.has(signature) &&
      !pendingRuntimeSuppressedSignatures.has(signature)
    )
  })

  const effectiveRows = [
    ...manualRows.filter((row) => row.manualSection === 'prepend'),
    ...deletedRows,
    ...baseRows,
    ...runtimeRows,
    ...manualRows.filter((row) => row.manualSection === 'append'),
  ]

  return markFinalFallbackRule(effectiveRows)
}

export const removeAt = (
  list: ManualRuleItem[],
  index?: number,
  fallbackRaw?: string,
) => {
  if (typeof index === 'number' && index >= 0 && index < list.length) {
    return list.filter((_, currentIndex) => currentIndex !== index)
  }

  if (fallbackRaw) {
    const next = [...list]
    const signature = getRawRuleIdentitySignature(fallbackRaw)
    const foundIndex = next.findIndex(
      (item) =>
        item.raw === fallbackRaw ||
        getRawRuleIdentitySignature(item.raw) === signature,
    )
    if (foundIndex >= 0) next.splice(foundIndex, 1)
    return next
  }

  return list
}

export const replaceAt = (
  list: ManualRuleItem[],
  index: number | undefined,
  fallbackRaw: string | undefined,
  raw: string,
  enabled = true,
) => {
  const next = [...list]

  if (typeof index === 'number' && index >= 0 && index < next.length) {
    next[index] = createManualRuleItem(raw, next[index]?.enabled ?? enabled)
    return next
  }

  if (fallbackRaw) {
    const signature = getRawRuleIdentitySignature(fallbackRaw)
    const foundIndex = next.findIndex(
      (item) =>
        item.raw === fallbackRaw ||
        getRawRuleIdentitySignature(item.raw) === signature,
    )
    if (foundIndex >= 0) {
      next[foundIndex] = createManualRuleItem(
        raw,
        next[foundIndex]?.enabled ?? enabled,
      )
      return next
    }
  }

  next.unshift(createManualRuleItem(raw, enabled))
  return next
}

export const insertAt = (
  list: ManualRuleItem[],
  index: number | undefined,
  raw: string,
  enabled = true,
) => {
  const next = [...list]
  const safeIndex =
    typeof index === 'number' && index >= 0 && index <= next.length ? index : 0

  next.splice(safeIndex, 0, createManualRuleItem(raw, enabled))
  return next
}

export const isManualRuleSource = (
  source: RuleSource,
): source is ManualRuleSource => source !== 'runtime'

export const addRuleDelete = (document: ManualRulesDocument, raw: string) => {
  const signature = getRawRuleIdentitySignature(raw)
  const exists = document.delete.some(
    (item) => getRawRuleIdentitySignature(item) === signature,
  )

  if (!exists) document.delete.push(raw)
}

export const addRuleOverlayReplacement = (
  document: ManualRulesDocument,
  originalRaw: string,
  replacementRaw: string,
) => {
  addRuleDelete(document, originalRaw)
  addRuleDelete(document, replacementRaw)
  document.prepend.unshift(createManualRuleItem(replacementRaw))
}

export const renamePolicyInManualRules = (
  document: ManualRulesDocument,
  oldName: string,
  newName: string,
  runtimeRules: RuntimeRuleInput[] = [],
): ManualRulesDocument => {
  if (oldName === newName) return document

  const next: ManualRulesDocument = {
    prepend: document.prepend.map((item) => ({
      ...item,
      raw: renameRulePolicyRaw(item.raw, oldName, newName),
    })),
    append: document.append.map((item) => ({
      ...item,
      raw: renameRulePolicyRaw(item.raw, oldName, newName),
    })),
    delete: [...document.delete],
  }
  const nextManualSignatures = new Set(
    [...next.prepend, ...next.append].map((item) =>
      getRawRuleIdentitySignature(item.raw),
    ),
  )

  runtimeRules.forEach((rule) => {
    if (rule.proxy !== oldName) return

    const originalRaw = runtimeRuleToRaw(rule)
    const replacementRaw = renameRulePolicyRaw(originalRaw, oldName, newName)
    if (replacementRaw === originalRaw) return

    if (nextManualSignatures.has(getRawRuleIdentitySignature(replacementRaw))) {
      addRuleDelete(next, originalRaw)
    } else {
      addRuleOverlayReplacement(next, originalRaw, replacementRaw)
    }
  })

  return sanitizeManualRules(next)
}

export const revealRuntimeRuleIfUnshadowed = (
  document: ManualRulesDocument,
  raw: string,
) => {
  const signature = getRawRuleIdentitySignature(raw)
  const hasManualRule = [...document.prepend, ...document.append].some(
    (item) =>
      item.enabled && getRawRuleIdentitySignature(item.raw) === signature,
  )

  if (!hasManualRule) {
    document.delete = document.delete.filter(
      (item) => getRawRuleIdentitySignature(item) !== signature,
    )
  }
}

export const getTypeOptions = (kind: RuleDialogKind) => {
  if (kind === 'logical') return logicalRuleTypes
  if (kind === 'ruleset') return rulesetRuleTypes
  return standardRuleTypes
}

export const getKindFromType = (type: string): RuleDialogKind => {
  if (logicalRuleTypes.includes(type)) return 'logical'
  if (rulesetRuleTypes.includes(type)) return 'ruleset'
  return 'standard'
}

export const getDefaultRuleForm = (
  kind: RuleDialogKind,
  policy: string,
): RuleForm => ({
  type: getTypeOptions(kind)[0],
  value: '',
  policy,
  noResolve: false,
})

export const isGeoipRule = (type: string) =>
  type === 'GEOIP' || type === 'SRC-GEOIP'

export const normalizeRuleType = (type: string) => {
  const trimmedType = type.trim()
  return (
    runtimeRuleTypeMap[trimmedType] ??
    trimmedType.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toUpperCase()
  )
}

export const getRulePresetDialogState = (
  preset: RulePresetRouteState['rulePreset'],
  fallbackPolicy: string,
): RulePresetDialogState | null => {
  const presetType = preset?.type?.trim()
  if (!preset || !presetType) return null

  const type = normalizeRuleType(presetType)
  const kind = getKindFromType(type)
  const form = getDefaultRuleForm(kind, fallbackPolicy)

  return {
    kind,
    form: {
      ...form,
      type,
      value: preset.value ?? form.value,
      policy: preset.policy?.trim() || form.policy,
      noResolve: Boolean(preset.noResolve),
    },
  }
}

export const createLogicalRuleItemId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`

export const createLogicalRuleItem = (
  type = 'DOMAIN',
  value = '',
): LogicalRuleItem => ({
  id: createLogicalRuleItemId(),
  type,
  value,
  noResolve: false,
})

const isWrappedByOuterParentheses = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return false

  let depth = 0
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index]
    if (char === '(') depth += 1
    if (char === ')') depth -= 1

    if (depth < 0) return false
    if (depth === 0 && index < trimmed.length - 1) return false
  }

  return depth === 0
}

const stripOuterParentheses = (value: string) => {
  const trimmed = value.trim()
  return isWrappedByOuterParentheses(trimmed)
    ? trimmed.slice(1, -1).trim()
    : trimmed
}

const splitExpressionParts = (raw: string) => {
  const parts: string[] = []
  let depth = 0
  let start = 0

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]

    if (char === '(') depth += 1
    if (char === ')') depth = Math.max(0, depth - 1)

    if (char === ',' && depth === 0) {
      parts.push(raw.slice(start, index).trim())
      start = index + 1
    }
  }

  parts.push(raw.slice(start).trim())

  return parts.filter(Boolean)
}

const splitLogicalRuleItems = (value: string) => {
  const inner = stripOuterParentheses(value)
  if (!inner) return []
  if (!inner.includes('(')) return [inner]

  return splitExpressionParts(inner).map(stripOuterParentheses).filter(Boolean)
}

const splitLogicalExpressionItems = (type: string, value: string) => {
  const normalizedType = type.trim().toUpperCase()
  let inner = stripOuterParentheses(value)

  if (normalizedType === 'NOT') {
    if (inner.startsWith('!')) inner = inner.slice(1).trim()
    return inner ? [stripOuterParentheses(inner)] : []
  }

  const operator =
    normalizedType === 'AND' ? '&&' : normalizedType === 'OR' ? '||' : ''
  if (!operator || !inner.includes(operator)) return []

  const items: string[] = []
  let depth = 0
  let start = 0

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index]

    if (char === '(') depth += 1
    if (char === ')') depth = Math.max(0, depth - 1)

    if (
      depth === 0 &&
      inner.slice(index, index + operator.length) === operator
    ) {
      items.push(stripOuterParentheses(inner.slice(start, index).trim()))
      start = index + operator.length
      index += operator.length - 1
    }
  }

  items.push(stripOuterParentheses(inner.slice(start).trim()))

  return items.filter(Boolean)
}

const getLogicalExpressionType = (raw: string) => {
  const inner = stripOuterParentheses(raw)
  if (inner.startsWith('!')) return 'NOT'

  let depth = 0
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index]

    if (char === '(') depth += 1
    if (char === ')') depth = Math.max(0, depth - 1)

    if (depth === 0) {
      if (inner.slice(index, index + 2) === '&&') return 'AND'
      if (inner.slice(index, index + 2) === '||') return 'OR'
    }
  }

  return ''
}

const parseLogicalRuleItemRaw = (raw: string): LogicalRuleItem | null => {
  const parts = splitExpressionParts(raw)
  const candidateType = normalizeRuleType(parts[0] ?? '')
  const hasExplicitRuleType =
    parts.length > 1 &&
    (standardRuleTypes.includes(candidateType) ||
      logicalRuleTypes.includes(candidateType) ||
      rulesetRuleTypes.includes(candidateType))

  const expressionType = hasExplicitRuleType
    ? ''
    : getLogicalExpressionType(raw)
  if (expressionType) {
    return {
      id: createLogicalRuleItemId(),
      type: expressionType,
      value: normalizeLogicalRuleValue(expressionType, raw),
      noResolve: false,
    }
  }

  const type = normalizeRuleType(parts.shift() ?? '')
  const noResolve = parts.at(-1)?.toLowerCase() === 'no-resolve'

  if (noResolve) parts.pop()
  if (!type) return null

  return {
    id: createLogicalRuleItemId(),
    type,
    value: parts.join(','),
    noResolve: noResolve && noResolveRuleTypes.has(type),
  }
}

export const parseLogicalRuleItems = (typeOrValue: string, value?: string) => {
  const type = value === undefined ? '' : typeOrValue
  const rawValue = value ?? typeOrValue
  const expressionItems = type
    ? splitLogicalExpressionItems(type, rawValue)
    : []
  const items = (
    expressionItems.length > 0
      ? expressionItems
      : splitLogicalRuleItems(rawValue)
  )
    .map(parseLogicalRuleItemRaw)
    .filter((item): item is LogicalRuleItem => Boolean(item))

  return items.length > 0 ? items : [createLogicalRuleItem()]
}

export const isLogicalRuleItemComplete = (item: LogicalRuleItem) => {
  const type = item.type.trim().toUpperCase()
  if (!type) return false

  return item.value.trim().length > 0
}

export const buildLogicalRuleItemRaw = (item: LogicalRuleItem): string => {
  const type = item.type.trim().toUpperCase()
  const value = normalizeRuleValue(type, item.value)
  const base = value ? `${type},${value}` : type

  return item.noResolve && noResolveRuleTypes.has(type)
    ? `${base},no-resolve`
    : base
}

export const buildLogicalRuleValue = (items: LogicalRuleItem[]): string => {
  const subrules = items
    .filter(isLogicalRuleItemComplete)
    .map((item) => `(${buildLogicalRuleItemRaw(item)})`)

  return subrules.length > 0 ? `(${subrules.join(',')})` : ''
}

export const normalizeLogicalRuleValue = (
  type: string,
  value: string,
): string => {
  const itemRaws = splitLogicalExpressionItems(type, value)
  const items = (itemRaws.length > 0 ? itemRaws : splitLogicalRuleItems(value))
    .map(parseLogicalRuleItemRaw)
    .filter((item): item is LogicalRuleItem => Boolean(item))

  if (items.length === 0) return value.trim()

  return buildLogicalRuleValue(items) || value.trim()
}
