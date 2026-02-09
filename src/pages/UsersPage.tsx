import { useState } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Shield,
  User as UserIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import AppLayout from "@/components/layout/AppLayout";

const mockUsers = [
  {
    id: "1",
    name: "João Silva",
    email: "joao@empresa.com",
    role: "admin",
    status: "active",
    lastLogin: "Hoje, 14:30",
  },
  {
    id: "2",
    name: "Maria Lopes",
    email: "maria@empresa.com",
    role: "operator",
    status: "active",
    lastLogin: "Hoje, 10:15",
  },
  {
    id: "3",
    name: "Carlos Ribeiro",
    email: "carlos@empresa.com",
    role: "viewer",
    status: "active",
    lastLogin: "Ontem, 18:00",
  },
  {
    id: "4",
    name: "Ana Costa",
    email: "ana@empresa.com",
    role: "operator",
    status: "inactive",
    lastLogin: "3 dias atrás",
  },
  {
    id: "5",
    name: "Pedro Santos",
    email: "pedro@empresa.com",
    role: "admin",
    status: "active",
    lastLogin: "Hoje, 09:00",
  },
];

const roleConfig: Record<string, { label: string; icon: React.ElementType }> = {
  admin: { label: "Admin", icon: Shield },
  operator: { label: "Operador", icon: UserIcon },
  viewer: { label: "Visualizador", icon: UserIcon },
};

const UsersPage = () => {
  const [search, setSearch] = useState("");

  const filtered = mockUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Usuários</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie usuários, roles e permissões
            </p>
          </div>
          <Button className="gap-2 font-semibold">
            <Plus className="w-4 h-4" />
            Novo Usuário
          </Button>
        </div>

        <Card className="border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {filtered.length} usuários
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuários..."
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
                  <TableHead className="pl-6">Usuário</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Login</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => {
                  const role = roleConfig[user.role];
                  return (
                    <TableRow key={user.id} className="cursor-pointer">
                      <TableCell className="pl-6">
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <role.icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm">{role.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.status === "active" ? (
                          <Badge
                            variant="secondary"
                            className="status-badge-success text-[11px] gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="status-badge-error text-[11px] gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.lastLogin}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem>Permissões</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Desativar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default UsersPage;
