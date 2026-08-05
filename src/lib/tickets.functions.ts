import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const selectionSchema = z.object({
  fixture_market_option_id: z.string().uuid(),
  expected_odd: z.number(),
});

const createTicketInput = z.object({
  stake: z.number().min(5).max(5000),
  idempotency_key: z.string().uuid(),
  selections: z.array(selectionSchema).min(1).max(20),
});

interface RPCResult {
  success: boolean;
  ticket_id?: string;
  ticket_code?: string;
  error_code?: string;
  is_duplicate?: boolean;
  changed_selections?: Array<{
    option_id: string;
    old_odd: number;
    current_odd: number;
    label: string;
  }>;
}

export const createTicket = createServerFn({ method: "POST" })
  .inputValidator((data) => createTicketInput.parse(data))
  .handler(async ({ data }) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Usuário não autenticado");
    }

    const { stake, idempotency_key, selections } = inputData;

    // Call the atomic RPC
    const { data: rpcResponse, error: rpcError } = await supabase.rpc('create_ticket_atomic', {
      p_stake: stake,
      p_idempotency_key: idempotency_key,

      p_selections: selections.map(s => ({
        option_id: s.fixture_market_option_id,
        expected_odd: s.expected_odd
      }))
    });

    if (rpcError) {
      console.error("RPC Error:", rpcError);
      
      if (rpcError.code === 'P0001') {
        throw new Error(rpcError.message.replace('Market or option is suspended: ', 'O mercado ou opção não está mais disponível: '));
      }
      if (rpcError.code === 'P0002') {
        throw new Error(rpcError.message.replace('Match already started: ', 'A partida já começou: '));
      }
      if (rpcError.code === '23505') {
        return { success: true, is_duplicate: true };
      }

      throw new Error("Erro ao processar bilhete. Tente novamente.");
    }

    const result = data as unknown as RPCResult;

    if (!result || !result.success) {
      if (result?.error_code === 'ODDS_CHANGED') {
        return {
          success: false,
          error_code: 'ODDS_CHANGED',
          changed_selections: result.changed_selections
        };
      }
      throw new Error("Erro ao validar bilhete.");
    }

    return {
      success: true,
      ticketCode: result.ticket_code,
      ticketId: result.ticket_id,
      is_duplicate: result.is_duplicate || false
    };
  });

