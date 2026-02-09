import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface MyAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MyAccountDialog = ({ open, onOpenChange }: MyAccountDialogProps) => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({ title: "A senha deve ter no mínimo 8 caracteres", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("change-password", {
        body: { new_password: newPassword },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: "Senha alterada com sucesso" });
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Erro ao alterar senha",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Minha Conta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={profile?.full_name ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Nova Senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Confirmar Nova Senha</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MyAccountDialog;
