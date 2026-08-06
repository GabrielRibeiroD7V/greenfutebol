import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

async function requireUser() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Não autenticado");
  return user;
}

export const generatePix = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({ ticketId: z.string().uuid() }).parse(data))
  .handler(async ({ data: { ticketId } }) => {
    const { data, error } = await supabase.functions.invoke("process-pix-payment", {
      body: { ticket_id: ticketId },
    });

    if (error) throw new Error(error.message || "Erro ao gerar PIX");
    return data;
  });

export const checkPixStatus = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({ ticketId: z.string().uuid() }).parse(data))
  .handler(async ({ data: { ticketId } }) => {
    const { data, error } = await supabase.functions.invoke("check-pix-payment", {
      body: { ticket_id: ticketId },
    });

    if (error) throw new Error(error.message || "Erro ao consultar status");
    return data;
  });
