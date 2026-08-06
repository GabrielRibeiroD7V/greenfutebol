import { useState, useEffect, useCallback, useRef } from "react";
export function useBetSlip() {
    const [selections, setSelections] = useState([]);
    const [stake, setStake] = useState(10);
    const isFirstMount = useRef(true);
    // Load from localStorage on mount
    useEffect(() => {
        if (typeof window === "undefined")
            return;
        const saved = localStorage.getItem("gf_bet_slip");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const data = parsed.selections || [];
                // Detect legacy format: id, fixture_id, market_id, selection_id
                const isLegacy = data.some((s) => s.id || s.fixture_id || s.market_id || s.selection_id);
                if (isLegacy) {
                    localStorage.removeItem("gf_bet_slip");
                    setSelections([]);
                }
                else {
                    setSelections(data);
                }
            }
            catch (e) {
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
    const hasSelection = useCallback((selectionId) => {
        return selections.some(s => s.selectionId === selectionId);
    }, [selections]);
    const getSelectionByMarket = useCallback((marketId) => {
        return selections.find(s => s.marketId === marketId);
    }, [selections]);
    const removeSelection = useCallback((selectionId) => {
        setSelections(prev => prev.filter(s => s.selectionId !== selectionId));
    }, []);
    const clearBetSlip = useCallback(() => {
        setSelections([]);
    }, []);
    const addSelection = useCallback((newSelection) => {
        if (!newSelection.selectionId || !newSelection.marketId || newSelection.fixtureId <= 0)
            return;
        if (newSelection.displayedOdd <= 1.0)
            return;
        setSelections(prev => {
            const filtered = prev.filter(s => s.marketId !== newSelection.marketId);
            if (prev.some(s => s.selectionId === newSelection.selectionId)) {
                return prev.filter(s => s.selectionId !== newSelection.selectionId);
            }
            return [...filtered, newSelection];
        });
    }, []);
    const toggleSelection = useCallback((newSelection) => {
        const exists = selections.find(s => s.selectionId === newSelection.selectionId);
        if (exists) {
            removeSelection(newSelection.selectionId);
        }
        else {
            addSelection(newSelection);
        }
    }, [selections, addSelection, removeSelection]);
    const previewTotalOdd = selections.reduce((acc, s) => acc * s.displayedOdd, 1);
    const selectionCount = selections.length;
    return {
        selections,
        stake,
        setStake,
        addSelection,
        removeSelection,
        toggleSelection,
        clearBetSlip,
        hasSelection,
        getSelectionByMarket,
        selectionCount,
        previewTotalOdd,
        totalOdd: previewTotalOdd,
        clearSlip: clearBetSlip
    };
}
