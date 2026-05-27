import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function WorkflowsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  const { data: workflows } = await supabase
    .from("action_workflows")
    .select("*, workflow_steps(*, ai_actions(action_type, title, status))")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      case 'executing': return 'bg-blue-500/10 text-blue-500';
      case 'completed': return 'bg-green-500/10 text-green-500';
      case 'failed': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'LOW': return 'bg-green-500/10 text-green-500';
      case 'MEDIUM': return 'bg-orange-500/10 text-orange-500';
      case 'HIGH': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Workflows Autónomos</h2>
      </div>
      <p className="text-muted-foreground">
        Planes de acción generados por el motor autónomo de Klyvo.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Workflows</CardTitle>
        </CardHeader>
        <CardContent>
          {workflows?.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No hay workflows generados aún.
            </div>
          ) : (
            <div className="space-y-6">
              {workflows?.map((wf) => (
                <div key={wf.id} className="border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{wf.title}</h3>
                      <p className="text-sm text-muted-foreground">{wf.summary}</p>
                    </div>
                    <div className="flex space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRiskColor(wf.risk_score)}`}>
                        {wf.risk_score}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(wf.status)}`}>
                        {wf.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Acciones ({wf.workflow_steps?.length}):</p>
                    <ul className="space-y-1 text-sm">
                      {wf.workflow_steps?.map((step: any) => (
                        <li key={step.id} className="flex justify-between items-center bg-background p-2 rounded border">
                          <span>{step.ai_actions?.title}</span>
                          <span className={`text-xs ${step.status === 'completed' ? 'text-green-500' : step.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}`}>
                            {step.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
