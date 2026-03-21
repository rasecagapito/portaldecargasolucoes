import { useState, useEffect } from "react";
import { XCircle, StopCircle, FileUp, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { Play, Clock, CheckCircle2, AlertTriangle, Search, Eye, RotateCcw, Loader2, Plus, Pencil, Power, ChevronDown, ChevronRight, Trash2, GripVertical, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CargaItem {
  id: string;
  carga_id: string;
  tenant_id: string;
  name: string;
  webhook_url: string;
  active: boolean;
  execution_order: number;
  created_at: string;
  updated_at: string;
}

interface Carga {
  id: string;
  name: string;
  description: string | null;
  webhook_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  items?: CargaItem[];
}

interface CargaExecution {
  id: string;
  carga_id: string;
  carga_item_id: string | null;
  status: string;
  user_id: string;
  params: unknown;
  result: unknown;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  carga_name?: string;
  carga_item_name?: string;
  user_name?: string;
}

interface SpedHistoryItem {
  id: string;
  status: string;
  created_at: string;
  updated_at: string | null;
  client_id: string;
  client_name?: string;
}

const statusConfig: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  success: { label: "Sucesso", class: "bg-status-success/10 text-[hsl(var(--status-success))]", icon: CheckCircle2 },
  running: { label: "Executando", class: "bg-status-running/10 text-[hsl(var(--status-running))]", icon: Loader2 },
  error: { label: "Erro", class: "bg-status-error/10 text-[hsl(var(--status-error))]", icon: AlertTriangle },
  pending: { label: "Pendente", class: "bg-status-queued/10 text-[hsl(var(--status-queued))]", icon: Clock },
  cancelled: { label: "Cancelada", class: "bg-muted text-muted-foreground", icon: Ban },
};

const CargasPage = () => {
  const { session, profile, isAdmin, canCreate } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [launchDialog, setLaunchDialog] = useState<{ itemId: string; itemName: string; cargaName: string } | null>(null);
  const [detailDialog, setDetailDialog] = useState<string | null>(null);
  const [cargaFormDialog, setCargaFormDialog] = useState<Carga | null | "new">(null);
  const [launchParams, setLaunchParams] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formItems, setFormItems] = useState<Array<{ id?: string; name: string; webhook_url: string; active: boolean; execution_order: number }>>([]);
  
  // SPED State
  const [spedDialogOpen, setSpedDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [spedUploadId, setSpedUploadId] = useState<string | null>(null);
  const [spedStatus, setSpedStatus] = useState<string | null>(null);

  // Fetch cargas with items
  const { data: cargas = [], isLoading: loadingCargas } = useQuery({
    queryKey: ["cargas"],
    queryFn: async () => {
      const { data: cargasData, error } = await supabase
        .from("cargas")
        .select("*")
        .order("name");
      if (error) throw error;

      const { data: itemsData, error: itemsError } = await supabase
        .from("carga_items")
        .select("*")
        .order("execution_order");
      if (itemsError) throw itemsError;

      return (cargasData || []).map((c: Carga) => ({
        ...c,
        items: (itemsData || []).filter((i: CargaItem) => i.carga_id === c.id),
      })) as Carga[];
    },
  });

  // Fetch Clients for SPED
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-minimal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Listen for Realtime updates on sped_uploads
  useEffect(() => {
    if (!spedUploadId) return;

    const channel = supabase
      .channel("sped_updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sped_uploads",
          filter: `id=eq.${spedUploadId}`,
        },
        (payload) => {
          console.log("Realtime SPED update:", payload.new);
          setSpedStatus(payload.new.status);
          if (payload.new.status === "success" || payload.new.status === "error") {
            // Stop listening maybe? Or just let it be.
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spedUploadId]);

  // Fetch executions with polling
  const { data: executions = [], isLoading: loadingExecs } = useQuery({
    queryKey: ["carga_executions"],
    queryFn: async () => {
      const { data: execs, error } = await supabase
        .from("carga_executions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const cargaIds = [...new Set((execs || []).map((e: CargaExecution) => e.carga_id))];
      const userIds = [...new Set((execs || []).map((e: CargaExecution) => e.user_id))];
      const itemIds = [...new Set((execs || []).filter((e: CargaExecution) => e.carga_item_id).map((e: CargaExecution) => e.carga_item_id!))];

      const [cargasRes, profilesRes, itemsRes] = await Promise.all([
        cargaIds.length > 0
          ? supabase.from("cargas").select("id, name").in("id", cargaIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
        itemIds.length > 0
          ? supabase.from("carga_items").select("id, name").in("id", itemIds)
          : Promise.resolve({ data: [] }),
      ]);

      const cargaMap = Object.fromEntries((cargasRes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
      const userMap = Object.fromEntries((profilesRes.data || []).map((p: { user_id: string; full_name: string }) => [p.user_id, p.full_name]));
      const itemMap = Object.fromEntries((itemsRes.data || []).map((i: { id: string; name: string }) => [i.id, i.name]));

      return (execs || []).map((e: CargaExecution) => ({
        ...e,
        carga_name: cargaMap[e.carga_id] || "—",
        carga_item_name: e.carga_item_id ? (itemMap[e.carga_item_id] || "—") : null,
        user_name: userMap[e.user_id] || "—",
      })) as CargaExecution[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as CargaExecution[] | undefined;
      const hasActive = data?.some((e) => e.status === "pending" || e.status === "running");
      return hasActive ? 5000 : false;
    },
  });

  // Fetch SPED uploads history
  const { data: spedHistory = [] } = useQuery({
    queryKey: ["sped_uploads_history"],
    queryFn: async () => {
      const { data: modernData, error: modernError } = await supabase
        .from("sped_uploads")
        .select("id, status, created_at, finished_at, client_id")
        .order("created_at", { ascending: false })
        .limit(50);

      let normalizedRows: SpedHistoryItem[] = [];

      if (!modernError) {
        normalizedRows = (modernData || []).map((row: { id: string; status: string; created_at: string; finished_at: string | null; client_id: string }) => ({
          id: row.id,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.finished_at ?? row.created_at,
          client_id: row.client_id,
        }));
      } else {
        const { data: legacyData, error: legacyError } = await supabase
          .from("sped_uploads")
          .select("id, status, created_at, updated_at, client_id")
          .order("created_at", { ascending: false })
          .limit(50);

        if (legacyError) throw modernError;

        normalizedRows = (legacyData || []).map((row: { id: string; status: string; created_at: string; updated_at: string | null; client_id: string }) => ({
          id: row.id,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at ?? row.created_at,
          client_id: row.client_id,
        }));
      }

      // Buscar nomes dos clientes
      const clientIds = [...new Set(normalizedRows.map((s) => s.client_id))];
      const { data: clientsData } = clientIds.length > 0
        ? await supabase.from("clients").select("id, name").in("id", clientIds)
        : { data: [] };
      const clientMap = Object.fromEntries(
        (clientsData || []).map((c) => [c.id, c.name])
      );

      return normalizedRows.map((s) => ({
        ...s,
        client_name: clientMap[s.client_id] || "—",
      }));
    },
    refetchInterval: 10000,
  });

  // Dispatch mutation (now dispatches a carga_item)
  const dispatchMutation = useMutation({
    mutationFn: async ({ cargaItemId, params }: { cargaItemId: string; params: Record<string, unknown> }) => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://kmunvgkwmdonygmldhgf.supabase.co/functions/v1/dispatch-carga`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession?.access_token}`,
          },
          body: JSON.stringify({ carga_item_id: cargaItemId, params }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao disparar carga");
      return json;
    },
    onSuccess: (data) => {
      toast.success("Carga disparada com sucesso!", { description: `Execução: ${data.execution_id.slice(0, 8)}...` });
      queryClient.invalidateQueries({ queryKey: ["carga_executions"] });
      setLaunchDialog(null);
      setLaunchParams("");
    },
    onError: (err: Error) => {
      toast.error("Erro ao disparar carga", { description: err.message });
    },
  });

  // Cancel execution mutation
  const cancelMutation = useMutation({
    mutationFn: async (executionId: string) => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://kmunvgkwmdonygmldhgf.supabase.co/functions/v1/cancel-carga`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession?.access_token}`,
          },
          body: JSON.stringify({ execution_id: executionId }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao cancelar execução");
      return json;
    },
    onSuccess: () => {
      toast.success("Execução cancelada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["carga_executions"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao cancelar execução", { description: err.message });
    },
  });

  // Save carga module (create/update) with items
  const saveCargaMutation = useMutation({
    mutationFn: async (carga: { id?: string; name: string; description: string; items: Array<{ id?: string; name: string; webhook_url: string; active: boolean; execution_order: number }> }) => {
      const tenantId = (await supabase.rpc("get_user_tenant_id")).data;
      let cargaId = carga.id;

      if (cargaId) {
        const { error } = await supabase.from("cargas").update({
          name: carga.name,
          description: carga.description,
        }).eq("id", cargaId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("cargas").insert({
          name: carga.name,
          description: carga.description,
          tenant_id: tenantId,
        }).select("id").single();
        if (error) throw error;
        cargaId = data.id;
      }

      // Get existing items for this carga
      const { data: existingItems } = await supabase
        .from("carga_items")
        .select("id")
        .eq("carga_id", cargaId);

      const existingIds = new Set((existingItems || []).map((i: { id: string }) => i.id));
      const submittedIds = new Set(carga.items.filter(i => i.id).map(i => i.id));

      // Delete removed items
      const toDelete = [...existingIds].filter(id => !submittedIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase.from("carga_items").delete().in("id", toDelete);
        if (error) throw error;
      }

      // Upsert items
      for (const item of carga.items) {
        if (item.id) {
          const { error } = await supabase.from("carga_items").update({
            name: item.name,
            webhook_url: item.webhook_url,
            active: item.active,
            execution_order: item.execution_order,
          }).eq("id", item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("carga_items").insert({
            carga_id: cargaId,
            tenant_id: tenantId,
            name: item.name,
            webhook_url: item.webhook_url,
            active: item.active,
            execution_order: item.execution_order,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Módulo salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["cargas"] });
      setCargaFormDialog(null);
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar módulo", { description: err.message });
    },
  });

  // Toggle active (module level)
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("cargas").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargas"] });
    },
  });

  const handleDispatch = async () => {
    if (!launchDialog) return;
    let params = {};
    if (launchParams.trim()) {
      try {
        params = JSON.parse(launchParams);
      } catch {
        toast.error("JSON inválido nos parâmetros");
        return;
      }
    }
    try {
      await dispatchMutation.mutateAsync({ cargaItemId: launchDialog.itemId, params });
    } catch {
      // error handled by onError callback — modal stays open
    }
  };

  const handleSpedUpload = async () => {
    if (!selectedClientId || !selectedFile) {
      toast.error("Selecione um cliente e um arquivo SPED");
      return;
    }

    setIsUploading(true);
    setSpedStatus("uploading");

    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${profile?.tenant_id}/${fileName}`;

      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from("sped-files")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // 2. Dispatch Edge Function
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        await supabase.auth.refreshSession();
        const { data: { session: refreshed } } = await supabase.auth.getSession();
        if (!refreshed?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
        Object.assign(currentSession ?? {}, refreshed);
      }
      const res = await fetch(
        `https://kmunvgkwmdonygmldhgf.supabase.co/functions/v1/dispatch-carga-sped`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || 
                    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            client_id: selectedClientId,
            file_path: filePath,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao disparar carga SPED");

      setSpedUploadId(json.id);
      setSpedStatus("processing");
      toast.success("Arquivo enviado! Processamento iniciado.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido no upload";
      toast.error("Erro no processo", { description: message });
      setSpedStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  const openCargaForm = (carga?: Carga) => {
    if (carga) {
      setFormName(carga.name);
      setFormDescription(carga.description || "");
      setFormItems(
        (carga.items || []).map(i => ({
          id: i.id,
          name: i.name,
          webhook_url: i.webhook_url,
          active: i.active,
          execution_order: i.execution_order,
        }))
      );
      setCargaFormDialog(carga);
    } else {
      setFormName("");
      setFormDescription("");
      setFormItems([]);
      setCargaFormDialog("new");
    }
  };

  const handleSaveCarga = () => {
    if (!formName.trim()) {
      toast.error("Nome do módulo é obrigatório");
      return;
    }
    if (formItems.length > 0 && formItems.some(i => !i.name.trim() || !i.webhook_url.trim())) {
      toast.error("Todos os itens devem ter nome e webhook URL");
      return;
    }
    const id = cargaFormDialog !== "new" ? (cargaFormDialog as Carga).id : undefined;
    saveCargaMutation.mutate({ id, name: formName, description: formDescription, items: formItems });
  };

  const addFormItem = () => {
    setFormItems([...formItems, { name: "", webhook_url: "", active: true, execution_order: formItems.length }]);
  };

  const updateFormItem = (index: number, field: string, value: unknown) => {
    const updated = [...formItems];
    (updated[index] as Record<string, unknown>)[field] = value;
    setFormItems(updated);
  };

  const removeFormItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index).map((item, i) => ({ ...item, execution_order: i })));
  };

  const toggleModuleExpand = (cargaId: string) => {
    setExpandedModules(prev => ({ ...prev, [cargaId]: !prev[cargaId] }));
  };

  // Get active execution id for an item (pending or running)
  const getItemActiveExecution = (itemId: string) => {
    return executions.find(e => e.carga_item_id === itemId && (e.status === "pending" || e.status === "running"));
  };

  const activeCargas = cargas.filter((c) => c.active);
  const selectedExec = executions.find((e) => e.id === detailDialog);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getDuration = (started: string | null, finished: string | null) => {
    if (!started) return "—";
    const start = new Date(started).getTime();
    const end = finished ? new Date(finished).getTime() : Date.now();
    const diff = Math.round((end - start) / 1000);
    if (diff < 60) return `${diff}s`;
    const min = Math.floor(diff / 60);
    const sec = diff % 60;
    return `${min}min ${sec}s`;
  };

  // Get latest status for each item in a module
  const getItemLatestStatus = (itemId: string) => {
    const exec = executions.find(e => e.carga_item_id === itemId);
    return exec ? exec.status : null;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cargas</h1>
            <p className="text-sm text-muted-foreground mt-1">Dispare e monitore execuções de cargas</p>
          </div>
          {isAdmin && (
            <Button className="gap-2" onClick={() => openCargaForm()}>
              <Plus className="w-4 h-4" />
              Nova Carga
            </Button>
          )}
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
            {isAdmin && (
              <TabsTrigger value="manage" className="gap-2">
                <Pencil className="w-3.5 h-3.5" />
                Gerenciar
              </TabsTrigger>
            )}
          </TabsList>

          {/* Dispatch Tab */}
          <TabsContent value="dispatch">
            {loadingCargas ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeCargas.length === 0 ? (
              <Card className="border border-border">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma carga ativa cadastrada.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {/* SPED Upload Card */}
                <Card className="border border-primary/20 bg-primary/5 hover:border-primary/40 transition-colors shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                          <FileUp className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold flex items-center gap-2">
                            Carga de Parceiros via SPED
                            <Badge variant="outline" className="text-[9px] font-normal border-primary/20 bg-primary/5 uppercase">Novo</Badge>
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Extração automática de PNs a partir de arquivos SPED Fiscal/Contribuições (Registros 0150)
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        className="gap-2 font-bold shadow-sm"
                        onClick={() => {
                          setSpedDialogOpen(true);
                          setSpedStatus(null);
                          setSpedUploadId(null);
                          setSelectedFile(null);
                        }}
                      >
                        <Upload className="w-4 h-4" />
                        Upload SPED
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {activeCargas.map((carga) => {
                  const isExpanded = expandedModules[carga.id] || false;
                  const activeItems = (carga.items || []).filter(i => i.active);
                  return (
                    <Card key={carga.id} className="border border-border hover:border-primary/30 transition-colors">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleModuleExpand(carga.id)}
                              className="mt-0.5 p-1 rounded hover:bg-muted transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                            <div>
                              <h3 className="text-sm font-semibold">{carga.name}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {carga.description || "Sem descrição"} · {activeItems.length} execuç{activeItems.length === 1 ? "ão" : "ões"}
                              </p>
                            </div>
                          </div>
                          {activeItems.length > 0 && (isAdmin || canCreate("cargas")) && (
                            <Button
                              size="sm"
                              className="gap-1.5 font-semibold"
                              onClick={() => toggleModuleExpand(carga.id)}
                            >
                              <Play className="w-3.5 h-3.5" />
                              Executar
                            </Button>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="mt-4 space-y-2 pl-8">
                            {activeItems.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">Nenhuma execução cadastrada neste módulo.</p>
                            ) : (
                              activeItems
                                .sort((a, b) => a.execution_order - b.execution_order)
                                .map((item) => {
                                  const latestStatus = getItemLatestStatus(item.id);
                                  const statusCfg = latestStatus ? statusConfig[latestStatus] : null;
                                  const activeExec = getItemActiveExecution(item.id);
                                  return (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/30"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium">{item.name}</span>
                                        {statusCfg && (
                                          <Badge variant="secondary" className={`text-[10px] gap-1 ${statusCfg.class}`}>
                                            <statusCfg.icon className={`w-3 h-3 ${latestStatus === "running" ? "animate-spin" : ""}`} />
                                            {statusCfg.label}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {activeExec && (isAdmin || canCreate("cargas")) && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                            onClick={() => cancelMutation.mutate(activeExec.id)}
                                            disabled={cancelMutation.isPending}
                                          >
                                            {cancelMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <StopCircle className="w-3 h-3" />}
                                            Parar
                                          </Button>
                                        )}
                                        {(isAdmin || canCreate("cargas")) && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5 text-xs"
                                            onClick={() => setLaunchDialog({ itemId: item.id, itemName: item.name, cargaName: carga.name })}
                                          >
                                            <Play className="w-3 h-3" />
                                            Executar
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <div className="space-y-6">
              {/* SPED History */}
              <Card className="border border-border">
                <CardHeader className="pb-3 border-b border-border mb-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                        <FileUp className="w-4 h-4 text-primary" />
                      </div>
                      <CardTitle className="text-base font-bold text-primary">Cargas SPED</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-muted/50">
                        <TableHead className="pl-6 w-[120px]">ID</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Atualizado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {spedHistory.map((sped) => {
                        const config = statusConfig[sped.status] || statusConfig.pending;
                        return (
                          <TableRow key={sped.id} className="group">
                            <TableCell className="pl-6 font-mono text-xs">{sped.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-sm font-medium">{sped.client_name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`text-[10px] font-medium gap-1 ${config.class}`}>
                                <config.icon className={`w-3 h-3 ${sped.status === "running" || sped.status === "uploading" || sped.status === "processing" ? "animate-spin" : ""}`} />
                                {sped.status === "uploading" ? "Enviando" : 
                                 sped.status === "processing" ? "Processando" : 
                                 config.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(sped.created_at)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(sped.updated_at)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {spedHistory.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                            Nenhuma carga SPED encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Legacy Executions */}
              <Card className="border border-border">
                <CardHeader className="pb-3 border-b border-border mb-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-base font-semibold text-muted-foreground">Histórico de Execuções (legado)</CardTitle>
                    </div>
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
                  {loadingExecs ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-muted/50">
                          <TableHead className="pl-6 w-[120px]">ID</TableHead>
                          <TableHead>Módulo</TableHead>
                          <TableHead>Execução</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Início</TableHead>
                          <TableHead>Duração</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {executions
                          .filter((e) =>
                            (e.carga_name || "").toLowerCase().includes(search.toLowerCase()) ||
                            (e.carga_item_name || "").toLowerCase().includes(search.toLowerCase()) ||
                            e.id.toLowerCase().includes(search.toLowerCase())
                          )
                          .map((exec) => {
                            const config = statusConfig[exec.status] || statusConfig.pending;
                            return (
                              <TableRow key={exec.id} className="cursor-pointer group">
                                <TableCell className="pl-6 font-mono text-xs">{exec.id.slice(0, 8)}</TableCell>
                                <TableCell className="text-sm font-medium">{exec.carga_name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{exec.carga_item_name || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={`text-[10px] font-medium gap-1 ${config.class}`}>
                                    <config.icon className={`w-3 h-3 ${exec.status === "running" ? "animate-spin" : ""}`} />
                                    {config.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{exec.user_name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{formatDate(exec.started_at)}</TableCell>
                                <TableCell className="text-xs font-mono">{getDuration(exec.started_at, exec.finished_at)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {(exec.status === "pending" || exec.status === "running") && (isAdmin || canCreate("cargas")) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => cancelMutation.mutate(exec.id)}
                                        disabled={cancelMutation.isPending}
                                        title="Parar execução"
                                      >
                                        <StopCircle className="w-4 h-4" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-8 w-8 group-hover:bg-muted" onClick={() => setDetailDialog(exec.id)}>
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        {executions.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground italic">
                              Nenhuma execução encontrada
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Manage Tab (admin only) */}
          {isAdmin && (
            <TabsContent value="manage">
              <Card className="border border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Gerenciar Módulos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">Módulo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Execuções</TableHead>
                        <TableHead>Ativa</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cargas.map((carga) => (
                        <TableRow key={carga.id}>
                          <TableCell className="pl-6 text-sm font-medium">{carga.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{carga.description || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {(carga.items || []).length} item(s)
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={carga.active}
                              onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: carga.id, active: checked })}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCargaForm(carga)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {cargas.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Nenhum módulo cadastrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Launch Dialog (now for a specific item) */}
        <Dialog open={!!launchDialog} onOpenChange={(open) => { if (!open) { setLaunchDialog(null); setLaunchParams(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Executar: {launchDialog?.itemName}</DialogTitle>
              <DialogDescription>
                Módulo: {launchDialog?.cargaName}. Configure os parâmetros antes de disparar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Parâmetros (JSON)</Label>
                <p className="text-xs text-muted-foreground">
                  Informe os dados que serão enviados ao workflow do n8n em formato JSON. Esses parâmetros serão recebidos como variáveis no fluxo de automação.
                </p>
                <Textarea
                  placeholder={'{\n  "data_inicio": "2026-01-01",\n  "data_fim": "2026-01-31",\n  "tipo": "completa"\n}'}
                  className="font-mono text-sm min-h-[120px]"
                  value={launchParams}
                  onChange={(e) => setLaunchParams(e.target.value)}
                />
                <p className="text-xs text-muted-foreground italic">
                  Deixe vazio para executar sem parâmetros. O campo deve conter um JSON válido (ex: chaves entre aspas duplas).
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setLaunchDialog(null); setLaunchParams(""); }}>
                Cancelar
              </Button>
              <Button className="gap-2 font-semibold" onClick={handleDispatch} disabled={dispatchMutation.isPending}>
                {dispatchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Disparar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={!!detailDialog} onOpenChange={(open) => !open && setDetailDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Execução: {selectedExec?.id.slice(0, 8)}</DialogTitle>
              <DialogDescription>
                {selectedExec?.carga_name}{selectedExec?.carga_item_name ? ` → ${selectedExec.carga_item_name}` : ""}
              </DialogDescription>
            </DialogHeader>
            {selectedExec && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Status</p>
                    <Badge variant="secondary" className={`${(statusConfig[selectedExec.status] || statusConfig.pending).class} gap-1`}>
                      {(statusConfig[selectedExec.status] || statusConfig.pending).label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Duração</p>
                    <p className="font-mono">{getDuration(selectedExec.started_at, selectedExec.finished_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Usuário</p>
                    <p>{selectedExec.user_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Início</p>
                    <p>{formatDate(selectedExec.started_at)}</p>
                  </div>
                </div>

                {selectedExec.error_message && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Erro</p>
                    <p className="text-sm text-[hsl(var(--status-error))] bg-destructive/10 rounded p-2 font-mono text-xs">{selectedExec.error_message}</p>
                  </div>
                )}

                {selectedExec.result && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Resultado</p>
                    <pre className="text-xs font-mono bg-secondary rounded p-2 overflow-auto max-h-40">
                      {JSON.stringify(selectedExec.result, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <p className="text-muted-foreground text-xs mb-2">Timeline</p>
                  <div className="space-y-2 border-l-2 border-border pl-4 ml-1">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary" />
                      <p className="text-sm font-medium">Carga criada</p>
                      <p className="text-xs text-muted-foreground">{formatDate(selectedExec.created_at)}</p>
                    </div>
                    {selectedExec.started_at && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary" />
                        <p className="text-sm font-medium">Webhook enviado ao n8n</p>
                        <p className="text-xs text-muted-foreground">{formatDate(selectedExec.started_at)}</p>
                      </div>
                    )}
                    {selectedExec.status === "success" && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[hsl(var(--status-success))]" />
                        <p className="text-sm font-medium">Execução concluída</p>
                        <p className="text-xs text-muted-foreground">{formatDate(selectedExec.finished_at)}</p>
                      </div>
                    )}
                    {selectedExec.status === "error" && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[hsl(var(--status-error))]" />
                        <p className="text-sm font-medium">Erro na execução</p>
                        <p className="text-xs text-muted-foreground">{selectedExec.error_message || formatDate(selectedExec.finished_at)}</p>
                      </div>
                    )}
                    {(selectedExec.status === "running" || selectedExec.status === "pending") && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[hsl(var(--status-running))] animate-pulse" />
                        <p className="text-sm font-medium">Aguardando resposta...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailDialog(null)}>
                Fechar
              </Button>
              {selectedExec && selectedExec.carga_item_id && (isAdmin || canCreate("cargas")) && (
                <Button variant="outline" className="gap-2" onClick={() => {
                  const item = cargas.flatMap(c => c.items || []).find(i => i.id === selectedExec.carga_item_id);
                  const carga = cargas.find(c => c.id === selectedExec.carga_id);
                  if (item && carga) {
                    setDetailDialog(null);
                    setLaunchDialog({ itemId: item.id, itemName: item.name, cargaName: carga.name });
                  }
                }}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Re-executar
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Module Form Dialog (admin) */}
        <Dialog open={!!cargaFormDialog} onOpenChange={(open) => !open && setCargaFormDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{cargaFormDialog === "new" ? "Novo Módulo" : "Editar Módulo"}</DialogTitle>
              <DialogDescription>Configure o módulo e suas execuções filhas.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Módulo</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Carga de Parceiro de Negócio" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Descrição do módulo" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Execuções (Filhos)</Label>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addFormItem}>
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar
                  </Button>
                </div>

                {formItems.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Nenhuma execução cadastrada. Clique em "Adicionar" para criar.
                  </p>
                )}

                {formItems.map((item, index) => (
                  <div key={index} className="border border-border rounded-md p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Execução #{index + 1}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground">Ativa</Label>
                          <Switch
                            checked={item.active}
                            onCheckedChange={(checked) => updateFormItem(index, "active", checked)}
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFormItem(index)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome</Label>
                        <Input
                          value={item.name}
                          onChange={(e) => updateFormItem(index, "name", e.target.value)}
                          placeholder="Ex: OCRD"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Ordem</Label>
                        <Input
                          type="number"
                          value={item.execution_order}
                          onChange={(e) => updateFormItem(index, "execution_order", parseInt(e.target.value) || 0)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Webhook URL (n8n)</Label>
                      <Input
                        value={item.webhook_url}
                        onChange={(e) => updateFormItem(index, "webhook_url", e.target.value)}
                        placeholder="https://n8n.example.com/webhook/..."
                        className="h-9 text-sm font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCargaFormDialog(null)}>Cancelar</Button>
              <Button onClick={handleSaveCarga} disabled={saveCargaMutation.isPending}>
                {saveCargaMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SPED Upload Dialog */}
        <Dialog open={spedDialogOpen} onOpenChange={(open) => { if (!open) setSpedDialogOpen(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-primary" />
                Carga PN via SPED
              </DialogTitle>
              <DialogDescription>
                Selecione o cliente destino e o arquivo SPED (.txt). Iremos extrair os registros 0150 e processar via IA.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Cliente Destino</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                    {clients.length === 0 && (
                      <div className="p-2 text-center text-xs text-muted-foreground whitespace-pre-wrap">Nenhum cliente ativo encontrado. Cadastre em "Clientes".</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Arquivo SPED (.txt)</Label>
                {!selectedFile ? (
                  <div 
                    className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => document.getElementById("sped-file-input")?.click()}
                  >
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Clique para selecionar</p>
                      <p className="text-xs text-muted-foreground mt-1">Apenas arquivos .txt são aceitos</p>
                    </div>
                    <input 
                      id="sped-file-input" 
                      type="file" 
                      accept=".txt" 
                      className="hidden" 
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50 border border-border">
                    <div className="flex items-center gap-3">
                      <FileUp className="w-5 h-5 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setSelectedFile(null)}>
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {spedStatus && (
                <div className={`p-4 rounded-lg flex items-start gap-3 ${
                  spedStatus === "success" ? "bg-status-success/10 border border-status-success/20" :
                  spedStatus === "error" ? "bg-status-error/10 border border-status-error/20" :
                  "bg-status-running/10 border border-status-running/20"
                }`}>
                  {spedStatus === "success" ? <CheckCircle className="w-5 h-5 text-status-success shrink-0" /> :
                   spedStatus === "error" ? <AlertCircle className="w-5 h-5 text-status-error shrink-0" /> :
                   <Loader2 className="w-5 h-5 text-status-running animate-spin shrink-0" />
                  }
                  <div className="space-y-1">
                    <p className="text-sm font-semibold capitalize">
                      {spedStatus === "uploading" ? "Enviando arquivo..." :
                       spedStatus === "processing" ? "Extraindo dados com IA..." :
                       spedStatus === "success" ? "Carga concluída com sucesso!" :
                       spedStatus === "error" ? "Falha no processamento" :
                       spedStatus}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {spedStatus === "processing" ? "Isso pode levar alguns minutos dependendo do tamanho do arquivo." :
                       spedStatus === "success" ? "Os parceiros foram criados/atualizados no SAP." :
                       spedStatus === "error" ? "Verifique os logs ou tente novamente." :
                       "Aguarde a conclusão do processo."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSpedDialogOpen(false)}>
                Fechar
              </Button>
              <Button 
                onClick={handleSpedUpload} 
                disabled={isUploading || !selectedFile || !selectedClientId || (spedStatus !== null && spedStatus !== "error" && spedStatus !== "success")}
                className="gap-2 font-bold"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Iniciar Processamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default CargasPage;
