import { Box, Chip } from '@mui/material'
import type { ReactNode } from 'react'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DialogRef } from '@/components/base'
import { EditorViewer } from '@/components/profile/editor-viewer'
import { getRuntimeYaml } from '@/services/cmds'

interface ConfigViewerProps {
  title?: ReactNode
  path?: string
}

export const ConfigViewer = forwardRef<DialogRef, ConfigViewerProps>(
  ({ title, path = 'runtime-config.yaml' }, ref) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [configText, setConfigText] = useState('')

    const resolvedTitle =
      title ?? t('settings.components.verge.advanced.fields.runtimeConfig')

    useImperativeHandle(ref, () => ({
      open: () => {
        setConfigText('')
        setLoading(true)
        setOpen(true)
        getRuntimeYaml()
          .then((data) => {
            setConfigText(data ?? '# Error getting runtime yaml\n')
          })
          .catch(() => {
            setConfigText('# Error getting runtime yaml\n')
          })
          .finally(() => {
            setLoading(false)
          })
      },
      close: () => setOpen(false),
    }))

    if (!open) return null
    return (
      <EditorViewer
        open={true}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {resolvedTitle}
            <Chip label={t('shared.labels.readOnly')} size="small" />
          </Box>
        }
        value={configText}
        readOnly
        language="yaml"
        path={path}
        loading={loading}
        onClose={() => setOpen(false)}
      />
    )
  },
)
