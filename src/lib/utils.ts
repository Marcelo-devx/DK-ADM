import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hslStringToHex(hsl: string): string {
  if (!hsl) return "#000000";
  const hslValues = hsl.match(/(\d+(\.\d+)?)/g);

  if (!hslValues || hslValues.length < 3) {
    return "#000000";
  }

  let h = parseFloat(hslValues[0]);
  let s = parseFloat(hslValues[1]);
  let l = parseFloat(hslValues[2]);

  s /= 100;
  l /= 100;

  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  
  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }

  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}