import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Selection {
  fixture_market_option_id: string;
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

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("gf_bet_slip");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // We should actually re-validate these against the DB, 
        // but for now we'll just load them.
        setSelections(parsed);
      } catch (e) {
        console.error("Error loading bet slip from localStorage", e);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem("gf_bet_slip", JSON.stringify(selections));
  }, [selections]);

  const addSelection = useCallback((newSelection: Selection) => {
    setSelections(prev => {
      // Rule: Impedir que o usuário selecione mais de uma opção do mesmo mercado na mesma partida.
      // We don't have market_type_id here yet, but we have market_name and fixture_id.
      // Ideally we should use market_type_id or code.
      
      const filtered = prev.filter(s => !(s.fixture_id === newSelection.fixture_id && s.market_name === newSelection.market_name));
      
      // Check if already selected exactly this option (to toggle off)
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
    potentialReturn
  };
}
