import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const asaasToken = process.env['ASAAS_WEBHOOK_TOKEN'];
          if (!asaasToken) {
            console.error("ASAAS_WEBHOOK_TOKEN não configurada no servidor");
            return new Response("Unauthorized", { status: 401 });
          }

          if (request.headers.get("asaas-access-token") !== asaasToken) {
            return new Response("Unauthorized", { status: 401 });
          }

          const body = await request.json();
          console.log("Asaas Webhook received:", body.event, body.payment?.id);

          // Eventos de interesse: PAYMENT_RECEIVED, PAYMENT_CONFIRMED
          if (body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED") {
            const paymentId = body.payment.id;
            
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAdmin = createClient(
              process.env['SUPABASE_URL']!,
              process.env['SUPABASE_SERVICE_ROLE_KEY']!
            );

            // 1. Verificar se o ticket já está PAID de forma atômica ou robusta
            const { data: ticket, error: fetchError } = await supabaseAdmin
              .from("tickets")
              .select("id, status, payment_id")
              .eq("payment_id", paymentId)
              .single();

            if (fetchError || !ticket) {
              console.warn("Webhook: Ticket não encontrado para payment_id:", paymentId);
              return new Response("Not Found", { status: 404 });
            }

            if (ticket.status === "PAID") {
              console.log("Webhook: Ticket já estava pago (idempotência):", ticket.id);
              return new Response("OK", { status: 200 });
            }

            // 2. Atualizar para PAID apenas se o payment_id corresponder (segurança adicional)
            const { error: updateError } = await supabaseAdmin
              .from("tickets")
              .update({ 
                status: "PAID",
                payment_status: body.event 
              })
              .eq("id", ticket.id)
              .eq("payment_id", paymentId);

            if (updateError) {
              console.error("Webhook update error:", updateError);
              return new Response("Internal Error", { status: 500 });
            }
            
            console.log("Webhook: Ticket atualizado para PAID:", ticket.id);
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
