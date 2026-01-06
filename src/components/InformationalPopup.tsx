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
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

const fetchActivePopup = async () => {
  const { data, error } = await supabase
    .from("informational_popups")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // Ignore no rows found error
    console.error("Error fetching active popup:", error.message);
    return null;
  }
  return data;
};

export const InformationalPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { data: popup, isLoading } = useQuery({
    queryKey: ["activeInformationalPopup"],
    queryFn: fetchActivePopup,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    const isExcludedRoute = 
      location.pathname === '/login' || 
      location.pathname === '/' || 
      location.pathname.startsWith('/dashboard');

    if (popup && !isExcludedRoute) {
      const popupId = `popup-${popup.id}`;
      const hasBeenShown = sessionStorage.getItem(popupId);
      if (!hasBeenShown) {
        setIsOpen(true);
      }
    } else {
      setIsOpen(false);
    }
  }, [popup, location.pathname]);

  const handleClose = () => {
    if (popup) {
      const popupId = `popup-${popup.id}`;
      sessionStorage.setItem(popupId, 'true');
    }
    setIsOpen(false);
  };

  if (isLoading || !popup || !isOpen) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{popup.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {popup.content}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogAction onClick={handleClose}>
          {popup.button_text}
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
};