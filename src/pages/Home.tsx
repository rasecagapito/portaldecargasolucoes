import {
  Truck,
  Users,
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/layout/AppLayout";

const stats = [
  {
    title: "Total Execuções",
    value: "1.284",
    change: "+12%",
    icon: Activity,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    title: "Cargas Ativas",
    value: "23",
    change: "+3",
    icon: Truck,
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    title: "Usuários",
    value: "18",
    change: "2 novos",
    icon: Users,
    color: "text-status-warning",
    bg: "bg-[hsl(var(--status-warning)/0.1)]",
  },
  {
    title: "Taxa Sucesso",
    value: "97.3%",
    change: "+0.8%",
    icon: CheckCircle2,
    color: "text-status-success",
    bg: "bg-[hsl(var(--status-success)/0.1)]",
  },
];

const recentExecutions = [
  {
    id: "exec_001",
    workflow: "Sync Estoque",
    status: "success",
    user: "João S.",
    time: "2 min atrás",
  },
  {
    id: "exec_002",
    workflow: "Importar NFs",
    status: "running",
    user: "Maria L.",
    time: "5 min atrás",
  },
  {
    id: "exec_003",
    workflow: "Relatório Diário",
    status: "error",
    user: "Admin",
    time: "12 min atrás",
  },
  {
    id: "exec_004",
    workflow: "Atualizar Preços",
    status: "success",
    user: "Carlos R.",
    time: "25 min atrás",
  },
  {
    id: "exec_005",
    workflow: "Backup DB",
    status: "queued",
    user: "Sistema",
    time: "30 min atrás",
  },
];

const statusConfig: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  success: { label: "Sucesso", class: "status-badge-success", icon: CheckCircle2 },
  running: { label: "Executando", class: "status-badge-running", icon: Clock },
  error: { label: "Erro", class: "status-badge-error", icon: AlertTriangle },
  queued: { label: "Na Fila", class: "status-badge-queued", icon: Clock },
};

const Home = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral das operações
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="border border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <span className="text-xs font-medium text-status-success flex items-center gap-0.5">
                    {stat.change}
                    <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.title}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Executions */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Últimas Execuções
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentExecutions.map((exec) => {
                const config = statusConfig[exec.status];
                const StatusIcon = config.icon;
                return (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon
                        className={`w-4 h-4 shrink-0 ${
                          exec.status === "success"
                            ? "text-status-success"
                            : exec.status === "error"
                            ? "text-status-error"
                            : exec.status === "running"
                            ? "text-status-warning animate-pulse-slow"
                            : "text-primary"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {exec.workflow}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {exec.user}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge
                        variant="secondary"
                        className={`text-[11px] font-medium px-2 py-0.5 ${config.class}`}
                      >
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {exec.time}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Home;
