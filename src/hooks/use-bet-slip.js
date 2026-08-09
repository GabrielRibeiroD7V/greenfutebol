import { useState, useEffect, useCallback, useRef } from "react";
export function useBetSlip() {
    const [selections, setSelections] = useState([]);
    const [stake, setStake] = useState(10);
    const [idempotencyKey, setIdempotencyKey] = useState(null);
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
                const savedKey = parsed.idempotencyKey || null;
                // Detect legacy format: id, fixture_id, market_id, selection_id
                const isLegacy = data.some((s) => s.id || s.fixture_id || s.market_id || s.selection_id);
                if (isLegacy) {
                    localStorage.removeItem("gf_bet_slip");
                    setSelections([]);
                    setIdempotencyKey(null);
                }
                else {
                    setSelections(data);
                    setIdempotencyKey(savedKey);
                }
            }
            catch (e) {
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
    const hasSelection = useCallback((selectionId) => {
        return selections.some(s => s.selectionId === selectionId);
    }, [selections]);
    const getSelectionByMarket = useCallback((marketId) => {
        return selections.find(s => s.marketId === marketId);
    }, [selections]);
    const removeSelection = useCallback((selectionId) => {
        setSelections(prev => {
            const next = prev.filter(s => s.selectionId !== selectionId);
            if (next.length === 0)
                setIdempotencyKey(null);
            return next;
        });
    }, []);
    const clearBetSlip = useCallback(() => {
        setSelections([]);
        setIdempotencyKey(null);
    }, []);
    const addSelection = useCallback((newSelection) => {
        if (!newSelection.selectionId || !newSelection.marketId || newSelection.fixtureId <= 0)
            return;
        if (newSelection.displayedOdd <= 1.0)
            return;
        if (!idempotencyKey) {
            const key = crypto.randomUUID();
            setIdempotencyKey(key);
        }
        setSelections(prev => {
            // Regra FASE 2C: Mesma partida e mesmo mercado substitui
            const filtered = prev.filter(s => !(s.fixtureId === newSelection.fixtureId && s.marketId === newSelection.marketId));
            // Se já estava selecionada exatamente essa opção, remove (toggle behavior)
            if (prev.some(s => s.selectionId === newSelection.selectionId)) {
                const next = prev.filter(s => s.selectionId !== newSelection.selectionId);
                if (next.length === 0)
                    setIdempotencyKey(null);
                return next;
            }
            return [...filtered, newSelection];
        });
    }, [idempotencyKey]);
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
