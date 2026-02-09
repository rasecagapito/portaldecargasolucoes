import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  full_name: string;
  avatar_url: string | null;
  tenant_id: string;
}

interface Tenant {
  name: string;
  slug: string;
}

type AppRole = "admin" | "operator" | "viewer";

interface ModulePermission {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  tenant: Tenant | null;
  role: AppRole | null;
  permissions: ModulePermission[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasModuleAccess: (module: string) => boolean;
  canCreate: (module: string) => boolean;
  canEdit: (module: string) => boolean;
  canDelete: (module: string) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    // Fetch profile, role, and tenant in parallel
    const [profileRes, roleRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, avatar_url, tenant_id")
        .eq("user_id", userId)
        .single(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single(),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data);

      const [tenantRes, permRes] = await Promise.all([
        supabase
          .from("tenants")
          .select("name, slug")
          .eq("id", profileRes.data.tenant_id)
          .single(),
        supabase
          .from("role_modules")
          .select("module, can_view, can_create, can_edit, can_delete")
          .eq("tenant_id", profileRes.data.tenant_id)
          .eq("role", roleRes.data?.role ?? "viewer"),
      ]);

      setTenant(tenantRes.data);
      setPermissions(permRes.data ?? []);
    }

    if (roleRes.data) {
      setRole(roleRes.data.role as AppRole);
    }
  };

  const fetchUserDataRef = React.useRef(fetchUserData);
  fetchUserDataRef.current = fetchUserData;

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchUserData(session.user.id);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (!newSession?.user) {
          setProfile(null);
          setTenant(null);
          setRole(null);
          setPermissions([]);
        }
        // fetchUserData is called explicitly in signIn, not here
        // to avoid race conditions
      }
    );

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.session?.user) {
      await fetchUserDataRef.current(data.session.user.id);
    }
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasModuleAccess = (module: string) => {
    if (role === "admin") return true;
    return permissions.some((p) => p.module === module && p.can_view);
  };

  const canCreate = (module: string) => {
    if (role === "admin") return true;
    return permissions.some((p) => p.module === module && p.can_create);
  };

  const canEdit = (module: string) => {
    if (role === "admin") return true;
    return permissions.some((p) => p.module === module && p.can_edit);
  };

  const canDelete = (module: string) => {
    if (role === "admin") return true;
    return permissions.some((p) => p.module === module && p.can_delete);
  };

  const isAdmin = role === "admin";

  return (
    <AuthContext.Provider
      value={{
        session, user, profile, tenant, role, permissions, loading,
        signIn, signOut, hasModuleAccess, canCreate, canEdit, canDelete, isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
