export type EffectiveSource =
  | 'base'
  | 'manual'
  | 'provider'
  | 'generated'
  | 'runtime'
  | 'overlay-delete'

export type EffectiveWriteTarget =
  | 'rules-prepend'
  | 'rules-append'
  | 'rules-delete'
  | 'rules-fallback'
  | 'proxies-overlay'
  | 'groups-overlay'
  | 'none'

export type EffectiveManualRuleSection = 'prepend' | 'append'

export type EffectivePolicySource =
  | 'builtin'
  | 'base'
  | 'manual'
  | 'provider'
  | 'runtime'

export type EffectivePolicyType = 'proxy' | 'group' | 'builtin'

export interface EffectiveRuleRow {
  id: string
  raw: string
  type: string
  value: string
  policy: string
  noResolve: boolean
  enabled: boolean
  source: EffectiveSource
  effectiveIndex: number
  searchText: string
  origin?: string
  baseRaw?: string
  baseIndex?: number
  manualIndex?: number
  manualSection?: EffectiveManualRuleSection
  locked: boolean
  editable: boolean
  deletable: boolean
  canToggle: boolean
  canChangePolicy: boolean
  writeTarget: EffectiveWriteTarget
}

export interface EffectivePolicyOption {
  name: string
  source: EffectivePolicySource
  type: EffectivePolicyType
  available: boolean
}

export interface EffectiveProfile {
  rules: EffectiveRuleRow[]
  policyOptions: EffectivePolicyOption[]
}
