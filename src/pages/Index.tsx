import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, isAdmin, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/login");
      } else if (isAdmin) {
        navigate("/dashboard");
      } else {
        navigate("/meus-pedidos");
      }
    }
  }, [user, isAdmin, loading, navigate]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default Index;