import {
  CheckRounded,
  ContentCopyRounded,
  DeleteRounded,
  EditRounded,
  LanOutlined,
  LanRounded,
  WarningRounded,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Divider,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'
import { useLockFn } from 'ahooks'
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  closeAllConnections,
  selectNodeForGroup,
  type Rule,
} from 'tauri-plugin-mihomo-api'

import { BaseDialog, BasePage, TooltipIcon } from '@/components/base'
import { ManualGroupViewer } from '@/components/profile/manual-group-viewer'
import { ManualProxyViewer } from '@/components/profile/manual-proxy-viewer'
import { ProviderButton } from '@/components/proxy/provider-button'
import { ProxyGroups } from '@/components/proxy/proxy-groups'
import { useProfiles } from '@/hooks/use-profiles'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import { useVerge } from '@/hooks/use-verge'
import {
  useAppRefreshers,
  useClashConfigData,
  useProxiesData,
  useRulesData,
} from '@/providers/app-data-context'
import {
  ensureProfileProxies,
  enhanceProfiles,
  getRuntimeProxyChainConfig,
  patchClashMode,
  readProfileFile,
  saveProfileFile,
  saveProfileOverlayFiles,
  updateProxyChainConfigInRuntime,
} from '@/services/cmds'
import { showNotice } from '@/services/notice-service'
import { debugLog } from '@/utils/debug'
import {
  dumpManualGroupDocument,
  dumpManualProxyDocument,
  ensureManualGroupDocumentIds,
  ensureManualProxyDocumentIds,
  getDuplicatedPolicyName,
  getManualGroupIdentityMap,
  getManualGroupNames,
  getManualProxyDialerMap,
  getManualProxyIdentityMap,
  getManualProxyNames,
  groupDependsOn,
  mergeMaps,
  mergeNames,
  normalizeManualGroupDocument,
  normalizeManualProxyDocument,
  removePolicyFromManualGroups,
  renameManualProxyDialerReferences,
  renamePolicyInManualGroups,
  type ManualGroupDocument,
  type ManualProxyDocument,
} from '@/utils/manual-policy-docs'
import {
  ensurePolicyId,
  getPolicyId,
  POLICY_ID_KEY,
  type PolicyIdentityMap,
  withNewPolicyId,
} from '@/utils/policy-metadata'
import { renameProfileSelectedPolicyReferences } from '@/utils/profile-selection'
import {
  dumpManualRules,
  normalizeManualRules,
  renamePolicyInManualRules,
} from '@/utils/rule-utils'

const MODES = ['rule', 'global', 'direct'] as const
type Mode = (typeof MODES)[number]
const MODE_SET = new Set<string>(MODES)
const isMode = (value: unknown): value is Mode =>
  typeof value === 'string' && MODE_SET.has(value)
const BUILTIN_PROXY_NAMES = new Set([
  'DIRECT',
  'REJECT',
  'REJECT-DROP',
  'PASS',
  'COMPATIBLE',
])
const GROUP_POLICY_BUILTINS = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']
const SELECTABLE_GROUP_TYPES = new Set([
  'selector',
  'select',
  'urltest',
  'url-test',
  'fallback',
])

type ManualProxyMenuState = {
  mouseX: number
  mouseY: number
  name: string
}

type ManualGroupMenuState = {
  mouseX: number
  mouseY: number
  name: string
}

type DeleteDependencyDetails = {
  groupRefs: string[]
  ruleRefs: string[]
}

const getProxyItemName = (item: unknown) => {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object' && 'name' in item) {
    const name = (item as { name?: unknown }).name
    return typeof name === 'string' ? name : undefined
  }

  return undefined
}

const groupUsesPolicy = (group: IProxyGroupItem | undefined, name: string) =>
  Array.isArray(group?.all) &&
  group.all.some((item) => getProxyItemName(item) === name)

const isSelectableProxyGroup = (group: IProxyGroupItem | undefined) =>
  typeof group?.type === 'string' &&
  SELECTABLE_GROUP_TYPES.has(group.type.toLowerCase())

const ruleUsesPolicy = (rule: Rule, name: string) =>
  (rule as { proxy?: unknown }).proxy === name

const getRuleLabel = (rule: Rule) => {
  const type = (rule as { type?: unknown }).type
  const payload = (rule as { payload?: unknown }).payload

  return [type, payload]
    .filter((item): item is string => typeof item === 'string' && !!item)
    .join(' · ')
}

const DeleteDependencyContent = (props: {
  name: string | null
  messageKey: string
  dependencies: DeleteDependencyDetails
}) => {
  const { name, messageKey, dependencies } = props
  const { t } = useTranslation()
  const hasGroupRefs = dependencies.groupRefs.length > 0
  const hasRuleRefs = dependencies.ruleRefs.length > 0

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Typography>{t(messageKey as any, { name })}</Typography>

      {hasRuleRefs ? (
        <Alert severity="error">
          <Typography sx={{ fontWeight: 700 }}>
            {t('profiles.modals.deleteDependency.ruleRefsTitle')}
          </Typography>
          <Typography sx={{ mt: 0.5 }}>
            {t('profiles.modals.deleteDependency.ruleRefsHint')}
          </Typography>
          <Box component="ul" sx={{ pl: 2.25, my: 0.75 }}>
            {dependencies.ruleRefs.map((rule) => (
              <li key={rule}>
                <Typography component="span">{rule}</Typography>
              </li>
            ))}
          </Box>
        </Alert>
      ) : null}

      {hasGroupRefs ? (
        <Alert severity="warning">
          <Typography sx={{ fontWeight: 700 }}>
            {t('profiles.modals.deleteDependency.groupRefsTitle')}
          </Typography>
          <Typography sx={{ mt: 0.5 }}>
            {t('profiles.modals.deleteDependency.groupRefsHint')}
          </Typography>
          <Box component="ul" sx={{ pl: 2.25, my: 0.75 }}>
            {dependencies.groupRefs.map((group) => (
              <li key={group}>
                <Typography component="span">{group}</Typography>
              </li>
            ))}
          </Box>
          <Typography sx={{ mt: 0.5 }}>
            {t('profiles.modals.deleteDependency.fallbackHint')}
          </Typography>
        </Alert>
      ) : null}

      {!hasGroupRefs && !hasRuleRefs ? (
        <Typography color="text.secondary">
          {t('profiles.modals.deleteDependency.noRefs')}
        </Typography>
      ) : null}
    </Box>
  )
}

