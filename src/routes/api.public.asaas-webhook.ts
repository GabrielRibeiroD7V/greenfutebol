import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Asaas envia um token de segurança no header se configurado
          // const asaasToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
          // if (request.headers.get("asaas-access-token") !== asaasToken) {
          //   return new Response("Unauthorized", { status: 401 });
          // }

          const body = await request.json();
          console.log("Asaas Webhook received:", body.event, body.payment?.id);

          // Eventos de interesse: PAYMENT_RECEIVED, PAYMENT_CONFIRMED
          if (body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED") {
            const paymentId = body.payment.id;
            const externalReference = body.payment.externalReference;

            // Usar o service_role para atualizar o banco (bypassing RLS)
            // Importante: No TanStack Start, podemos usar o supabaseAdmin do servidor
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAdmin = createClient(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            const { error } = await supabaseAdmin
              .from("tickets")
              .update({ 
                status: "PAID",
                payment_status: body.event 
              })
              .eq("payment_id", paymentId);

            if (error) {
              console.error("Webhook update error:", error);
              return new Response("Internal Error", { status: 500 });
            }
          }

          return new Response("OK", { status: 200 });
        } catch (err) {
          console.error("Webhook error:", err);
          return new Response("Bad Request", { status: 400 });
        }
      },
    },
  },
});
