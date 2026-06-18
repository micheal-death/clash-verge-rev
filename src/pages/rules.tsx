import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AddRounded,
  BlockRounded,
  ContentCopyRounded,
  DeleteRounded,
  DragIndicatorRounded,
  EditRounded,
  PlaylistAddRounded,
  RestoreRounded,
} from '@mui/icons-material'
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  ListSubheader,
  ListItemIcon,
  Menu,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useLockFn } from 'ahooks'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type UIEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'

import {
  BaseEmpty,
  BasePage,
  BaseSearchBox,
  type SearchState,
} from '@/components/base'
import { ScrollTopButton } from '@/components/layout/scroll-top-button'
import { ProviderButton } from '@/components/rule/provider-button'
import { useProfiles } from '@/hooks/use-profiles'
import { useVisibility } from '@/hooks/use-visibility'
import {
  useAppRefreshers,
  useProxiesData,
  useRulesData,
} from '@/providers/app-data-context'
import {
  ensureProfileProxies,
  enhanceProfiles,
  readProfileFile,
  saveProfileFile,
} from '@/services/cmds'
import { showNotice } from '@/services/notice-service'
import type { EffectiveRuleRow } from '@/types/effective-profile'
import {
  normalizeManualGroupDocument,
  normalizeManualProxyDocument,
  type ManualGroupDocument,
  type ManualProxyDocument,
} from '@/utils/manual-policy-docs'
import {
  addRuleDelete,
  addRuleOverlayReplacement,
  buildEffectiveRuleRows,
  buildEffectivePolicyOptions,
  buildLogicalRuleValue,
  buildRuleRaw,
  cloneManualRules,
  createManualRuleItem,
  createLogicalRuleItem,
  dumpManualRules,
  emptyManualRules,
  getDefaultRuleForm,
  getKindFromType,
  getProfileRuleRaws,
  getRawRuleIdentitySignature,
  getRuleIdentitySignature,
  getRulePresetDialogState,
  getTypeOptions,
  insertAt,
  isEffectiveFallbackRuleRow,
  isEffectiveConfigRuleRow,
  isEffectiveManualRuleRow,
  isEffectiveOverlayDeleteRuleRow,
  isEffectiveRuntimeRuleRow,
  isGeoipRule,
  isMatchRuleRaw,
  isLogicalRuleItemComplete,
  logicalRuleTypes,
  logicalSubruleTypes,
  networkRuleValues,
  noResolveRuleTypes,
  normalizeManualRules,
  parseLogicalRuleItems,
  removeAt,
  replaceAt,
  revealRuntimeRuleIfUnshadowed,
  ruleTypeExamples,
  sanitizeManualRules,
  shouldShowEffectiveRuleRow,
  type LogicalRuleItem,
  type ManualRulesDocument,
  type RuleDialogKind,
  type RuleForm,
  type RulePresetRouteState,
} from '@/utils/rule-utils'

type RuleDialogMode = 'add' | 'edit' | 'duplicate'

type ManagedRuleRow = EffectiveRuleRow

interface PolicyOptionGroup {
  key: 'builtin' | 'proxy' | 'group' | 'other'
  label: string
  options: string[]
}

interface PolicyLayerData {
  baseProfileData: string
  baseRules: string[]
  manualProxies: ManualProxyDocument
  manualGroups: ManualGroupDocument
}

const builtinProxyPolicies = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']

const geoipRegionCodes = [
  'CN',
  'HK',
  'MO',
  'TW',
  'US',
  'JP',
  'KR',
  'SG',
  'GB',
  'DE',
  'FR',
  'CA',
  'AU',
  'IN',
  'RU',
  'BR',
  'EU',
  'PRIVATE',
  'AD',
  'AE',
  'AF',
  'AG',
  'AI',
  'AL',
  'AM',
  'AO',
  'AQ',
  'AR',
  'AS',
  'AT',
  'AW',
  'AX',
  'AZ',
  'BA',
  'BB',
  'BD',
  'BE',
  'BF',
  'BG',
  'BH',
  'BI',
  'BJ',
  'BL',
  'BM',
  'BN',
  'BO',
  'BQ',
  'BS',
  'BT',
  'BV',
  'BW',
  'BY',
  'BZ',
  'CC',
  'CD',
  'CF',
  'CG',
  'CH',
  'CI',
  'CK',
  'CL',
  'CM',
  'CO',
  'CR',
  'CU',
  'CV',
  'CW',
  'CX',
  'CY',
  'CZ',
  'DJ',
  'DK',
  'DM',
  'DO',
  'DZ',
  'EC',
  'EE',
  'EG',
  'EH',
  'ER',
  'ES',
  'ET',
  'FI',
  'FJ',
  'FK',
  'FM',
  'FO',
  'GA',
  'GD',
  'GE',
  'GF',
  'GG',
  'GH',
  'GI',
  'GL',
  'GM',
  'GN',
  'GP',
  'GQ',
  'GR',
  'GS',
  'GT',
  'GU',
  'GW',
  'GY',
  'HM',
  'HN',
  'HR',
  'HT',
  'HU',
  'ID',
  'IE',
  'IL',
  'IM',
  'IO',
  'IQ',
  'IR',
  'IS',
  'IT',
  'JE',
  'JM',
  'JO',
  'KE',
  'KG',
  'KH',
  'KI',
  'KM',
  'KN',
  'KP',
  'KW',
  'KY',
  'KZ',
  'LA',
  'LB',
  'LC',
  'LI',
  'LK',
  'LR',
  'LS',
  'LT',
  'LU',
  'LV',
  'LY',
  'MA',
  'MC',
  'MD',
  'ME',
  'MF',
  'MG',
  'MH',
  'MK',
  'ML',
  'MM',
  'MN',
  'MP',
  'MQ',
  'MR',
  'MS',
  'MT',
  'MU',
  'MV',
  'MW',
  'MX',
  'MY',
  'MZ',
  'NA',
  'NC',
  'NE',
  'NF',
  'NG',
  'NI',
  'NL',
  'NO',
  'NP',
  'NR',
  'NU',
  'NZ',
  'OM',
  'PA',
  'PE',
  'PF',
  'PG',
  'PH',
  'PK',
  'PL',
  'PM',
  'PN',
  'PR',
  'PS',
  'PT',
  'PW',
  'PY',
  'QA',
  'RE',
  'RO',
  'RS',
  'RW',
  'SA',
  'SB',
  'SC',
  'SD',
  'SE',
  'SH',
  'SI',
  'SJ',
  'SK',
  'SL',
  'SM',
  'SN',
  'SO',
  'SR',
  'SS',
  'ST',
  'SV',
  'SX',
  'SY',
  'SZ',
  'TC',
  'TD',
  'TF',
  'TG',
  'TH',
  'TJ',
  'TK',
  'TL',
  'TM',
  'TN',
  'TO',
  'TR',
  'TT',
  'TV',
  'TZ',
  'UA',
  'UG',
  'UM',
  'UY',
  'UZ',
  'VA',
  'VC',
  'VE',
  'VG',
  'VI',
  'VN',
  'VU',
  'WF',
  'WS',
  'YE',
  'YT',
  'ZA',
  'ZM',
  'ZW',
]

