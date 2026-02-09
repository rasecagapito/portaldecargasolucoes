import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Mock login - will be replaced with Supabase Auth
    setTimeout(() => {
      setLoading(false);
      navigate("/home");
    }, 800);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 sidebar-gradient items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-accent blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-sidebar-accent-foreground">
                Cargas Flow
              </h1>
              <p className="text-sm text-sidebar-foreground">
                Gestão de Cargas SaaS
              </p>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-sidebar-accent-foreground leading-tight mb-4">
            Controle total das suas operações de carga
          </h2>
          <p className="text-sidebar-foreground leading-relaxed">
            Dispare, monitore e audite todas as suas execuções em um único
            painel. Multi-tenant, seguro e escalável.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-6">
            {[
              { value: "99.9%", label: "Uptime" },
              { value: "50k+", label: "Execuções/mês" },
              { value: "<200ms", label: "Latência" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold text-primary">
                  {stat.value}
                </p>
                <p className="text-xs text-sidebar-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Cargas Flow</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold">Bem-vindo de volta</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Entre com suas credenciais para continuar
            </p>
          </div>

          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 font-semibold"
                  disabled={loading}
                >
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-xs text-center text-muted-foreground mt-8">
            © 2026 Cargas Flow. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
