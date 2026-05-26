import { inngest } from "../inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import * as Sentry from "@sentry/nextjs";

export const cleanupZombieUsersJob = inngest.createFunction(
  { id: "cleanup-zombie-users", name: "Cleanup Zombie Users" },
  { cron: "0 * * * *" }, // Run every hour
  async ({ step }) => {
    await step.run("delete-zombie-users", async () => {
      try {
        const supabaseAdmin = createAdminClient();
        
        // Obtenemos todos los usuarios (en produccion con muchos usuarios esto podria requerir paginacion)
        // La API admin listUsers no permite filtrar por jsonb o created_at facilmente desde la llamada,
        // asi que obtenemos la lista y filtramos en memoria.
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        
        if (error) throw error;

        let deletedCount = 0;
        const now = new Date();

        for (const user of users) {
          // Si el estado de pago es pendiente o esta intentando comprar pro/ultra
          const paymentStatus = user.user_metadata?.payment_status;
          const plan = user.user_metadata?.plan;

          // Verificamos si paso mas de 2 horas desde su creacion
          const createdAt = new Date(user.created_at);
          const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

          if (diffHours > 2) {
            // Verificamos si no tienen un tenant asociado revisando su perfil
            const { data: profile } = await supabaseAdmin.from("profiles").select("tenant_id").eq("id", user.id).single();
            
            if (!profile || !profile.tenant_id) {
              // Si su pago esta pendiente o nunca se creo su tenant
              if (paymentStatus === 'pending' || (plan && plan !== 'starter')) {
                // Procedemos a eliminar al usuario permanentemente
                await supabaseAdmin.auth.admin.deleteUser(user.id);
                deletedCount++;
                logger.info(`Deleted zombie user: ${user.email} (${user.id})`, "CLEANUP_JOB");
              }
            }
          }
        }

        logger.info(`Finished cleanup job. Deleted ${deletedCount} zombie users.`, "CLEANUP_JOB");
        return { deleted: deletedCount };
      } catch (error: any) {
        Sentry.captureException(error);
        logger.error(`Error in cleanup job: ${error.message}`, "CLEANUP_JOB");
        throw error;
      }
    });
  }
);
