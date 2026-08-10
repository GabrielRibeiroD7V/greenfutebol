import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toggleSelection } from "@/lib/bet-slip-policy";

export interface Selection {
  selection_id: string;
  market_id: string;
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
    if (currentSelections.length === 0) return;
    
    setIsValidating(true);
    try {
      const selectionIds = currentSelections.map(s => s.selection_id);
      
      const { data, error } = await (supabase as any)
        .from('fixture_market_selections')
        .select('id, market_id, odd, status')
        .in('id', selectionIds);

      if (error || !data) throw error;

      const marketIds = [...new Set(data.map((selection: any) => selection.market_id))];
      const { data: markets, error: marketsError } = await (supabase as any)
        .from('fixture_markets')
        .select('id, status, fixture_id, kickoff_at')
        .in('id', marketIds);

      if (marketsError || !markets) throw marketsError;

      // 4. Revalidate cache for kickoff
      const { data: fixturesCache } = await supabase
        .from('football_fixtures_cache')
        .select('payload');

      const allFixtures: any[] = fixturesCache?.flatMap(f => (f.payload as any).fixtures || []) || [];
      const now = new Date();

      const validSelections: Selection[] = [];
      const removedLabels: string[] = [];
      const updatedLabels: string[] = [];

      for (const s of currentSelections) {
        const dbOpt = data.find((d: any) => d.id === s.selection_id);
        const market = markets.find((m: any) => m.id === dbOpt?.market_id);
        const fixture = allFixtures.find(f => f.fixture_id === s.fixture_id);
        
        const kickoffAt = market?.kickoff_at || fixture?.kickoff_at;
        const isStarted = !kickoffAt || new Date(kickoffAt) <= now;
        const isSuspended = !dbOpt || dbOpt.status !== 'OPEN' || market?.status !== 'OPEN' || Number(dbOpt.odd) <= 1;

        if (!dbOpt || isSuspended || isStarted) {
          removedLabels.push(`${s.home_team} x ${s.away_team} (${s.label})`);
          continue;
        }

        if (Math.abs(Number(dbOpt.odd) - s.odd) > 0.0001) {
          updatedLabels.push(s.label);
          validSelections.push({
            ...s,
            odd: Number(dbOpt.odd)
          });
        } else {
          validSelections.push(s);
        }
      }

      setSelections(validSelections);
      
      // We could use toast here if we had access to it, 
      // but usually hooks shouldn't trigger UI side effects directly.
      // We'll let the component handle the feedback if needed via state.
      
    } catch (e) {
      console.error("Error revalidating bet slip:", e);
    } finally {
      setIsValidating(false);
    }
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
    setSelections(prev => toggleSelection(prev, newSelection));
  }, []);

  const removeSelection = useCallback((id: string) => {
    setSelections(prev => prev.filter(s => s.selection_id !== id));
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
