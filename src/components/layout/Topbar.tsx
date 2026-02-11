import { useState } from "react";
import { Bell, Search, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MyAccountDialog from "@/components/MyAccountDialog";

const Topbar = () => {
  const { profile, tenant, signOut } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "??";

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-card border-b border-border">
        {/* Search */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cargas, usuários..."
            className="pl-9 bg-secondary border-0 h-9 text-sm"
          />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 ml-4">
          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
            <Bell className="w-[18px] h-[18px] text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-status-error" />
          </button>

          {/* Tenant + User */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 pl-4 border-l border-border cursor-pointer hover:opacity-80 transition-opacity">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium leading-none">
                    {profile?.full_name ?? "Carregando..."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tenant?.name ?? "—"}
                  </p>
                </div>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-status-warning text-primary-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setAccountOpen(true)}>
                Minha Conta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <MyAccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </>
  );
};

export default Topbar;
