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
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Filtra apenas os popups que ainda não foram mostrados nesta sessão
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
    
    // Se houver mais popups na fila, avança. Caso contrário, fecha.
    if (currentIndex < pendingPopups.length - 1) {
        setCurrentIndex(prev => prev + 1);
    } else {
        setIsOpen(false);
        setCurrentIndex(0); // Reseta para a próxima vez que a página carregar
    }
  };

  if (isLoading || !currentPopup || !isOpen) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if(!open) handleClose(); }}>
      <AlertDialogContent className="max-w-[400px]">
        <AlertDialogHeader className="flex flex-col items-center text-center">
          <AlertDialogTitle className="text-2xl font-black">{currentPopup.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-gray-600 w-full">
            <div 
              className="formatted-content"
              dangerouslySetInnerHTML={{ __html: currentPopup.content }} 
            />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogAction onClick={handleClose} className="w-full font-bold h-12">
          {currentPopup.button_text}
        </AlertDialogAction>
        <style>{`
          .formatted-content p { margin-bottom: 0.5rem; }
          .formatted-content p:last-child { margin-bottom: 0; }
          .formatted-content .ql-align-center { text-align: center; }
          .formatted-content .ql-align-right { text-align: right; }
          .formatted-content .ql-align-justify { text-align: justify; }
        `}</style>
      </AlertDialogContent>
    </AlertDialog>
  );
};