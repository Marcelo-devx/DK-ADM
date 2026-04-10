import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface SortDropdownProps {
  direction: 'asc' | 'desc' | null;
  onSortChange: (direction: 'asc' | 'desc' | null) => void;
}

export const SortDropdown = ({ direction, onSortChange }: SortDropdownProps) => {
  const getSortIcon = () => {
    if (direction === 'asc') return <ArrowUp className="h-3 w-3" />;
    if (direction === 'desc') return <ArrowDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3 opacity-30" />;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0 hover:bg-primary/10"
        >
          {getSortIcon()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[160px]">
        <DropdownMenuItem onClick={() => onSortChange('asc')} className="flex items-center gap-2">
          <ArrowUp className="h-4 w-4" />
          <span>Crescente</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSortChange('desc')} className="flex items-center gap-2">
          <ArrowDown className="h-4 w-4" />
          <span>Decrescente</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSortChange(null)} className="flex items-center gap-2">
          <Minus className="h-4 w-4" />
          <span>Sem ordenação</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
