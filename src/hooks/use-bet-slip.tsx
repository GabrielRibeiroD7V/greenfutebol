import { useState, useEffect, useCallback, useRef } from "react";

export type BetSlipSelection = {
  fixtureId: number;
  fixtureName: string;
  kickoffAt: string;
  competitionName: string | null;
  marketId: string;
  marketName: string;
  marketType: string;
  selectionId: string;
  selectionName: string;
  displayedOdd: number;
  homeTeam: string;
  awayTeam: string;
};

export function useBetSlip() {
  const [selections, setSelections] = useState<BetSlipSelection[]>([]);
  const [stake, setStake] = useState<number>(10);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const isFirstMount = useRef(true);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const saved = localStorage.getItem("gf_bet_slip");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const data = parsed.selections || [];
        const savedKey = parsed.idempotencyKey || null;
        
        // Detect legacy format: id, fixture_id, market_id, selection_id
        const isLegacy = data.some((s: any) => 
          s.id || s.fixture_id || s.market_id || s.selection_id
        );

        if (isLegacy) {
          localStorage.removeItem("gf_bet_slip");
          setSelections([]);
          setIdempotencyKey(null);
        } else {
          setSelections(data);
          setIdempotencyKey(savedKey);
        }
      } catch (e) {
        setSelections([]);
        setIdempotencyKey(null);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    localStorage.setItem("gf_bet_slip", JSON.stringify({ selections, idempotencyKey }));
  }, [selections, idempotencyKey]);

  const generateIdempotencyKey = useCallback(() => {
    const key = crypto.randomUUID();
    setIdempotencyKey(key);
    return key;
  }, []);

  const hasSelection = useCallback((selectionId: string) => {
    return selections.some(s => s.selectionId === selectionId);
  }, [selections]);

  const getSelectionByMarket = useCallback((marketId: string) => {
    return selections.find(s => s.marketId === marketId);
  }, [selections]);

  const removeSelection = useCallback((selectionId: string) => {
    // FASE 2C.1: Alteração manual invalida a tentativa anterior
    setIdempotencyKey(null);
    setSelections(prev => prev.filter(s => s.selectionId !== selectionId));
  }, []);

  const clearBetSlip = useCallback(() => {
    setSelections([]);
    setIdempotencyKey(null);
  }, []);

  const resetIdempotency = useCallback(() => {
    setIdempotencyKey(null);
  }, []);

  const addSelection = useCallback((newSelection: BetSlipSelection) => {
    if (!newSelection.selectionId || !newSelection.marketId || newSelection.fixtureId <= 0) return;
    if (newSelection.displayedOdd <= 1.0) return;

    // FASE 2C.1: Alteração manual invalida a tentativa anterior
    setIdempotencyKey(null);

    setSelections(prev => {
      // Regra FASE 2C: Mesma partida e mesmo mercado substitui
      const filtered = prev.filter(s => !(s.fixtureId === newSelection.fixtureId && s.marketId === newSelection.marketId));
      
      // Se já estava selecionada exatamente essa opção, remove (toggle behavior)
      if (prev.some(s => s.selectionId === newSelection.selectionId)) {
        return prev.filter(s => s.selectionId !== newSelection.selectionId);
      }
      
      return [...filtered, newSelection];
    });
  }, []);

  const toggleSelection = useCallback((newSelection: BetSlipSelection) => {
    const exists = selections.find(s => s.selectionId === newSelection.selectionId);
    if (exists) {
      removeSelection(newSelection.selectionId);
    } else {
      addSelection(newSelection);
    }
  }, [selections, addSelection, removeSelection]);

  const previewTotalOdd = selections.reduce((acc, s) => acc * s.displayedOdd, 1);
  const selectionCount = selections.length;

  return {
    selections,
    stake,
    setStake,
    idempotencyKey,
    generateIdempotencyKey,
    addSelection,
    removeSelection,
    toggleSelection,
    clearBetSlip,
    hasSelection,
    getSelectionByMarket,
    previewTotalOdd,
    selectionCount,
  };
}
