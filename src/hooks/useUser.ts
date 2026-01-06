import { useState, useEffect } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  first_name: string | null;
  last_name: string | null;
  role: 'user' | 'adm';
}

export const useUser = () => {
  const session = useSession();
  const user = session?.user;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error fetching profile:', error.message);
            setIsAdmin(false);
            setProfile(null);
          } else if (data) {
            setProfile(data as Profile);
            setIsAdmin(data.role === 'adm');
          }
        } catch (e) {
            if (e instanceof Error) {
                console.error('An unexpected error occurred:', e.message);
            }
            setIsAdmin(false);
            setProfile(null);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
        setProfile(null);
        setIsAdmin(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  return { user, profile, loading, isAdmin };
};