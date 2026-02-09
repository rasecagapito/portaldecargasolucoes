import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Blocks,
  ShieldCheck,
  ScrollText,
  Eye,
  EyeOff,
  RotateCcw,
  Lock,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  KeyRound,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

/* ────── Mock data ────── */

const tenantInfo = {
  name: "Empresa Demo",
  slug: "empresa-demo",
  plan: "Profissional",
  createdAt: "2026-01-15",
  usersCount: 8,
  maxUsers: 20,
};

const modules = [
  { id: "cargas", label: "Cargas", enabled: true, description: "Disparo e monitoramento de cargas via n8n" },
  { id: "usuarios", label: "Usuários", enabled: true, description: "Gestão de usuários, roles e permissões" },
  { id: "configuracoes", label: "Configurações", enabled: true, description: "Configurações do tenant e segurança" },
  { id: "relatorios", label: "Relatórios", enabled: false, description: "Relatórios avançados e analytics" },
  { id: "integracoes", label: "Integrações", enabled: false, description: "Integrações com sistemas externos" },
];

const webhookSecrets = [
  {
    id: "wh-1",
    label: "n8n Principal",
    hashPreview: "sha256:a3f8…d92c",
    createdAt: "2026-01-20",
    lastRotated: "2026-02-01",
    status: "active" as const,
  },
  {
    id: "wh-2",
    label: "n8n Backup",
    hashPreview: "sha256:b7e2…1f4a",
    createdAt: "2026-01-22",
    lastRotated: "2026-01-22",
    status: "expired" as const,
  },
];

const auditLogs = [
  { id: "1", action: "webhook.rotated", actor: "admin@empresa.com", target: "n8n Principal", timestamp: "2026-02-01 14:32", ip: "192.168.1.10" },
  { id: "2", action: "module.enabled", actor: "admin@empresa.com", target: "Relatórios", timestamp: "2026-01-28 09:15", ip: "192.168.1.10" },
  { id: "3", action: "user.created", actor: "admin@empresa.com", target: "joao@empresa.com", timestamp: "2026-01-25 16:45", ip: "192.168.1.10" },
  { id: "4", action: "tenant.updated", actor: "admin@empresa.com", target: "Empresa Demo", timestamp: "2026-01-20 11:20", ip: "192.168.1.10" },
  { id: "5", action: "webhook.created", actor: "admin@empresa.com", target: "n8n Backup", timestamp: "2026-01-22 08:00", ip: "192.168.1.10" },
  { id: "6", action: "role.updated", actor: "admin@empresa.com", target: "Operador", timestamp: "2026-01-19 13:10", ip: "192.168.1.10" },
];

const actionLabels: Record<string, string> = {
  "webhook.rotated": "Segredo rotacionado",
  "webhook.created": "Segredo criado",
  "module.enabled": "Módulo ativado",
  "module.disabled": "Módulo desativado",
  "user.created": "Usuário criado",
  "user.updated": "Usuário atualizado",
  "tenant.updated": "Tenant atualizado",
  "role.updated": "Role atualizada",
};

/* ────── Component ────── */

