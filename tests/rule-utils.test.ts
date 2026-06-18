import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applySelectionOverride } from '../src/hooks/use-runtime-proxy-groups.ts'
import {
  normalizeManualGroupDocument,
  normalizeManualProxyDocument,
} from '../src/utils/manual-policy-normalize.ts'
import {
  ensurePolicyId,
  getPolicyId,
  stripPolicyMetadata,
  withNewPolicyId,
} from '../src/utils/policy-metadata.ts'
import { renameProfileSelectedPolicyReferences } from '../src/utils/profile-selection.ts'
import {
  addRuleOverlayReplacement,
  buildEffectivePolicyOptions,
  buildEffectiveRuleRows,
  buildLogicalRuleValue,
  buildRuleRaw,
  dumpManualRules,
  getProfileRuleRaws,
  getRawRuleIdentitySignature,
  getRulePresetDialogState,
  isEffectiveFallbackRuleRow,
  isEffectiveManualRuleRow,
  isEffectiveOverlayDeleteRuleRow,
  normalizeManualRules,
  normalizeLogicalRuleValue,
  parseLogicalRuleItems,
  renamePolicyInManualRules,
  renameRulePolicyRaw,
  runtimeRuleToRaw,
  sanitizeManualRules,
  shouldShowEffectiveRuleRow,
} from '../src/utils/rule-utils.ts'
import {
  createStableIdentityOrderState,
  stabilizeIdentityOrder,
} from '../src/utils/stable-identity-order.ts'

test('creates, preserves, clones, and strips policy metadata ids', () => {
  const proxy = { name: 'hz-home', type: 'ss' }
  const withId = ensurePolicyId(proxy)
  const id = getPolicyId(withId)

  assert.ok(id)
  assert.equal(getPolicyId(ensurePolicyId(withId)), id)

  const duplicated = withNewPolicyId(withId)
  assert.ok(getPolicyId(duplicated))
  assert.notEqual(getPolicyId(duplicated), id)

  assert.deepEqual(stripPolicyMetadata(withId), proxy)
  assert.deepEqual(
    stripPolicyMetadata({ ...proxy, 'x-verge-id': '   ' }),
    proxy,
  )
})

test('renames persisted selected policy references without dropping selections', () => {
  const selected = [
    { name: 'Japan', now: 'old-proxy' },
    { name: 'old-group', now: 'DIRECT' },
    { name: 'SGP', now: 'old-group' },
  ]

  assert.deepEqual(
    renameProfileSelectedPolicyReferences(selected, 'old-proxy', 'new-proxy'),
    {
      selected: [
        { name: 'Japan', now: 'new-proxy' },
        { name: 'old-group', now: 'DIRECT' },
        { name: 'SGP', now: 'old-group' },
      ],
      changed: true,
    },
  )

  assert.deepEqual(
    renameProfileSelectedPolicyReferences(selected, 'old-group', 'new-group', {
      renameGroupName: true,
    }),
    {
      selected: [
        { name: 'Japan', now: 'old-proxy' },
        { name: 'new-group', now: 'DIRECT' },
        { name: 'SGP', now: 'new-group' },
      ],
      changed: true,
    },
  )
})

