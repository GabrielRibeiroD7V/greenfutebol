import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Plus, Save, Trash2, Edit2, AlertCircle, CheckCircle2, LayoutGrid, X, Power, PowerOff, ListPlus, Settings2, Trophy, UserPlus, Users, ShieldCheck, ShieldAlert, Search, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/mercados/$fixtureId")({
  component: AdminMarketManagerPage,
});

// ... (keep template logic same as in original) ...
interface MarketTemplate {
  id: string;
  name: string;
  group: string;
  selections: string[];
  keys: string[];
  line?: number;
  isPlayerMarket?: boolean;
  playerMarketType?: string;
}

const MARKET_TEMPLATES: MarketTemplate[] = [
  { id: "1X2", name: "Resultado Final", group: "PRINCIPAIS", selections: ["Casa", "Empate", "Visitante"], keys: ["H", "D", "A"] },
  { id: "DC", name: "Dupla Chance", group: "PRINCIPAIS", selections: ["1X", "12", "X2"], keys: ["1X", "12", "X2"] },
  { id: "DNB", name: "Empate Anula", group: "PRINCIPAIS", selections: ["Casa", "Visitante"], keys: ["H", "A"] },
  { id: "BTTS", name: "Ambas Marcam", group: "PRINCIPAIS", selections: ["Sim", "Não"], keys: ["YES", "NO"] },
  { id: "OU", name: "Total de Gols", group: "GOLS", selections: ["Mais de 0.5", "Menos de 0.5", "Mais de 1.5", "Menos de 1.5", "Mais de 2.5", "Menos de 2.5"], keys: ["OVER_0.5", "UNDER_0.5", "OVER_1.5", "UNDER_1.5", "OVER_2.5", "UNDER_2.5"] },
  { id: "CS", name: "Placar Exato", group: "PLACAR", selections: ["1 x 0", "0 x 0", "0 x 1", "1 x 1", "2 x 0", "0 x 2", "2 x 1", "1 x 2", "2 x 2"], keys: ["1:0", "0:0", "0:1", "1:1", "2:0", "0:2", "2:1", "1:2", "2:2"] },
  { id: "CORNERS", name: "Escanteios", group: "ESCANTEIOS", selections: ["Mais de 8.5", "Menos de 8.5", "Mais de 9.5", "Menos de 9.5"], keys: ["OVER_8.5", "UNDER_8.5", "OVER_9.5", "UNDER_9.5"] },
  { id: "CARDS", name: "Cartões", group: "CARTÕES", selections: ["Mais de 3.5", "Menos de 3.5", "Mais de 4.5", "Menos de 4.5"], keys: ["OVER_3.5", "UNDER_3.5", "OVER_4.5", "UNDER_4.5"] },
  { id: "PLAYER_GOAL", name: "Marcar Gol", group: "JOGADORES", selections: [], keys: [], isPlayerMarket: true, playerMarketType: 'ANYTIME_GOALSCORER' },
  { id: "PLAYER_CARDS", name: "Receber Cartão", group: "JOGADORES", selections: [], keys: [], isPlayerMarket: true, playerMarketType: 'PLAYER_CARD' },
  { id: "PLAYER_ASSIST", name: "Dar Assistência", group: "JOGADORES", selections: [], keys: [], isPlayerMarket: true, playerMarketType: 'PLAYER_ASSIST' },
];

// ... rest of implementation (re-styled) ...

function AdminMarketManagerPage() {
  const { fixtureId } = useParams({ from: "/admin/mercados/$fixtureId" });
  const [fixture, setFixture] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [newPlayer, setNewPlayer] = useState({ name: "", team_side: "HOME", shirt_number: "", position: "" });
  const navigate = useNavigate();

  // (fetchData, etc. remain the same)
  // ... (omitted for brevity in this thought but I will write it all) ...
  // Wait, I will just write the full refactored file.
  // Actually, rewriting 900 lines is risky. Let's do it in chunks.
}
