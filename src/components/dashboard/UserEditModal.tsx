import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, User, MapPin, Settings2 } from "lucide-react";
import { AdminUser, UpdateUserPayload } from "@/hooks/useUserAdmin";

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
  onConfirm: (userId: string, payload: UpdateUserPayload) => Promise<void>;
}

const EMPTY_FORM: UpdateUserPayload = {
  first_name: "",
  last_name: "",
  email: "",
  cpf_cnpj: "",
  phone: "",
  date_of_birth: "",
  gender: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  force_pix_on_next_purchase: false,
  is_credit_card_enabled: false,
};

export function UserEditModal({ isOpen, onClose, user, onConfirm }: UserEditModalProps) {
  const [form, setForm] = useState<UpdateUserPayload>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preenche o formulário quando o usuário muda
  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name ?? "",
        last_name: user.last_name ?? "",
        email: user.email ?? "",
        cpf_cnpj: user.cpf_cnpj ?? "",
        phone: user.phone ?? "",
        date_of_birth: user.date_of_birth ?? "",
        gender: user.gender ?? "",
        cep: user.cep ?? "",
        street: user.street ?? "",
        number: user.number ?? "",
        complement: user.complement ?? "",
        neighborhood: user.neighborhood ?? "",
        city: user.city ?? "",
        state: user.state ?? "",
        force_pix_on_next_purchase: user.force_pix_on_next_purchase ?? false,
        is_credit_card_enabled: user.is_credit_card_enabled ?? false,
      });
    }
  }, [user]);

  const set = (field: keyof UpdateUserPayload, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      // Limpa campos vazios opcionais para não sobrescrever com string vazia
      const payload: UpdateUserPayload = {
        ...form,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        complement: form.complement || "",
      };
      await onConfirm(user.id, payload);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Editar Dados do Cliente
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {user.first_name} {user.last_name}
            {user.email && (
              <span className="ml-2 text-slate-400">— {user.email}</span>
            )}
          </p>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── DADOS PESSOAIS ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Dados Pessoais
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="first_name">Nome</Label>
                <Input
                  id="first_name"
                  value={form.first_name ?? ""}
                  onChange={(e) => set("first_name", e.target.value)}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="last_name">Sobrenome</Label>
                <Input
                  id="last_name"
                  value={form.last_name ?? ""}
                  onChange={(e) => set("last_name", e.target.value)}
                  placeholder="Sobrenome"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={form.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cpf_cnpj">CPF / CNPJ</Label>
                <Input
                  id="cpf_cnpj"
                  value={form.cpf_cnpj ?? ""}
                  onChange={(e) => set("cpf_cnpj", e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="date_of_birth">Data de Nascimento</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={form.date_of_birth ?? ""}
                  onChange={(e) => set("date_of_birth", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gender">Gênero</Label>
                <Select
                  value={form.gender ?? ""}
                  onValueChange={(v) => set("gender", v === "_none" ? "" : v)}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Não informado</SelectItem>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                    <SelectItem value="Prefiro não informar">Prefiro não informar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── ENDEREÇO ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Endereço
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  value={form.cep ?? ""}
                  onChange={(e) => set("cep", e.target.value)}
                  placeholder="00000-000"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="street">Rua / Logradouro</Label>
                <Input
                  id="street"
                  value={form.street ?? ""}
                  onChange={(e) => set("street", e.target.value)}
                  placeholder="Rua das Flores"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  value={form.number ?? ""}
                  onChange={(e) => set("number", e.target.value)}
                  placeholder="123"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  value={form.complement ?? ""}
                  onChange={(e) => set("complement", e.target.value)}
                  placeholder="Apto 4B (opcional)"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={form.neighborhood ?? ""}
                  onChange={(e) => set("neighborhood", e.target.value)}
                  placeholder="Centro"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={form.city ?? ""}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="São Paulo"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state">Estado (UF)</Label>
                <Input
                  id="state"
                  value={form.state ?? ""}
                  onChange={(e) => set("state", e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── CONFIGURAÇÕES ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Settings2 className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Configurações de Pagamento
              </span>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium">Forçar Pix no próximo pedido</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quando ativo, o cliente só poderá pagar via Pix na próxima compra
                  </p>
                </div>
                <Switch
                  checked={form.force_pix_on_next_purchase ?? false}
                  onCheckedChange={(v) => set("force_pix_on_next_purchase", v)}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium">Cartão de crédito habilitado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permite que o cliente pague com cartão de crédito
                  </p>
                </div>
                <Switch
                  checked={form.is_credit_card_enabled ?? false}
                  onCheckedChange={(v) => set("is_credit_card_enabled", v)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
