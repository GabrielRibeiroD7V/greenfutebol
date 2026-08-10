import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toggleSelection } from "@/lib/bet-slip-policy";
import { calculateBetPreview, parseStakeInput } from "@/lib/bet-slip-finance";

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

export interface BetSlipState {
  id: string;
  selections: Selection[];
  stakeInput: string;
  idempotencyKey: string;
  returnToConfirm: boolean;
}

const STORAGE_KEY = "gf_bet_slips_v2";
const LEGACY_STORAGE_KEY = "gf_bet_slip";
const SELECTION_LIMIT = 20;

function createEmptySlip(): BetSlipState {
  return { id: crypto.randomUUID(), selections: [], stakeInput: "", idempotencyKey: crypto.randomUUID(), returnToConfirm: false };
}

interface StoredState { betSlips: BetSlipState[]; activeBetSlipId: string }

function readStoredState(fallback: BetSlipState): StoredState {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      const parsed = JSON.parse(current) as StoredState;
      if (Array.isArray(parsed.betSlips) && parsed.betSlips.length > 0) {
        const betSlips = parsed.betSlips.map((slip) => ({ ...slip, idempotencyKey: slip.idempotencyKey || crypto.randomUUID(), stakeInput: String(slip.stakeInput ?? "") }));
        return { betSlips, activeBetSlipId: betSlips.some((slip) => slip.id === parsed.activeBetSlipId) ? parsed.activeBetSlipId : betSlips[0]!.id };
      }
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated = { ...fallback, selections: parsed.selections || [], stakeInput: parsed.stake == null ? "" : String(parsed.stake), returnToConfirm: Boolean(parsed.returnToConfirm) };
      return { betSlips: [migrated], activeBetSlipId: migrated.id };
    }
  } catch (error) {
    console.error("Error loading bet slips from localStorage", error);
  }
  return { betSlips: [fallback], activeBetSlipId: fallback.id };
}

