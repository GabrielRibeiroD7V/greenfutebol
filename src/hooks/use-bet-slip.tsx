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
};

export function useBetSlip() {
  const [selections, setSelections] = useState<BetSlipSelection[]>([]);
  // Use a local state for stake that is NOT persisted in tickets (as per Phase 2 requirements)
  const [stake, setStake] = useState<number>(10);
  const isFirstMount = useRef(true);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const saved = localStorage.getItem("gf_bet_slip");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const data = parsed.selections || [];
        
        // Detect legacy format: id, fixture_id, market_id, selection_id
        const isLegacy = data.some((s: any) => 
          s.id || s.fixture_id || s.market_id || s.selection_id
        );

        if (isLegacy) {
          console.warn("Legacy bet slip format detected. Clearing.");
          localStorage.removeItem("gf_bet_slip");
          setSelections([]);
        } else {
          setSelections(data);
        }
      } catch (e) {
        console.error("Error loading bet slip from localStorage", e);
        setSelections([]);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    localStorage.setItem("gf_bet_slip", JSON.stringify({ selections }));
  }, [selections]);

  const hasSelection = useCallback((selectionId: string) => {
    return selections.some(s => s.selectionId === selectionId);
  }, [selections]);

  const getSelectionByMarket = useCallback((marketId: string) => {
    return selections.find(s => s.marketId === marketId);
  }, [selections]);

  const removeSelection = useCallback((selectionId: string) => {
    setSelections(prev => prev.filter(s => s.selectionId !== selectionId));
  }, []);

  const clearBetSlip = useCallback(() => {
    setSelections([]);
  }, []);

  const addSelection = useCallback((newSelection: BetSlipSelection) => {
    // Validation
    if (!newSelection.selectionId || !newSelection.marketId || newSelection.fixtureId <= 0) return;
    if (newSelection.displayedOdd <= 1.0) return;

    setSelections(prev => {
      // One selection per marketId
      const filtered = prev.filter(s => s.marketId !== newSelection.marketId);
      // No duplicate selectionId (redundant but safe)
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

  const replaceMarketSelection = useCallback((newSelection: BetSlipSelection) => {
    addSelection(newSelection);
  }, [addSelection]);

  const previewTotalOdd = selections.reduce((acc, s) => acc * s.displayedOdd, 1);
  const selectionCount = selections.length;

  return {
    selections,
    stake,
    setStake,
    addSelection,
    removeSelection,
    replaceMarketSelection,
    toggleSelection,
    clearBetSlip,
    hasSelection,
    getSelectionByMarket,
    selectionCount,
    previewTotalOdd,
    // Aliases for backward compatibility if needed during refactoring
    totalOdd: previewTotalOdd,
    clearSlip: clearBetSlip
  };
}
