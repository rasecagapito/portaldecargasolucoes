import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Settings } from "lucide-react";

const ConfiguracoesPage = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie as configurações do sistema
          </p>
        </div>

        <Card className="p-8 flex flex-col items-center justify-center text-center min-h-[300px] border-dashed">
          <Settings className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Em breve</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            O módulo de configurações está em desenvolvimento. Aqui você poderá gerenciar tenants, módulos habilitados e segredos de webhooks n8n.
          </p>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ConfiguracoesPage;
