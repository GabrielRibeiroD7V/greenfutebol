RELATÓRIO DE AUDITORIA COMPLETA — GREENFUTEBOL (GF-2026-08-09)

==================================================
1. AUDITORIA DA PÁGINA DA PARTIDA
==================================================

- Arquivo: src/routes/jogo.$fixtureId.tsx
- Rota: /jogo/$fixtureId
- Componentes: MatchDetails, BetSlip (Aside e Mobile Bar).
- Origem dos dados: 
    1. Metadados da partida (times, data, placar): Chamada à Edge Function 'get-football-fixture'.
    2. Mercados e Odds: Consulta direta à tabela 'public.fixture_markets' (join com 'fixture_market_selections').
- Hooks: useBetSlip, useAuth, useParams, useNavigate, useState, useEffect.
- Estados locais: fixture (obj), markets (array), expandedCategories (map).

RESPOSTAS:
1. Reais. Os mercados são carregados da tabela 'fixture_markets'.
2. Não. São dinâmicas conforme o banco de dados.
3. Definidas na tabela 'fixture_market_selections.odd'.
4. Sim: `supabase.from("fixture_markets").select("*, fixture_market_selections(*)").eq("fixture_id", ...)`
5. Não. A página consome o que já está persistido no Supabase. A sincronização com API externa ocorre via Edge Function (que alimenta o cache/banco).
6. Sim. FK fixture_id na tabela fixture_markets.
7. Sim, pois estão no banco.
8. Carrega os dados específicos daquele fixture_id. Se não houver mercados no banco para aquele ID, mostra "Nenhum mercado disponível".

==================================================
2. MERCADOS EXISTENTES
==================================================

| Mercado | Existe | Real/Mock | Onde está definido | Persistido? |
| :--- | :--- | :--- | :--- | :--- |
| Resultado Final (1X2) | Sim | Real | fixture_markets | Sim |
| Dupla Chance | Sim | Real | fixture_markets | Sim |
| Total de Gols (Over/Under) | Sim | Real | fixture_markets | Sim |
| Ambas Marcam | Sim | Real | fixture_markets | Sim |
| Handicap | Sim | Real | fixture_markets | Sim |
| Escanteios | Não | - | - | - |
| Cartões | Não | - | - | - |
| Jogadores (Gols/Cartões) | Não | - | - | - |

Nota: O sistema atual suporta qualquer mercado que o Admin insira via `/admin/odds`, mas os automatizados pelo provedor football-data.org são limitados a 1X2 e metas básicas no fluxo de cache atual.

==================================================
3. AUDITORIA DO BANCO
==================================================

TABELAS RELEVANTES:
- public.tickets: Armazena o cabeçalho da aposta (stake, status, total_odd, idempotency_key). RLS: SELECT próprio, INSERT/UPDATE restrito à RPC.
- public.ticket_selections: Itens do bilhete. Normalizado. Vincula ticket_id -> selection_id.
- public.fixture_markets: Cabeçalho do mercado (nome, grupo, status, kickoff_at).
- public.fixture_market_selections: Opções e Odds (nome, odd, status). PK UUID.
- public.profiles: Dados do usuário (email, phone, balance).
- public.user_roles: Papéis (admin, user).
- public.football_fixtures_cache: Cache bruto da API de futebol.
- public.ticket_audit_logs: Logs de segurança da RPC.

ESTRUTURAS FALTANTES:
- players / fixture_players (Não existem)
- stats (corners, cards) (Não existem de forma estruturada)

==================================================
4. AUDITORIA DAS ODDS
==================================================

- Origem: Tabela `fixture_market_selections.odd`.
- Como nasce: 
    1. Via Edge Function (Sincronização com API externa).
    2. Via Admin (`/admin/odds`) - Edição manual pelo administrador.
- Histórico: Apenas o valor atual é mantido na tabela de seleções.
- Suspensão: Existe coluna `status` ('OPEN', 'SUSPENDED', 'CLOSED') em ambas as tabelas de mercado.

==================================================
5. AUDITORIA DO ADMIN
==================================================

