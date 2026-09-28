"use client";

import { type ReactNode } from "react";
import { Card } from "@/components/ui/Card";

interface ModalProps {
  open: boolean;
  children: ReactNode;
}

export function Modal({ open, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md mx-4">{children}</Card>
    </div>
  );
}
