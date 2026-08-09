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
  metadata?: any;
};

export function useBetSlip() {
  const [selections, setSelections] = useState<BetSlipSelection[]>([]);
  const [stakeState, setStakeState] = useState<number>(10);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const setStake = useCallback((newStake: number) => {
    setStakeState(newStake);
    setIdempotencyKey(null);
  }, []);
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
      // REGRA CORREÇÃO FUNCIONAL: Nenhuma substituição automática.
      // Apenas toggle exato por selectionId.
      
      const isDuplicate = prev.some(s => s.selectionId === newSelection.selectionId);
      
      if (isDuplicate) {
        // Toggle: Se já existe exatamente essa seleção, remove.
        return prev.filter(s => s.selectionId !== newSelection.selectionId);
      }
      
      // Caso contrário, adiciona ao bilhete sem remover outras da mesma fixture/market.
      return [...prev, newSelection];
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
    stake: stakeState,
    setStake,
    idempotencyKey,
    generateIdempotencyKey,
    resetIdempotency,
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
