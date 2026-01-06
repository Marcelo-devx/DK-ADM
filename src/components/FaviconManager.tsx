import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fetchLogoUrl = async () => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'logo_url')
    .single();
  if (error && error.code !== 'PGRST116') { // PGRST116: no rows returned
    console.error('Error fetching favicon URL:', error.message);
    return null;
  }
  return data?.value || null;
};

export const FaviconManager = () => {
  const { data: logoUrl } = useQuery<string | null>({
    queryKey: ['favicon'],
    queryFn: fetchLogoUrl,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    if (!logoUrl) return;

    let link: HTMLLinkElement | null = document.querySelector("link[rel='icon']") || document.querySelector("link[rel='shortcut icon']");
    
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    
    link.href = logoUrl;

  }, [logoUrl]);

  return null;
};