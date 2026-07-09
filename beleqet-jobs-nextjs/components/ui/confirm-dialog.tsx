"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[80] bg-primary/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[90] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-primary/10 bg-white p-6 shadow-2xl">
          <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${destructive ? "bg-redAccent/10 text-redAccent" : "bg-brandGreen/10 text-brandGreen"}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <AlertDialog.Title className="mt-4 text-xl font-black text-primary">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className="rounded-full border border-primary/15 px-5 py-2.5 text-sm font-bold text-primary hover:bg-pageBg">
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={onConfirm}
              className={`rounded-full px-5 py-2.5 text-sm font-bold text-white ${destructive ? "bg-redAccent hover:bg-red-700" : "bg-brandGreen hover:bg-darkGreen"}`}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
