import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { UseConfirmDialogReturn } from '@/hooks/use_confirm_dialog'

interface ConfirmDialogProps {
  state: UseConfirmDialogReturn['state']
  close: UseConfirmDialogReturn['close']
  loading: UseConfirmDialogReturn['loading']
  handleConfirm: UseConfirmDialogReturn['handleConfirm']
}

export function ConfirmDialog({ state, close, loading, handleConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <Spinner className="size-4" />
                {state.loadingLabel}
              </>
            ) : (
              state.confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
