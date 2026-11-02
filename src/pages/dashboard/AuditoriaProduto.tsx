import { useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageSearch, Search, RefreshCw } from "lucide-react";

interface Product {
  id: number;
  name: string;
  sku: string | null;
}
interface Variant {
  id: string;
  product_id: number;
  sku: string | null;
  color: string | null;
  size: string | null;
  ohms: string | null;
  volume_ml: number | null;
  flavors: { name: string } | null;
}
interface Selection {
  productId: number;
  variantId: string | null;
  name: string;
  sku: string | null;
}
interface Purchase {
  id: number;
  quantity: number;
  price_at_purchase: number;
  name_at_purchase: string;
  orders: {
    id: number;
    created_at: string;
    status: string;
    delivery_status: string | null;
    guest_email: string | null;
    guest_phone: string | null;
    shipping_address: Record<string, unknown>;
    profiles: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
  };
}

const variantLabel = (v: Variant) => [v.flavors?.name, v.color, v.size, v.ohms && `${v.ohms}Ω`, v.volume_ml && `${v.volume_ml} ml`].filter(Boolean).join(" / ") || "Variação";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const PAGE_SIZE = 100;

export default function AuditoriaProduto() {
  const { user, isAdmin, isGerenteGeral } = useUser();
  const allowed = isAdmin || isGerenteGeral;
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Selection | null>(null);

  const search = useQuery({
    queryKey: ["auditoria-produto-busca", user?.id, term],
    enabled: allowed && !!term,
    queryFn: async () => {
      // Separate filters keep the search text out of PostgREST's OR syntax.
      const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
      const [byName, bySku, variantSku] = await Promise.all([
        supabase.from("products").select("id, name, sku").ilike("name", pattern).order("name").limit(50),
        supabase.from("products").select("id, name, sku").ilike("sku", pattern).order("name").limit(50),
        supabase.from("product_variants").select("product_id").ilike("sku", pattern).limit(50),
      ]);
      for (const result of [byName, bySku, variantSku]) if (result.error) throw result.error;
      const productMap = new Map<number, Product>();
      for (const p of [...(byName.data ?? []), ...(bySku.data ?? [])]) productMap.set(p.id, p);
      const missing = [...new Set((variantSku.data ?? []).map(v => v.product_id).filter((id): id is number => id != null && !productMap.has(id)))];
      if (missing.length) {
        const result = await supabase.from("products").select("id, name, sku").in("id", missing);
        if (result.error) throw result.error;
        for (const p of result.data ?? []) productMap.set(p.id, p);
      }
      const products = [...productMap.values()].sort((a, b) => a.name.localeCompare(b.name));
      const variants: Variant[] = [];
      if (products.length) {
        let offset = 0;
        while (true) {
          const result = await supabase.from("product_variants")
            .select("id, product_id, sku, color, size, ohms, volume_ml, flavors(name)")
            .in("product_id", products.map(p => p.id)).order("id").range(offset, offset + 499);
          if (result.error) throw result.error;
          const batch = (result.data ?? []) as unknown as Variant[];
          variants.push(...batch);
          if (batch.length < 500) break;
          offset += 500;
        }
      }
      return { products, variants, limited: [byName, bySku, variantSku].some(r => r.data?.length === 50) };
    },
  });

  const purchases = useInfiniteQuery({
    queryKey: ["auditoria-produto-compradores", user?.id, selected?.productId, selected?.variantId],
    enabled: allowed && !!selected,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase.from("order_items")
        .select("id, quantity, price_at_purchase, name_at_purchase, orders!order_items_order_id_fkey!inner(id, created_at, status, delivery_status, guest_email, guest_phone, shipping_address, profiles!orders_user_id_fkey(first_name, last_name, email, phone))", { count: "exact" })
        .eq("item_type", "product").eq("item_id", selected!.productId);
      if (selected!.variantId) query = query.eq("variant_id", selected!.variantId);
      const { data, error, count } = await query.order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as Purchase[], count: count ?? 0, offset: pageParam };
    },
    getNextPageParam: last => last.offset + last.rows.length < last.count && last.rows.length > 0 ? last.offset + last.rows.length : undefined,
  });

  const rows = purchases.data?.pages.flatMap(p => p.rows) ?? [];
  const total = purchases.data?.pages[0]?.count ?? 0;

  if (!allowed) return <p className="text-muted-foreground">Acesso restrito a administrador e gerente geral.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-orange-100 p-3"><PackageSearch className="h-6 w-6 text-orange-600" /></div>
        <div><h1 className="text-2xl font-bold">Auditoria de Produto</h1><p className="text-sm text-muted-foreground">Encontre quem comprou um produto ou uma variação específica.</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Buscar produto ou variação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setSelected(null); const next = input.trim(); if (next === term) void search.refetch(); else setTerm(next); }}>
            <Input aria-label="Nome ou SKU" placeholder="Nome do produto ou SKU da variação..." value={input} onChange={e => setInput(e.target.value)} maxLength={150} />
            <Button type="submit" disabled={!input.trim() || search.isFetching}><Search className="mr-2 h-4 w-4" />Buscar</Button>
          </form>
          {search.isFetching && <p className="text-sm text-muted-foreground">Buscando produtos e variações...</p>}
          {search.isError && <p role="alert" className="text-sm text-destructive">Não foi possível buscar: {search.error.message}</p>}
          {term && !search.isFetching && !search.isError && !search.data?.products.length && <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
          {search.data?.limited && <p className="text-sm text-amber-700">A busca atingiu o limite de resultados. Use um nome ou SKU mais específico.</p>}
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {search.data?.products.map(p => (
              <div key={p.id} className="rounded-lg border p-3 space-y-2">
                <Button variant={selected?.productId === p.id && !selected.variantId ? "secondary" : "ghost"} className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => setSelected({ productId: p.id, variantId: null, name: p.name, sku: p.sku })}>
                  <div><div className="font-semibold">{p.name}</div><div className="text-xs text-muted-foreground">SKU: {p.sku || "—"} · Todas as compras deste produto</div></div>
                </Button>
                {search.data.variants.filter(v => v.product_id === p.id).map(v => (
                  <Button key={v.id} variant={selected?.variantId === v.id ? "secondary" : "outline"} className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => setSelected({ productId: p.id, variantId: v.id, name: `${p.name} — ${variantLabel(v)}`, sku: v.sku })}>
                    <div><div>{variantLabel(v)}</div><div className="text-xs text-muted-foreground">SKU: {v.sku || "—"} · Apenas esta variação</div></div>
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {selected && <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-lg">Compradores — {selected.name}</CardTitle><Button variant="outline" size="sm" disabled={purchases.isFetching} onClick={() => void purchases.refetch()}><RefreshCw className={`mr-2 h-4 w-4 ${purchases.isFetching ? "animate-spin" : ""}`} />Atualizar</Button></div>
          <p className="text-sm text-muted-foreground">SKU: {selected.sku || "—"}. Uma linha por item comprado; inclui pedidos pendentes e cancelados, identificados pelo status.</p>
          {selected.variantId && <p className="text-xs text-muted-foreground">Consulta pelo vínculo da variação. Compras antigas sem variant_id não são atribuídas automaticamente.</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          {purchases.isError ? <p role="alert" className="text-destructive">Não foi possível consultar compradores: {purchases.error.message}</p> : purchases.isPending ? <p className="text-muted-foreground">Carregando compradores...</p> : <>
            <p className="text-sm text-muted-foreground">Exibindo {rows.length} de {total} registros.</p>
            <Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Contato</TableHead><TableHead>Pedido / Data (Brasília)</TableHead><TableHead>Item comprado</TableHead><TableHead>Quantidade</TableHead><TableHead>Subtotal do item</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Nenhuma compra encontrada para esta seleção.</TableCell></TableRow> : rows.map(row => {
                const o = row.orders;
                const profile = o.profiles;
                const address = o.shipping_address;
                const addressName = [address.first_name, address.last_name].filter(v => typeof v === "string").join(" ").trim();
                const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || addressName || "Cliente sem nome";
                const email = profile?.email || o.guest_email || (typeof address.email === "string" ? address.email : "—");
                const phone = profile?.phone || o.guest_phone || (typeof address.phone === "string" ? address.phone : "—");
                return <TableRow key={row.id}><TableCell className="font-medium">{name}</TableCell><TableCell><div>{email}</div><div className="text-xs text-muted-foreground">{phone}</div></TableCell><TableCell className="whitespace-nowrap"><div className="font-semibold">#{o.id}</div><div className="text-xs text-muted-foreground">{date.format(new Date(o.created_at))}</div></TableCell><TableCell>{row.name_at_purchase}</TableCell><TableCell>{row.quantity}</TableCell><TableCell className="whitespace-nowrap">{money.format(row.quantity * row.price_at_purchase)}</TableCell><TableCell><Badge variant={o.status === "Cancelado" ? "destructive" : "secondary"}>{o.status}</Badge><div className="mt-1 text-xs text-muted-foreground">{o.delivery_status || "—"}</div></TableCell></TableRow>;
              })}</TableBody>
            </Table>
            {purchases.hasNextPage && <Button variant="outline" disabled={purchases.isFetchingNextPage} onClick={() => void purchases.fetchNextPage()}>{purchases.isFetchingNextPage ? "Carregando..." : "Carregar mais compradores"}</Button>}
          </>}
        </CardContent>
      </Card>}
    </div>
  );
}