const getGeoipRegionLabel = (code: string, language: string) => {
  const normalizedCode = code.toUpperCase()
  if (normalizedCode === 'PRIVATE') {
    return language.startsWith('zh')
      ? 'PRIVATE - 私有网络'
      : 'PRIVATE - Private network'
  }

  try {
    const DisplayNames = (Intl as any).DisplayNames
    if (!DisplayNames) return normalizedCode

    const regionName = new DisplayNames([language], {
      type: 'region',
    }).of(normalizedCode)

    return regionName ? `${normalizedCode} - ${regionName}` : normalizedCode
  } catch {
    return normalizedCode
  }
}

const emptyPolicyLayerData = (): PolicyLayerData => ({
  baseProfileData: '',
  baseRules: [],
  manualProxies: { prepend: [], append: [], delete: [] },
  manualGroups: { prepend: [], append: [], delete: [] },
})

const getRuntimePolicyName = (item: unknown, fallback?: string) => {
  if (item && typeof item === 'object' && 'name' in item) {
    const name = (item as { name?: unknown }).name
    if (typeof name === 'string' && name) return name
  }

  return fallback && !/^\d+$/.test(fallback) ? fallback : undefined
}

const ruleTableColumns =
  '40px 48px 64px minmax(132px, 180px) minmax(220px, 1fr) minmax(120px, 180px) 96px'

const keepNonFallbackManualRule = (item: { raw: string; enabled: boolean }) =>
  !item.enabled || !isMatchRuleRaw(item.raw)

const removeActiveManualFallbackRules = (document: ManualRulesDocument) => {
  document.prepend = document.prepend.filter(keepNonFallbackManualRule)
  document.append = document.append.filter(keepNonFallbackManualRule)
}

const RuleTableHeader = () => {
  const { t } = useTranslation()

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: ruleTableColumns,
        alignItems: 'center',
        px: 2,
        py: 1,
        borderTop: '1px solid var(--divider-color)',
        borderBottom: '1px solid var(--divider-color)',
        bgcolor: 'rgba(255,255,255,0.03)',
        color: 'text.secondary',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      <Box />
      <Box />
      <Box>{t('rules.page.table.id')}</Box>
      <Box>{t('rules.page.table.type')}</Box>
      <Box>{t('rules.page.table.value')}</Box>
      <Box>{t('rules.page.table.policy')}</Box>
      <Box>{t('rules.page.table.source')}</Box>
    </Box>
  )
}

interface RuleRowProps {
  row: ManagedRuleRow
  displayIndex: number
  selected: boolean
  dragDisabled: boolean
  onSelect: (row: ManagedRuleRow) => void
  onEdit: (row: ManagedRuleRow) => void
  onToggleEnabled: (row: ManagedRuleRow, enabled: boolean) => void
  onContextMenu: (event: MouseEvent<HTMLElement>, row: ManagedRuleRow) => void
}

const RuleTableRow = (props: RuleRowProps) => {
  const {
    row,
    displayIndex,
    selected,
    dragDisabled,
    onSelect,
    onContextMenu,
    onEdit,
    onToggleEnabled,
  } = props
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled: dragDisabled })
  const sourceLabel = isEffectiveOverlayDeleteRuleRow(row)
    ? t('rules.page.sources.disabledConfig')
    : isEffectiveConfigRuleRow(row)
      ? t('rules.page.sources.runtime')
      : t('rules.page.sources.manual')

  return (
    <Box
      ref={setNodeRef}
      onClick={() => onSelect(row)}
      onContextMenu={(event) => onContextMenu(event, row)}
      onDoubleClick={() => onEdit(row)}
      sx={{
        display: 'grid',
        gridTemplateColumns: ruleTableColumns,
        alignItems: 'center',
        minHeight: 44,
        px: 2,
        borderBottom: '1px solid var(--divider-color)',
        color: row.enabled ? 'text.primary' : 'text.disabled',
        cursor: 'pointer',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.72 : 1,
        zIndex: isDragging ? 1 : undefined,
        bgcolor: selected ? 'rgba(25,118,210,0.22)' : undefined,
        '&:nth-of-type(even)': {
          bgcolor: selected
            ? 'rgba(25,118,210,0.22)'
            : 'rgba(255,255,255,0.025)',
        },
        '&:hover': {
          bgcolor: selected ? 'rgba(25,118,210,0.28)' : 'rgba(25,118,210,0.14)',
        },
      }}
      title={row.raw}
    >
      <Box
        {...(dragDisabled ? {} : attributes)}
        {...(dragDisabled ? {} : listeners)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          color: dragDisabled ? 'text.disabled' : 'text.secondary',
          cursor: dragDisabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        }}
      >
        <DragIndicatorRounded fontSize="small" />
      </Box>
      <Checkbox
        size="small"
        checked={row.enabled}
        disabled={!row.canToggle}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onChange={(event) => onToggleEnabled(row, event.target.checked)}
        slotProps={{
          input: {
            'aria-label': row.enabled
              ? t('rules.page.table.disableRule')
              : t('rules.page.table.enableRule'),
          },
        }}
        sx={{ p: 0.5, justifySelf: 'flex-start' }}
      />
      <Typography
        color="text.secondary"
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {displayIndex + 1}
      </Typography>
      <Typography noWrap sx={{ fontWeight: 700 }}>
        {row.type || '-'}
      </Typography>
      <Typography noWrap sx={{ userSelect: 'text' }}>
        {row.value || '-'}
        {row.noResolve ? (
          <Typography
            component="span"
            color="text.secondary"
            sx={{ ml: 1, fontSize: 12 }}
          >
            no-resolve
          </Typography>
        ) : null}
      </Typography>
      <Typography
        noWrap
        color={
          !row.enabled
            ? 'text.disabled'
            : row.policy === 'REJECT'
              ? 'error.main'
              : 'text.primary'
        }
      >
        {row.policy || '-'}
      </Typography>
      <Typography noWrap color="text.secondary" sx={{ fontSize: 13 }}>
        {sourceLabel}
      </Typography>
    </Box>
  )
}

interface RuleEditorDialogProps {
  open: boolean
  mode: RuleDialogMode
  kind: RuleDialogKind
  form: RuleForm
  policyOptionGroups: PolicyOptionGroup[]
  providerOptions: string[]
  policyDisabled?: boolean
  typeDisabled?: boolean
  onClose: () => void
  onChange: (form: RuleForm) => void
  onSubmit: (form?: RuleForm) => void
}

