import { ReactNode } from "react";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}