-- Phase 1: Betting System Infrastructure

-- 1. Enums and Extensions
create type public.app_role as enum ('admin', 'user');

-- 2. User Roles Table
create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role public.app_role not null,
    unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- 3. Market Types
create table public.market_types (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name text not null,
    category text not null,
    settlement_type text not null,
    period text not null default 'FULL_TIME',
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

grant select on public.market_types to authenticated;
grant select on public.market_types to anon;
grant all on public.market_types to service_role;

alter table public.market_types enable row level security;

-- 4. Market Options
create table public.market_options (
    id uuid primary key default gen_random_uuid(),
    market_type_id uuid not null references public.market_types(id) on delete cascade,
    code text not null,
    label text not null,
    side text null,
    parameter numeric null,
    active boolean not null default true,
    display_order integer not null default 0,
    created_at timestamptz not null default now(),
    unique (market_type_id, code, parameter, side)
);

grant select on public.market_options to authenticated;
grant select on public.market_options to anon;
grant all on public.market_options to service_role;

alter table public.market_options enable row level security;

-- 5. Fixture Markets
create table public.fixture_markets (
    id uuid primary key default gen_random_uuid(),
    fixture_id bigint not null,
    market_type_id uuid not null references public.market_types(id) on delete cascade,
    status text not null default 'OPEN' check (status in ('OPEN', 'SUSPENDED', 'CLOSED', 'SETTLED', 'CANCELLED')),
    opens_at timestamptz null,
    suspends_at timestamptz null,
    closes_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (fixture_id, market_type_id)
);

grant select on public.fixture_markets to authenticated;
grant select on public.fixture_markets to anon;
grant all on public.fixture_markets to service_role;

alter table public.fixture_markets enable row level security;

-- 6. Fixture Market Options
create table public.fixture_market_options (
    id uuid primary key default gen_random_uuid(),
    fixture_market_id uuid not null references public.fixture_markets(id) on delete cascade,
    market_option_id uuid not null references public.market_options(id) on delete cascade,
    odd numeric(10,4) not null check (odd > 1),
    active boolean not null default true,
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (fixture_market_id, market_option_id)
);

grant select on public.fixture_market_options to authenticated;
grant select on public.fixture_market_options to anon;
grant all on public.fixture_market_options to service_role;

alter table public.fixture_market_options enable row level security;

-- 7. Tickets
create table public.tickets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    code text unique not null,
    stake numeric(12,2) not null check (stake >= 5 and stake <= 5000),
    total_odd numeric(12,4) not null,
    potential_return numeric(12,2) not null,
    status text not null default 'DRAFT' check (status in ('DRAFT', 'CONFIRMED', 'CANCELLED')),
    payment_status text not null default 'NOT_REQUIRED',
    selection_count integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

grant select, insert, update on public.tickets to authenticated;
grant all on public.tickets to service_role;

alter table public.tickets enable row level security;

-- 8. Ticket Selections
create table public.ticket_selections (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null references public.tickets(id) on delete cascade,
    fixture_id bigint not null,
    fixture_market_id uuid not null references public.fixture_markets(id),
    fixture_market_option_id uuid not null references public.fixture_market_options(id),
    market_type_code_snapshot text not null,
    market_name_snapshot text not null,
    option_code_snapshot text not null,
    option_label_snapshot text not null,
    parameter_snapshot numeric null,
    odd_snapshot numeric(10,4) not null,
    home_team_snapshot text not null,
    away_team_snapshot text not null,
    home_team_logo_snapshot text null,
    away_team_logo_snapshot text null,
    competition_snapshot text null,
    kickoff_at_snapshot timestamptz not null,
    settlement_status text not null default 'PENDING' check (settlement_status in ('PENDING', 'WON', 'LOST', 'VOID')),
    created_at timestamptz not null default now()
);

grant select, insert on public.ticket_selections to authenticated;
grant all on public.ticket_selections to service_role;

alter table public.ticket_selections enable row level security;

-- 9. Security Definer Function: has_role
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- 10. RLS Policies

-- market_types: public read, admin write
create policy "Anyone can read market_types" on public.market_types for select using (active = true);
create policy "Admins can manage market_types" on public.market_types for all to authenticated using (public.has_role(auth.uid(), 'admin'));

-- market_options: public read, admin write
create policy "Anyone can read market_options" on public.market_options for select using (active = true);
create policy "Admins can manage market_options" on public.market_options for all to authenticated using (public.has_role(auth.uid(), 'admin'));

-- fixture_markets: public read, admin write
create policy "Anyone can read fixture_markets" on public.fixture_markets for select using (status != 'CANCELLED');
create policy "Admins can manage fixture_markets" on public.fixture_markets for all to authenticated using (public.has_role(auth.uid(), 'admin'));

-- fixture_market_options: public read, admin write
create policy "Anyone can read fixture_market_options" on public.fixture_market_options for select using (active = true);
create policy "Admins can manage fixture_market_options" on public.fixture_market_options for all to authenticated using (public.has_role(auth.uid(), 'admin'));

-- tickets: user can read/create/update own tickets, admin can read all
create policy "Users can read own tickets" on public.tickets for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Users can create own tickets" on public.tickets for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own draft tickets" on public.tickets for update to authenticated using (auth.uid() = user_id and status = 'DRAFT');

-- ticket_selections: user can read/create own selections, admin can read all
create policy "Users can read own selections" on public.ticket_selections for select to authenticated using (
    exists (select 1 from public.tickets where id = ticket_id and (user_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
);
create policy "Users can create own selections" on public.ticket_selections for insert to authenticated with check (
    exists (select 1 from public.tickets where id = ticket_id and user_id = auth.uid())
);

-- 11. Seed Data (Initial Markets)

-- MATCH_RESULT
with mt as (
    insert into public.market_types (code, name, category, settlement_type, period)
    values ('MATCH_RESULT', 'Resultado Final', 'RESULT', 'THREE_WAY_RESULT', 'FULL_TIME')
    returning id
)
insert into public.market_options (market_type_id, code, label, side, display_order)
select id, 'HOME', 'Vitória do mandante', 'HOME', 1 from mt
union all
select id, 'DRAW', 'Empate', 'DRAW', 2 from mt
union all
select id, 'AWAY', 'Vitória do visitante', 'AWAY', 3 from mt;

-- DOUBLE_CHANCE
with mt as (
    insert into public.market_types (code, name, category, settlement_type, period)
    values ('DOUBLE_CHANCE', 'Dupla Chance', 'RESULT', 'DOUBLE_CHANCE', 'FULL_TIME')
    returning id
)
insert into public.market_options (market_type_id, code, label, side, display_order)
select id, 'HOME_OR_DRAW', 'Mandante ou empate', 'HOME_OR_DRAW', 1 from mt
union all
select id, 'HOME_OR_AWAY', 'Mandante ou visitante', 'HOME_OR_AWAY', 2 from mt
union all
select id, 'DRAW_OR_AWAY', 'Empate ou visitante', 'DRAW_OR_AWAY', 3 from mt;

-- DRAW_NO_BET
with mt as (
    insert into public.market_types (code, name, category, settlement_type, period)
    values ('DRAW_NO_BET', 'Empate Anula Aposta', 'RESULT', 'DRAW_NO_BET', 'FULL_TIME')
    returning id
)
insert into public.market_options (market_type_id, code, label, side, display_order)
select id, 'HOME', 'Mandante', 'HOME', 1 from mt
union all
select id, 'AWAY', 'Visitante', 'AWAY', 2 from mt;

-- TOTAL_GOALS
with mt as (
    insert into public.market_types (code, name, category, settlement_type, period)
    values ('TOTAL_GOALS', 'Total de Gols', 'GOALS', 'OVER_UNDER', 'FULL_TIME')
    returning id
)
insert into public.market_options (market_type_id, code, label, side, parameter, display_order)
select id, 'OVER', 'Mais de 0.5', 'OVER', 0.5, 1 from mt union all
select id, 'UNDER', 'Menos de 0.5', 'UNDER', 0.5, 2 from mt union all
select id, 'OVER', 'Mais de 1.5', 'OVER', 1.5, 3 from mt union all
select id, 'UNDER', 'Menos de 1.5', 'UNDER', 1.5, 4 from mt union all
select id, 'OVER', 'Mais de 2.5', 'OVER', 2.5, 5 from mt union all
select id, 'UNDER', 'Menos de 2.5', 'UNDER', 2.5, 6 from mt union all
select id, 'OVER', 'Mais de 3.5', 'OVER', 3.5, 7 from mt union all
select id, 'UNDER', 'Menos de 3.5', 'UNDER', 3.5, 8 from mt;

-- BOTH_TEAMS_TO_SCORE
with mt as (
    insert into public.market_types (code, name, category, settlement_type, period)
    values ('BOTH_TEAMS_TO_SCORE', 'Ambas Marcam', 'GOALS', 'YES_NO', 'FULL_TIME')
    returning id
)
insert into public.market_options (market_type_id, code, label, side, display_order)
select id, 'YES', 'Sim', 'YES', 1 from mt
union all
select id, 'NO', 'Não', 'NO', 2 from mt;

-- TOTAL_CORNERS
with mt as (
    insert into public.market_types (code, name, category, settlement_type, period)
    values ('TOTAL_CORNERS', 'Total de Escanteios', 'CORNERS', 'OVER_UNDER', 'FULL_TIME')
    returning id
)
insert into public.market_options (market_type_id, code, label, side, parameter, display_order)
select id, 'OVER', 'Mais de 4.5', 'OVER', 4.5, 1 from mt union all
select id, 'UNDER', 'Menos de 4.5', 'UNDER', 4.5, 2 from mt union all
select id, 'OVER', 'Mais de 5.5', 'OVER', 5.5, 3 from mt union all
select id, 'UNDER', 'Menos de 5.5', 'UNDER', 5.5, 4 from mt union all
select id, 'OVER', 'Mais de 7.5', 'OVER', 7.5, 5 from mt union all
select id, 'UNDER', 'Menos de 7.5', 'UNDER', 7.5, 6 from mt union all
select id, 'OVER', 'Mais de 8.5', 'OVER', 8.5, 7 from mt union all
select id, 'UNDER', 'Menos de 8.5', 'UNDER', 8.5, 8 from mt union all
select id, 'OVER', 'Mais de 9.5', 'OVER', 9.5, 9 from mt union all
select id, 'UNDER', 'Menos de 9.5', 'UNDER', 9.5, 10 from mt union all
select id, 'OVER', 'Mais de 10.5', 'OVER', 10.5, 11 from mt union all
select id, 'UNDER', 'Menos de 10.5', 'UNDER', 10.5, 12 from mt;

-- TOTAL_CARDS
with mt as (
    insert into public.market_types (code, name, category, settlement_type, period)
    values ('TOTAL_CARDS', 'Total de Cartões', 'CARDS', 'OVER_UNDER', 'FULL_TIME')
    returning id
)
insert into public.market_options (market_type_id, code, label, side, parameter, display_order)
select id, 'OVER', 'Mais de 2.5', 'OVER', 2.5, 1 from mt union all
select id, 'UNDER', 'Menos de 2.5', 'UNDER', 2.5, 2 from mt union all
select id, 'OVER', 'Mais de 3.5', 'OVER', 3.5, 3 from mt union all
select id, 'UNDER', 'Menos de 3.5', 'UNDER', 3.5, 4 from mt union all
select id, 'OVER', 'Mais de 4.5', 'OVER', 4.5, 5 from mt union all
select id, 'UNDER', 'Menos de 4.5', 'UNDER', 4.5, 6 from mt union all
select id, 'OVER', 'Mais de 5.5', 'OVER', 5.5, 7 from mt union all
select id, 'UNDER', 'Menos de 5.5', 'UNDER', 5.5, 8 from mt;

-- FIRST_HALF_RESULT
with mt as (
    insert into public.market_types (code, name, category, settlement_type, period)
    values ('FIRST_HALF_RESULT', 'Resultado do Primeiro Tempo', 'FIRST_HALF', 'THREE_WAY_RESULT', 'FIRST_HALF')
    returning id
)
insert into public.market_options (market_type_id, code, label, side, display_order)
select id, 'HOME', 'Mandante', 'HOME', 1 from mt
union all
select id, 'DRAW', 'Empate', 'DRAW', 2 from mt
union all
select id, 'AWAY', 'Visitante', 'AWAY', 3 from mt;

-- FIRST_HALF_TOTAL_GOALS
with mt as (
    insert into public.market_types (code, name, category, settlement_type, period)
    values ('FIRST_HALF_TOTAL_GOALS', 'Total de Gols no 1º Tempo', 'FIRST_HALF', 'OVER_UNDER', 'FIRST_HALF')
    returning id
)
insert into public.market_options (market_type_id, code, label, side, parameter, display_order)
select id, 'OVER', 'Mais de 0.5', 'OVER', 0.5, 1 from mt union all
select id, 'UNDER', 'Menos de 0.5', 'UNDER', 0.5, 2 from mt union all
select id, 'OVER', 'Mais de 1.5', 'OVER', 1.5, 3 from mt union all
select id, 'UNDER', 'Menos de 1.5', 'UNDER', 1.5, 4 from mt;