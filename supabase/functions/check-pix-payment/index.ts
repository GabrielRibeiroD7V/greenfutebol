import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const asaasUrl = Deno.env.get("ASAAS_URL") || "https://sandbox.asaas.com/api/v3";

    if (!asaasApiKey) {
      throw new Error("ASAAS_API_KEY não configurada");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Buscar ticket e validar
    const { data: ticket, error: ticketError } = await supabaseClient
      .from("tickets")
      .select("*")
      .eq("id", ticket_id)
      .eq("user_id", user.id)
      .single();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket não encontrado ou acesso negado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ticket.payment_id) {
      return new Response(JSON.stringify({ error: "Nenhum pagamento gerado para este ticket" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Consultar status no Asaas
    const response = await fetch(`${asaasUrl}/payments/${ticket.payment_id}`, {
      headers: { access_token: asaasApiKey },
    });
    const payment = await response.json();

    if (!payment.id) {
      throw new Error("Erro ao consultar pagamento no Asaas");
    }

    // 3. Atualizar status no banco se mudou
    // Status Asaas: RECEIVED, CONFIRMED, OVERDUE, etc.
    if (payment.status !== ticket.payment_status) {
      let ticketStatus = ticket.status;
      if (payment.status === "RECEIVED" || payment.status === "CONFIRMED") {
        ticketStatus = "PAID";
      }

      await supabaseClient
        .from("tickets")
        .update({
          payment_status: payment.status,
          status: ticketStatus,
        })
        .eq("id", ticket.id);
      
      return new Response(JSON.stringify({ 
        status: payment.status, 
        ticket_status: ticketStatus 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      status: payment.status, 
      ticket_status: ticket.status 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro na Edge Function check-pix-payment:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
