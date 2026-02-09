import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Truck,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/home" },
  { label: "Cargas", icon: Truck, path: "/cargas" },
  { label: "Usuários", icon: Users, path: "/usuarios", adminOnly: true },
  { label: "Configurações", icon: Settings, path: "/configuracoes", adminOnly: true },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <aside
      className={cn(
        "sidebar-gradient flex flex-col border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-sidebar-accent-foreground truncate">
                Cargas Flow
              </span>
              <span className="text-[10px] text-sidebar-foreground truncate">
                Gestão de Cargas
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={async () => { await signOut(); navigate("/"); }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>

        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
