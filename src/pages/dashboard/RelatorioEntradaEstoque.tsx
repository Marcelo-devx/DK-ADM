import { useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { FileDown, CheckCircle2, Package } from "lucide-react";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const pedidos = [
  {
    id: 8,
    fornecedor: "DK Estoque",
    data: "29/03/2026",
    status: "Recebido",
    totalItens: 6,
    totalUnidades: 9,
    valorTotal: 477.0,
    itens: [
      { produto: "Juice BLVK Yellow Mango - 3mg/60ml - Banana Ice", qtd: 2, custo: 53.0 },
      { produto: "Juice BLVK Yellow Mango - 3mg/60ml - Grape Apple Ice", qtd: 1, custo: 53.0 },
      { produto: "Juice BLVK Yellow Mango - 6mg/60ml - Grape Apple Ice", qtd: 2, custo: 53.0 },
      { produto: "Juice BLVK Yellow Mango - 3mg/60ml - Passion Ice", qtd: 1, custo: 53.0 },
      { produto: "Juice BLVK Yellow Mango - 6mg/60ml - Passion Ice", qtd: 2, custo: 53.0 },
      { produto: "Juice BLVK Yellow Mango - 6mg/60ml - Strawberry Ice", qtd: 1, custo: 53.0 },
    ],
  },
  {
    id: 10,
    fornecedor: "PontoMX",
    data: "07/04/2026",
    status: "Recebido",
    totalItens: 101,
    totalUnidades: 534,
    valorTotal: 19281.22,
    itens: [
      { produto: "Coil Vaporesso Eco Nano - 0.8Ω", qtd: 10, custo: 18.29 },
      { produto: "Coil Vaporesso Eco Nano - 1.2Ω", qtd: 10, custo: 19.95 },
      { produto: "Coil Vaporessso Gti Meshed (Unidade) - 0.2Ω", qtd: 5, custo: 13.97 },
      { produto: "Cartucho Vaporesso - Coil Vibe Nano - 4,5ml (Unidade) - 0.8Ω", qtd: 10, custo: 18.29 },
      { produto: "Cartucho Vaporesso - Coil Vibe Nano - 4,5ml (Unidade) - 1.0Ω", qtd: 10, custo: 18.29 },
      { produto: "Coil Xros 3ml (Unidade) - 0.6Ω", qtd: 40, custo: 14.13 },
      { produto: "Coil Xros 3ml (Unidade) - 0.8Ω", qtd: 80, custo: 14.13 },
      { produto: "Coil Xros 2ml (Unidade) - 1.0 MeshΩ", qtd: 40, custo: 13.3 },
      { produto: "Coil Xros 2ml (Unidade) - 1.2 RegularΩ", qtd: 40, custo: 13.3 },
      { produto: "Eco Nano 2 - Vaporesso - Blossom Pink", qtd: 2, custo: 61.51 },
      { produto: "Eco Nano 2 - Vaporesso - Night Dark", qtd: 2, custo: 61.51 },
      { produto: "Eco Nano 2 - Vaporesso - Pristine White", qtd: 2, custo: 61.51 },
      { produto: "Eco Nano 2 - Vaporesso - Sky Blue", qtd: 2, custo: 61.51 },
      { produto: "Vaporesso - Eco Nano Plus Kit - Space Silver", qtd: 1, custo: 91.44 },
      { produto: "Coil Vaporesso Luxe Q2 e Q2SE 3ml (Unidade) - 0.8 MeshΩ", qtd: 20, custo: 15.79 },
      { produto: "Xros 5 - Vaporesso - Blue Silk", qtd: 2, custo: 151.29 },
      { produto: "Xros 5 - Vaporesso - Grey Silk", qtd: 2, custo: 151.29 },
      { produto: "Xros 5 - Vaporesso - Grey Leather", qtd: 2, custo: 151.29 },
      { produto: "Xros 5 - Vaporesso - Opal White", qtd: 2, custo: 151.29 },
      { produto: "Xros Mini 5 - Vaporesso - Rose Red", qtd: 2, custo: 114.71 },
      { produto: "Xros Mini 5 - Vaporesso - Sky Blue", qtd: 2, custo: 114.71 },
      { produto: "Airistech Cloud V Haze - Orange", qtd: 1, custo: 172.9 },
      { produto: "Airistech Mystica Ace Led - Airistech - Peacock Green", qtd: 1, custo: 89.78 },
      { produto: "Descartável Black Sheep 40k SWI | 5% - Grape + Energy Drink", qtd: 5, custo: 75.15 },
      { produto: "Descartável Black Sheep 40k SWI | 5% - Grape + Menthol", qtd: 5, custo: 75.15 },
      { produto: "Descartável Black Sheep 40k SWI | 5% - Ice Master Kiwi Grape + Açai Strawberry", qtd: 5, custo: 75.15 },
      { produto: "Salt Mr. Freeze - 35mg/30ml - Strawberry Frost", qtd: 3, custo: 41.56 },
      { produto: "Descartável Black Sheep 40k SWI | 5% - Passion Fruit + Watermelon Strawberry", qtd: 5, custo: 75.15 },
      { produto: "Descartável Black Sheep 40k SWI | 5% - Strawberry Kiwi + Cola Lime", qtd: 5, custo: 75.15 },
      { produto: "Descartável Black Sheep Duo Mix 30k - Energy Drink + Menthol", qtd: 5, custo: 68.5 },
      { produto: "Descartável Black Sheep Duo Mix 30k - Fresh Mint + Miami Mint", qtd: 5, custo: 68.5 },
      { produto: "Descartável Black Sheep Duo Mix 30k - Grape + Strawberry Kiwi", qtd: 5, custo: 68.5 },
      { produto: "Descartável Black Sheep Duo Mix 30k - Strawberry Watermelon + Fresh Mint", qtd: 5, custo: 68.5 },
      { produto: "Descartável Elfbar BC 15k | 5% - Mango Magic", qtd: 1, custo: 39.9 },
      { produto: "Descartável Elfbar BC 15k | 5% - Sakura Grape", qtd: 10, custo: 39.9 },
      { produto: "Descartável Elfbar BC 15k | 5% - Strawberry Ice", qtd: 10, custo: 39.9 },
      { produto: "Descartável Elfbar BC 15k | 5% - Watermelon Ice", qtd: 10, custo: 39.9 },
      { produto: "Descartável Ignite V155 Slim Black | 5% - Blueberry Ice", qtd: 10, custo: 52.54 },
      { produto: "Descartável Ignite V155 Slim Black | 5% - Icy Mint", qtd: 10, custo: 52.54 },
      { produto: "Descartável Ignite V155 Slim Black | 5% - Pineapple Ice", qtd: 10, custo: 52.54 },
      { produto: "Descartável Ignite V-Mix 40k | 5% - Açai Ice + Watermelon Grape Ice", qtd: 5, custo: 71.82 },
      { produto: "Descartável Ignite V-Mix 40k | 5% - Menthol + Mighty Melon", qtd: 5, custo: 71.82 },
      { produto: "Descartável Ignite V-Mix 40k | 5% - Pineapple Ice + Passion Fruit Sour Kiwi", qtd: 5, custo: 71.82 },
      { produto: "Descartável Ignite V-Mix 40k | 5% - Strawberry Ice + Pineapple Mango Ice", qtd: 5, custo: 71.82 },
      { produto: "Life Pod II 10K|5% - Blue Razz Bubblegum", qtd: 5, custo: 41.56 },
      { produto: "Life Pod II 10K|5% - Blueberry Watermelon", qtd: 5, custo: 41.56 },
      { produto: "Life Pod II 10K|5% - Cherry Bubblegum", qtd: 5, custo: 41.56 },
      { produto: "Life Pod II 10K|5% - Cherry Lime", qtd: 5, custo: 41.56 },
      { produto: "Life Pod II 10K|5% - Grape Honeydew", qtd: 5, custo: 41.56 },
      { produto: "Life Pod II 10K|5% - Monster Drink", qtd: 5, custo: 41.56 },
      { produto: "Life Pod II 10K|5% - Passion Fruit", qtd: 5, custo: 41.56 },
      { produto: "Life Pod II 10K|5% - Pink Lemonade", qtd: 5, custo: 41.56 },
      { produto: "Life Pod II 10K|5% - Strawberry Coconut", qtd: 5, custo: 41.56 },
      { produto: "Life Pod II 10K|5% - Summer Love", qtd: 5, custo: 41.56 },
      { produto: "Juice Mr. Freeze - 3mg/100ml - Banana Frost", qtd: 2, custo: 59.19 },
      { produto: "Juice Mr. Freeze - 3mg/100ml - Spearmint Frost", qtd: 3, custo: 59.19 },
      { produto: "Juice Mr. Freeze - 3mg/100ml - Strawberry Grape Frost", qtd: 2, custo: 59.19 },
      { produto: "Juice Mr. Freeze - 3mg/100ml - Strawberry Frost", qtd: 3, custo: 59.19 },
      { produto: "Juice Mr. Freeze - 3mg/100ml - Strawberry Kiwi Pomegranade Frost", qtd: 2, custo: 59.19 },
      { produto: "Juice Mr. Freeze - 3mg/100ml - Strawberry Lemonade Frost", qtd: 2, custo: 59.19 },
      { produto: "Juice Mr. Freeze - 3mg/100ml - Mango Frost", qtd: 2, custo: 59.19 },
      { produto: "Juice Mr. Freeze - 3mg/100ml - Watermelon Frost", qtd: 2, custo: 59.19 },
      { produto: "Juice Mr. Freeze - 3mg/100ml - Strawberry Mango Frost", qtd: 2, custo: 59.19 },
      { produto: "Juice Mr. Freeze - 3mg/100ml - Watermelon Frost (2ª entrada)", qtd: 2, custo: 58.74 },
      { produto: "Salt Mr. Freeze - 35mg/30ml - Strawberry Banana Frost", qtd: 3, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 35mg/30ml - Strawberry Grape Frost", qtd: 5, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 35mg/30ml - Mango Frost", qtd: 3, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 35mg/30ml - Strawberry Watermelon Frost", qtd: 3, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 35mg/30ml - Strawberry Mango Frost", qtd: 3, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Carambola Blue Ice", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Dragon Fruit Strawberry Frost", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Mango Frost", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Moon Rocks Blue Razz Frost", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Peach Frost", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Strawberry Banana Frost", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Strawberry Grape Frost", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Strawberry Kiwi Pomegranade Frost", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Strawberry Lemonade Frost", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Strawberry Mango Frost", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Strawberry Watermelon Frost", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml - Tangerine Frost", qtd: 2, custo: 41.56 },
      { produto: "Salt Mr. Freeze - 50mg/30ml (sem variante) x2", qtd: 4, custo: 41.56 },
    ],
  },
  {
    id: 11,
    fornecedor: "Extra 04-04 PT 1",
    data: "13/04/2026",
    status: "Recebido",
    totalItens: 48,
    totalUnidades: 302,
    valorTotal: 15518.95,
    itens: [
      { produto: "Pouch Nicotine G-Pulse - 6mg - Citrus", qtd: 5, custo: 30.4 },
      { produto: "Pouch Nicotine G-Pulse - 15mg - Citrus", qtd: 5, custo: 30.4 },
      { produto: "Pouch Nicotine G-Pulse - 6mg - Coffe", qtd: 10, custo: 30.4 },
      { produto: "Pouch Nicotine G-Pulse - 6mg - Mixed Berry", qtd: 5, custo: 30.4 },
      { produto: "Pouch Nicotine G-Pulse - 6mg - Peppermint", qtd: 10, custo: 30.4 },
      { produto: "Pouch Nicotine G-Pulse - 15mg - Peppermint", qtd: 5, custo: 30.4 },
      { produto: "Pouch Nicotine G-Pulse - 15mg - Spearmint", qtd: 5, custo: 30.4 },
      { produto: "Pouch Nicotine G-Pulse - 6mg - Wintergreen", qtd: 5, custo: 30.4 },
      { produto: "Pouch Nicotine G-Pulse - 15mg - Wintergreen", qtd: 5, custo: 30.4 },
      { produto: "Chicletes de Nicotina (4mg) - Slapple - Lemon", qtd: 2, custo: 37.16 },
      { produto: "Chicletes de Nicotina (4mg) - Slapple - Pineapple", qtd: 2, custo: 37.16 },
      { produto: "Pouch AAA - Zyn - Black Cherry mini Dry 6mg", qtd: 5, custo: 54.05 },
      { produto: "Pouch AAA - Zyn - Black Currant XXstrong 12.5mg", qtd: 5, custo: 54.05 },
      { produto: "Pouch AAA - Zyn - Citrus 6mg", qtd: 5, custo: 54.05 },
      { produto: "Pouch AAA - Zyn - Citrus 9mg", qtd: 5, custo: 54.05 },
      { produto: "Pouch AAA - Zyn - Cool Mint Max 16mg", qtd: 7, custo: 54.05 },
      { produto: "Pouch AAA - Zyn - Fresh mint 6.5mg", qtd: 10, custo: 54.05 },
      { produto: "Pouch AAA - Zyn - Gentle Mint 6.5mg", qtd: 5, custo: 54.05 },
      { produto: "Pouch AAA - Zyn - Menthol Ice 13.5mg", qtd: 8, custo: 54.05 },
      { produto: "Descartável BLVK Just Juice 45K - Dragon Strawnana", qtd: 5, custo: 67.56 },
      { produto: "Descartável BLVK Just Juice 45K - Grape Ice", qtd: 5, custo: 67.56 },
      { produto: "Descartável BLVK Just Juice 45K - Kiwi Passion Fruit", qtd: 5, custo: 67.56 },
      { produto: "Descartável BLVK Just Juice 45K - Spearmint", qtd: 10, custo: 67.56 },
      { produto: "Descartável BLVK Just Juice 45K - Strawberry Ice", qtd: 5, custo: 67.56 },
      { produto: "Descartável BLVK Just Juice 45K - Strawberry Kiwi", qtd: 5, custo: 67.56 },
      { produto: "Descartável BLVK Just Juice 45K - Strawberry Mango", qtd: 5, custo: 67.56 },
      { produto: "Descartável BLVK Just Juice 45K - Strawberry Watermelon", qtd: 5, custo: 67.56 },
      { produto: "Descartável BLVK Just Juice 45K - Watermelon Ice", qtd: 5, custo: 67.56 },
      { produto: "Descartável Dinner Lady 20k Luna - Peach Mango Watermelon", qtd: 3, custo: 50.67 },
      { produto: "Refil Elfbar - Joinone 25k - Blue Razz Ice", qtd: 10, custo: 50.67 },
      { produto: "Refil Elfbar - Joinone 25k - Grape Ice", qtd: 10, custo: 50.67 },
      { produto: "Refil Elfbar - Joinone 25k - Kiwi Passion Fruit Guava", qtd: 10, custo: 50.67 },
      { produto: "Descartável Elfbar Ice King 40k - Cherry Fuse", qtd: 5, custo: 64.19 },
      { produto: "Descartável Elfbar Ice King 40k - Cherry Strazz", qtd: 5, custo: 64.19 },
      { produto: "Descartável Elfbar Ice King 40k - Double Apple Ice", qtd: 5, custo: 64.19 },
      { produto: "Descartável Elfbar Ice King 40k - Grape Ice", qtd: 5, custo: 64.19 },
      { produto: "Descartável Elfbar Ice King 40k - Green Apple Ice", qtd: 5, custo: 64.19 },
      { produto: "Descartável Elfbar Ice King 40k - Miami Mint", qtd: 10, custo: 64.19 },
      { produto: "Descartável Elfbar Ice King 40k - Sour Apple Ice", qtd: 5, custo: 64.19 },
      { produto: "Descartável Ice King SUMMER 40K - Green Apple Slush", qtd: 5, custo: 64.19 },
      { produto: "Descartável Ice King SUMMER 40K - Strawberry Spark", qtd: 5, custo: 64.19 },
      { produto: "Descartável Ice King SUMMER 40K - Triple Berry", qtd: 5, custo: 64.19 },
      { produto: "Descartável Elfbar BC 15k - Green Apple Ice", qtd: 10, custo: 42.9 },
      { produto: "Descartável Elfbar BC 15k - Passion Fruit Orange Guava", qtd: 10, custo: 42.9 },
      { produto: "Descartável Elfbar BC 15k - Sour Apple Ice", qtd: 10, custo: 42.9 },
      { produto: "Descartável Elfbar BC 15k - Strawberry Watermelon", qtd: 10, custo: 42.9 },
      { produto: "Descartável Elfbar BC 15k - Tropical Lemonade", qtd: 10, custo: 42.9 },
      { produto: "Descartável Elfbar E-Shisha 18k - Bubble Gum Mint", qtd: 5, custo: 54.05 },
    ],
  },
  {
    id: 12,
    fornecedor: "Extra 04-04 PT 2",
    data: "13/04/2026",
    status: "Recebido",
    totalItens: 43,
    totalUnidades: 260,
    valorTotal: 16374.3,
    itens: [
      { produto: "Descartável Elfbar TE 30K - Blueberry Ice", qtd: 10, custo: 56.42 },
      { produto: "Descartável Elfbar TE 30K - Elf Love", qtd: 10, custo: 56.42 },
      { produto: "Descartável Elfbar TE 30K - Peach Mango Watermelon", qtd: 10, custo: 56.42 },
      { produto: "Descartável Elfbar TE New 30k - Coconut Strawberry Ice", qtd: 10, custo: 56.42 },
      { produto: "Descartável Z35k - Geekbar - Blackberry Blueberry", qtd: 5, custo: 54.05 },
      { produto: "Descartável Z35k - Geekbar - Blue Razz Ice", qtd: 5, custo: 54.05 },
      { produto: "Descartável Z35k - Geekbar - Extreme Mint", qtd: 10, custo: 54.05 },
      { produto: "Descartável Z35k - Geekbar - Frozen Strawberry", qtd: 5, custo: 54.05 },
      { produto: "Descartável Z35k - Geekbar - Frozen Watermelon", qtd: 5, custo: 54.05 },
      { produto: "Descartável Z35k - Geekbar - Passion Fruit Sour Kiwi", qtd: 5, custo: 54.05 },
      { produto: "Descartável Z35k - Geekbar - Sour Apple Ice", qtd: 5, custo: 54.05 },
      { produto: "Descartável Z35k - Geekbar - Sour Strawberry", qtd: 5, custo: 54.05 },
      { produto: "Descartável Z35k - Geekbar - Strawberry kiwi ice", qtd: 5, custo: 54.05 },
      { produto: "Descartável Z35k - Geekbar - White Peach Raspberry", qtd: 5, custo: 54.05 },
      { produto: "Descartável Ignite V300 Ultra Slim - Aloe Grape", qtd: 5, custo: 72.29 },
      { produto: "Descartável Ignite V300 Ultra Slim - Green Apple", qtd: 5, custo: 72.29 },
      { produto: "Descartável Ignite V400 40k - Icy Banana Cherry", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Blue Razz Lemon", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Blueberry", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Cherry Watermelon", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Cola", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Grape", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Grape Peach", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Lemon Lime", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Menthol", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Mint", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Passion Fruit Sour Kiwi", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Peach", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Pineapple", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Sakura Grape", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Strawberry", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Strawberry Banana", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Strawberry Kiwi", qtd: 5, custo: 69.93 },
      { produto: "Descartável Ignite V400 40k - Icy Watermelon", qtd: 5, custo: 69.93 },
      { produto: "Descartável Life Pod 40k - Banana Bubblegum", qtd: 5, custo: 63.51 },
      { produto: "Descartável Life Pod 40k - Cherry Bubblegum", qtd: 10, custo: 63.51 },
      { produto: "Descartável Life Pod 40k - Coconut Water", qtd: 5, custo: 63.51 },
      { produto: "Descartável Life Pod 40k - Spearmint", qtd: 10, custo: 63.51 },
      { produto: "Descartável Life Pod 40k - Strawberry Bubblegum", qtd: 5, custo: 63.51 },
      { produto: "Descartável Life Pod 40k - Watermelon Bubblegum", qtd: 5, custo: 63.51 },
      { produto: "Descartável Life Pod 40k - Menthol", qtd: 5, custo: 63.51 },
      { produto: "Descartável Life Pod 40k - Miami Mint", qtd: 10, custo: 63.51 },
      { produto: "Descartável Life Pod 40k - Monster Drink", qtd: 10, custo: 63.51 },
    ],
  },
  {
    id: 13,
    fornecedor: "Extra 04-04 PT 3",
    data: "13/04/2026",
    status: "Recebido",
    totalItens: 37,
    totalUnidades: 265,
    valorTotal: 9840.78,
    itens: [
      { produto: "Refil Oxbar Svopp G32K 2% - Double Apple", qtd: 12, custo: 45.61 },
      { produto: "Refil Oxbar Svopp G32K 2% - Fanta Grape", qtd: 12, custo: 45.61 },
      { produto: "Refil Oxbar Svopp G32K 2% - Fanta Strawberry", qtd: 12, custo: 45.61 },
      { produto: "Refil Oxbar Svopp G32K 2% - Ox Love", qtd: 6, custo: 45.61 },
      { produto: "Refil Oxbar Svopp G32K 2% - Strawberry Banana", qtd: 6, custo: 45.61 },
      { produto: "Refil Oxbar Svopp G32K 2% - Strawberry Watermelon Ice", qtd: 6, custo: 45.61 },
      { produto: "Airistech 350MAH Versão 2 - Preto", qtd: 5, custo: 39.19 },
      { produto: "Airistech 350MAH Versão 2 - Prata", qtd: 2, custo: 39.19 },
      { produto: "Airistech 350MAH Versão 2 - Branco", qtd: 2, custo: 39.19 },
      { produto: "Carregador E-fest Slim K2", qtd: 2, custo: 33.78 },
      { produto: "Algodão Wotofo X-Fiber 6mm", qtd: 2, custo: 33.78 },
      { produto: "Coil Uwell Caliburn A2 / AK2 (Unidade) - 0.9Ω", qtd: 8, custo: 12.67 },
      { produto: "Descartável Oxbar Invisível 50k 3in1 - Grape Ice", qtd: 5, custo: 70.94 },
      { produto: "Descartável Oxbar Invisível 50k 3in1 - Pineapple Kiwi Dragon", qtd: 5, custo: 70.94 },
      { produto: "Descartável Oxbar Invisível 50k 3in1 - Strawberry Grape", qtd: 5, custo: 70.94 },
      { produto: "Descartável Oxbar Invisível 50k 3in1 - Strawberry Ice", qtd: 5, custo: 70.94 },
      { produto: "Descartável Oxbar Invisível 50k 3in1 - Strawberry Kiwi", qtd: 5, custo: 70.94 },
      { produto: "Refil Oxbar Svopp G32K 2% - Açai Banana Ice", qtd: 12, custo: 45.61 },
      { produto: "Refil Oxbar Svopp G32K 2% - Apple Kiwi Ice", qtd: 12, custo: 45.61 },
      { produto: "Refil Oxbar Svopp G32K 2% - Banana Ice", qtd: 6, custo: 45.61 },
      { produto: "Refil Oxbar Svopp G32K 2% - Blue Razz Ice", qtd: 12, custo: 45.61 },
      { produto: "Coil Uwell Caliburn G / Koko Prime / G2 - 0.8 MeshΩ", qtd: 20, custo: 15.2 },
      { produto: "Coil Uwell Caliburn G / Koko Prime / G2 - 1.0 RegularΩ", qtd: 12, custo: 15.2 },
      { produto: "Cartucho Uwell Caliburn G1 / Prime (Unidade)", qtd: 4, custo: 13.51 },
      { produto: "Cartucho Uwell Caliburn G2 / GK2 (Unidade)", qtd: 2, custo: 13.51 },
      { produto: "Coil Xros 3ml (Unidade) - 0.4Ω", qtd: 20, custo: 14.78 },
      { produto: "Coil Xros 3ml (Unidade) - 0.7Ω", qtd: 40, custo: 14.78 },
      { produto: "Vaporesso - Luxe XR MAX 2 Kit - Black", qtd: 1, custo: 195.94 },
      { produto: "Vaporesso - Luxe XR MAX 2 Kit - Blue", qtd: 1, custo: 195.94 },
      { produto: "Vaporesso - Luxe XR MAX 2 Kit - Imperial Red Leather", qtd: 1, custo: 195.94 },
      { produto: "Vaporesso - Luxe XR MAX 2 Kit - Silver", qtd: 1, custo: 195.94 },
      { produto: "Vaporesso - Xros Pro 2 - Dawn Purple", qtd: 1, custo: 168.91 },
      { produto: "Vaporesso - Xros Pro 2 - Gem Green", qtd: 1, custo: 168.91 },
      { produto: "Vaporesso - Xros Pro 2 - Moonlit Pink", qtd: 1, custo: 168.91 },
      { produto: "Coil Voopoo PNP (Unidade) - PNP VM6Ω", qtd: 5, custo: 16.22 },
      { produto: "Coil Voopoo PNP-X (Drag 5) - 0.30 (40w)Ω", qtd: 10, custo: 16.22 },
      { produto: "Salt The Black Sheep - 35mg/30ml - True Blue", qtd: 3, custo: 37.16 },
    ],
  },
];

const totalGeral = pedidos.reduce((acc, p) => acc + p.valorTotal, 0);
const totalUnidadesGeral = pedidos.reduce((acc, p) => acc + p.totalUnidades, 0);

const gerarPDF = () => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // ── Capa / Cabeçalho geral ──────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO DE ENTRADA DE ESTOQUE", 14, 16);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Correção retroativa aplicada em 14/04/2026 — Pedidos #8, #10, #11, #12, #13", 14, 24);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 14, 31);

  // ── Resumo geral ────────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO GERAL", 14, 50);

  autoTable(doc, {
    head: [["Pedido #", "Fornecedor", "Data", "Status", "Variações", "Unidades Recebidas", "Valor Total"]],
    body: pedidos.map((p) => [
      `#${p.id}`,
      p.fornecedor,
      p.data,
      p.status,
      p.totalItens,
      p.totalUnidades,
      formatCurrency(p.valorTotal),
    ]),
    foot: [["", "", "", "TOTAL GERAL", "", totalUnidadesGeral, formatCurrency(totalGeral)]],
    startY: 54,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 9 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      1: { cellWidth: 45 },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 30, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 35, halign: "center" },
      6: { cellWidth: 40, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Detalhamento por pedido ─────────────────────────────────────────────────
  pedidos.forEach((pedido) => {
    doc.addPage();

    // Header do pedido
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`PEDIDO #${pedido.id} — ${pedido.fornecedor.toUpperCase()}`, 14, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Data: ${pedido.data}   |   Status: ${pedido.status}   |   ${pedido.totalItens} variações   |   ${pedido.totalUnidades} unidades   |   Total: ${formatCurrency(pedido.valorTotal)}`, 14, 24);

    doc.setTextColor(30, 30, 30);

    autoTable(doc, {
      head: [["#", "Produto / Variação", "Qtd. Recebida", "Custo Unit.", "Subtotal"]],
      body: pedido.itens.map((item, idx) => [
        idx + 1,
        item.produto,
        item.qtd,
        formatCurrency(item.custo),
        formatCurrency(item.qtd * item.custo),
      ]),
      foot: [
        [
          "",
          "TOTAL DO PEDIDO",
          pedido.totalUnidades,
          "",
          formatCurrency(pedido.valorTotal),
        ],
      ],
      startY: 36,
      theme: "striped",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 8, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: "auto", overflow: "linebreak" },
        2: { cellWidth: 28, halign: "center" },
        3: { cellWidth: 32, halign: "right" },
        4: { cellWidth: 35, halign: "right" },
      },
      tableWidth: pageW - 28,
      margin: { left: 14, right: 14 },
    });
  });

  // ── Página final: bugs corrigidos ───────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("CORREÇÕES TÉCNICAS APLICADAS NO SISTEMA", 14, 18);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Problemas identificados e corrigidos:", 14, 44);

  autoTable(doc, {
    head: [["#", "Problema", "Impacto", "Solução Aplicada"]],
    body: [
      [
        "1",
        "Race condition no processamento paralelo (Promise.all)",
        "Itens do mesmo produto processados ao mesmo tempo liam o mesmo estoque e sobrescreviam um ao outro — apenas uma entrada era contabilizada",
        "Trocado para loop sequencial (for...of) garantindo que cada item seja processado após o anterior",
      ],
      [
        "2",
        "Identificação incorreta do item ao salvar quantidade recebida",
        "O update de received_quantity usava match composto que podia falhar para produtos sem variante",
        "Corrigido para usar .eq('id', item.id) — identificação direta e inequívoca",
      ],
      [
        "3",
        "ID do item não era enviado pelo modal de conferência",
        "Sem o ID, a correção do Bug #2 não era possível",
        "O campo id agora é incluído em cada item passado pelo modal SupplierOrderReceiveModal",
      ],
      [
        "4",
        "Dashboard não atualizava após recebimento",
        "Os valores de Investimento em Estoque e Potencial de Recebimento não mudavam após confirmar um pedido",
        "Adicionado queryClient.invalidateQueries para a query dashboardFinancialStats no onSuccess",
      ],
      [
        "5",
        "Estoque retroativo não inserido (pedidos #8, #10, #11, #12, #13)",
        "Todos os pedidos já marcados como Recebido não tinham dado entrada no estoque",
        "Executado SQL de correção retroativa: UPDATE product_variants e products somando received_quantity ao stock_quantity",
      ],
    ],
    startY: 48,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8, overflow: "linebreak", valign: "top" },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 55 },
      2: { cellWidth: 80 },
      3: { cellWidth: 120 },
    },
    tableWidth: pageW - 28,
    margin: { left: 14, right: 14 },
  });

  doc.save(`relatorio_entrada_estoque_${new Date().toISOString().slice(0, 10)}.pdf`);
};

const RelatorioEntradaEstoque = () => {
  useEffect(() => {
    gerarPDF();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Package className="h-12 w-12 text-primary" />
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold">Relatório de Entrada de Estoque</h1>
        <p className="text-muted-foreground max-w-lg">
          O PDF foi gerado automaticamente com o detalhamento completo de todos os itens inseridos no estoque via correção retroativa dos pedidos <strong>#8, #10, #11, #12 e #13</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full max-w-3xl">
        {pedidos.map((p) => (
          <div key={p.id} className="bg-white border rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-muted-foreground font-bold uppercase">Pedido #{p.id}</p>
            <p className="text-sm font-semibold mt-1">{p.fornecedor}</p>
            <p className="text-2xl font-black text-primary mt-2">{p.totalUnidades}</p>
            <p className="text-xs text-muted-foreground">unidades</p>
            <p className="text-xs font-bold text-green-600 mt-1">{formatCurrency(p.valorTotal)}</p>
          </div>
        ))}
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center max-w-md">
        <p className="text-sm font-bold text-primary">Total Geral Inserido no Estoque</p>
        <p className="text-4xl font-black text-primary mt-1">{formatCurrency(totalGeral)}</p>
        <p className="text-xs text-muted-foreground mt-1">{totalUnidadesGeral} unidades em {pedidos.length} pedidos</p>
      </div>

      <Button onClick={gerarPDF} size="lg" className="gap-2">
        <FileDown className="h-5 w-5" />
        Baixar PDF Novamente
      </Button>
    </div>
  );
};

export default RelatorioEntradaEstoque;