test('migrates stable identity order in place and prunes stale keys', () => {
  const state = createStableIdentityOrderState()
  const identityMap: Record<string, string> = {}
  const getIdentity = (item: { name: string }) =>
    identityMap[item.name] ?? `runtime:${item.name}`

  assert.deepEqual(
    stabilizeIdentityOrder(
      [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      state,
      getIdentity,
    ).map((item) => item.name),
    ['a', 'b', 'c'],
  )

  identityMap.b = 'manual:b'
  assert.deepEqual(
    stabilizeIdentityOrder(
      [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      state,
      getIdentity,
    ).map((item) => item.name),
    ['a', 'b', 'c'],
  )
  assert.deepEqual(state.order, ['runtime:a', 'manual:b', 'runtime:c'])

  assert.deepEqual(
    stabilizeIdentityOrder(
      [{ name: 'b' }, { name: 'c' }],
      state,
      getIdentity,
    ).map((item) => item.name),
    ['b', 'c'],
  )
  assert.deepEqual(state.order, ['manual:b', 'runtime:c'])
})

test('applies proxy group selection overrides without mutating unchanged groups', () => {
  const group = { name: 'Japan', now: 'aws-jp', all: ['aws-jp', 'hz-jp'] }

  const overridden = applySelectionOverride(group, { Japan: 'aws-jp1' })

  assert.notEqual(overridden, group)
  assert.deepEqual(overridden, {
    name: 'Japan',
    now: 'aws-jp1',
    all: ['aws-jp', 'hz-jp'],
  })
  assert.equal(group.now, 'aws-jp')
  assert.equal(applySelectionOverride(group, { Japan: 'aws-jp' }), group)
  assert.equal(applySelectionOverride(group, { SGP: 'aws-sg' }), group)
})

test('builds canonical logical rule values from structured sub-rules', () => {
  assert.equal(
    buildLogicalRuleValue([
      { id: 'a', type: 'DOMAIN', value: 'example.com', noResolve: false },
      { id: 'b', type: 'NETWORK', value: 'udp', noResolve: false },
      { id: 'c', type: 'IP-CIDR', value: '1.1.1.1/32', noResolve: true },
    ]),
    '((DOMAIN,example.com),(NETWORK,UDP),(IP-CIDR,1.1.1.1/32,no-resolve))',
  )
})

test('normalizes runtime logical expression syntax into stored logical values', () => {
  assert.equal(
    normalizeLogicalRuleValue(
      'AND',
      '((Network,udp) && (ProcessPath,/Applications/Foo.app/Contents/MacOS/foo))',
    ),
    '((NETWORK,UDP),(PROCESS-PATH,/Applications/Foo.app/Contents/MacOS/foo))',
  )

  assert.equal(
    normalizeLogicalRuleValue('NOT', '!(Domain,example.com)'),
    '((DOMAIN,example.com))',
  )
})

test('parses editor logical payloads with the selected outer operator', () => {
  const andItems = parseLogicalRuleItems(
    'AND',
    '((Network,udp) && (ProcessPath,/tmp/app))',
  )

  assert.equal(andItems.length, 2)
  assert.equal(andItems[0].type, 'NETWORK')
  assert.equal(andItems[1].type, 'PROCESS-PATH')
  assert.equal(
    buildLogicalRuleValue(andItems),
    '((NETWORK,UDP),(PROCESS-PATH,/tmp/app))',
  )

  const notItems = parseLogicalRuleItems('NOT', '!(Domain,example.com)')

  assert.equal(notItems.length, 1)
  assert.equal(notItems[0].type, 'DOMAIN')
  assert.equal(buildLogicalRuleValue(notItems), '((DOMAIN,example.com))')
})

test('parses and rebuilds nested logical sub-rules without requiring raw input', () => {
  const raw =
    '((OR,((DOMAIN-KEYWORD,google),(DOMAIN-SUFFIX,example.com))),(NETWORK,udp))'
  const items = parseLogicalRuleItems(raw)

  assert.equal(items.length, 2)
  assert.equal(items[0].type, 'OR')
  assert.equal(
    items[0].value,
    '((DOMAIN-KEYWORD,google),(DOMAIN-SUFFIX,example.com))',
  )
  assert.equal(buildLogicalRuleValue(items), raw.replace('udp', 'UDP'))
})

test('keeps no-resolve only on supported logical sub-rule types', () => {
  const items = parseLogicalRuleItems(
    '((IP-CIDR,1.1.1.1/32,no-resolve),(DOMAIN,example.com,no-resolve))',
  )

  assert.equal(items[0].noResolve, true)
  assert.equal(items[1].noResolve, false)
  assert.equal(
    buildLogicalRuleValue(items),
    '((IP-CIDR,1.1.1.1/32,no-resolve),(DOMAIN,example.com))',
  )
})

test('deduplicates manual rules across canonical and runtime logical forms', () => {
  const sanitized = sanitizeManualRules({
    prepend: [
      {
        raw: 'AND,((NETWORK,UDP),(PROCESS-PATH,/tmp/app)),DIRECT',
        enabled: true,
      },
    ],
    append: [
      {
        raw: 'AND,((Network,udp) && (ProcessPath,/tmp/app)),DIRECT',
        enabled: true,
      },
    ],
    delete: [],
  })

  assert.deepEqual(sanitized, {
    prepend: [
      {
        raw: 'AND,((NETWORK,UDP),(PROCESS-PATH,/tmp/app)),DIRECT',
        enabled: true,
      },
    ],
    append: [],
    delete: [],
  })
  assert.equal(
    getRawRuleIdentitySignature(
      'AND,((Network,udp) && (ProcessPath,/tmp/app)),DIRECT',
    ),
    getRawRuleIdentitySignature(
      'AND,((NETWORK,UDP),(PROCESS-PATH,/tmp/app)),DIRECT',
    ),
  )
})

test('preserves disabled manual rule state through sanitize and dump', () => {
  const document = normalizeManualRules(`
prepend:
  - DOMAIN,enabled.example,DIRECT
  - rule: DOMAIN,disabled.example,DIRECT
    enabled: false
append:
  - raw: GEOIP,CN,DIRECT,no-resolve
    enabled: true
delete:
  - MATCH,GLOBAL
`)
  const sanitized = sanitizeManualRules(document)

  assert.deepEqual(sanitized, {
    prepend: [
      { raw: 'DOMAIN,enabled.example,DIRECT', enabled: true },
      { raw: 'DOMAIN,disabled.example,DIRECT', enabled: false },
    ],
    append: [{ raw: 'GEOIP,CN,DIRECT,no-resolve', enabled: true }],
    delete: ['MATCH,GLOBAL', 'DOMAIN,disabled.example,DIRECT'],
  })
  assert.deepEqual(normalizeManualRules(dumpManualRules(sanitized)), sanitized)
})

test('prefers enabled duplicate manual rules over disabled copies', () => {
  const sanitized = sanitizeManualRules({
    prepend: [{ raw: 'DOMAIN,example.com,DIRECT', enabled: false }],
    append: [{ raw: 'DOMAIN,example.com,DIRECT', enabled: true }],
    delete: [],
  })

  assert.deepEqual(sanitized, {
    prepend: [{ raw: 'DOMAIN,example.com,DIRECT', enabled: true }],
    append: [],
    delete: [],
  })
})

test('normalizes routed rule presets before opening the editor', () => {
  assert.deepEqual(
    getRulePresetDialogState(
      {
        type: 'ProcessPath',
        value: '/Applications/Foo.app/Contents/MacOS/foo',
      },
      'DIRECT',
    ),
    {
      kind: 'standard',
      form: {
        type: 'PROCESS-PATH',
        value: '/Applications/Foo.app/Contents/MacOS/foo',
        policy: 'DIRECT',
        noResolve: false,
      },
    },
  )
})

test('builds rule rows from editor forms and runtime rules consistently', () => {
  assert.equal(
    buildRuleRaw({
      type: 'NETWORK',
      value: 'udp',
      policy: 'DIRECT',
      noResolve: true,
    }),
    'NETWORK,UDP,DIRECT',
  )
  assert.equal(
    runtimeRuleToRaw({
      type: 'ProcessPath',
      payload: '/Applications/Foo.app/Contents/MacOS/foo',
      proxy: 'DIRECT',
    }),
    'PROCESS-PATH,/Applications/Foo.app/Contents/MacOS/foo,DIRECT',
  )
})

test('renames only the policy portion of manual rule raws', () => {
  assert.equal(
    renameRulePolicyRaw(
      'PROCESS-PATH,/Applications/hz-home.app/Contents/MacOS/hz-home,hz-home',
      'hz-home',
      'hz-office',
    ),
    'PROCESS-PATH,/Applications/hz-home.app/Contents/MacOS/hz-home,hz-office',
  )
})

test('renames manual rule policies and overlays runtime rule replacements', () => {
  const renamed = renamePolicyInManualRules(
    {
      prepend: [
        {
          raw: 'DOMAIN,manual.example,hz-home',
          enabled: true,
        },
      ],
      append: [],
      delete: [],
    },
    'hz-home',
    'hz-office',
    [
      {
        type: 'ProcessPath',
        payload: '/Applications/hz-home.app/Contents/MacOS/hz-home',
        proxy: 'hz-home',
      },
    ],
  )

  assert.deepEqual(renamed.prepend, [
    {
      raw: 'PROCESS-PATH,/Applications/hz-home.app/Contents/MacOS/hz-home,hz-office',
      enabled: true,
    },
    {
      raw: 'DOMAIN,manual.example,hz-office',
      enabled: true,
    },
  ])
  assert.deepEqual(renamed.append, [])
  assert.deepEqual(renamed.delete, [
    'PROCESS-PATH,/Applications/hz-home.app/Contents/MacOS/hz-home,hz-home',
    'PROCESS-PATH,/Applications/hz-home.app/Contents/MacOS/hz-home,hz-office',
  ])
})

test('deletes duplicate base rules when a matching manual rule is renamed', () => {
  const renamed = renamePolicyInManualRules(
    {
      prepend: [],
      append: [
        {
          raw: 'DOMAIN,manual.example,hz-home',
          enabled: true,
        },
      ],
      delete: [],
    },
    'hz-home',
    'hz-office',
    [
      {
        type: 'Domain',
        payload: 'manual.example',
        proxy: 'hz-home',
      },
    ],
  )

  assert.deepEqual(renamed.prepend, [])
  assert.deepEqual(renamed.append, [
    {
      raw: 'DOMAIN,manual.example,hz-office',
      enabled: true,
    },
  ])
  assert.deepEqual(renamed.delete, ['DOMAIN,manual.example,hz-home'])
})

test('builds source-aware effective rule rows without changing row ordering', () => {
  const rows = buildEffectiveRuleRows({
    manualRules: {
      prepend: [{ raw: 'DOMAIN,manual.test,DIRECT', enabled: true }],
      append: [{ raw: 'MATCH,GLOBAL', enabled: true }],
      delete: ['DOMAIN,deleted.test,DIRECT'],
    },
    runtimeRules: [
      { type: 'Domain', payload: 'deleted.test', proxy: 'DIRECT' },
      { type: 'Domain', payload: 'runtime.test', proxy: 'DIRECT' },
      { type: 'Match', proxy: 'GLOBAL' },
    ],
  })

  assert.deepEqual(
    rows.map((row) => [row.source, row.raw, row.enabled, row.effectiveIndex]),
    [
      ['manual', 'DOMAIN,manual.test,DIRECT', true, 0],
      ['overlay-delete', 'DOMAIN,deleted.test,DIRECT', false, 1],
      ['runtime', 'DOMAIN,runtime.test,DIRECT', true, 2],
      ['manual', 'MATCH,GLOBAL', true, 3],
    ],
  )

  assert.equal(isEffectiveManualRuleRow(rows[0]), true)
  assert.equal(isEffectiveManualRuleRow(rows[1]), false)
  assert.equal(rows[0].manualSection, 'prepend')
  assert.equal(rows[3].manualSection, 'append')
  assert.equal(rows[1].writeTarget, 'rules-delete')
  assert.equal(isEffectiveFallbackRuleRow(rows[3]), true)
  assert.equal(rows[3].locked, true)
  assert.equal(rows[3].deletable, false)
  assert.equal(rows[3].canToggle, false)
})

test('extracts base profile rules for effective rows', () => {
  assert.deepEqual(
    getProfileRuleRaws(`
rules:
  - DOMAIN,base.example,DIRECT
  - rule: DOMAIN,object-rule.example,proxy-default
    enabled: false
  - raw: MATCH,GLOBAL
  - value: DOMAIN,value-rule.example,DIRECT
  - invalid: true
`),
    [
      'DOMAIN,base.example,DIRECT',
      'DOMAIN,object-rule.example,proxy-default',
      'MATCH,GLOBAL',
      'DOMAIN,value-rule.example,DIRECT',
    ],
  )

  assert.deepEqual(getProfileRuleRaws('rules: [unterminated'), [])
  assert.deepEqual(getProfileRuleRaws(undefined), [])
})

test('hides pending runtime rows while keeping disabled overlay rows visible', () => {
  const suppressedSignature = getRawRuleIdentitySignature(
    'DOMAIN,suppressed.test,DIRECT',
  )
  const rows = buildEffectiveRuleRows({
    manualRules: {
      prepend: [{ raw: 'DOMAIN,manual.test,DIRECT', enabled: false }],
      append: [],
      delete: ['DOMAIN,manual.test,DIRECT', 'DOMAIN,deleted.test,DIRECT'],
    },
    runtimeRules: [
      { type: 'Domain', payload: 'manual.test', proxy: 'DIRECT' },
      { type: 'Domain', payload: 'deleted.test', proxy: 'DIRECT' },
      { type: 'Domain', payload: 'suppressed.test', proxy: 'DIRECT' },
      { type: 'Domain', payload: 'visible.test', proxy: 'DIRECT' },
    ],
    pendingRuntimeSuppressedSignatures: new Set([suppressedSignature]),
  })

  assert.deepEqual(
    rows.map((row) => [row.source, row.raw, row.enabled]),
    [
      ['manual', 'DOMAIN,manual.test,DIRECT', false],
      ['overlay-delete', 'DOMAIN,deleted.test,DIRECT', false],
      ['runtime', 'DOMAIN,visible.test,DIRECT', true],
    ],
  )
})

test('filters disabled config rows from the default visible rule list', () => {
  const rows = buildEffectiveRuleRows({
    manualRules: {
      prepend: [{ raw: 'DOMAIN,manual.test,DIRECT', enabled: true }],
      append: [{ raw: 'MATCH,proxy-default', enabled: true }],
      delete: ['MATCH,GLOBAL'],
    },
    runtimeRules: [{ type: 'Match', proxy: 'GLOBAL' }],
  })

  assert.deepEqual(
    rows.map((row) => [row.source, row.raw, row.enabled]),
    [
      ['manual', 'DOMAIN,manual.test,DIRECT', true],
      ['overlay-delete', 'MATCH,GLOBAL', false],
      ['manual', 'MATCH,proxy-default', true],
    ],
  )
  assert.equal(isEffectiveOverlayDeleteRuleRow(rows[1]), true)

  assert.deepEqual(
    rows
      .filter((row) => shouldShowEffectiveRuleRow(row))
      .map((row) => [row.source, row.raw]),
    [
      ['manual', 'DOMAIN,manual.test,DIRECT'],
      ['manual', 'MATCH,proxy-default'],
    ],
  )
  assert.deepEqual(
    rows
      .filter((row) =>
        shouldShowEffectiveRuleRow(row, { showDisabledConfigRules: true }),
      )
      .map((row) => [row.source, row.raw]),
    [
      ['manual', 'DOMAIN,manual.test,DIRECT'],
      ['overlay-delete', 'MATCH,GLOBAL'],
      ['manual', 'MATCH,proxy-default'],
    ],
  )
})

test('config rule replacement writes delete marker and local replacement', () => {
  const manualRules = {
    prepend: [],
    append: [],
    delete: [],
  }

  addRuleOverlayReplacement(
    manualRules,
    'DOMAIN,base.test,DIRECT',
    'DOMAIN,base.test,proxy-default',
  )

  assert.deepEqual(manualRules, {
    prepend: [
      {
        raw: 'DOMAIN,base.test,proxy-default',
        enabled: true,
      },
    ],
    append: [],
    delete: ['DOMAIN,base.test,DIRECT', 'DOMAIN,base.test,proxy-default'],
  })

  const rows = buildEffectiveRuleRows({
    manualRules: sanitizeManualRules(manualRules),
    baseRules: ['DOMAIN,base.test,DIRECT'],
    runtimeRules: [{ type: 'Domain', payload: 'base.test', proxy: 'DIRECT' }],
  })

  assert.deepEqual(
    rows
      .filter((row) => shouldShowEffectiveRuleRow(row))
      .map((row) => [row.source, row.raw]),
    [['manual', 'DOMAIN,base.test,proxy-default']],
  )
  assert.deepEqual(
    rows
      .filter((row) =>
        shouldShowEffectiveRuleRow(row, { showDisabledConfigRules: true }),
      )
      .map((row) => [row.source, row.raw]),
    [
      ['manual', 'DOMAIN,base.test,proxy-default'],
      ['overlay-delete', 'DOMAIN,base.test,DIRECT'],
    ],
  )
})

test('config rule replacement suppresses matching base replacement rows', () => {
  const manualRules = {
    prepend: [],
    append: [],
    delete: [],
  }

  addRuleOverlayReplacement(
    manualRules,
    'DOMAIN,old.test,DIRECT',
    'DOMAIN,existing.test,DIRECT',
  )
  assert.deepEqual(manualRules.delete, [
    'DOMAIN,old.test,DIRECT',
    'DOMAIN,existing.test,DIRECT',
  ])

  const rows = buildEffectiveRuleRows({
    manualRules: sanitizeManualRules(manualRules),
    baseRules: ['DOMAIN,old.test,DIRECT', 'DOMAIN,existing.test,DIRECT'],
    runtimeRules: [],
  })

  assert.deepEqual(
    rows
      .filter((row) => shouldShowEffectiveRuleRow(row))
      .map((row) => [row.source, row.raw]),
    [['manual', 'DOMAIN,existing.test,DIRECT']],
  )
  assert.deepEqual(
    rows
      .filter((row) =>
        shouldShowEffectiveRuleRow(row, { showDisabledConfigRules: true }),
      )
      .map((row) => [row.source, row.raw]),
    [
      ['manual', 'DOMAIN,existing.test,DIRECT'],
      ['overlay-delete', 'DOMAIN,old.test,DIRECT'],
    ],
  )
})

test('uses base rules as source-aware rows before runtime fallback rows', () => {
  const rows = buildEffectiveRuleRows({
    manualRules: {
      prepend: [],
      append: [{ raw: 'MATCH,GLOBAL', enabled: true }],
      delete: ['DOMAIN,deleted-base.test,DIRECT'],
    },
    baseRules: [
      'DOMAIN,base.test,DIRECT',
      'DOMAIN,deleted-base.test,DIRECT',
      'DOMAIN,manual-shadowed.test,DIRECT',
    ],
    runtimeRules: [
      { type: 'Domain', payload: 'base.test', proxy: 'DIRECT' },
      { type: 'Domain', payload: 'runtime-only.test', proxy: 'DIRECT' },
      { type: 'Domain', payload: 'manual-shadowed.test', proxy: 'DIRECT' },
      { type: 'Match', proxy: 'GLOBAL' },
    ],
  })

  assert.deepEqual(
    rows.map((row) => [row.source, row.raw, row.baseIndex, row.effectiveIndex]),
    [
      ['overlay-delete', 'DOMAIN,deleted-base.test,DIRECT', undefined, 0],
      ['base', 'DOMAIN,base.test,DIRECT', 0, 1],
      ['base', 'DOMAIN,manual-shadowed.test,DIRECT', 2, 2],
      ['runtime', 'DOMAIN,runtime-only.test,DIRECT', undefined, 3],
      ['manual', 'MATCH,GLOBAL', undefined, 4],
    ],
  )
})

test('marks only the final active MATCH rule as the fallback row', () => {
  const rows = buildEffectiveRuleRows({
    manualRules: {
      prepend: [{ raw: 'DOMAIN,manual.test,DIRECT', enabled: true }],
      append: [{ raw: 'MATCH,proxy-default', enabled: true }],
      delete: ['MATCH,GLOBAL'],
    },
    runtimeRules: [
      { type: 'Match', proxy: 'GLOBAL' },
      { type: 'Domain', payload: 'runtime.test', proxy: 'DIRECT' },
    ],
  })

  assert.deepEqual(
    rows.map((row) => [row.source, row.raw, row.enabled]),
    [
      ['manual', 'DOMAIN,manual.test,DIRECT', true],
      ['overlay-delete', 'MATCH,GLOBAL', false],
      ['runtime', 'DOMAIN,runtime.test,DIRECT', true],
      ['manual', 'MATCH,proxy-default', true],
    ],
  )

  const fallbackRows = rows.filter(isEffectiveFallbackRuleRow)
  assert.equal(fallbackRows.length, 1)
  assert.equal(fallbackRows[0].raw, 'MATCH,proxy-default')
  assert.equal(fallbackRows[0].writeTarget, 'rules-fallback')
  assert.equal(fallbackRows[0].canChangePolicy, true)
})

test('does not lock non-fallback config rules', () => {
  const rows = buildEffectiveRuleRows({
    manualRules: emptyManualRulesForTest(),
    runtimeRules: [
      { type: 'Domain', payload: 'runtime.test', proxy: 'DIRECT' },
      { type: 'Match', proxy: 'GLOBAL' },
    ],
  })

  assert.equal(rows[0].raw, 'DOMAIN,runtime.test,DIRECT')
  assert.equal(rows[0].locked, false)
  assert.equal(rows[0].deletable, true)
  assert.equal(rows[0].canToggle, true)
  assert.equal(rows[0].writeTarget, 'rules-delete')

  assert.equal(rows[1].raw, 'MATCH,GLOBAL')
  assert.equal(isEffectiveFallbackRuleRow(rows[1]), true)
})

const emptyManualRulesForTest = () => ({
  prepend: [],
  append: [],
  delete: [],
})

test('builds effective policy options from base, overlay, and runtime sources', () => {
  const manualProxies = normalizeManualProxyDocument(`
prepend:
  - stray-proxy-name
  - type: ss
  - name: manual-proxy
    type: ss
append: []
delete:
  - base-proxy
`)
  const manualGroups = normalizeManualGroupDocument(`
prepend:
  - stray-group-name
  - type: select
  - name: proxy-default
    type: select
    proxies:
      - manual-proxy
append: []
delete:
  - base-deleted-group
`)
  const options = buildEffectivePolicyOptions({
    builtinPolicies: ['DIRECT', 'REJECT'],
    baseProfileData: `
proxies:
  - name: base-proxy
    type: ss
  - name: base-kept-proxy
    type: ss
proxy-groups:
  - name: base-deleted-group
    type: select
  - name: base-kept-group
    type: select
`,
    manualProxies,
    manualGroups,
    runtimeProxyNames: ['base-proxy', 'runtime-proxy'],
    runtimeGroupNames: ['base-deleted-group', 'GLOBAL', 'runtime-group'],
  })

  assert.deepEqual(
    options.map((option) => [option.name, option.source, option.type]),
    [
      ['DIRECT', 'builtin', 'builtin'],
      ['REJECT', 'builtin', 'builtin'],
      ['base-kept-proxy', 'base', 'proxy'],
      ['base-kept-group', 'base', 'group'],
      ['manual-proxy', 'manual', 'proxy'],
      ['proxy-default', 'manual', 'group'],
      ['runtime-proxy', 'runtime', 'proxy'],
      ['GLOBAL', 'runtime', 'group'],
      ['runtime-group', 'runtime', 'group'],
    ],
  )
})

test('deduplicates policy options while preferring earlier effective sources', () => {
  const options = buildEffectivePolicyOptions({
    builtinPolicies: ['DIRECT'],
    baseProfileData: `
proxies:
  - name: duplicated
    type: ss
proxy-groups:
  - name: duplicated-group
    type: select
`,
    manualProxies: normalizeManualProxyDocument(`
prepend:
  - name: duplicated
    type: ss
append: []
delete: []
`),
    manualGroups: normalizeManualGroupDocument(`
prepend:
  - name: duplicated-group
    type: select
append: []
delete: []
`),
    runtimeProxyNames: ['duplicated'],
    runtimeGroupNames: ['duplicated-group'],
  })

  assert.deepEqual(
    options.map((option) => [option.name, option.source, option.type]),
    [
      ['DIRECT', 'builtin', 'builtin'],
      ['duplicated', 'base', 'proxy'],
      ['duplicated-group', 'base', 'group'],
    ],
  )
})
