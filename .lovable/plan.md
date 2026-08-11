# Plano de Reestruturação GreenSport

Este plano visa a completa auditoria e reestruturação da plataforma conforme os requisitos detalhados, focando em navegação real, robustez na listagem de jogos, segurança nos bilhetes e um painel administrativo completo.

## Fase 1: Auditoria Finalizada (Resumo)

### Estado Atual
*   **Frontend:** Rotas básicas funcionando, mas navegação da sidebar quebrada (`/futebol`, `/ao-vivo` inexistentes). BetSlip funcional com `camelCase`.
*   **Backend:** RPCs seguras (`create_ticket_atomic`, `settle_fixture_atomic`) já implementadas com validação de stake (R$ 10,00) e liquidação All-or-Nothing.
*   **Segurança:** RLS ativo, mas necessita auditoria em novas tabelas administrativas.
*   **Admin:** Painéis de bilhetes, mercados e resultados existem, mas faltam `/admin/usuarios` e `/admin/partidas`.

---

## Fase 2: Correção de Navegação e Rotas

Organizar a arquitetura de rotas para garantir navegação fluida e consistente.

*   **Implementar rotas faltantes:**
    *   `src/routes/futebol.tsx`: Listagem geral (similar à home mas sem foco em "hoje").
    *   `src/routes/ao-vivo.tsx`: Filtro exclusivo para partidas com status `LIVE`.
    *   `src/routes/admin/usuarios.tsx`: Gestão de usuários.
    *   `src/routes/admin/partidas.tsx`: Gestão de fixtures (sincronização e status).
*   **Sidebar:** Atualizar `src/components/PublicSidebar.tsx` para usar links reais do TanStack Router, garantindo que o estado "ativo" seja refletido corretamente.

---

## Fase 3: Home Robusta e Fallback 14 Dias

Garantir que a página inicial nunca fique vazia.

*   **Refatorar lógica de busca na Home:**
    *   Se não houver jogos hoje, buscar sequencialmente nos próximos 14 dias até encontrar uma data com jogos.
    *   Exibir claramente a data encontrada (ex: "Próximas Partidas — 15/08").
    *   Garantir que o timezone `America/Campo_Grande` seja respeitado em todos os cálculos.

---

## Fase 4: Painel Administrativo Completo

Transformar o admin em uma ferramenta de controle operacional total.

*   **Dashboard (/admin/index.tsx):**
    *   Métricas reais: Total de usuários, bilhetes por status, volume financeiro apostado (stake) e retorno potencial.
    *   Gráficos simples de volume por período (Hoje, 7 dias, 30 dias).
*   **Gestão de Usuários (/admin/usuarios.tsx):**
    *   Listagem com busca por e-mail/telefone.
    *   Detalhes do usuário: Histórico de apostas, saldo (se aplicável), data de cadastro.
*   **Gestão de Partidas (/admin/partidas.tsx):**
    *   Listagem de fixtures no banco e no cache.
    *   Botão para forçar sincronização via `sync-fixtures`.

---

## Fase 5: Refinamento de Bilhetes e Settlement

*   **BetSlip:** Validar stake mínima de R$ 10,00 no frontend e garantir que a RPC `create_ticket_atomic` receba os dados corretamente.
*   **Status de Pagamento:** Integrar visualmente o status `PENDING_PAYMENT` e o fluxo de PIX (Asaas) se as secrets estiverem presentes.
*   **Liquidação:** Melhorar a UI de `/admin/resultados` para permitir entrada rápida de scores e execução da RPC de liquidação.

---

## Fase 6: Auditoria de Segurança e UX Final

*   **Segurança:** Revisar RLS para garantir que apenas admins acessem `/admin/*` via políticas de banco (tabela `user_roles`).
*   **Responsividade:** Testar sidebar e tabelas administrativas em dispositivos móveis.
*   **Tema Premium:** Aplicar consistentemente o tema claro (Branco/Verde/Slate) em todas as novas telas.

## Detalhes Técnicos

### Novas Rotas
*   `/futebol`: Lista todas as competições.
*   `/ao-vivo`: Filtro `status IN ('1H', 'HT', '2H', 'ET', 'P', 'LIVE')`.
*   `/admin/usuarios`: Tabela de `profiles` join `user_roles`.
*   `/admin/partidas`: Tabela de `fixtures` com ações de sync.

### RPCs e Tabelas
*   Manter `create_ticket_atomic` como autoridade única de criação.
*   Utilizar `fixtures` e `football_fixtures_cache` para listagens.
*   Garantir que `ticket_selections` tenha snapshots das odds.
