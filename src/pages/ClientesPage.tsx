import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  MoreHorizontal,
  Building2,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import AppLayout from "@/components/layout/AppLayout";

interface Client {
  id: string;
  name: string;
  cnpj: string;
  active: boolean;
  tenant_id: string;
  created_at: string;
  client_sap_configs?: ClientSAPConfig[];
}

interface ClientSAPConfig {
  id: string;
  client_id: string;
  sap_url: string;
  sap_company_db: string;
  sap_user: string;
  active: boolean;
}

const ClientesPage = () => {
  const [search, setSearch] = useState("");
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [sapDialogOpen, setSapDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [configuringSap, setConfiguringSap] = useState<Client | null>(null);

  const [clientForm, setClientForm] = useState({
    name: "",
    cnpj: "",
    active: true,
  });

  const [sapForm, setSapForm] = useState({
    sap_url: "",
    sap_company_db: "",
    sap_user: "",
    sap_password: "",
    active: true,
  });

  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch Clients with their SAP config
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, client_sap_configs(*)")
        .order("name");

      if (error) throw error;
      return data as Client[];
    },
  });

  // Client Mutations
  const createClientMutation = useMutation({
    mutationFn: async (newClient: typeof clientForm) => {
      const { data, error } = await supabase
        .from("clients")
        .insert([{ ...newClient, tenant_id: profile?.tenant_id }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Cliente criado com sucesso" });
      setClientDialogOpen(false);
      resetClientForm();
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar cliente", description: err.message, variant: "destructive" });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; cnpj: string; active: boolean }) => {
      const { error } = await supabase
        .from("clients")
        .update({ name: payload.name, cnpj: payload.cnpj, active: payload.active })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Cliente atualizado com sucesso" });
      setClientDialogOpen(false);
      setEditingClient(null);
      resetClientForm();
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar cliente", description: err.message, variant: "destructive" });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Cliente excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao excluir cliente", description: err.message, variant: "destructive" });
    },
  });

  // SAP Config Mutation
  const saveSapMutation = useMutation({
    mutationFn: async (payload: typeof sapForm & { client_id: string; id?: string }) => {
      const dataToSave: any = {
        client_id: payload.client_id,
        tenant_id: profile?.tenant_id,
        sap_url: payload.sap_url,
        sap_company_db: payload.sap_company_db,
        sap_user: payload.sap_user,
        active: payload.active,
      };

      if (payload.sap_password) {
        dataToSave.sap_password = payload.sap_password;
      }

      if (payload.id) {
        const { error } = await supabase
          .from("client_sap_configs")
          .update(dataToSave)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_sap_configs")
          .insert([dataToSave]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Configuração SAP salva" });
      setSapDialogOpen(false);
      setConfiguringSap(null);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar configuração SAP", description: err.message, variant: "destructive" });
    },
  });

  const resetClientForm = () => {
    setClientForm({ name: "", cnpj: "", active: true });
  };

  const handleCreateOrUpdateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      updateClientMutation.mutate({ id: editingClient.id, ...clientForm });
    } else {
      createClientMutation.mutate(clientForm);
    }
  };

  const handleSaveSap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringSap) return;
    const existingConfig = configuringSap.client_sap_configs?.[0];
    saveSapMutation.mutate({
      ...sapForm,
      client_id: configuringSap.id,
      id: existingConfig?.id,
    });
  };

  const openEditClient = (client: Client) => {
    setEditingClient(client);
    setClientForm({ name: client.name, cnpj: client.cnpj, active: client.active });
    setClientDialogOpen(true);
  };

  const openSapConfig = (client: Client) => {
    setConfiguringSap(client);
    const config = client.client_sap_configs?.[0];
    if (config) {
      setSapForm({
        sap_url: config.sap_url,
        sap_company_db: config.sap_company_db,
        sap_user: config.sap_user,
        sap_password: "",
        active: config.active,
      });
    } else {
      setSapForm({
        sap_url: "",
        sap_company_db: "",
        sap_user: "",
        sap_password: "",
        active: true,
      });
    }
    setSapDialogOpen(true);
  };

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search)
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastro de clientes e configurações SAP exclusivas
            </p>
          </div>
          <Button className="gap-2 font-semibold" onClick={() => { setEditingClient(null); resetClientForm(); setClientDialogOpen(true); }}>
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>

        <Card className="border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {filtered.length} clientes
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar clientes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm bg-secondary border-0"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Cliente</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>SAP Config</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((client) => {
                      const hasSap = (client.client_sap_configs?.length ?? 0) > 0;
                      return (
                        <TableRow key={client.id}>
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              <p className="text-sm font-medium">{client.name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono">{client.cnpj}</TableCell>
                          <TableCell>
                            {hasSap ? (
                              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1">
                                <Server className="w-3 h-3" />
                                Configurado
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground border-transparent text-[10px] gap-1">
                                <XCircle className="w-3 h-3" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {client.active ? (
                              <Badge variant="secondary" className="status-badge-success text-[11px] gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="status-badge-error text-[11px] gap-1">
                                <XCircle className="w-3 h-3" />
                                Inativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditClient(client)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Editar Cliente
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openSapConfig(client)}>
                                  <Server className="w-4 h-4 mr-2" />
                                  Configurar SAP
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    if (confirm("Tem certeza que deseja excluir este cliente?")) {
                                      deleteClientMutation.mutate(client.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client Dialog */}
      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrUpdateClient} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Empresa / Cliente</Label>
              <Input
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                required
                placeholder="Ex: Cliente Alpha Ltda"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={clientForm.cnpj}
                onChange={(e) => setClientForm({ ...clientForm, cnpj: e.target.value })}
                required
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={clientForm.active}
                onCheckedChange={(checked) => setClientForm({ ...clientForm, active: checked })}
              />
              <Label>Cliente Ativo</Label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createClientMutation.isPending || updateClientMutation.isPending}>
                {createClientMutation.isPending || updateClientMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingClient ? "Salvar Alterações" : "Criar Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SAP Config Dialog */}
      <Dialog open={sapDialogOpen} onOpenChange={setSapDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configuração SAP: {configuringSap?.name}</DialogTitle>
            <DialogDescription>
              Atenção: Estas credenciais são restritas a este cliente específico.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSap} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">URL do Service Layer</Label>
              <Input
                placeholder="https://servidor:50000"
                value={sapForm.sap_url}
                onChange={(e) => setSapForm({ ...sapForm, sap_url: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Company DB</Label>
              <Input
                placeholder="SBO_COMPANY"
                value={sapForm.sap_company_db}
                onChange={(e) => setSapForm({ ...sapForm, sap_company_db: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Usuário</Label>
              <Input
                placeholder="manager"
                value={sapForm.sap_user}
                onChange={(e) => setSapForm({ ...sapForm, sap_user: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Senha</Label>
              <Input
                type="password"
                placeholder={configuringSap?.client_sap_configs?.[0] ? "Digite para alterar" : "Senha do SAP"}
                value={sapForm.sap_password}
                onChange={(e) => setSapForm({ ...sapForm, sap_password: e.target.value })}
                required={!configuringSap?.client_sap_configs?.[0]}
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={sapForm.active}
                onCheckedChange={(checked) => setSapForm({ ...sapForm, active: checked })}
              />
              <Label>Integração Ativa</Label>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSapDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveSapMutation.isPending}>
                {saveSapMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Server className="w-4 h-4 mr-2" />}
                Salvar Configuração
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ClientesPage;
