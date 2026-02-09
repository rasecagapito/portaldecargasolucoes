import { useState } from "react";
import { Play, Clock, CheckCircle2, AlertTriangle, Search, Eye, RotateCcw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/components/layout/AppLayout";

const availableCargas = [
  {
    id: "carga_01",
    name: "Sync Estoque",
    description: "Sincroniza estoque com ERP",
    lastRun: "Hoje, 14:30",
    avgTime: "45s",
  },
  {
    id: "carga_02",
    name: "Impostos",
    description: "Importa tipos de impostos",
    lastRun: "Hoje, 10:15",
    avgTime: "2min",
  },
  {
    id: "carga_03",
    name: "Relatório Diário",
    description: "Gera relatórios consolidados",
    lastRun: "Ontem, 23:00",
    avgTime: "1min 30s",
  },
  {
    id: "carga_04",
    name: "Atualizar Preços",
    description: "Atualiza tabela de preços por fornecedor",
    lastRun: "3 dias atrás",
    avgTime: "30s",
  },
];

const executionHistory = [
  {
    id: "exec_001",
    workflow: "Sync Estoque",
    status: "success",
    user: "João Silva",
    startedAt: "09/02/2026 14:30",
    finishedAt: "09/02/2026 14:31",
    duration: "45s",
  },
  {
    id: "exec_002",
    workflow: "Importar NFs",
    status: "running",
    user: "Maria Lopes",
    startedAt: "09/02/2026 14:25",
    finishedAt: "—",
    duration: "5min+",
  },
  {
    id: "exec_003",
    workflow: "Relatório Diário",
    status: "error",
    user: "Admin",
    startedAt: "09/02/2026 14:18",
    finishedAt: "09/02/2026 14:19",
    duration: "1min 02s",
  },
  {
    id: "exec_004",
    workflow: "Atualizar Preços",
    status: "success",
    user: "Carlos R.",
    startedAt: "09/02/2026 14:05",
    finishedAt: "09/02/2026 14:05",
    duration: "28s",
  },
  {
    id: "exec_005",
    workflow: "Sync Estoque",
    status: "queued",
    user: "Sistema",
    startedAt: "09/02/2026 14:00",
    finishedAt: "—",
    duration: "—",
  },
];

const statusConfig: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  success: { label: "Sucesso", class: "status-badge-success", icon: CheckCircle2 },
  running: { label: "Executando", class: "status-badge-running", icon: Loader2 },
  error: { label: "Erro", class: "status-badge-error", icon: AlertTriangle },
  queued: { label: "Na Fila", class: "status-badge-queued", icon: Clock },
};

const CargasPage = () => {
  const [search, setSearch] = useState("");
  const [launchDialog, setLaunchDialog] = useState<string | null>(null);
  const [detailDialog, setDetailDialog] = useState<string | null>(null);

  const selectedCarga = availableCargas.find((c) => c.id === launchDialog);
  const selectedExec = executionHistory.find((e) => e.id === detailDialog);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cargas</h1>
          <p className="text-sm text-muted-foreground mt-1">Dispare e monitore execuções de cargas</p>
        </div>

        <Tabs defaultValue="dispatch" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dispatch" className="gap-2">
              <Play className="w-3.5 h-3.5" />
              Disparo
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Clock className="w-3.5 h-3.5" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Dispatch Tab */}
          <TabsContent value="dispatch">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableCargas.map((carga) => (
                <Card key={carga.id} className="border border-border hover:border-primary/30 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold">{carga.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{carga.description}</p>
                      </div>
                      <Button size="sm" className="gap-1.5 font-semibold" onClick={() => setLaunchDialog(carga.id)}>
                        <Play className="w-3.5 h-3.5" />
                        Executar
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Última: {carga.lastRun}</span>
                      <span>Tempo médio: {carga.avgTime}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card className="border border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Histórico de Execuções</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar execuções..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 h-9 text-sm bg-secondary border-0"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">ID</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executionHistory
                      .filter(
                        (e) =>
                          e.workflow.toLowerCase().includes(search.toLowerCase()) ||
                          e.id.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((exec) => {
                        const config = statusConfig[exec.status];
                        return (
                          <TableRow key={exec.id} className="cursor-pointer">
                            <TableCell className="pl-6 font-mono text-xs">{exec.id}</TableCell>
                            <TableCell className="text-sm font-medium">{exec.workflow}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`text-[11px] font-medium gap-1 ${config.class}`}>
                                <config.icon className={`w-3 h-3 ${exec.status === "running" ? "animate-spin" : ""}`} />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{exec.user}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{exec.startedAt}</TableCell>
                            <TableCell className="text-sm font-mono">{exec.duration}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setDetailDialog(exec.id)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Launch Dialog */}
        <Dialog open={!!launchDialog} onOpenChange={(open) => !open && setLaunchDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Executar: {selectedCarga?.name}</DialogTitle>
              <DialogDescription>
                {selectedCarga?.description}. Configure os parâmetros antes de disparar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Parâmetros (JSON)</Label>
                <Textarea placeholder='{"key": "value"}' className="font-mono text-sm min-h-[100px]" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLaunchDialog(null)}>
                Cancelar
              </Button>
              <Button className="gap-2 font-semibold" onClick={() => setLaunchDialog(null)}>
                <Play className="w-4 h-4" />
                Disparar Carga
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={!!detailDialog} onOpenChange={(open) => !open && setDetailDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Execução: {selectedExec?.id}</DialogTitle>
              <DialogDescription>Detalhes da execução de {selectedExec?.workflow}</DialogDescription>
            </DialogHeader>
            {selectedExec && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Status</p>
                    <Badge variant="secondary" className={`${statusConfig[selectedExec.status].class} gap-1`}>
                      {statusConfig[selectedExec.status].label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Duração</p>
                    <p className="font-mono">{selectedExec.duration}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Usuário</p>
                    <p>{selectedExec.user}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Início</p>
                    <p>{selectedExec.startedAt}</p>
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground text-xs mb-2">Timeline</p>
                  <div className="space-y-2 border-l-2 border-border pl-4 ml-1">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary" />
                      <p className="text-sm font-medium">Carga iniciada</p>
                      <p className="text-xs text-muted-foreground">{selectedExec.startedAt}</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-status-success" />
                      <p className="text-sm font-medium">Webhook enviado ao n8n</p>
                      <p className="text-xs text-muted-foreground">Payload validado</p>
                    </div>
                    {selectedExec.status === "success" && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-status-success" />
                        <p className="text-sm font-medium">Execução concluída</p>
                        <p className="text-xs text-muted-foreground">{selectedExec.finishedAt}</p>
                      </div>
                    )}
                    {selectedExec.status === "error" && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-status-error" />
                        <p className="text-sm font-medium">Erro na execução</p>
                        <p className="text-xs text-muted-foreground">Timeout na resposta do ERP</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" className="gap-2" onClick={() => setDetailDialog(null)}>
                <RotateCcw className="w-3.5 h-3.5" />
                Re-executar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default CargasPage;
