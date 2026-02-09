import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  module?: string;
}

const AccessDenied = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <ShieldX className="w-12 h-12 text-destructive" />
      <h1 className="text-xl font-bold">Acesso Negado</h1>
      <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      <Button variant="outline" onClick={() => navigate("/home")}>
        Voltar ao Dashboard
      </Button>
    </div>
  );
};

const ProtectedRoute = ({ children, module }: ProtectedRouteProps) => {
  const { session, loading, hasModuleAccess, role } = useAuth();

  // Show loading while auth or user data is still being fetched
  if (loading || (session && role === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (module && !hasModuleAccess(module)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
