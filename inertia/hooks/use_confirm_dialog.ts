import { useState, useCallback } from 'react'

export interface ConfirmDialogOptions {
  title: string
  description: string
  confirmLabel: string
  loadingLabel: string
  onConfirm: () => Promise<void>
}

export interface ConfirmDialogState {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  loadingLabel: string
  onConfirm: () => Promise<void>
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    description: '',
    confirmLabel: '',
    loadingLabel: '',
    onConfirm: async () => {},
  })
  const [loading, setLoading] = useState(false)

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    setState({
      open: true,
      ...options,
    })
  }, [])

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }))
  }, [])

  const handleConfirm = useCallback(async () => {
    setLoading(true)
    try {
      await state.onConfirm()
    } finally {
      setLoading(false)
      close()
    }
  }, [state.onConfirm, close])

  return {
    state,
    confirm,
    close,
    loading,
    handleConfirm,
  }
}

export type UseConfirmDialogReturn = ReturnType<typeof useConfirmDialog>