| Função administrativa | Existe? | Rota | Funcional? |
| :--- | :--- | :--- | :--- |
| Localizar/Abrir Partida | Sim | /admin/odds | Sim |
| Criar Mercado/Opção | Sim | /admin/odds | Sim (Botão Adicionar) |
| Alterar Odd | Sim | /admin/odds | Sim (Input direto) |
| Suspender/Fechar | Sim | /admin/odds | Sim |
| Gerenciar Jogadores | Não | - | - |

==================================================
6. AUDITORIA DE JOGADORES
==================================================

1. Não existe tabela de players.
2. A API football-data.org (Tier free/standard) fornece dados limitados de jogadores via endpoint de 'persons', mas o fluxo atual de fixtures NÃO os consome.
3. Não há elenco persistido.
4. Não há escalação (lineups).
5. Vínculos não existem.
6. Mercados de jogadores: Atualmente IMPOSSÍVEIS sem nova integração.

==================================================
7. ESTATÍSTICAS (ESCANTEIOS/CARTÕES)
==================================================

- Provedor atual: football-data.org.
- Disponibilidade:
    A. Antes: Não fornece linhas de odds de escanteios (precisam ser manuais).
    B. Ao vivo: Placar e tempo.
    C. Após: Gols e Placar final. Estatísticas detalhadas de escanteios/cartões dependem do plano da API (geralmente indisponíveis no Tier Free).

==================================================
8. AUDITORIA DO BILHETE
==================================================

Campos armazenados no frontend (BetSlipSelection):
- fixtureId, fixtureName, kickoffAt, marketId, marketName, selectionId, selectionName, displayedOdd.

RESPOSTAS:
- Identificação: UUID da `fixture_market_selections`.
- Validação: O servidor recalcula tudo.
- Risco Crítico: O servidor NÃO CONFIA na odd do frontend (corrigido na Entrega 3 via RPC).

==================================================
9. CRIAÇÃO DO TICKET (SEGURANÇA)
==================================================

RPC: create_ticket_atomic
1. Recalcula Odds? SIM (Busca no banco via selection_id).
2. Valida Mercado/Opção? SIM.
3. Valida Status (OPEN)? SIM.
4. Valida Kickoff? SIM.
5. Proteção DevTools? SIM (A odd enviada pelo frontend é ignorada no cálculo final).

CLASSIFICAÇÃO: SEGURO.

==================================================
10. TICKET_SELECTIONS
==================================================

- Normalização: SIM. Existe a tabela `ticket_selections` que separa cada item.
- Consultas de exposição: POSSÍVEIS. Pode-se fazer COUNT/SUM filtrando por selection_id ou market_id.

==================================================
11. RESULTADOS E LIQUIDAÇÃO
==================================================

- Sistema atual: Existência da RPC `settle_ticket` e tabelas de auditoria de resultados.
- Como uma aposta é ganha: O administrador insere o resultado/placar na tabela de resultados e dispara a RPC de liquidação.
- Automação: Ainda manual/semiautomática.

==================================================
12. MERCADOS SUPORTADOS
==================================================

GRUPO A (Auto-liquidáveis): 1X2, Over/Under Gols (se o placar final for capturado), Ambas Marcam.
GRUPO B (Manual): Escanteios, Cartões, Placar Exato (precisa de confirmação de placar).
GRUPO C (Sem Dados): Jogadores (Gols, Assistências, Finalizações).

==================================================
13. ARQUITETURA RECOMENDADA
==================================================

1. Criar `market_templates`: Para gerar rapidamente mercados padrão para novos jogos.
2. Implementar `players` e `fixture_lineups`: Para habilitar mercados de artilharia.
3. Dash de Exposição: No admin, mostrar quanto o site perde/ganha em cada opção de um jogo.

==================================================
14. PLANO DE IMPLEMENTAÇÃO
==================================================

FASE 3A: Automatização da captura de Placar Final e Liquidação Automática (Grupo A).
FASE 3B: Estrutura de Jogadores e Escalações.
FASE 3C: Mercados Especiais (Escanteios/Cartões) com entrada de dados manual/API.

==================================================
RELATÓRIO FINAL
==================================================

CLASSIFICAÇÃO FINAL: B — Estrutura parcialmente pronta. 
A fundação de segurança (RPC) e persistência de mercados está sólida, mas a cobertura de dados (stats/jogadores) é o gargalo atual.

NÃO ALTEREI NADA. Auditoria concluída.
