"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreateClientForm } from "@/components/dashboard/CreateClientForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: any) => void;
  isCreating: boolean;
}

export default function CreateClientModal({ open, onOpenChange, onCreate, isCreating }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <span />
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Cadastro de Cliente</DialogTitle>
        </DialogHeader>

        <CreateClientForm onSubmit={(v) => onCreate(v)} isSubmitting={isCreating} />
      </DialogContent>
    </Dialog>
  );
}