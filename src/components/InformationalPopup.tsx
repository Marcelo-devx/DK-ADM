import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Info } from "lucide-react";

const fetchActivePopups = async () => {
  const { data, error } = await supabase
    .from("informational_popups")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching active popups:", error.message);
    return [];
  }
  return data;
};

export const InformationalPopup = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const { data: popups, isLoading } = useQuery({
    queryKey: ["activeInformationalPopups"],
    queryFn: fetchActivePopups,
    staleTime: 1000 * 60 * 5,
  });

  const pendingPopups = useMemo(() => {
    if (!popups) return [];
    return popups.filter(p => !sessionStorage.getItem(`popup-${p.id}`));
  }, [popups]);

  useEffect(() => {
    const isExcludedRoute = 
      location.pathname === '/login' || 
      location.pathname === '/' || 
      location.pathname.startsWith('/dashboard');

    if (pendingPopups.length > 0 && !isExcludedRoute && !isOpen) {
        setIsOpen(true);
    }
  }, [pendingPopups, location.pathname, isOpen]);

  const currentPopup = pendingPopups[currentIndex];

  const handleClose = () => {
    if (currentPopup) {
      sessionStorage.setItem(`popup-${currentPopup.id}`, 'true');
    }
    
    if (currentIndex < pendingPopups.length - 1) {
        setCurrentIndex(prev => prev + 1);
    } else {
        setIsOpen(false);
        setCurrentIndex(0);
    }
  };

  if (isLoading || !currentPopup || !isOpen) {
    return null;
  }

  return (
    <AlertDialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // Se tentar fechar (open === false), impedimos a mudança de estado
        if (!open) return;
        setIsOpen(open);
      }}
    >
      <AlertDialogContent 
        className="max-w-[450px] bg-[#0B1221] border-[#1E293B] text-white p-0 overflow-hidden rounded-3xl"
      >
        <div className="p-8 flex flex-col items-center text-center space-y-6">
          <div className="bg-[#1E293B] p-4 rounded-2xl">
            <Info className="h-8 w-8 text-[#0099FF]" />
          </div>

          <AlertDialogHeader className="w-full flex flex-col items-center">
            <AlertDialogTitle className="text-3xl font-black italic uppercase tracking-tight leading-tight">
                {currentPopup.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 text-base leading-relaxed w-full mt-4" asChild>
              <div 
                className="formatted-content max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar"
                dangerouslySetInnerHTML={{ __html: currentPopup.content }} 
              />
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogAction 
            onClick={handleClose} 
            className="w-full bg-[#0099FF] hover:bg-[#0088EE] text-white font-black h-14 rounded-2xl text-lg uppercase shadow-lg shadow-[#0099FF]/20"
          >
            {currentPopup.button_text}
          </AlertDialogAction>
        </div>

        <style>{`
          .formatted-content p { margin-bottom: 0.75rem; }
          .formatted-content p:last-child { margin-bottom: 0; }
          .formatted-content .ql-align-center { text-align: center; }
          .formatted-content .ql-align-right { text-align: right; }
          .formatted-content .ql-align-justify { text-align: justify; }
          .formatted-content strong { color: white; }
          
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
          }
        `}</style>
      </AlertDialogContent>
    </AlertDialog>
  );
};