'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  loading?: boolean;
  /// Erro retornado pela ação (ex.: regra de negócio recusada no
  /// backend). Renderizado DENTRO do diálogo — colocar isso fora, atrás
  /// do overlay, deixaria a mensagem invisível enquanto o modal está
  /// aberto.
  error?: string | null;
}

/// Confirmação antes de uma ação irreversível ou de impacto (inativar
/// produto, cancelar compra, confirmar venda com estoque insuficiente).
/// Não usar para toda ação — só quando o custo de errar é real (brief:
/// "modais para tudo" está na lista do que evitar).
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  loading = false,
  error,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-danger">{error}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">{cancelLabel}</Button>
          </DialogClose>
          <Button variant={destructive ? 'danger' : 'default'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Aguarde…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
