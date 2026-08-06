import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Selection {
  fixture_market_option_id: string;
  fixture_market_id: string; // New structural key
  odd: number;
  label: string;
  market_name: string;
  home_team: string;
  away_team: string;
  fixture_id: number;
}

export function useBetSlip() {
  const [selections, setSelections] = useState<Selection[]>([]);
  const [stake, setStake] = useState<number>(10);
  const [isValidating, setIsValidating] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(crypto.randomUUID());
  const [returnToConfirm, setReturnToConfirm] = useState(false);
  
  const isFirstMount = useRef(true);

  const revalidateSelections = useCallback(async (currentSelections: Selection[]) => {
    // Phase 3 requirement: "Não realizar nenhuma chamada para API. Tudo em memória."
    // We disable revalidation during this phase to maintain isolation.
    return;
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    if (!isFirstMount.current) return;
    isFirstMount.current = false;

    const saved = localStorage.getItem("gf_bet_slip");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSelections(parsed.selections || []);
        setStake(parsed.stake || 10);
        setReturnToConfirm(parsed.returnToConfirm || false);
        if (parsed.selections?.length > 0) {
          revalidateSelections(parsed.selections);
        }
      } catch (e) {
        console.error("Error loading bet slip from localStorage", e);
      }
    }
  }, [revalidateSelections]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem("gf_bet_slip", JSON.stringify({
      selections,
      stake,
      returnToConfirm
    }));
  }, [selections, stake, returnToConfirm]);

  const addSelection = useCallback((newSelection: Selection) => {
    setSelections(prev => {
      // Incompatibility Rule: Only one selection per fixture_id + fixture_market_id
      const filtered = prev.filter(s => !(s.fixture_id === newSelection.fixture_id && s.fixture_market_id === newSelection.fixture_market_id));
      const isAlreadySelected = prev.find(s => s.fixture_market_option_id === newSelection.fixture_market_option_id);
      
      if (isAlreadySelected) {
        return prev.filter(s => s.fixture_market_option_id !== newSelection.fixture_market_option_id);
      }

      return [...filtered, newSelection];
    });
  }, []);

  const removeSelection = useCallback((id: string) => {
    setSelections(prev => prev.filter(s => s.fixture_market_option_id !== id));
  }, []);

  const clearSlip = useCallback(() => {
    setSelections([]);
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  const refreshIdempotency = useCallback(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  const totalOdd = selections.reduce((acc, s) => acc * s.odd, 1);
  const potentialReturn = stake * totalOdd;

  return {
    selections,
    stake,
    setStake,
    addSelection,
    removeSelection,
    clearSlip,
    totalOdd,
    potentialReturn,
    isValidating,
    idempotencyKey,
    refreshIdempotency,
    returnToConfirm,
    setReturnToConfirm
  };
}