import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { ShoppingCart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface SalesPopup {
  id: number;
  customer_name: string;
  product_name: string;
  product_image_url: string | null;
  time_ago: string;
}

const fetchActiveSalesPopups = async () => {
  const { data, error } = await supabase
    .from("sales_popups")
    .select("id, customer_name, product_name, product_image_url, time_ago")
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching sales popups:", error.message);
    return [];
  }
  return data as SalesPopup[];
};

const fetchPopupInterval = async () => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "sales_popup_interval")
    .single();
  
  if (error || !data) return 20; // Default: 20 seconds
  return parseInt(data.value, 10) || 20;
};

export const SalesPopupDisplay = () => {
  const { data: popups, isLoading: isLoadingPopups } = useQuery({
    queryKey: ["activeSalesPopups"],
    queryFn: fetchActiveSalesPopups,
    staleTime: 1000 * 60 * 5,
  });

  const { data: intervalSeconds } = useQuery({
    queryKey: ["salesPopupIntervalSetting"],
    queryFn: fetchPopupInterval,
    staleTime: 1000 * 60 * 10,
  });

  const isMobile = useIsMobile();
  const [currentPopup, setCurrentPopup] = useState<SalesPopup | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isLoadingPopups || !popups || popups.length === 0) return;

    let showTimeout: ReturnType<typeof setTimeout>;
    let hideTimeout: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setTimeout>;

    const displayRandomPopup = () => {
      const randomIndex = Math.floor(Math.random() * popups.length);
      const selectedPopup = popups[randomIndex];
      setCurrentPopup(selectedPopup);

      setIsVisible(true);

      // Esconde após 8 segundos
      hideTimeout = setTimeout(() => {
        setIsVisible(false);
      }, 8000);

      // Agenda o próximo baseado na configuração (entre 80% e 120% do tempo definido para variar um pouco)
      const baseMs = (intervalSeconds || 20) * 1000;
      const variation = Math.random() * (1.2 - 0.8) + 0.8;
      const nextDelay = baseMs * variation;
      
      interval = setTimeout(displayRandomPopup, nextDelay);
    };

    showTimeout = setTimeout(displayRandomPopup, 5000);

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
      clearTimeout(interval);
    };
  }, [popups, isLoadingPopups, intervalSeconds]);

  if (isLoadingPopups || !currentPopup) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-50 max-w-xs w-full bg-white dark:bg-gray-800 shadow-xl rounded-lg p-3 transition-all duration-500 transform",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
        isMobile ? "bottom-16" : "bottom-4"
      )}
      role="alert"
    >
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-1 right-1 text-gray-400 hover:text-gray-600 p-1 rounded-full"
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start space-x-3">
        {currentPopup.product_image_url ? (
          <img
            src={currentPopup.product_image_url}
            alt={currentPopup.product_name}
            className="h-12 w-12 rounded-md object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="h-6 w-6 text-primary" />
          </div>
        )}
        <div className="flex flex-col">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {currentPopup.customer_name} comprou
          </p>
          <p className="text-sm text-primary font-medium truncate max-w-[180px]">
            {currentPopup.product_name}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {currentPopup.time_ago}
          </p>
        </div>
      </div>
    </div>
  );
};