const ConfiguracoesPage = () => {
  const [moduleStates, setModuleStates] = useState(
    modules.reduce((acc, m) => ({ ...acc, [m.id]: m.enabled }), {} as Record<string, boolean>)
  );

  const handleModuleToggle = (moduleId: string) => {
    toast.info("⚠️ Ação sensível: alterações em módulos serão processadas via Edge Function com registro em audit_logs.");
    setModuleStates((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const handleRotateSecret = (secretId: string) => {
    toast.info("⚠️ Rotação de segredo será executada via Edge Function. O hash antigo será invalidado e um novo será gerado.");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gerenciamento do tenant, módulos e segurança
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs font-medium border-primary/30 text-primary">
            <Lock className="w-3 h-3" />
            Somente Admin
          </Badge>
        </div>

        {/* Security notice */}
        <Card className="p-3 bg-muted/50 border-dashed flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-warning))] mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Todas as ações nesta tela são registradas em <strong>audit_logs</strong>. Escritas sensíveis são processadas exclusivamente via <strong>Edge Functions</strong>. Segredos de webhook nunca são exibidos em texto — apenas o hash é armazenado.
          </p>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="tenant" className="space-y-4">
          <TabsList className="bg-secondary/50 p-1">
            <TabsTrigger value="tenant" className="gap-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5" />
              Tenant
            </TabsTrigger>
            <TabsTrigger value="modulos" className="gap-1.5 text-xs">
              <Blocks className="w-3.5 h-3.5" />
              Módulos
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="gap-1.5 text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-1.5 text-xs">
              <ScrollText className="w-3.5 h-3.5" />
              Auditoria
            </TabsTrigger>
          </TabsList>

          {/* ─── TENANT ─── */}
          <TabsContent value="tenant" className="space-y-4">
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-4">Informações do Tenant</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome da Empresa</Label>
                    <Input value={tenantInfo.name} readOnly className="bg-muted/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Slug</Label>
                    <Input value={tenantInfo.slug} readOnly className="bg-muted/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Plano</Label>
                    <div className="flex items-center gap-2">
                      <Input value={tenantInfo.plan} readOnly className="bg-muted/50" />
                      <Badge className="shrink-0 bg-primary/10 text-primary border-0 text-[10px]">Ativo</Badge>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Criado em</Label>
                    <Input value={tenantInfo.createdAt} readOnly className="bg-muted/50" />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-4">Limites</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="p-4 bg-muted/30 border-dashed">
                    <p className="text-xs text-muted-foreground">Usuários ativos</p>
                    <p className="text-2xl font-bold mt-1">
                      {tenantInfo.usersCount}
                      <span className="text-sm font-normal text-muted-foreground">/{tenantInfo.maxUsers}</span>
                    </p>
                  </Card>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Alterações no tenant são realizadas via Edge Function e registradas em audit_logs.</p>
              </div>
            </Card>
          </TabsContent>

          {/* ─── MÓDULOS ─── */}
          <TabsContent value="modulos" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-4">Módulos do Tenant</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Ative ou desative módulos disponíveis para este tenant. Um módulo só será visível para usuários cujas roles possuam permissão.
              </p>
              <div className="space-y-3">
                {modules.map((mod) => (
                  <div
                    key={mod.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${moduleStates[mod.id] ? "bg-primary/10" : "bg-muted"}`}>
                        <Blocks className={`w-4 h-4 ${moduleStates[mod.id] ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{mod.label}</p>
                        <p className="text-xs text-muted-foreground">{mod.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${moduleStates[mod.id] ? "status-badge-success" : "border-muted-foreground/30 text-muted-foreground"}`}
                      >
                        {moduleStates[mod.id] ? "Ativo" : "Inativo"}
                      </Badge>
                      <Switch
                        checked={moduleStates[mod.id]}
                        onCheckedChange={() => handleModuleToggle(mod.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* ─── SEGURANÇA ─── */}
          <TabsContent value="seguranca" className="space-y-4">
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-1">Segredos de Webhook (n8n)</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Segredos são usados para validar callbacks do n8n via HMAC. Apenas o hash é armazenado — o valor original nunca é exibido.
                </p>
              </div>

              <div className="space-y-3">
                {webhookSecrets.map((secret) => (
                  <div
                    key={secret.id}
                    className="p-4 rounded-lg border bg-card space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{secret.label}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${secret.status === "active" ? "status-badge-success" : "status-badge-error"}`}
                        >
                          {secret.status === "active" ? "Ativo" : "Expirado"}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8"
                        onClick={() => handleRotateSecret(secret.id)}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Rotacionar
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hash</p>
                        <div className="flex items-center gap-1.5">
                          <EyeOff className="w-3 h-3 text-muted-foreground" />
                          <code className="text-xs font-mono text-muted-foreground">{secret.hashPreview}</code>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Criado em</p>
                        <p className="text-xs">{secret.createdAt}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Última rotação</p>
                        <p className="text-xs">{secret.lastRotated}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Política de Segurança</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: ShieldCheck, label: "Validação HMAC obrigatória", active: true },
                    { icon: Lock, label: "Hash-only storage", active: true },
                    { icon: RotateCcw, label: "Rotação obrigatória a cada 30 dias", active: true },
                    { icon: ScrollText, label: "Auditoria de todas as operações", active: true },
                  ].map((policy, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-dashed">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--status-success))]" />
                      <span className="text-xs">{policy.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ─── AUDITORIA ─── */}
          <TabsContent value="auditoria" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">Logs de Auditoria</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Registros imutáveis de todas as ações administrativas
                  </p>
                </div>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Clock className="w-3 h-3" />
                  Imutável
                </Badge>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Ação</TableHead>
                      <TableHead className="text-xs">Ator</TableHead>
                      <TableHead className="text-xs">Alvo</TableHead>
                      <TableHead className="text-xs">Data/Hora</TableHead>
                      <TableHead className="text-xs">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/20">
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {actionLabels[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{log.actor}</TableCell>
                        <TableCell className="text-xs font-medium">{log.target}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.timestamp}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{log.ip}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Logs são imutáveis e não podem ser alterados ou excluídos. Armazenados com tenant_id para isolamento multi-tenant.
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ConfiguracoesPage;