const ProxyPage = () => {
  const { t } = useTranslation()

  // 从 localStorage 恢复链式代理按钮状态
  const [isChainMode, setIsChainMode] = useState(() => {
    try {
      const saved = localStorage.getItem('proxy-chain-mode-enabled')
      return saved === 'true'
    } catch {
      return false
    }
  })

  const [chainConfigData, dispatchChainConfigData] = useReducer(
    (_: string | null, action: string | null) => action,
    null as string | null,
  )

  const { clashConfig } = useClashConfigData()
  const { proxies: proxiesData } = useProxiesData()
  const { rules = [] } = useRulesData()
  const { refreshClashConfig, refreshProxy } = useAppRefreshers()
  const { changeProxy } = useProxySelection({
    onSuccess: refreshProxy,
    onError: (error) => {
      console.error('代理组切换失败', error)
      refreshProxy()
    },
  })
  const { profiles, mutateProfiles, patchCurrent } = useProfiles()
  const [manualOpen, setManualOpen] = useState(false)
  const [manualMode, setManualMode] = useState<'add' | 'edit'>('add')
  const [activeManualProxy, setActiveManualProxy] =
    useState<IProxyConfig | null>(null)
  const manualProxyIdCacheRef = useRef<Record<string, string>>({})
  const [manualProxyNames, setManualProxyNames] = useState<string[]>([])
  const [manualProxyIdentityMap, setManualProxyIdentityMap] =
    useState<PolicyIdentityMap>({})
  const [manualProxyDialerMap, setManualProxyDialerMap] = useState<
    Record<string, string>
  >({})
  const [manualProxyMenu, setManualProxyMenu] =
    useState<ManualProxyMenuState | null>(null)
  const [deleteProxyName, setDeleteProxyName] = useState<string | null>(null)
  const [manualGroupOpen, setManualGroupOpen] = useState(false)
  const [manualGroupMode, setManualGroupMode] = useState<'add' | 'edit'>('add')
  const [activeManualGroup, setActiveManualGroup] =
    useState<IProxyGroupConfig | null>(null)
  const manualGroupIdCacheRef = useRef<Record<string, string>>({})
  const [manualGroupNames, setManualGroupNames] = useState<string[]>([])
  const [manualGroupIdentityMap, setManualGroupIdentityMap] =
    useState<PolicyIdentityMap>({})
  const [manualGroupMenu, setManualGroupMenu] =
    useState<ManualGroupMenuState | null>(null)
  const [deleteGroupName, setDeleteGroupName] = useState<string | null>(null)
  const [selectionOverrides, setSelectionOverrides] = useState<
    Record<string, string>
  >({})

  const updateChainConfigData = useCallback((value: string | null) => {
    dispatchChainConfigData(value)
  }, [])
  const { verge } = useVerge()

  const normalizedMode = clashConfig?.mode?.toLowerCase()
  const curMode = isMode(normalizedMode) ? normalizedMode : undefined
  const chainWarning = t('proxies.page.chain.warning')
  const currentProfile = profiles?.items?.find(
    (item) => item.uid === profiles.current,
  )
  const proxyNames: string[] = Array.from(
    new Set<string>(
      (proxiesData?.proxies ?? [])
        .map((proxy: IProxyItem) => proxy.name)
        .filter(
          (name: unknown): name is string =>
            typeof name === 'string' && name.length > 0,
        ),
    ),
  )
  const dialerProxyOptions = useMemo(
    () =>
      proxyNames.filter((name) => !BUILTIN_PROXY_NAMES.has(name.toUpperCase())),
    [proxyNames],
  )
  const dialogExistingNames = useMemo(
    () =>
      manualMode === 'edit' && activeManualProxy
        ? proxyNames.filter((name) => name !== activeManualProxy.name)
        : proxyNames,
    [activeManualProxy, manualMode, proxyNames],
  )
  const runtimeProxyDialerMap = useMemo(
    () =>
      Object.fromEntries(
        ((proxiesData?.proxies ?? []) as IProxyConfig[])
          .map((proxy) => [proxy.name, proxy['dialer-proxy']])
          .filter(
            (entry): entry is [string, string] =>
              typeof entry[0] === 'string' &&
              !!entry[0] &&
              typeof entry[1] === 'string' &&
              !!entry[1],
          ),
      ),
    [proxiesData?.proxies],
  )
  const proxyDialerMap = useMemo(
    () => ({ ...runtimeProxyDialerMap, ...manualProxyDialerMap }),
    [manualProxyDialerMap, runtimeProxyDialerMap],
  )
  const runtimeGroupNames = useMemo<string[]>(
    () =>
      Array.from(
        new Set(
          (proxiesData?.groups ?? [])
            .map((group: IProxyGroupItem) => group.name)
            .filter(
              (name: unknown): name is string =>
                typeof name === 'string' && name.length > 0,
            ),
        ),
      ),
    [proxiesData?.groups],
  )
  const runtimeGroupDependencyMap = useMemo(() => {
    const groupNameSet = new Set(runtimeGroupNames)
    const records = proxiesData?.records ?? {}

    return new Map(
      runtimeGroupNames.map((name) => {
        const record = records[name] as { all?: unknown[] } | undefined
        const dependencies = Array.isArray(record?.all)
          ? record.all
              .map((item) =>
                typeof item === 'string'
                  ? item
                  : item && typeof item === 'object' && 'name' in item
                    ? String((item as { name?: unknown }).name ?? '')
                    : '',
              )
              .filter((item) => groupNameSet.has(item))
          : []

        return [name, dependencies] as const
      }),
    )
  }, [proxiesData?.records, runtimeGroupNames])
  const selectableGroupPolicyNames = useMemo(() => {
    const activeName =
      manualGroupMode === 'edit' ? activeManualGroup?.name : undefined

    if (!activeName) return runtimeGroupNames

    return runtimeGroupNames.filter(
      (name) =>
        name !== activeName &&
        !groupDependsOn(runtimeGroupDependencyMap, name, activeName),
    )
  }, [
    activeManualGroup?.name,
    manualGroupMode,
    runtimeGroupDependencyMap,
    runtimeGroupNames,
  ])
  const groupPolicyOptions = useMemo<string[]>(
    () =>
      Array.from(
        new Set([
          ...GROUP_POLICY_BUILTINS,
          ...proxyNames,
          ...selectableGroupPolicyNames,
        ]),
      ),
    [proxyNames, selectableGroupPolicyNames],
  )
  const groupDialogExistingNames = useMemo<string[]>(
    () =>
      manualGroupMode === 'edit' && activeManualGroup
        ? runtimeGroupNames.filter((name) => name !== activeManualGroup.name)
        : runtimeGroupNames,
    [activeManualGroup, manualGroupMode, runtimeGroupNames],
  )
  const activeMenuGroup = useMemo(
    () =>
      manualGroupMenu
        ? (proxiesData?.groups ?? []).find(
            (group: IProxyGroupItem) => group.name === manualGroupMenu.name,
          )
        : undefined,
    [manualGroupMenu, proxiesData?.groups],
  )
  const activeMenuGroupEditable = manualGroupMenu
    ? manualGroupNames.includes(manualGroupMenu.name)
    : false
  const activeMenuGroupIsSelector =
    activeMenuGroup?.type?.toLowerCase() === 'selector' ||
    activeMenuGroup?.type?.toLowerCase() === 'select'
  const activeMenuGroupOptions = activeMenuGroup?.all ?? []
  const getDeleteDependencies = useCallback(
    (name: string): DeleteDependencyDetails => {
      const groupRefs = [
        proxiesData?.global,
        ...((proxiesData?.groups ?? []) as IProxyGroupItem[]),
      ]
        .filter(
          (group): group is IProxyGroupItem =>
            !!group && group.name !== name && groupUsesPolicy(group, name),
        )
        .map((group) => group.name)

      const ruleRefs = rules
        .filter((rule) => ruleUsesPolicy(rule, name))
        .map(getRuleLabel)
        .filter(Boolean)

      return {
        groupRefs: Array.from(new Set(groupRefs)),
        ruleRefs: Array.from(new Set(ruleRefs)),
      }
    },
    [proxiesData?.global, proxiesData?.groups, rules],
  )
  const deleteProxyDependencies = useMemo(
    () =>
      deleteProxyName
        ? getDeleteDependencies(deleteProxyName)
        : { groupRefs: [], ruleRefs: [] },
    [deleteProxyName, getDeleteDependencies],
  )
  const deleteGroupDependencies = useMemo(
    () =>
      deleteGroupName
        ? getDeleteDependencies(deleteGroupName)
        : { groupRefs: [], ruleRefs: [] },
    [deleteGroupName, getDeleteDependencies],
  )

  const refreshManualProxyNames = useCallback(
    async (proxiesUid?: string) => {
      const uid = proxiesUid ?? currentProfile?.option?.proxies
      if (!uid) {
        setManualProxyNames([])
        setManualProxyIdentityMap({})
        setManualProxyDialerMap({})
        return
      }

      try {
        const data = await readProfileFile(uid)
        const ensured = ensureManualProxyDocumentIds(
          normalizeManualProxyDocument(data),
          manualProxyIdCacheRef.current,
        )
        const document = ensured.document
        setManualProxyNames(getManualProxyNames(document))
        setManualProxyIdentityMap(getManualProxyIdentityMap(document))
        setManualProxyDialerMap(getManualProxyDialerMap(document))
      } catch (err) {
        console.warn('[ManualProxy] Failed to read manual proxies:', err)
        setManualProxyNames([])
        setManualProxyIdentityMap({})
        setManualProxyDialerMap({})
      }
    },
    [currentProfile?.option?.proxies],
  )

  const refreshManualGroupNames = useCallback(
    async (groupsUid?: string) => {
      const uid = groupsUid ?? currentProfile?.option?.groups
      if (!uid) {
        setManualGroupNames([])
        setManualGroupIdentityMap({})
        return
      }

      try {
        const data = await readProfileFile(uid)
        const ensured = ensureManualGroupDocumentIds(
          normalizeManualGroupDocument(data),
          manualGroupIdCacheRef.current,
        )
        setManualGroupNames(getManualGroupNames(ensured.document))
        setManualGroupIdentityMap(getManualGroupIdentityMap(ensured.document))
      } catch (err) {
        console.warn('[ManualGroup] Failed to read manual groups:', err)
        setManualGroupNames([])
        setManualGroupIdentityMap({})
      }
    },
    [currentProfile?.option?.groups],
  )

  const onChangeMode = useLockFn(async (mode: Mode) => {
    // 断开连接
    if (mode !== curMode && verge?.auto_close_connection) {
      closeAllConnections()
    }
    await patchClashMode(mode)
    refreshClashConfig()
  })

  const onToggleChainMode = useLockFn(async () => {
    const newChainMode = !isChainMode

    setIsChainMode(newChainMode)
    // 保存链式代理按钮状态到 localStorage
    localStorage.setItem('proxy-chain-mode-enabled', newChainMode.toString())

    if (!newChainMode) {
      // 退出链式代理模式时，清除链式代理配置
      try {
        debugLog('Exiting chain mode, clearing chain configuration')
        await updateProxyChainConfigInRuntime(null)
        debugLog('Chain configuration cleared successfully')
      } catch (error) {
        console.error('Failed to clear chain configuration:', error)
      }
    }
  })

  const saveManualProxyDocument = useCallback(
    async (proxiesUid: string, document: ManualProxyDocument) => {
      if (
        !(await saveProfileFile(proxiesUid, dumpManualProxyDocument(document)))
      ) {
        return false
      }

      setManualProxyNames(getManualProxyNames(document))
      setManualProxyIdentityMap(getManualProxyIdentityMap(document))
      setManualProxyDialerMap(getManualProxyDialerMap(document))
      if (await enhanceProfiles()) {
        await Promise.all([refreshProxy(), refreshClashConfig()])
      }
      await mutateProfiles()
      showNotice.success('shared.feedback.notifications.saved')
      return true
    },
    [mutateProfiles, refreshClashConfig, refreshProxy],
  )

  const saveManualGroupDocument = useCallback(
    async (groupsUid: string, document: ManualGroupDocument) => {
      if (
        !(await saveProfileFile(groupsUid, dumpManualGroupDocument(document)))
      ) {
        return false
      }

      setManualGroupNames(getManualGroupNames(document))
      setManualGroupIdentityMap(getManualGroupIdentityMap(document))
      if (await enhanceProfiles()) {
        await Promise.all([refreshProxy(), refreshClashConfig()])
      }
      await mutateProfiles()
      showNotice.success('shared.feedback.notifications.saved')
      return true
    },
    [mutateProfiles, refreshClashConfig, refreshProxy],
  )

  const updateSelectedPolicyReferences = useCallback(
    async (oldName: string, newName: string, renameGroupName = false) => {
      const result = renameProfileSelectedPolicyReferences(
        currentProfile?.selected,
        oldName,
        newName,
        { renameGroupName },
      )

      if (!result.changed) return

      await patchCurrent({ selected: result.selected })
    },
    [currentProfile?.selected, patchCurrent],
  )

  const getGroupsSelectingPolicy = useCallback(
    (policyName: string) =>
      [
        proxiesData?.global,
        ...((proxiesData?.groups ?? []) as IProxyGroupItem[]),
      ]
        .filter(
          (group): group is IProxyGroupItem =>
            isSelectableProxyGroup(group) &&
            group.now === policyName &&
            groupUsesPolicy(group, policyName),
        )
        .map((group) => group.name),
    [proxiesData?.global, proxiesData?.groups],
  )

  const restoreRenamedPolicySelection = useCallback(
    async (groupNames: string[], newName: string) => {
      if (groupNames.length === 0) return []

      const results = await Promise.all(
        groupNames.map(async (groupName) => {
          try {
            await selectNodeForGroup(groupName, newName)
            return null
          } catch (err) {
            console.warn(
              `[ManualPolicy] Failed to restore ${groupName} selection to ${newName}:`,
              err,
            )
            return groupName
          }
        }),
      )

      return results.filter((groupName): groupName is string => !!groupName)
    },
    [],
  )

  const showManualPolicySaveNotice = useCallback(
    (failedSelectionGroupNames: string[]) => {
      if (failedSelectionGroupNames.length > 0) {
        showNotice.error(
          `Saved, but failed to restore selection for: ${failedSelectionGroupNames.join(', ')}. Please reselect manually.`,
        )
        return
      }

      showNotice.success('shared.feedback.notifications.saved')
    },
    [],
  )

  const setRenamedPolicySelectionOverrides = useCallback(
    (groupNames: string[], newName: string) => {
      if (groupNames.length === 0) return

      setSelectionOverrides((prev) => {
        const next = { ...prev }
        for (const groupName of groupNames) {
          next[groupName] = newName
        }
        return next
      })
    },
    [],
  )

  const clearRenamedPolicySelectionOverrides = useCallback(
    (groupNames: string[], newName: string) => {
      if (groupNames.length === 0) return

      setSelectionOverrides((prev) => {
        let changed = false
        const next = { ...prev }

        for (const groupName of groupNames) {
          if (next[groupName] === newName) {
            delete next[groupName]
            changed = true
          }
        }

        return changed ? next : prev
      })
    },
    [],
  )

  const onAddManualProxy = useLockFn(
    async (proxy: IProxyConfig, placement: 'prepend' | 'append') => {
      try {
        const { proxiesUid } = await ensureProfileProxies(currentProfile?.uid)
        const data = await readProfileFile(proxiesUid)
        const document = ensureManualProxyDocumentIds(
          normalizeManualProxyDocument(data),
          manualProxyIdCacheRef.current,
        ).document
        const nextProxy = ensurePolicyId(proxy)

        await saveManualProxyDocument(proxiesUid, {
          prepend:
            placement === 'prepend'
              ? [nextProxy, ...document.prepend]
              : document.prepend,
          append:
            placement === 'append'
              ? [...document.append, nextProxy]
              : document.append,
          delete: document.delete,
        })
      } catch (err) {
        showNotice.error(err)
      }
    },
  )

  const onEditManualProxy = useLockFn(async (name: string) => {
    try {
      const { proxiesUid } = await ensureProfileProxies(currentProfile?.uid)
      const data = await readProfileFile(proxiesUid)
      const document = ensureManualProxyDocumentIds(
        normalizeManualProxyDocument(data),
        manualProxyIdCacheRef.current,
      ).document
      const proxy = [...document.prepend, ...document.append].find(
        (item) => item.name === name,
      )

      if (!proxy) {
        showNotice.error('profiles.modals.manualProxy.errors.notEditable')
        return
      }

      setManualMode('edit')
      setActiveManualProxy(proxy)
      setManualOpen(true)
    } catch (err) {
      showNotice.error(err)
    }
  })

  const onSaveManualProxy = useLockFn(async (proxy: IProxyConfig) => {
    if (!activeManualProxy) return

    try {
      const { proxiesUid, groupsUid, rulesUid } = await ensureProfileProxies(
        currentProfile?.uid,
      )
      const data = await readProfileFile(proxiesUid)
      const document = ensureManualProxyDocumentIds(
        normalizeManualProxyDocument(data),
        manualProxyIdCacheRef.current,
      ).document
      const oldName = activeManualProxy.name
      const newName = proxy.name
      const isRenamed = oldName !== newName
      const nextProxy = {
        ...proxy,
        [POLICY_ID_KEY]: getPolicyId(activeManualProxy) || getPolicyId(proxy),
      } as IProxyConfig
      let replaced = false
      const replaceProxy = (item: IProxyConfig) => {
        if (item.name !== oldName) return item
        replaced = true
        return ensurePolicyId(nextProxy)
      }

      const replacedDocument = {
        prepend: document.prepend.map(replaceProxy),
        append: document.append.map(replaceProxy),
        delete: document.delete,
      }
      const nextDocument = renameManualProxyDialerReferences(
        replacedDocument,
        oldName,
        newName,
      )

      if (!replaced) {
        showNotice.error('profiles.modals.manualProxy.errors.notEditable')
        return
      }

      if (isRenamed) {
        const [groupsData, rulesData] = await Promise.all([
          readProfileFile(groupsUid),
          readProfileFile(rulesUid),
        ])
        const groupsDocument = ensureManualGroupDocumentIds(
          normalizeManualGroupDocument(groupsData),
          manualGroupIdCacheRef.current,
        ).document
        const nextGroupsDocument = renamePolicyInManualGroups(
          groupsDocument,
          oldName,
          newName,
        )
        const rulesDocument = normalizeManualRules(rulesData)
        const nextRulesDocument = renamePolicyInManualRules(
          rulesDocument,
          oldName,
          newName,
          rules,
        )

        const currentProxyNames = getManualProxyNames(document)
        const nextProxyNames = getManualProxyNames(nextDocument)
        const currentProxyIdentityMap = getManualProxyIdentityMap(document)
        const nextProxyIdentityMap = getManualProxyIdentityMap(nextDocument)
        const currentProxyDialerMap = getManualProxyDialerMap(document)
        const nextProxyDialerMap = getManualProxyDialerMap(nextDocument)
        const currentGroupNames = getManualGroupNames(groupsDocument)
        const nextGroupNames = getManualGroupNames(nextGroupsDocument)
        const currentGroupIdentityMap =
          getManualGroupIdentityMap(groupsDocument)
        const nextGroupIdentityMap =
          getManualGroupIdentityMap(nextGroupsDocument)
        const selectingGroupNames = getGroupsSelectingPolicy(oldName)
        const rollbackRenameUiState = () => {
          setManualProxyNames(getManualProxyNames(document))
          setManualProxyIdentityMap(getManualProxyIdentityMap(document))
          setManualProxyDialerMap(getManualProxyDialerMap(document))
          setManualGroupNames(getManualGroupNames(groupsDocument))
          setManualGroupIdentityMap(getManualGroupIdentityMap(groupsDocument))
        }

        setManualProxyNames(mergeNames(currentProxyNames, nextProxyNames))
        setManualProxyIdentityMap(
          mergeMaps(currentProxyIdentityMap, nextProxyIdentityMap),
        )
        setManualProxyDialerMap(
          mergeMaps(currentProxyDialerMap, nextProxyDialerMap),
        )
        setManualGroupNames(mergeNames(currentGroupNames, nextGroupNames))
        setManualGroupIdentityMap(
          mergeMaps(currentGroupIdentityMap, nextGroupIdentityMap),
        )
        setRenamedPolicySelectionOverrides(selectingGroupNames, newName)
        let saved = false
        try {
          saved = await saveProfileOverlayFiles([
            {
              index: proxiesUid,
              fileData: dumpManualProxyDocument(nextDocument),
            },
            {
              index: groupsUid,
              fileData: dumpManualGroupDocument(nextGroupsDocument),
            },
            {
              index: rulesUid,
              fileData: dumpManualRules(nextRulesDocument),
            },
          ])
        } catch (err) {
          rollbackRenameUiState()
          clearRenamedPolicySelectionOverrides(selectingGroupNames, newName)
          throw err
        }

        if (!saved) {
          rollbackRenameUiState()
          clearRenamedPolicySelectionOverrides(selectingGroupNames, newName)
          return
        }

        let failedSelectionGroupNames: string[] = []
        try {
          await updateSelectedPolicyReferences(oldName, newName)
          failedSelectionGroupNames = await restoreRenamedPolicySelection(
            selectingGroupNames,
            newName,
          )
          await Promise.all([refreshProxy(), refreshClashConfig()])
        } catch (err) {
          setManualProxyNames(nextProxyNames)
          setManualProxyIdentityMap(nextProxyIdentityMap)
          setManualProxyDialerMap(nextProxyDialerMap)
          setManualGroupNames(nextGroupNames)
          setManualGroupIdentityMap(nextGroupIdentityMap)
          await mutateProfiles()
          throw err
        } finally {
          clearRenamedPolicySelectionOverrides(selectingGroupNames, newName)
        }
        setManualProxyNames(nextProxyNames)
        setManualProxyIdentityMap(nextProxyIdentityMap)
        setManualProxyDialerMap(nextProxyDialerMap)
        setManualGroupNames(nextGroupNames)
        setManualGroupIdentityMap(nextGroupIdentityMap)
        await mutateProfiles()
        showManualPolicySaveNotice(failedSelectionGroupNames)
        setActiveManualProxy(null)
        setManualMode('add')
        return
      }

      await saveManualProxyDocument(proxiesUid, nextDocument)
      setActiveManualProxy(null)
      setManualMode('add')
    } catch (err) {
      showNotice.error(err)
    }
  })

  const onDuplicateManualProxy = useLockFn(async (name: string) => {
    try {
      const { proxiesUid } = await ensureProfileProxies(currentProfile?.uid)
      const data = await readProfileFile(proxiesUid)
      const document = ensureManualProxyDocumentIds(
        normalizeManualProxyDocument(data),
        manualProxyIdCacheRef.current,
      ).document
      const proxy = [...document.prepend, ...document.append].find(
        (item) => item.name === name,
      )

      if (!proxy) {
        showNotice.error('profiles.modals.manualProxy.errors.notEditable')
        return
      }

      setManualMode('add')
      setActiveManualProxy(
        withNewPolicyId({
          ...proxy,
          name: getDuplicatedPolicyName(proxy.name, proxyNames),
        }),
      )
      setManualOpen(true)
    } catch (err) {
      showNotice.error(err)
    }
  })

  const onDeleteManualProxy = useLockFn(async (name: string) => {
    try {
      const dependencies = getDeleteDependencies(name)
      if (dependencies.ruleRefs.length > 0) {
        showNotice.error('profiles.modals.deleteDependency.blockedNotice')
        return
      }

      const { proxiesUid, groupsUid } = await ensureProfileProxies(
        currentProfile?.uid,
      )
      const data = await readProfileFile(proxiesUid)
      const document = ensureManualProxyDocumentIds(
        normalizeManualProxyDocument(data),
        manualProxyIdCacheRef.current,
      ).document
      const nextDocument = {
        prepend: document.prepend.filter((proxy) => proxy.name !== name),
        append: document.append.filter((proxy) => proxy.name !== name),
        delete: document.delete,
      }

      if (
        nextDocument.prepend.length === document.prepend.length &&
        nextDocument.append.length === document.append.length
      ) {
        showNotice.error('profiles.modals.manualProxy.errors.notEditable')
        return
      }

      const groupsData = await readProfileFile(groupsUid)
      const groupsDocument = ensureManualGroupDocumentIds(
        normalizeManualGroupDocument(groupsData),
        manualGroupIdCacheRef.current,
      ).document
      const nextGroupsDocument = removePolicyFromManualGroups(
        groupsDocument,
        name,
      )
      if (
        !(await saveProfileOverlayFiles([
          {
            index: proxiesUid,
            fileData: dumpManualProxyDocument(nextDocument),
          },
          {
            index: groupsUid,
            fileData: dumpManualGroupDocument(nextGroupsDocument),
          },
        ]))
      ) {
        return
      }
      setManualProxyNames(getManualProxyNames(nextDocument))
      setManualProxyIdentityMap(getManualProxyIdentityMap(nextDocument))
      setManualProxyDialerMap(getManualProxyDialerMap(nextDocument))
      setManualGroupNames(getManualGroupNames(nextGroupsDocument))
      setManualGroupIdentityMap(getManualGroupIdentityMap(nextGroupsDocument))
      await Promise.all([refreshProxy(), refreshClashConfig()])
      await mutateProfiles()
      showNotice.success('shared.feedback.notifications.saved')
      setDeleteProxyName(null)
    } catch (err) {
      showNotice.error(err)
    }
  })

  const openManualAdd = () => {
    setManualMode('add')
    setActiveManualProxy(null)
    setManualOpen(true)
  }

  const closeManualViewer = () => {
    setManualOpen(false)
    setActiveManualProxy(null)
    setManualMode('add')
  }

  const openManualProxyMenu = (
    event: MouseEvent<HTMLElement>,
    name: string,
  ) => {
    setManualProxyMenu(
      manualProxyMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
            name,
          }
        : null,
    )
  }

  const closeManualProxyMenu = () => setManualProxyMenu(null)

  const runManualProxyMenuAction = (action: (name: string) => void) => {
    if (!manualProxyMenu) return
    const { name } = manualProxyMenu
    closeManualProxyMenu()
    action(name)
  }

  const onAddManualGroup = useLockFn(
    async (group: IProxyGroupConfig, placement: 'prepend' | 'append') => {
      try {
        const { groupsUid } = await ensureProfileProxies(currentProfile?.uid)
        const data = await readProfileFile(groupsUid)
        const document = ensureManualGroupDocumentIds(
          normalizeManualGroupDocument(data),
          manualGroupIdCacheRef.current,
        ).document
        const nextGroup = ensurePolicyId(group)

        await saveManualGroupDocument(groupsUid, {
          prepend:
            placement === 'prepend'
              ? [nextGroup, ...document.prepend]
              : document.prepend,
          append:
            placement === 'append'
              ? [...document.append, nextGroup]
              : document.append,
          delete: document.delete,
        })
      } catch (err) {
        showNotice.error(err)
      }
    },
  )

  const onEditManualGroup = useLockFn(async (name: string) => {
    try {
      const { groupsUid } = await ensureProfileProxies(currentProfile?.uid)
      const data = await readProfileFile(groupsUid)
      const document = ensureManualGroupDocumentIds(
        normalizeManualGroupDocument(data),
        manualGroupIdCacheRef.current,
      ).document
      const group = [...document.prepend, ...document.append].find(
        (item) => item.name === name,
      )

      if (!group) {
        showNotice.error('profiles.modals.manualGroup.errors.notEditable')
        return
      }

      setManualGroupMode('edit')
      setActiveManualGroup(group)
      setManualGroupOpen(true)
    } catch (err) {
      showNotice.error(err)
    }
  })

  const onSaveManualGroup = useLockFn(async (group: IProxyGroupConfig) => {
    if (!activeManualGroup) return

    try {
      const { groupsUid, rulesUid } = await ensureProfileProxies(
        currentProfile?.uid,
      )
      const data = await readProfileFile(groupsUid)
      const document = ensureManualGroupDocumentIds(
        normalizeManualGroupDocument(data),
        manualGroupIdCacheRef.current,
      ).document
      const oldName = activeManualGroup.name
      const newName = group.name
      const isRenamed = oldName !== newName
      const nextGroup = ensurePolicyId({
        ...group,
        [POLICY_ID_KEY]: getPolicyId(activeManualGroup) || getPolicyId(group),
      } as IProxyGroupConfig)
      let replaced = false
      const replaceGroup = (item: IProxyGroupConfig) => {
        if (item.name !== oldName) return item
        replaced = true
        return nextGroup
      }
      const replacedDocument = {
        prepend: document.prepend.map(replaceGroup),
        append: document.append.map(replaceGroup),
        delete: document.delete,
      }
      const nextDocument = renamePolicyInManualGroups(
        replacedDocument,
        oldName,
        newName,
      )

      if (!replaced) {
        showNotice.error('profiles.modals.manualGroup.errors.notEditable')
        return
      }

      if (isRenamed) {
        const rulesData = await readProfileFile(rulesUid)
        const rulesDocument = normalizeManualRules(rulesData)
        const nextRulesDocument = renamePolicyInManualRules(
          rulesDocument,
          oldName,
          newName,
          rules,
        )
        const prevChainGroup = localStorage.getItem('proxy-chain-group')

        const currentGroupNames = getManualGroupNames(document)
        const nextGroupNames = getManualGroupNames(nextDocument)
        const currentGroupIdentityMap = getManualGroupIdentityMap(document)
        const nextGroupIdentityMap = getManualGroupIdentityMap(nextDocument)
        const selectingGroupNames = getGroupsSelectingPolicy(oldName)
        const rollbackRenameUiState = () => {
          setManualGroupNames(getManualGroupNames(document))
          setManualGroupIdentityMap(getManualGroupIdentityMap(document))
          if (prevChainGroup === oldName) {
            localStorage.setItem('proxy-chain-group', oldName)
          }
        }

        setManualGroupNames(mergeNames(currentGroupNames, nextGroupNames))
        setManualGroupIdentityMap(
          mergeMaps(currentGroupIdentityMap, nextGroupIdentityMap),
        )
        if (prevChainGroup === oldName) {
          localStorage.setItem('proxy-chain-group', newName)
        }
        setRenamedPolicySelectionOverrides(selectingGroupNames, newName)
        let saved = false
        try {
          saved = await saveProfileOverlayFiles([
            {
              index: groupsUid,
              fileData: dumpManualGroupDocument(nextDocument),
            },
            {
              index: rulesUid,
              fileData: dumpManualRules(nextRulesDocument),
            },
          ])
        } catch (err) {
          rollbackRenameUiState()
          clearRenamedPolicySelectionOverrides(selectingGroupNames, newName)
          throw err
        }

        if (!saved) {
          rollbackRenameUiState()
          clearRenamedPolicySelectionOverrides(selectingGroupNames, newName)
          return
        }

        let failedSelectionGroupNames: string[] = []
        try {
          await updateSelectedPolicyReferences(oldName, newName, true)
          failedSelectionGroupNames = await restoreRenamedPolicySelection(
            selectingGroupNames,
            newName,
          )
          await Promise.all([refreshProxy(), refreshClashConfig()])
        } catch (err) {
          setManualGroupNames(nextGroupNames)
          setManualGroupIdentityMap(nextGroupIdentityMap)
          await mutateProfiles()
          throw err
        } finally {
          clearRenamedPolicySelectionOverrides(selectingGroupNames, newName)
        }
        setManualGroupNames(nextGroupNames)
        setManualGroupIdentityMap(nextGroupIdentityMap)
        await mutateProfiles()
        showManualPolicySaveNotice(failedSelectionGroupNames)
        setActiveManualGroup(null)
        setManualGroupMode('add')
        return
      }

      await saveManualGroupDocument(groupsUid, nextDocument)
      setActiveManualGroup(null)
      setManualGroupMode('add')
    } catch (err) {
      showNotice.error(err)
    }
  })

  const onDuplicateManualGroup = useLockFn(async (name: string) => {
    try {
      const { groupsUid } = await ensureProfileProxies(currentProfile?.uid)
      const data = await readProfileFile(groupsUid)
      const document = ensureManualGroupDocumentIds(
        normalizeManualGroupDocument(data),
        manualGroupIdCacheRef.current,
      ).document
      const group = [...document.prepend, ...document.append].find(
        (item) => item.name === name,
      )

      if (!group) {
        showNotice.error('profiles.modals.manualGroup.errors.notEditable')
        return
      }

      setManualGroupMode('add')
      setActiveManualGroup(
        withNewPolicyId({
          ...group,
          name: getDuplicatedPolicyName(group.name, runtimeGroupNames),
        }),
      )
      setManualGroupOpen(true)
    } catch (err) {
      showNotice.error(err)
    }
  })

  const onDeleteManualGroup = useLockFn(async (name: string) => {
    try {
      const dependencies = getDeleteDependencies(name)
      if (dependencies.ruleRefs.length > 0) {
        showNotice.error('profiles.modals.deleteDependency.blockedNotice')
        return
      }

      const { groupsUid } = await ensureProfileProxies(currentProfile?.uid)
      const data = await readProfileFile(groupsUid)
      const document = ensureManualGroupDocumentIds(
        normalizeManualGroupDocument(data),
        manualGroupIdCacheRef.current,
      ).document
      const removedDocument = {
        prepend: document.prepend.filter((group) => group.name !== name),
        append: document.append.filter((group) => group.name !== name),
        delete: document.delete,
      }
      const nextDocument = removePolicyFromManualGroups(removedDocument, name)

      if (
        removedDocument.prepend.length === document.prepend.length &&
        removedDocument.append.length === document.append.length
      ) {
        showNotice.error('profiles.modals.manualGroup.errors.notEditable')
        return
      }

      await saveManualGroupDocument(groupsUid, nextDocument)
      setDeleteGroupName(null)
    } catch (err) {
      showNotice.error(err)
    }
  })

  const openManualGroupAdd = () => {
    setManualGroupMode('add')
    setActiveManualGroup(null)
    setManualGroupOpen(true)
  }

  const closeManualGroupViewer = () => {
    setManualGroupOpen(false)
    setActiveManualGroup(null)
    setManualGroupMode('add')
  }

  const openManualGroupMenu = (
    event: MouseEvent<HTMLElement>,
    group: IProxyGroupItem,
  ) => {
    setManualGroupMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      name: group.name,
    })
  }

  const closeManualGroupMenu = () => setManualGroupMenu(null)

  const runManualGroupMenuAction = (action: (name: string) => void) => {
    if (!manualGroupMenu) return
    const { name } = manualGroupMenu
    closeManualGroupMenu()
    action(name)
  }

  const selectGroupProxy = (proxyName: string) => {
    if (!activeMenuGroup) return
    closeManualGroupMenu()
    changeProxy(activeMenuGroup.name, proxyName, activeMenuGroup.now)
  }

  useEffect(() => {
    void refreshManualProxyNames()
  }, [refreshManualProxyNames])

  useEffect(() => {
    void refreshManualGroupNames()
  }, [refreshManualGroupNames])

  // 当开启链式代理模式时，获取配置数据
  useEffect(() => {
    if (!isChainMode) {
      updateChainConfigData(null)
      return
    }

    let cancelled = false

    const fetchChainConfig = async () => {
      try {
        const exitNode = localStorage.getItem('proxy-chain-exit-node')

        if (!exitNode) {
          console.error('No proxy chain exit node found in localStorage')
          if (!cancelled) {
            updateChainConfigData('')
          }
          return
        }

        const configData = await getRuntimeProxyChainConfig(exitNode)
        if (!cancelled) {
          updateChainConfigData(configData || '')
        }
      } catch (error) {
        console.error('Failed to get runtime proxy chain config:', error)
        if (!cancelled) {
          updateChainConfigData('')
        }
      }
    }

    fetchChainConfig()

    return () => {
      cancelled = true
    }
  }, [isChainMode, updateChainConfigData])

  useEffect(() => {
    if (normalizedMode && !isMode(normalizedMode)) {
      onChangeMode('rule')
    }
  }, [normalizedMode, onChangeMode])

  return (
    <>
      <BasePage
        full
        contentStyle={{ height: '101.5%' }}
        title={
          isChainMode ? (
            <Box
              component="span"
              data-tauri-drag-region="true"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
            >
              {t('proxies.page.title.chainMode')}
              <TooltipIcon
                title={chainWarning}
                icon={WarningRounded}
                color="warning"
                sx={{ p: 0.25 }}
              />
            </Box>
          ) : (
            t('proxies.page.title.default')
          )
        }
        header={
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <ProviderButton />

            <ButtonGroup size="small">
              {MODES.map((mode) => (
                <Button
                  key={mode}
                  variant={mode === curMode ? 'contained' : 'outlined'}
                  onClick={() => onChangeMode(mode)}
                  sx={{ textTransform: 'capitalize' }}
                >
                  {t(`proxies.page.modes.${mode}`)}
                </Button>
              ))}
            </ButtonGroup>

            <Button
              size="small"
              variant={isChainMode ? 'contained' : 'outlined'}
              onClick={onToggleChainMode}
              sx={{ ml: 1 }}
              startIcon={
                isChainMode ? (
                  <LanRounded fontSize="small" />
                ) : (
                  <LanOutlined fontSize="small" />
                )
              }
            >
              {t('proxies.page.actions.toggleChain')}
            </Button>
          </Box>
        }
      >
        <ProxyGroups
          mode={curMode ?? 'rule'}
          isChainMode={isChainMode}
          chainConfigData={chainConfigData}
          editableProxyNames={manualProxyNames}
          proxyIdentityMap={manualProxyIdentityMap}
          groupIdentityMap={manualGroupIdentityMap}
          selectionOverrides={selectionOverrides}
          onEditProxy={onEditManualProxy}
          onProxyContextMenu={openManualProxyMenu}
          onGroupContextMenu={openManualGroupMenu}
          onAddProxy={openManualAdd}
          onAddGroup={openManualGroupAdd}
        />
      </BasePage>

      <Menu
        open={!!manualGroupMenu}
        onClose={closeManualGroupMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          manualGroupMenu
            ? { top: manualGroupMenu.mouseY, left: manualGroupMenu.mouseX }
            : undefined
        }
        slotProps={{ list: { dense: true, sx: { minWidth: 220 } } }}
      >
        <MenuItem
          disabled={!activeMenuGroupEditable}
          onClick={() => runManualGroupMenuAction(onEditManualGroup)}
        >
          <ListItemIcon>
            <EditRounded fontSize="small" />
          </ListItemIcon>
          {t('profiles.modals.manualGroup.actions.edit')}
        </MenuItem>
        <MenuItem
          disabled={!activeMenuGroupEditable}
          onClick={() => runManualGroupMenuAction(onDuplicateManualGroup)}
        >
          <ListItemIcon>
            <ContentCopyRounded fontSize="small" />
          </ListItemIcon>
          {t('profiles.modals.manualGroup.actions.duplicate')}
        </MenuItem>
        <MenuItem
          disabled={!activeMenuGroupEditable}
          onClick={() =>
            runManualGroupMenuAction((name) => setDeleteGroupName(name))
          }
          sx={{ color: activeMenuGroupEditable ? 'error.main' : undefined }}
        >
          <ListItemIcon
            sx={{ color: activeMenuGroupEditable ? 'error.main' : undefined }}
          >
            <DeleteRounded fontSize="small" />
          </ListItemIcon>
          {t('profiles.modals.manualGroup.actions.delete')}
        </MenuItem>
        {activeMenuGroupIsSelector && (
          <>
            <Divider />
            <MenuItem disabled>
              {t('profiles.modals.manualGroup.actions.options')}
            </MenuItem>
            {activeMenuGroupOptions.map((proxy: IProxyItem) => (
              <MenuItem
                key={proxy.name}
                selected={activeMenuGroup.now === proxy.name}
                onClick={() => selectGroupProxy(proxy.name)}
              >
                <ListItemIcon>
                  {activeMenuGroup.now === proxy.name ? (
                    <CheckRounded fontSize="small" />
                  ) : null}
                </ListItemIcon>
                {proxy.name}
              </MenuItem>
            ))}
          </>
        )}
      </Menu>

      <Menu
        open={!!manualProxyMenu}
        onClose={closeManualProxyMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          manualProxyMenu
            ? { top: manualProxyMenu.mouseY, left: manualProxyMenu.mouseX }
            : undefined
        }
        slotProps={{ list: { dense: true, sx: { minWidth: 180 } } }}
      >
        <MenuItem onClick={() => runManualProxyMenuAction(onEditManualProxy)}>
          <ListItemIcon>
            <EditRounded fontSize="small" />
          </ListItemIcon>
          {t('profiles.modals.manualProxy.actions.edit')}
        </MenuItem>
        <MenuItem
          onClick={() => runManualProxyMenuAction(onDuplicateManualProxy)}
        >
          <ListItemIcon>
            <ContentCopyRounded fontSize="small" />
          </ListItemIcon>
          {t('profiles.modals.manualProxy.actions.duplicate')}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() =>
            runManualProxyMenuAction((name) => setDeleteProxyName(name))
          }
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}>
            <DeleteRounded fontSize="small" />
          </ListItemIcon>
          {t('profiles.modals.manualProxy.actions.delete')}
        </MenuItem>
      </Menu>

      <ManualProxyViewer
        open={manualOpen}
        mode={manualMode}
        initialProxy={activeManualProxy}
        existingNames={dialogExistingNames}
        proxyOptions={dialerProxyOptions}
        dialerProxyMap={proxyDialerMap}
        onClose={closeManualViewer}
        onAdd={onAddManualProxy}
        onSave={onSaveManualProxy}
      />

      <ManualGroupViewer
        open={manualGroupOpen}
        mode={manualGroupMode}
        initialGroup={activeManualGroup}
        existingNames={groupDialogExistingNames}
        policyOptions={groupPolicyOptions}
        proxyOptions={proxyNames}
        groupOptions={selectableGroupPolicyNames}
        onClose={closeManualGroupViewer}
        onAdd={onAddManualGroup}
        onSave={onSaveManualGroup}
      />

      <BaseDialog
        open={!!deleteProxyName}
        title={t('profiles.modals.manualProxy.deleteConfirm.title')}
        okBtn={
          deleteProxyDependencies.groupRefs.length > 0
            ? t('profiles.modals.deleteDependency.deleteAndClean')
            : t('shared.actions.delete')
        }
        cancelBtn={t('shared.actions.cancel')}
        disableOk={deleteProxyDependencies.ruleRefs.length > 0}
        contentSx={{ width: 480 }}
        onClose={() => setDeleteProxyName(null)}
        onCancel={() => setDeleteProxyName(null)}
        onOk={() => {
          if (deleteProxyName) void onDeleteManualProxy(deleteProxyName)
        }}
      >
        <DeleteDependencyContent
          name={deleteProxyName}
          messageKey="profiles.modals.manualProxy.deleteConfirm.message"
          dependencies={deleteProxyDependencies}
        />
      </BaseDialog>

      <BaseDialog
        open={!!deleteGroupName}
        title={t('profiles.modals.manualGroup.deleteConfirm.title')}
        okBtn={
          deleteGroupDependencies.groupRefs.length > 0
            ? t('profiles.modals.deleteDependency.deleteAndClean')
            : t('shared.actions.delete')
        }
        cancelBtn={t('shared.actions.cancel')}
        disableOk={deleteGroupDependencies.ruleRefs.length > 0}
        contentSx={{ width: 480 }}
        onClose={() => setDeleteGroupName(null)}
        onCancel={() => setDeleteGroupName(null)}
        onOk={() => {
          if (deleteGroupName) void onDeleteManualGroup(deleteGroupName)
        }}
      >
        <DeleteDependencyContent
          name={deleteGroupName}
          messageKey="profiles.modals.manualGroup.deleteConfirm.message"
          dependencies={deleteGroupDependencies}
        />
      </BaseDialog>
    </>
  )
}

export default ProxyPage
