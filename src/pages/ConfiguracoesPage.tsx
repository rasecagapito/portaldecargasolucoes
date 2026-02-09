import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
  Truck,
  Link2,
  Plus,
  Pencil,
  Trash2,
  Webhook,
  Users,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

/* ────── Mock data (unchanged tabs) ────── */

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

const cargaTypes = [
  {
    id: "ct-1",
    name: "Carga Completa (FTL)",
    description: "Transporte de carga lotação, veículo dedicado",
    webhookUrl: "https://n8n.exemplo.com/webhook/ftl-dispatch",
    webhookStatus: "connected" as const,
    lastTriggered: "2026-02-08 16:30",
  },
  {
    id: "ct-2",
    name: "Carga Fracionada (LTL)",
    description: "Transporte compartilhado com consolidação",
    webhookUrl: "https://n8n.exemplo.com/webhook/ltl-dispatch",
    webhookStatus: "connected" as const,
    lastTriggered: "2026-02-07 09:15",
  },
  {
    id: "ct-3",
    name: "Carga Expressa",
    description: "Entrega prioritária com prazo reduzido",
    webhookUrl: "",
    webhookStatus: "disconnected" as const,
    lastTriggered: null,
  },
  {
    id: "ct-4",
    name: "Carga Refrigerada",
    description: "Transporte com controle de temperatura",
    webhookUrl: "https://n8n.exemplo.com/webhook/reefer-dispatch",
    webhookStatus: "error" as const,
    lastTriggered: "2026-01-30 12:00",
  },
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

const actionLabels: Record<string, string> = {
  "webhook.rotated": "Segredo rotacionado",
  "webhook.created": "Segredo criado",
  "module.enabled": "Módulo ativado",
  "module.disabled": "Módulo desativado",
  "user.created": "Usuário criado",
  "user.updated": "Usuário atualizado",
  "user.activated": "Usuário ativado",
  "user.deactivated": "Usuário desativado",
  "tenant.updated": "Tenant atualizado",
  "role.updated": "Role atualizada",
  "permission.updated": "Permissão alterada",
};

const moduleLabels: Record<string, string> = {
  dashboard: "Dashboard",
  cargas: "Cargas",
  usuarios: "Usuários",
  configuracoes: "Configurações",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  operator: "Operador",
  viewer: "Visualizador",
};

/* ────── Component ────── */

interface RoleModuleRow {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const ConfiguracoesPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
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

  // Fetch role_modules for permissions tab
  const { data: roleModules = [], isLoading: loadingPerms } = useQuery({
    queryKey: ["role-modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_modules")
        .select("id, role, module, can_view, can_create, can_edit, can_delete")
        .order("role")
        .order("module");
      if (error) throw error;
      return (data ?? []) as RoleModuleRow[];
    },
  });

  // Fetch audit_logs from DB
  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, actor_id, target_type, target_id, details, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const permMutation = useMutation({
    mutationFn: async (payload: { role: string; module: string; field: string; value: boolean }) => {
      const { data, error } = await supabase.functions.invoke("manage-permissions", {
        body: {
          action: "update",
          role: payload.role,
          module: payload.module,
          [payload.field]: payload.value,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-modules"] });
      toast.success("Permissão atualizada");
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar permissão: " + err.message);
    },
  });

  const handlePermToggle = (role: string, module: string, field: string, currentValue: boolean) => {
    if (role === "admin") {
      toast.error("Permissões de admin não podem ser alteradas");
      return;
    }
    permMutation.mutate({ role, module, field, value: !currentValue });
  };

  // Group role_modules by role
  const roleGroups = ["admin", "operator", "viewer"];
  const moduleList = ["dashboard", "cargas", "usuarios", "configuracoes"];

  const getPermission = (role: string, module: string): RoleModuleRow | undefined => {
    return roleModules.find((rm) => rm.role === role && rm.module === module);
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
            <TabsTrigger value="permissoes" className="gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5" />
              Perfis e Permissões
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="gap-1.5 text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="cargas" className="gap-1.5 text-xs">
              <Truck className="w-3.5 h-3.5" />
              Cargas
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

          {/* ─── PERFIS E PERMISSÕES ─── */}
          <TabsContent value="permissoes" className="space-y-4">
            <Card className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Perfis e Permissões</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure quais módulos cada role pode acessar e quais ações pode realizar.
                </p>
              </div>

              {loadingPerms ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-semibold min-w-[100px]">Role</TableHead>
                        <TableHead className="text-xs font-semibold min-w-[100px]">Módulo</TableHead>
                        <TableHead className="text-xs text-center">Visualizar</TableHead>
                        <TableHead className="text-xs text-center">Criar</TableHead>
                        <TableHead className="text-xs text-center">Editar</TableHead>
                        <TableHead className="text-xs text-center">Excluir</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roleGroups.map((role) =>
                        moduleList.map((module, mi) => {
                          const perm = getPermission(role, module);
                          const isAdmin = role === "admin";
                          return (
                            <TableRow key={`${role}-${module}`} className={mi === 0 ? "border-t-2" : ""}>
                              {mi === 0 && (
                                <TableCell rowSpan={moduleList.length} className="align-top font-medium text-sm border-r">
                                  <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs">
                                    {roleLabels[role]}
                                  </Badge>
                                  {isAdmin && (
                                    <p className="text-[10px] text-muted-foreground mt-1">Acesso total</p>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="text-sm">{moduleLabels[module]}</TableCell>
                              {(["can_view", "can_create", "can_edit", "can_delete"] as const).map((field) => (
                                <TableCell key={field} className="text-center">
                                  <Checkbox
                                    checked={perm?.[field] ?? false}
                                    disabled={isAdmin || permMutation.isPending}
                                    onCheckedChange={() =>
                                      handlePermToggle(role, module, field, perm?.[field] ?? false)
                                    }
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Permissões de Admin são fixas e não podem ser alteradas. Todas as mudanças são registradas em audit_logs.
                </p>
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

          {/* ─── CARGAS ─── */}
          <TabsContent value="cargas" className="space-y-4">
            <Card className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Tipos de Carga</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure os tipos de carga e vincule os webhooks do n8n para cada fluxo
                  </p>
                </div>
                <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => toast.info("⚠️ Criação de tipo de carga será processada via Edge Function.")}>
                  <Plus className="w-3 h-3" />
                  Nova Carga
                </Button>
              </div>

              <div className="space-y-3">
                {cargaTypes.map((carga) => (
                  <div
                    key={carga.id}
                    className="p-4 rounded-lg border bg-card space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Truck className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{carga.name}</p>
                          <p className="text-xs text-muted-foreground">{carga.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toast.info("⚠️ Edição será processada via Edge Function.")}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => toast.info("⚠️ Exclusão será processada via Edge Function.")}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          Webhook n8n
                        </Label>
                        {carga.webhookUrl ? (
                          <code className="text-xs font-mono bg-muted/50 px-2 py-1.5 rounded block truncate">
                            {carga.webhookUrl}
                          </code>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input placeholder="https://n8n.exemplo.com/webhook/..." className="text-xs h-8 font-mono" />
                            <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => toast.info("⚠️ Webhook será salvo via Edge Function.")}>
                              Vincular
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</Label>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              carga.webhookStatus === "connected"
                                ? "status-badge-success"
                                : carga.webhookStatus === "error"
                                ? "status-badge-error"
                                : "border-muted-foreground/30 text-muted-foreground"
                            }`}
                          >
                            {carga.webhookStatus === "connected"
                              ? "Conectado"
                              : carga.webhookStatus === "error"
                              ? "Erro"
                              : "Desconectado"}
                          </Badge>
                          {carga.lastTriggered && (
                            <span className="text-[10px] text-muted-foreground">
                              Último: {carga.lastTriggered}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  URLs de webhook são validadas e armazenadas via Edge Function. Cada disparo é registrado em audit_logs com tenant_id.
                </p>
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

              {loadingAudit ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum log de auditoria encontrado
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Ação</TableHead>
                        <TableHead className="text-xs">Alvo</TableHead>
                        <TableHead className="text-xs">Detalhes</TableHead>
                        <TableHead className="text-xs">Data/Hora</TableHead>
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
                          <TableCell className="text-xs font-medium">
                            {log.target_type}: {log.target_id?.slice(0, 8)}…
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {log.details ? JSON.stringify(log.details) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString("pt-BR")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

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