const RuleEditorDialog = (props: RuleEditorDialogProps) => {
  const {
    open,
    mode,
    kind,
    form,
    policyOptionGroups,
    providerOptions,
    policyDisabled = false,
    typeDisabled = false,
    onClose,
    onChange,
    onSubmit,
  } = props
  const { t, i18n } = useTranslation()
  const typeOptions = getTypeOptions(kind)
  const policyOptions = useMemo(
    () => policyOptionGroups.flatMap((group) => group.options),
    [policyOptionGroups],
  )
  const selectablePolicies = useMemo(
    () => Array.from(new Set([...policyOptions, form.policy].filter(Boolean))),
    [form.policy, policyOptions],
  )
  const missingPolicyOptions = useMemo(
    () =>
      selectablePolicies.filter(
        (policy) =>
          !policyOptionGroups.some((group) => group.options.includes(policy)),
      ),
    [policyOptionGroups, selectablePolicies],
  )
  const selectablePolicyGroups = useMemo(() => {
    const groups = policyOptionGroups.filter(
      (group) => group.options.length > 0,
    )

    return missingPolicyOptions.length > 0
      ? [
          ...groups,
          {
            key: 'other' as const,
            label: t('rules.page.policyGroups.other'),
            options: missingPolicyOptions,
          },
        ]
      : groups
  }, [missingPolicyOptions, policyOptionGroups, t])
  const selectableProviders = useMemo(
    () => Array.from(new Set([...providerOptions, form.value].filter(Boolean))),
    [form.value, providerOptions],
  )
  const geoipRegionOptions = useMemo(
    () =>
      Array.from(new Set([...geoipRegionCodes, form.value.toUpperCase()]))
        .filter(Boolean)
        .map((code) => ({
          code,
          label: getGeoipRegionLabel(code, i18n.language),
        })),
    [form.value, i18n.language],
  )
  const requiresValue = form.type !== 'MATCH'
  const canUseNoResolve = noResolveRuleTypes.has(form.type)
  const isGeositeRule = form.type === 'GEOSITE'
  const title =
    mode === 'edit'
      ? t('rules.page.dialogs.editTitle')
      : mode === 'duplicate'
        ? t('rules.page.dialogs.duplicateTitle')
        : t(`rules.page.actions.${kind}`)
  const policyMenuItems = useMemo(
    () =>
      selectablePolicyGroups.flatMap((group, groupIndex) => [
        ...(groupIndex > 0
          ? [<Divider key={`${group.key}-divider`} component="li" />]
          : []),
        <ListSubheader key={`${group.key}-header`} disableSticky>
          {group.label}
        </ListSubheader>,
        ...group.options.map((policy) => (
          <MenuItem key={`${group.key}:${policy}`} value={policy}>
            {policy}
          </MenuItem>
        )),
      ]),
    [selectablePolicyGroups],
  )
  const [logicalItems, setLogicalItems] = useState<LogicalRuleItem[]>(() =>
    parseLogicalRuleItems(form.type, form.value),
  )
  const [logicalAddAnchor, setLogicalAddAnchor] = useState<null | HTMLElement>(
    null,
  )
  const [logicalError, setLogicalError] = useState('')
  const [nestedLogicalOpen, setNestedLogicalOpen] = useState(false)
  const [nestedLogicalTargetId, setNestedLogicalTargetId] = useState<
    string | null
  >(null)
  const [nestedLogicalForm, setNestedLogicalForm] = useState<RuleForm>(() =>
    getDefaultRuleForm('logical', ''),
  )

  const updateForm = (patch: Partial<RuleForm>) => {
    const next = { ...form, ...patch }
    if (!noResolveRuleTypes.has(next.type)) next.noResolve = false
    if (next.type === 'MATCH') next.value = ''
    onChange(next)
  }

  const getDefaultLogicalItemValue = useCallback(
    (type: string) => {
      const normalizedType = type.trim().toUpperCase()

      if (normalizedType === 'NETWORK') return 'UDP'
      if (isGeoipRule(normalizedType)) return 'CN'
      if (normalizedType === 'RULE-SET') return providerOptions[0] ?? ''

      return ''
    },
    [providerOptions],
  )

  const openNestedLogicalDialog = (item?: LogicalRuleItem) => {
    setLogicalAddAnchor(null)
    setLogicalError('')
    setNestedLogicalTargetId(item?.id ?? null)
    setNestedLogicalForm({
      type:
        item && logicalRuleTypes.includes(item.type)
          ? item.type
          : logicalRuleTypes[0],
      value: item?.value ?? '',
      policy: '',
      noResolve: false,
    })
    setNestedLogicalOpen(true)
  }

  const closeNestedLogicalDialog = () => {
    setNestedLogicalOpen(false)
    setNestedLogicalTargetId(null)
  }

  const updateLogicalItem = (
    id: string,
    patch: Partial<Omit<LogicalRuleItem, 'id'>>,
  ) => {
    setLogicalError('')
    setLogicalItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item

        const next = { ...item, ...patch }
        if (
          patch.type &&
          patch.type !== item.type &&
          patch.value === undefined
        ) {
          next.value = getDefaultLogicalItemValue(patch.type)
        }
        if (!noResolveRuleTypes.has(next.type)) next.noResolve = false

        return next
      }),
    )
  }

  const updateLogicalItemType = (item: LogicalRuleItem, type: string) => {
    if (logicalRuleTypes.includes(type)) {
      openNestedLogicalDialog({
        ...item,
        type,
        value: '',
        noResolve: false,
      })
      return
    }

    updateLogicalItem(item.id, { type })
  }

  const addLogicalItem = (type: string) => {
    setLogicalError('')
    setLogicalItems((items) => [
      ...items,
      createLogicalRuleItem(type, getDefaultLogicalItemValue(type)),
    ])
    setLogicalAddAnchor(null)
  }

  const removeLogicalItem = (id: string) => {
    setLogicalError('')
    setLogicalItems((items) => items.filter((item) => item.id !== id))
  }

  const submitNestedLogicalDialog = (submittedForm?: RuleForm) => {
    const nextForm = submittedForm ?? nestedLogicalForm
    const targetId = nestedLogicalTargetId
    const nextItem = createLogicalRuleItem(nextForm.type, nextForm.value)

    setLogicalError('')
    setLogicalItems((items) =>
      targetId
        ? items.map((item) =>
            item.id === targetId
              ? {
                  ...item,
                  type: nextForm.type,
                  value: nextForm.value,
                  noResolve: false,
                }
              : item,
          )
        : [...items, nextItem],
    )
    closeNestedLogicalDialog()
  }

  const getGeoipOptions = (value: string) =>
    Array.from(new Set([...geoipRegionCodes, value.toUpperCase()]))
      .filter(Boolean)
      .map((code) => ({
        code,
        label: getGeoipRegionLabel(code, i18n.language),
      }))

  const renderLogicalValueField = (item: LogicalRuleItem) => {
    const itemType = item.type.trim().toUpperCase()
    const placeholder = ruleTypeExamples[itemType] ?? ''

    if (isGeoipRule(itemType)) {
      const options = getGeoipOptions(item.value)
      return (
        <Autocomplete
          size="small"
          options={options}
          value={
            options.find(
              (option) => option.code === item.value.toUpperCase(),
            ) ?? null
          }
          getOptionLabel={(option) =>
            typeof option === 'string' ? option : option.label
          }
          onChange={(_, value) => {
            updateLogicalItem(item.id, { value: value?.code ?? '' })
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('rules.modals.editor.form.labels.content')}
              placeholder="CN"
            />
          )}
        />
      )
    }

    if (itemType === 'NETWORK') {
      const selectedValue = item.value.toUpperCase()
      const options = Array.from(
        new Set([...networkRuleValues, selectedValue].filter(Boolean)),
      )

      return (
        <TextField
          select
          size="small"
          label={t('rules.modals.editor.form.labels.content')}
          value={selectedValue}
          onChange={(event) =>
            updateLogicalItem(item.id, { value: event.target.value })
          }
        >
          {options.map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </TextField>
      )
    }

    if (itemType === 'RULE-SET') {
      const itemProviderOptions = Array.from(
        new Set([...providerOptions, item.value].filter(Boolean)),
      )

      if (itemProviderOptions.length > 0) {
        return (
          <TextField
            select
            size="small"
            label={t('rules.modals.editor.form.labels.content')}
            value={item.value}
            onChange={(event) =>
              updateLogicalItem(item.id, { value: event.target.value })
            }
          >
            {itemProviderOptions.map((provider) => (
              <MenuItem key={provider} value={provider}>
                {provider}
              </MenuItem>
            ))}
          </TextField>
        )
      }
    }

    if (logicalRuleTypes.includes(itemType)) {
      return (
        <TextField
          size="small"
          label={t('rules.modals.editor.form.labels.content')}
          placeholder={t('rules.modals.editor.logical.configureSubrule')}
          value={item.value}
          onClick={() => openNestedLogicalDialog(item)}
          slotProps={{ input: { readOnly: true } }}
          sx={{
            cursor: 'pointer',
            '& .MuiInputBase-input': {
              cursor: 'pointer',
            },
          }}
        />
      )
    }

    return (
      <TextField
        size="small"
        label={t('rules.modals.editor.form.labels.content')}
        placeholder={placeholder}
        value={item.value}
        onChange={(event) =>
          updateLogicalItem(item.id, { value: event.target.value })
        }
      />
    )
  }

  const handleSubmit = () => {
    if (kind !== 'logical') {
      onSubmit(form)
      return
    }

    if (logicalItems.length === 0) {
      setLogicalError(t('rules.modals.editor.form.validation.subrulesRequired'))
      return
    }

    if (logicalItems.some((item) => !isLogicalRuleItemComplete(item))) {
      setLogicalError(
        t('rules.modals.editor.form.validation.subruleConditionRequired'),
      )
      return
    }

    const value = buildLogicalRuleValue(logicalItems)
    if (!value) {
      setLogicalError(t('rules.modals.editor.form.validation.subrulesRequired'))
      return
    }

    setLogicalError('')
    onSubmit({ ...form, value, noResolve: false })
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent
          sx={{
            display: 'grid',
            gap: 2,
            pt: '12px !important',
          }}
        >
          {kind === 'logical' ? (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '220px 1fr' },
                  gap: 2,
                }}
              >
                <TextField
                  select
                  disabled={typeDisabled}
                  label={t('rules.modals.editor.logical.operator')}
                  value={form.type}
                  onChange={(event) => updateForm({ type: event.target.value })}
                >
                  {typeOptions.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  fullWidth
                  select
                  disabled={policyDisabled}
                  label={t('rules.modals.editor.form.labels.proxyPolicy')}
                  value={policyDisabled ? '' : form.policy}
                  onChange={(event) =>
                    updateForm({ policy: event.target.value })
                  }
                >
                  {policyDisabled ? (
                    <MenuItem value="">-</MenuItem>
                  ) : (
                    policyMenuItems
                  )}
                </TextField>
              </Box>

              <Box
                sx={{
                  border: '1px solid var(--divider-color)',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    display: { xs: 'none', md: 'grid' },
                    gridTemplateColumns:
                      'minmax(184px, 240px) minmax(260px, 1fr) 116px 48px',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid var(--divider-color)',
                    color: 'text.secondary',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <Box>{t('rules.page.table.type')}</Box>
                  <Box>{t('rules.page.table.value')}</Box>
                  <Box>{t('rules.modals.editor.form.toggles.noResolve')}</Box>
                  <Box />
                </Box>

                {logicalItems.map((item) => {
                  const canUseItemNoResolve = noResolveRuleTypes.has(item.type)

                  return (
                    <Box
                      key={item.id}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          md: 'minmax(184px, 240px) minmax(260px, 1fr) 116px 48px',
                        },
                        alignItems: { xs: 'stretch', md: 'center' },
                        gap: 1,
                        p: 1.5,
                        borderBottom: '1px solid var(--divider-color)',
                        '&:last-of-type': {
                          borderBottom: 'none',
                        },
                      }}
                    >
                      <TextField
                        select
                        size="small"
                        label={t('rules.modals.editor.form.labels.type')}
                        value={item.type}
                        onChange={(event) =>
                          updateLogicalItemType(item, event.target.value)
                        }
                      >
                        {logicalSubruleTypes.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </TextField>

                      {renderLogicalValueField(item)}

                      <FormControlLabel
                        disabled={!canUseItemNoResolve}
                        control={
                          <Checkbox
                            size="small"
                            checked={item.noResolve}
                            onChange={(event) =>
                              updateLogicalItem(item.id, {
                                noResolve: event.target.checked,
                              })
                            }
                          />
                        }
                        label={t('rules.modals.editor.form.toggles.noResolve')}
                        sx={{
                          m: 0,
                          whiteSpace: 'nowrap',
                        }}
                      />

                      <IconButton
                        aria-label={t(
                          'rules.modals.editor.logical.deleteSubrule',
                        )}
                        onClick={() => removeLogicalItem(item.id)}
                        sx={{ justifySelf: { xs: 'end', md: 'center' } }}
                      >
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </Box>
                  )
                })}

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    borderTop:
                      logicalItems.length > 0
                        ? '1px solid var(--divider-color)'
                        : undefined,
                  }}
                >
                  <Button
                    startIcon={<AddRounded />}
                    onClick={(event) =>
                      setLogicalAddAnchor(event.currentTarget)
                    }
                  >
                    {t('rules.modals.editor.logical.addSubrule')}
                  </Button>
                  {logicalError ? (
                    <Typography color="error" sx={{ fontSize: 13 }}>
                      {logicalError}
                    </Typography>
                  ) : null}
                </Box>
              </Box>

              <Menu
                anchorEl={logicalAddAnchor}
                open={Boolean(logicalAddAnchor)}
                onClose={() => setLogicalAddAnchor(null)}
              >
                <MenuItem onClick={() => addLogicalItem('DOMAIN')}>
                  {t('rules.modals.editor.logical.standardSubrule')}
                </MenuItem>
                <MenuItem onClick={() => openNestedLogicalDialog()}>
                  {t('rules.modals.editor.logical.logicalSubrule')}
                </MenuItem>
                <MenuItem onClick={() => addLogicalItem('RULE-SET')}>
                  {t('rules.modals.editor.logical.rulesetSubrule')}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '220px 1fr' },
                  gap: 2,
                }}
              >
                <TextField
                  select
                  disabled={typeDisabled}
                  label={t('rules.modals.editor.form.labels.type')}
                  value={form.type}
                  onChange={(event) => updateForm({ type: event.target.value })}
                >
                  {typeOptions.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>

                {isGeoipRule(form.type) ? (
                  <Autocomplete
                    options={geoipRegionOptions}
                    value={
                      geoipRegionOptions.find(
                        (option) => option.code === form.value.toUpperCase(),
                      ) ?? null
                    }
                    getOptionLabel={(option) =>
                      typeof option === 'string' ? option : option.label
                    }
                    onChange={(_, value) => {
                      updateForm({ value: value?.code ?? '' })
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t('rules.modals.editor.form.labels.content')}
                        placeholder="CN"
                      />
                    )}
                  />
                ) : form.type === 'RULE-SET' &&
                  selectableProviders.length > 0 ? (
                  <TextField
                    select
                    label={t('rules.modals.editor.form.labels.content')}
                    value={form.value}
                    onChange={(event) =>
                      updateForm({ value: event.target.value })
                    }
                  >
                    {selectableProviders.map((provider) => (
                      <MenuItem key={provider} value={provider}>
                        {provider}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TextField
                    disabled={!requiresValue}
                    label={t('rules.modals.editor.form.labels.content')}
                    placeholder={
                      requiresValue ? ruleTypeExamples[form.type] : ''
                    }
                    helperText={
                      isGeositeRule
                        ? t('rules.modals.editor.form.helpers.geosite')
                        : undefined
                    }
                    value={form.value}
                    onChange={(event) =>
                      updateForm({ value: event.target.value })
                    }
                  />
                )}
              </Box>

              <Box>
                <TextField
                  fullWidth
                  select
                  label={t('rules.modals.editor.form.labels.proxyPolicy')}
                  value={form.policy}
                  onChange={(event) =>
                    updateForm({ policy: event.target.value })
                  }
                >
                  {policyMenuItems}
                </TextField>
              </Box>

              <FormControlLabel
                disabled={!canUseNoResolve}
                control={
                  <Checkbox
                    checked={form.noResolve}
                    onChange={(event) =>
                      updateForm({ noResolve: event.target.checked })
                    }
                  />
                }
                label={t('rules.modals.editor.form.toggles.noResolve')}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>{t('shared.actions.cancel')}</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {t('shared.actions.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {kind === 'logical' && nestedLogicalOpen ? (
        <RuleEditorDialog
          key={`nested-logical:${nestedLogicalOpen ? 'open' : 'closed'}:${nestedLogicalTargetId ?? 'add'}`}
          open={nestedLogicalOpen}
          mode={nestedLogicalTargetId ? 'edit' : 'add'}
          kind="logical"
          form={nestedLogicalForm}
          policyOptionGroups={policyOptionGroups}
          providerOptions={providerOptions}
          policyDisabled
          onClose={closeNestedLogicalDialog}
          onChange={setNestedLogicalForm}
          onSubmit={submitNestedLogicalDialog}
        />
      ) : null}
    </>
  )
}

const RulesPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const routePresetDialog = getRulePresetDialogState(
    (location.state as RulePresetRouteState | null)?.rulePreset,
    'DIRECT',
  )
  const { rules = [], ruleProviders = {} } = useRulesData()
  const { proxies: proxiesData } = useProxiesData()
  const { refreshRules, refreshRuleProviders } = useAppRefreshers()
  const { profiles, mutateProfiles } = useProfiles()
  const [searchText, setSearchText] = useState('')
  const [match, setMatch] = useState(() => (_: string) => true)
  const [showDisabledConfigRules, setShowDisabledConfigRules] = useState(false)
  const [
    pendingRuntimeSuppressedSignatures,
    setPendingRuntimeSuppressedSignatures,
  ] = useState<Set<string>>(() => new Set())
  const [manualRules, setManualRules] = useState<ManualRulesDocument>(() =>
    emptyManualRules(),
  )
  const [policyLayerData, setPolicyLayerData] = useState<PolicyLayerData>(() =>
    emptyPolicyLayerData(),
  )
  const [rulesUid, setRulesUid] = useState('')
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null)
  const [rowMenu, setRowMenu] = useState<{
    mouseX: number
    mouseY: number
    row: ManagedRuleRow
  } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(() => Boolean(routePresetDialog))
  const [dialogMode, setDialogMode] = useState<RuleDialogMode>('add')
  const [dialogKind, setDialogKind] = useState<RuleDialogKind>(
    () => routePresetDialog?.kind ?? 'standard',
  )
  const [activeRow, setActiveRow] = useState<ManagedRuleRow | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [form, setForm] = useState<RuleForm>(
    () => routePresetDialog?.form ?? getDefaultRuleForm('standard', 'DIRECT'),
  )
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const mutateProfilesRef = useRef(mutateProfiles)
  const consumedRoutePresetKeyRef = useRef<string | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const pageVisible = useVisibility()
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  useEffect(() => {
    mutateProfilesRef.current = mutateProfiles
  }, [mutateProfiles])

  const currentProfile = useMemo(
    () => profiles?.items?.find((item) => item.uid === profiles.current),
    [profiles],
  )

  const runtimePolicyNames = useMemo(() => {
    const proxyNames = new Set<string>()
    const groupNames = new Set<string>()

    const proxies = proxiesData?.proxies
    if (Array.isArray(proxies)) {
      proxies.forEach((proxy) => {
        const name = getRuntimePolicyName(proxy)
        if (name) proxyNames.add(name)
      })
    } else {
      Object.entries(proxies ?? {}).forEach(([key, proxy]) => {
        const name = getRuntimePolicyName(proxy, key)
        if (name) proxyNames.add(name)
      })
    }

    if (proxiesData?.global?.name) groupNames.add(proxiesData.global.name)
    ;(proxiesData?.groups ?? []).forEach((group: any) => {
      const name = getRuntimePolicyName(group)
      if (name) groupNames.add(name)
    })

    return {
      proxyNames: Array.from(proxyNames),
      groupNames: Array.from(groupNames),
    }
  }, [proxiesData])

  const effectivePolicyOptions = useMemo(
    () =>
      buildEffectivePolicyOptions({
        builtinPolicies: builtinProxyPolicies,
        baseProfileData: policyLayerData.baseProfileData,
        manualProxies: policyLayerData.manualProxies,
        manualGroups: policyLayerData.manualGroups,
        runtimeProxyNames: runtimePolicyNames.proxyNames,
        runtimeGroupNames: runtimePolicyNames.groupNames,
      }),
    [
      policyLayerData.baseProfileData,
      policyLayerData.manualGroups,
      policyLayerData.manualProxies,
      runtimePolicyNames.groupNames,
      runtimePolicyNames.proxyNames,
    ],
  )

  const policyOptionGroups = useMemo<PolicyOptionGroup[]>(() => {
    const builtinSet = new Set(builtinProxyPolicies)
    const builtinOptions = effectivePolicyOptions
      .filter((option) => option.type === 'builtin' && option.available)
      .map((option) => option.name)
    const proxyOptions = effectivePolicyOptions
      .filter((option) => option.type === 'proxy' && option.available)
      .map((option) => option.name)
      .filter((name) => !builtinSet.has(name))
      .sort((a, b) => a.localeCompare(b))
    const groupOptions = effectivePolicyOptions
      .filter((option) => option.type === 'group' && option.available)
      .map((option) => option.name)
      .filter((name) => !builtinSet.has(name))
      .sort((a, b) => a.localeCompare(b))

    return [
      {
        key: 'builtin',
        label: t('rules.page.policyGroups.builtin'),
        options: builtinOptions,
      },
      {
        key: 'proxy',
        label: t('rules.page.policyGroups.proxies'),
        options: proxyOptions,
      },
      {
        key: 'group',
        label: t('rules.page.policyGroups.groups'),
        options: groupOptions,
      },
    ]
  }, [effectivePolicyOptions, t])

  const policyOptions = useMemo(
    () => policyOptionGroups.flatMap((group) => group.options),
    [policyOptionGroups],
  )

  const providerOptions = useMemo(
    () => Object.keys(ruleProviders ?? {}).sort((a, b) => a.localeCompare(b)),
    [ruleProviders],
  )

  useEffect(() => {
    const presetDialog = getRulePresetDialogState(
      (location.state as RulePresetRouteState | null)?.rulePreset,
      policyOptions[0] ?? 'DIRECT',
    )
    if (!presetDialog || consumedRoutePresetKeyRef.current === location.key) {
      return
    }

    let cancelled = false

    queueMicrotask(() => {
      if (cancelled || consumedRoutePresetKeyRef.current === location.key) {
        return
      }

      consumedRoutePresetKeyRef.current = location.key
      setAddMenuAnchor(null)
      setRowMenu(null)
      setDialogMode('add')
      setDialogKind(presetDialog.kind)
      setActiveRow(null)
      setSelectedRowId(null)
      setForm(presetDialog.form)
      setDialogOpen(true)

      navigate(
        {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
        { replace: true, state: null },
      )
    })

    return () => {
      cancelled = true
    }
  }, [
    location.hash,
    location.key,
    location.pathname,
    location.search,
    location.state,
    navigate,
    policyOptions,
  ])

  const ensureRulesFile = useCallback(async () => {
    const ensured = await ensureProfileProxies(currentProfile?.uid)
    setRulesUid(ensured.rulesUid)

    if (!currentProfile?.uid || currentProfile.uid !== ensured.profileUid) {
      await mutateProfilesRef.current()
    }

    return ensured.rulesUid
  }, [currentProfile?.uid])

  const loadPolicyLayerData =
    useCallback(async (): Promise<PolicyLayerData> => {
      if (!currentProfile?.uid) return emptyPolicyLayerData()

      const ensured = await ensureProfileProxies(currentProfile.uid)
      const [baseProfileData, proxiesData, groupsData] = await Promise.all([
        readProfileFile(ensured.profileUid),
        readProfileFile(ensured.proxiesUid),
        readProfileFile(ensured.groupsUid),
      ])

      if (
        currentProfile.option?.proxies !== ensured.proxiesUid ||
        currentProfile.option?.groups !== ensured.groupsUid
      ) {
        await mutateProfilesRef.current()
      }

      return {
        baseProfileData,
        baseRules: getProfileRuleRaws(baseProfileData),
        manualProxies: normalizeManualProxyDocument(proxiesData),
        manualGroups: normalizeManualGroupDocument(groupsData),
      }
    }, [
      currentProfile?.option?.groups,
      currentProfile?.option?.proxies,
      currentProfile?.uid,
    ])

  const releaseRuntimeSuppression = useCallback((signatures: string[]) => {
    if (signatures.length === 0) return

    const clear = () => {
      setPendingRuntimeSuppressedSignatures((prev) => {
        const nextSignatures = new Set(prev)
        signatures.forEach((signature) => nextSignatures.delete(signature))
        return nextSignatures
      })
    }

    window.requestAnimationFrame(() => window.requestAnimationFrame(clear))
  }, [])

  const fetchManualRules = useCallback(async () => {
    try {
      const uid = await ensureRulesFile()
      const data = await readProfileFile(uid)
      setManualRules(sanitizeManualRules(normalizeManualRules(data)))
    } catch (err: any) {
      showNotice.error(err)
    }
  }, [ensureRulesFile])

  const saveManualRules = useLockFn(
    async (
      next: ManualRulesDocument,
      options?: { suppressRuntimeRaws?: string[] },
    ) => {
      const suppressRuntimeSignatures = (
        options?.suppressRuntimeRaws ?? []
      ).map(getRawRuleIdentitySignature)
      let runtimeRefreshed = false
      let shouldFallbackReleaseSuppression = false

      try {
        const sanitizedNext = sanitizeManualRules(next)
        const uid = rulesUid || (await ensureRulesFile())
        if (!(await saveProfileFile(uid, dumpManualRules(sanitizedNext)))) {
          await fetchManualRules()
          return
        }

        if (suppressRuntimeSignatures.length > 0) {
          setPendingRuntimeSuppressedSignatures((prev) => {
            const nextSignatures = new Set(prev)
            suppressRuntimeSignatures.forEach((signature) =>
              nextSignatures.add(signature),
            )
            return nextSignatures
          })
        }

        setManualRules(sanitizedNext)
        showNotice.success('shared.feedback.notifications.saved')

        const enhanced = await enhanceProfiles()
        if (enhanced) {
          await Promise.all([refreshRules(), refreshRuleProviders()])
        } else {
          await refreshRules()
        }
        runtimeRefreshed = true
        await mutateProfilesRef.current()
      } catch (err: any) {
        shouldFallbackReleaseSuppression = suppressRuntimeSignatures.length > 0
        showNotice.error(err)
      } finally {
        if (runtimeRefreshed) {
          releaseRuntimeSuppression(suppressRuntimeSignatures)
        } else if (shouldFallbackReleaseSuppression) {
          window.setTimeout(
            () => releaseRuntimeSuppression(suppressRuntimeSignatures),
            3000,
          )
        }
      }
    },
  )

  useEffect(() => {
    refreshRules()
    refreshRuleProviders()

    if (pageVisible) {
      refreshRules()
      refreshRuleProviders()
    }
  }, [refreshRules, refreshRuleProviders, pageVisible])

  useEffect(() => {
    if (!profiles) return
    fetchManualRules()
  }, [fetchManualRules, profiles])

  useEffect(() => {
    if (!profiles) return

    let cancelled = false

    loadPolicyLayerData()
      .then((data) => {
        if (!cancelled) setPolicyLayerData(data)
      })
      .catch((err) => {
        console.warn('[Rules] Failed to load effective policy options:', err)
        if (!cancelled) setPolicyLayerData(emptyPolicyLayerData())
      })

    return () => {
      cancelled = true
    }
  }, [loadPolicyLayerData, profiles])

  const rows = useMemo<ManagedRuleRow[]>(
    () =>
      buildEffectiveRuleRows({
        manualRules,
        baseRules: policyLayerData.baseRules,
        runtimeRules: rules,
        pendingRuntimeSuppressedSignatures,
      }),
    [
      manualRules,
      pendingRuntimeSuppressedSignatures,
      policyLayerData.baseRules,
      rules,
    ],
  )

  const disabledConfigRuleCount = useMemo(
    () => rows.filter(isEffectiveOverlayDeleteRuleRow).length,
    [rows],
  )

  const visibleRows = useMemo(
    () =>
      rows.filter((row) =>
        shouldShowEffectiveRuleRow(row, { showDisabledConfigRules }),
      ),
    [rows, showDisabledConfigRules],
  )

  const filteredRows = useMemo(
    () => visibleRows.filter((item) => match(item.searchText)),
    [visibleRows, match],
  )

  const effectiveSelectedRowId = useMemo(() => {
    if (!selectedRowId) return null
    return visibleRows.some((row) => row.id === selectedRowId)
      ? selectedRowId
      : null
  }, [selectedRowId, visibleRows])

  const addRuntimeDeletesForRules = useCallback(
    (document: ManualRulesDocument, raws: string[]) => {
      const signatures = new Set(raws.map(getRawRuleIdentitySignature))

      rows.forEach((row) => {
        if (
          isEffectiveRuntimeRuleRow(row) &&
          signatures.has(getRuleIdentitySignature(row))
        ) {
          addRuleDelete(document, row.raw)
        }
      })
    },
    [rows],
  )

  const applyFallbackRuleReplacement = useCallback(
    (document: ManualRulesDocument, raw: string) => {
      rows.forEach((row) => {
        if (row.enabled && isMatchRuleRaw(row.raw)) {
          addRuleDelete(document, row.raw)
        }
      })

      removeActiveManualFallbackRules(document)
      document.append.push(createManualRuleItem(raw))
      addRuntimeDeletesForRules(document, [raw])
    },
    [addRuntimeDeletesForRules, rows],
  )

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setShowScrollTop(event.currentTarget.scrollTop > 100)
  }, [])

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openAddDialog = (kind: RuleDialogKind) => {
    setAddMenuAnchor(null)
    setDialogMode('add')
    setDialogKind(kind)
    setActiveRow(null)
    setForm(getDefaultRuleForm(kind, policyOptions[0] ?? 'DIRECT'))
    setDialogOpen(true)
  }

  const openRowDialog = (row: ManagedRuleRow, mode: RuleDialogMode) => {
    const kind = getKindFromType(row.type)

    setRowMenu(null)
    setDialogMode(mode)
    setDialogKind(kind)
    setActiveRow(row)
    setForm({
      type: row.type,
      value: row.value,
      policy: row.policy || policyOptions[0] || 'DIRECT',
      noResolve: row.noResolve,
    })
    setDialogOpen(true)
  }

  const applyDelete = useCallback(
    async (row: ManagedRuleRow) => {
      if (!row.deletable) return

      const next = cloneManualRules(manualRules)

      if (isEffectiveManualRuleRow(row)) {
        next[row.manualSection] = removeAt(
          next[row.manualSection],
          row.manualIndex,
          row.raw,
        )
        revealRuntimeRuleIfUnshadowed(next, row.raw)
      } else {
        addRuleDelete(next, row.raw)
      }

      setRowMenu(null)
      await saveManualRules(next, {
        suppressRuntimeRaws: isEffectiveManualRuleRow(row) ? [row.raw] : [],
      })
    },
    [manualRules, saveManualRules],
  )

  const handleSubmitDialog = useLockFn(async (submittedForm?: RuleForm) => {
    const currentForm = submittedForm ?? form
    const effectiveForm =
      dialogMode === 'edit' &&
      activeRow &&
      isEffectiveFallbackRuleRow(activeRow)
        ? {
            ...currentForm,
            type: 'MATCH',
            value: '',
            noResolve: false,
          }
        : currentForm
    const raw = buildRuleRaw(effectiveForm)

    if (!effectiveForm.type || !effectiveForm.policy) {
      showNotice.error('rules.page.validation.required')
      return
    }

    if (effectiveForm.type !== 'MATCH' && !effectiveForm.value.trim()) {
      showNotice.error('rules.modals.editor.form.validation.conditionRequired')
      return
    }

    const next = cloneManualRules(manualRules)

    if (dialogMode === 'edit' && activeRow) {
      if (isEffectiveFallbackRuleRow(activeRow)) {
        applyFallbackRuleReplacement(next, raw)
      } else if (isEffectiveConfigRuleRow(activeRow)) {
        addRuleOverlayReplacement(next, activeRow.raw, raw)
      } else if (isEffectiveManualRuleRow(activeRow)) {
        next[activeRow.manualSection] = replaceAt(
          next[activeRow.manualSection],
          activeRow.manualIndex,
          activeRow.raw,
          raw,
          activeRow.enabled,
        )
        revealRuntimeRuleIfUnshadowed(next, activeRow.raw)
      }

      if (isEffectiveFallbackRuleRow(activeRow)) {
        // The fallback path has already cleaned up active MATCH candidates.
      } else if (isEffectiveConfigRuleRow(activeRow)) {
        // Config/runtime edits are represented as delete + local replacement.
      } else if (activeRow.enabled) {
        addRuntimeDeletesForRules(next, [raw])
      } else {
        addRuleDelete(next, raw)
      }
      setDialogOpen(false)
      await saveManualRules(next, {
        suppressRuntimeRaws: isEffectiveConfigRuleRow(activeRow)
          ? []
          : [activeRow.raw],
      })
      return
    }

    if (dialogMode === 'add' || dialogMode === 'duplicate' || !activeRow) {
      if (dialogMode === 'duplicate' && activeRow?.locked) {
        setDialogOpen(false)
        return
      }

      const targetRow =
        dialogMode === 'duplicate'
          ? activeRow
          : rows.find((row) => row.id === effectiveSelectedRowId)

      if (targetRow && isEffectiveManualRuleRow(targetRow)) {
        const insertIndex =
          (targetRow.manualIndex ?? 0) +
          (dialogMode === 'duplicate' && !targetRow.locked ? 1 : 0)
        next[targetRow.manualSection] = insertAt(
          next[targetRow.manualSection],
          insertIndex,
          raw,
          targetRow.locked ? true : targetRow.enabled,
        )
      } else {
        next.prepend.unshift(createManualRuleItem(raw))
      }

      addRuntimeDeletesForRules(next, [raw])
      setDialogOpen(false)
      setSelectedRowId(null)
      await saveManualRules(next)
      return
    }

    setDialogOpen(false)
    await saveManualRules(next)
  })

  const handleContextMenu = (
    event: MouseEvent<HTMLElement>,
    row: ManagedRuleRow,
  ) => {
    event.preventDefault()
    setSelectedRowId(row.id)
    setRowMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      row,
    })
  }

  const handleSelectRow = (row: ManagedRuleRow) => {
    setSelectedRowId(row.id)
  }

  const handleToggleRuleEnabled = useCallback(
    async (row: ManagedRuleRow, enabled: boolean) => {
      if (!row.canToggle) return

      const next = cloneManualRules(manualRules)

      if (isEffectiveManualRuleRow(row)) {
        const list = next[row.manualSection]
        const signature = getRawRuleIdentitySignature(row.raw)
        const index =
          typeof row.manualIndex === 'number' &&
          row.manualIndex >= 0 &&
          row.manualIndex < list.length
            ? row.manualIndex
            : list.findIndex(
                (item) =>
                  item.raw === row.raw ||
                  getRawRuleIdentitySignature(item.raw) === signature,
              )

        if (index < 0) return

        list[index] = { ...list[index], enabled }

        if (enabled) {
          addRuntimeDeletesForRules(next, [list[index].raw])
        } else {
          addRuleDelete(next, list[index].raw)
        }
      } else if (enabled) {
        const signature = getRawRuleIdentitySignature(row.raw)
        next.delete = next.delete.filter(
          (raw) => getRawRuleIdentitySignature(raw) !== signature,
        )
      } else {
        addRuleDelete(next, row.raw)
      }

      await saveManualRules(next)
    },
    [addRuntimeDeletesForRules, manualRules, saveManualRules],
  )

  const dragDisabled = searchText.trim().length > 0

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event

      if (dragDisabled || !over || active.id === over.id) return

      const activeRow = rows.find((row) => row.id === active.id)
      const overRow = rows.find((row) => row.id === over.id)

      if (
        !activeRow ||
        !overRow ||
        activeRow.locked ||
        overRow.locked ||
        !isEffectiveManualRuleRow(activeRow) ||
        !isEffectiveManualRuleRow(overRow) ||
        activeRow.manualSection !== overRow.manualSection ||
        activeRow.manualIndex === undefined ||
        overRow.manualIndex === undefined
      ) {
        return
      }

      const next = cloneManualRules(manualRules)
      next[activeRow.manualSection] = arrayMove(
        next[activeRow.manualSection],
        activeRow.manualIndex,
        overRow.manualIndex,
      )

      await saveManualRules(next)
    },
    [dragDisabled, manualRules, rows, saveManualRules],
  )

  const rowMenuAction = rowMenu?.row
    ? isEffectiveOverlayDeleteRuleRow(rowMenu.row) && rowMenu.row.canToggle
      ? 'restore'
      : rowMenu.row.deletable && isEffectiveManualRuleRow(rowMenu.row)
        ? 'delete'
        : rowMenu.row.deletable && isEffectiveConfigRuleRow(rowMenu.row)
          ? 'disable'
          : null
    : null

  const handleDisableRow = async (row: ManagedRuleRow) => {
    setRowMenu(null)
    await handleToggleRuleEnabled(row, false)
  }

  const handleRestoreRow = async (row: ManagedRuleRow) => {
    setRowMenu(null)
    await handleToggleRuleEnabled(row, true)
  }

  return (
    <BasePage
      full
      title={t('rules.page.title')}
      contentStyle={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
      header={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AddRounded />}
            onClick={(event) => setAddMenuAnchor(event.currentTarget)}
          >
            {t('rules.page.actions.add')}
          </Button>
          <ProviderButton />
        </Box>
      }
    >
      <Box
        sx={{
          pt: 1,
          mb: 0.5,
          mx: '10px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <BaseSearchBox
            onSearch={(match, state: SearchState) => {
              setSearchText(state.text)
              setMatch(() => match)
            }}
          />
        </Box>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showDisabledConfigRules}
              disabled={disabledConfigRuleCount === 0}
              onChange={(event) =>
                setShowDisabledConfigRules(event.target.checked)
              }
            />
          }
          label={t('rules.page.actions.showDisabledConfig')}
          sx={{
            ml: 1,
            mr: 0,
            whiteSpace: 'nowrap',
            color: 'text.secondary',
            '.MuiFormControlLabel-label': { fontSize: 13 },
          }}
        />
      </Box>

      <RuleTableHeader />

      {filteredRows.length > 0 ? (
        <>
          <Box
            ref={scrollContainerRef}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedRowId(null)
              }
            }}
            onScroll={handleScroll}
            sx={{ flex: 1, overflow: 'auto' }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredRows.map((row) => row.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredRows.map((row, displayIndex) => (
                  <RuleTableRow
                    key={row.id}
                    row={row}
                    displayIndex={displayIndex}
                    selected={effectiveSelectedRowId === row.id}
                    dragDisabled={
                      dragDisabled ||
                      row.locked ||
                      !isEffectiveManualRuleRow(row)
                    }
                    onSelect={handleSelectRow}
                    onEdit={(row) => openRowDialog(row, 'edit')}
                    onToggleEnabled={handleToggleRuleEnabled}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </Box>
          <ScrollTopButton onClick={scrollToTop} show={showScrollTop} />
        </>
      ) : (
        <BaseEmpty />
      )}

      <Menu
        anchorEl={addMenuAnchor}
        open={Boolean(addMenuAnchor)}
        onClose={() => setAddMenuAnchor(null)}
      >
        <MenuItem onClick={() => openAddDialog('standard')}>
          <ListItemIcon>
            <PlaylistAddRounded fontSize="small" />
          </ListItemIcon>
          {t('rules.page.actions.standard')}
        </MenuItem>
        <MenuItem onClick={() => openAddDialog('logical')}>
          <ListItemIcon>
            <PlaylistAddRounded fontSize="small" />
          </ListItemIcon>
          {t('rules.page.actions.logical')}
        </MenuItem>
        <MenuItem onClick={() => openAddDialog('ruleset')}>
          <ListItemIcon>
            <PlaylistAddRounded fontSize="small" />
          </ListItemIcon>
          {t('rules.page.actions.ruleset')}
        </MenuItem>
      </Menu>

      <Menu
        open={rowMenu !== null}
        onClose={() => setRowMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          rowMenu !== null
            ? { top: rowMenu.mouseY, left: rowMenu.mouseX }
            : undefined
        }
      >
        <MenuItem
          onClick={() => rowMenu?.row && openRowDialog(rowMenu.row, 'edit')}
        >
          <ListItemIcon>
            <EditRounded fontSize="small" />
          </ListItemIcon>
          {t('rules.page.actions.edit')}
        </MenuItem>
        {rowMenu?.row && !rowMenu.row.locked ? (
          <MenuItem onClick={() => openRowDialog(rowMenu.row, 'duplicate')}>
            <ListItemIcon>
              <ContentCopyRounded fontSize="small" />
            </ListItemIcon>
            {t('rules.page.actions.duplicate')}
          </MenuItem>
        ) : null}
        {rowMenu?.row && rowMenuAction ? (
          <>
            <Divider />
            {rowMenuAction === 'restore' ? (
              <MenuItem
                onClick={() => rowMenu?.row && handleRestoreRow(rowMenu.row)}
              >
                <ListItemIcon>
                  <RestoreRounded fontSize="small" />
                </ListItemIcon>
                {t('rules.page.actions.restore')}
              </MenuItem>
            ) : rowMenuAction === 'disable' ? (
              <MenuItem
                onClick={() => rowMenu?.row && handleDisableRow(rowMenu.row)}
              >
                <ListItemIcon>
                  <BlockRounded fontSize="small" />
                </ListItemIcon>
                {t('rules.page.actions.disable')}
              </MenuItem>
            ) : (
              <MenuItem
                onClick={() => rowMenu?.row && applyDelete(rowMenu.row)}
                sx={{ color: 'error.main' }}
              >
                <ListItemIcon>
                  <DeleteRounded color="error" fontSize="small" />
                </ListItemIcon>
                {t('rules.page.actions.delete')}
              </MenuItem>
            )}
          </>
        ) : null}
      </Menu>

      <RuleEditorDialog
        key={`${dialogOpen ? 'open' : 'closed'}:${dialogMode}:${dialogKind}:${activeRow?.id ?? 'add'}`}
        open={dialogOpen}
        mode={dialogMode}
        kind={dialogKind}
        form={form}
        policyOptionGroups={policyOptionGroups}
        providerOptions={providerOptions}
        typeDisabled={Boolean(
          activeRow && isEffectiveFallbackRuleRow(activeRow),
        )}
        onClose={() => setDialogOpen(false)}
        onChange={setForm}
        onSubmit={handleSubmitDialog}
      />
    </BasePage>
  )
}

export default RulesPage