interface BetSlipContextValue {
  betSlips: BetSlipState[];
  activeBetSlipId: string;
  activeBetSlip: BetSlipState;
  selections: Selection[];
  stakeInput: string;
  stake: number | null;
  totalOdd: number;
  potentialReturn: number;
  potentialProfit: number;
  isValidating: boolean;
  selectionLimit: number;
  setActiveBetSlipId: (id: string) => void;
  createBetSlip: () => void;
  deleteActiveBetSlip: () => void;
  setStakeInput: (value: string) => void;
  addSelection: (selection: Selection) => void;
  removeSelection: (id: string) => void;
  clearSlip: () => void;
  completeActiveSlip: () => void;
  updateChangedOdds: (changes: Array<{ selection_id: string; current_odd?: number; new_odd?: number }>) => void;
  refreshIdempotency: () => void;
  returnToConfirm: boolean;
  setReturnToConfirm: (value: boolean) => void;
}

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(createEmptySlip);
  const [betSlips, setBetSlips] = useState<BetSlipState[]>([initial]);
  const [activeBetSlipId, setActiveBetSlipId] = useState(initial.id);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    const stored = readStoredState(initial);
    setBetSlips(stored.betSlips);
    setActiveBetSlipId(stored.activeBetSlipId);
    setIsHydrated(true);
  }, [initial]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ betSlips, activeBetSlipId }));
  }, [activeBetSlipId, betSlips, isHydrated]);

  const updateActive = useCallback((updater: (slip: BetSlipState) => BetSlipState) => {
    setBetSlips((current) => current.map((slip) => slip.id === activeBetSlipId ? updater(slip) : slip));
  }, [activeBetSlipId]);

  const createBetSlip = useCallback(() => {
    const slip = createEmptySlip();
    setBetSlips((current) => [...current, slip]);
    setActiveBetSlipId(slip.id);
  }, []);

  const deleteActiveBetSlip = useCallback(() => {
    setBetSlips((current) => {
      if (current.length === 1) {
        const replacement = createEmptySlip();
        setActiveBetSlipId(replacement.id);
        return [replacement];
      }
      const index = current.findIndex((slip) => slip.id === activeBetSlipId);
      const remaining = current.filter((slip) => slip.id !== activeBetSlipId);
      setActiveBetSlipId(remaining[Math.max(0, index - 1)]?.id ?? remaining[0]!.id);
      return remaining;
    });
  }, [activeBetSlipId]);

  const setStakeInput = useCallback((value: string) => updateActive((slip) => ({ ...slip, stakeInput: value, idempotencyKey: crypto.randomUUID() })), [updateActive]);
  const addSelection = useCallback((selection: Selection) => updateActive((slip) => {
    const selections = toggleSelection(slip.selections, selection, SELECTION_LIMIT);
    return selections === slip.selections ? slip : { ...slip, selections, idempotencyKey: crypto.randomUUID() };
  }), [updateActive]);
  const removeSelection = useCallback((id: string) => updateActive((slip) => ({ ...slip, selections: slip.selections.filter((selection) => selection.selection_id !== id), idempotencyKey: crypto.randomUUID() })), [updateActive]);
  const clearSlip = useCallback(() => updateActive((slip) => ({ ...slip, selections: [], stakeInput: "", idempotencyKey: crypto.randomUUID(), returnToConfirm: false })), [updateActive]);
  const completeActiveSlip = useCallback(() => deleteActiveBetSlip(), [deleteActiveBetSlip]);
  const refreshIdempotency = useCallback(() => updateActive((slip) => ({ ...slip, idempotencyKey: crypto.randomUUID() })), [updateActive]);
  const setReturnToConfirm = useCallback((value: boolean) => updateActive((slip) => ({ ...slip, returnToConfirm: value })), [updateActive]);
  const updateChangedOdds = useCallback((changes: Array<{ selection_id: string; current_odd?: number; new_odd?: number }>) => updateActive((slip) => ({
    ...slip,
    selections: slip.selections.map((selection) => {
      const change = changes.find((item) => item.selection_id === selection.selection_id);
      const odd = change?.current_odd ?? change?.new_odd;
      return odd == null ? selection : { ...selection, odd: Number(odd) };
    }),
    idempotencyKey: crypto.randomUUID(),
  })), [updateActive]);

  useEffect(() => {
    if (!isHydrated) return;
    const validate = async () => {
      const all = betSlips.flatMap((slip) => slip.selections);
      if (!all.length) return;
      setIsValidating(true);
      try {
        const ids = [...new Set(all.map((selection) => selection.selection_id))];
        const { data, error } = await (supabase as any).from("fixture_market_selections").select("id, odd").in("id", ids);
        if (error || !data) return;
        setBetSlips((current) => current.map((slip) => {
          let changed = false;
          const selections = slip.selections.map((selection) => {
            const remote = data.find((item: any) => item.id === selection.selection_id);
            const remoteOdd = Number(remote?.odd);
            if (remoteOdd > 1 && Math.abs(remoteOdd - selection.odd) > 0.0001) {
              changed = true;
              return { ...selection, odd: remoteOdd };
            }
            return selection;
          });
          return changed ? { ...slip, selections, idempotencyKey: crypto.randomUUID() } : slip;
        }));
      } finally { setIsValidating(false); }
    };
    void validate();
    // Revalidate only once after restoring persisted state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  const activeBetSlip = betSlips.find((slip) => slip.id === activeBetSlipId) ?? betSlips[0] ?? initial;
  const stake = parseStakeInput(activeBetSlip.stakeInput);
  const preview = calculateBetPreview(activeBetSlip.selections.map((selection) => selection.odd), stake);

  return <BetSlipContext.Provider value={{ betSlips, activeBetSlipId, activeBetSlip, selections: activeBetSlip.selections, stakeInput: activeBetSlip.stakeInput, stake, ...preview, isValidating, selectionLimit: SELECTION_LIMIT, setActiveBetSlipId, createBetSlip, deleteActiveBetSlip, setStakeInput, addSelection, removeSelection, clearSlip, completeActiveSlip, updateChangedOdds, refreshIdempotency, returnToConfirm: activeBetSlip.returnToConfirm, setReturnToConfirm }}>{children}</BetSlipContext.Provider>;
}

export function useBetSlip() {
  const context = useContext(BetSlipContext);
  if (!context) throw new Error("useBetSlip must be used within BetSlipProvider");
  return context;
}
