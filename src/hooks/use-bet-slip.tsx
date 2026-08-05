import { useState, useEffect, useCallback, useRef } from "react";
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
  const [isValidating, setIsValidating] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(crypto.randomUUID());
  
  const isFirstMount = useRef(true);

  const revalidateSelections = useCallback(async (currentSelections: Selection[]) => {
    if (currentSelections.length === 0) return;
    
    setIsValidating(true);
    try {
      const optionIds = currentSelections.map(s => s.fixture_market_option_id);
      
      const { data, error } = await supabase
        .from('fixture_market_options')
        .select(`
          id,
          odd,
          active,
          fixture_market:fixture_markets (
            id,
            status,
            fixture_id
          ),
          market_option:market_options (
            label
          )
        `)
        .in('id', optionIds);

      if (error || !data) throw error;

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
        const dbOpt = data.find(d => d.id === s.fixture_market_option_id);
        const fixture = allFixtures.find(f => f.fixture_id === s.fixture_id);
        
        const isStarted = fixture && new Date(fixture.kickoff_at) <= now;
        const isSuspended = !dbOpt || !dbOpt.active || (dbOpt.fixture_market as any).status !== 'OPEN';

        if (!dbOpt || isSuspended || isStarted) {
          removedLabels.push(`${s.home_team} x ${s.away_team} (${s.label})`);
          continue;
        }

        if (Math.abs(dbOpt.odd - s.odd) > 0.0001) {
          updatedLabels.push(s.label);
          validSelections.push({
            ...s,
            odd: dbOpt.odd
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
        setSelections(parsed);
        revalidateSelections(parsed);
      } catch (e) {
        console.error("Error loading bet slip from localStorage", e);
      }
    }
  }, [revalidateSelections]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem("gf_bet_slip", JSON.stringify(selections));
  }, [selections]);

  const addSelection = useCallback((newSelection: Selection) => {
    setSelections(prev => {
      const filtered = prev.filter(s => !(s.fixture_id === newSelection.fixture_id && s.market_name === newSelection.market_name));
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
    refreshIdempotency
  };
}