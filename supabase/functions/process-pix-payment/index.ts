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

    // Se já tiver pago, não faz nada
    if (ticket.status === "PAID") {
      return new Response(JSON.stringify({ error: "Bilhete já está pago" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Se já existir cobrança ativa no ASAAS, retornar os dados
    if (ticket.payment_id && ticket.status === "WAITING_PAYMENT") {
      // Opcional: Validar no ASAAS se ainda é válida. Aqui vamos retornar o que temos no banco primeiro.
      return new Response(
        JSON.stringify({
          payment_id: ticket.payment_id,
          pix_qr_code: ticket.pix_qr_code,
          pix_copy_paste: ticket.pix_copy_paste,
          expires_at: ticket.expires_at,
          invoice_url: ticket.invoice_url,
          status: ticket.payment_status,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Criar cobrança no ASAAS
    // Primeiro, precisamos garantir que o cliente existe no ASAAS ou criar um "placeholder" 
    // Para simplificar esta fase, vamos usar um cliente genérico ou criar um baseado no e-mail do user
    
    // Buscar se usuário já tem external_id do Asaas no profile (Fase 6+ futuro)
    // Por enquanto, vamos criar a cobrança diretamente
    
    const customerResponse = await fetch(`${asaasUrl}/customers?email=${user.email}`, {
      headers: { access_token: asaasApiKey },
    });
    const customers = await customerResponse.json();
    let customerId = customers.data?.[0]?.id;

    if (!customerId) {
      const newCustomer = await fetch(`${asaasUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
        },
        body: JSON.stringify({
          name: user.user_metadata?.full_name || user.email,
          email: user.email,
          externalReference: user.id,
        }),
      });
      const customerData = await newCustomer.json();
      customerId = customerData.id;
    }

    if (!customerId) throw new Error("Não foi possível criar/localizar cliente no Asaas");

    // Criar Cobrança PIX
    const paymentResponse = await fetch(`${asaasUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: ticket.stake,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 24h
        description: `Bilhete GreenFutebol ${ticket.code}`,
        externalReference: ticket.id,
      }),
    });

    const paymentData = await paymentResponse.json();
    if (!paymentData.id) {
      console.error("Erro Asaas:", paymentData);
      throw new Error("Erro ao criar cobrança no Asaas");
    }

    // Obter QR Code PIX
    const qrCodeResponse = await fetch(`${asaasUrl}/payments/${paymentData.id}/pixQrCode`, {
      headers: { access_token: asaasApiKey },
    });
    const qrCodeData = await qrCodeResponse.json();

    // 4. Atualizar Ticket no Banco
    const { error: updateError } = await supabaseClient
      .from("tickets")
      .update({
        payment_id: paymentData.id,
        payment_status: paymentData.status,
        invoice_url: paymentData.invoiceUrl,
        pix_qr_code: qrCodeData.encodedImage,
        pix_copy_paste: qrCodeData.payload,
        expires_at: paymentData.dueDate + "T23:59:59Z",
        status: "WAITING_PAYMENT",
      })
      .eq("id", ticket.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        payment_id: paymentData.id,
        pix_qr_code: qrCodeData.encodedImage,
        pix_copy_paste: qrCodeData.payload,
        expires_at: paymentData.dueDate + "T23:59:59Z",
        invoice_url: paymentData.invoiceUrl,
        status: paymentData.status,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Erro na Edge Function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
