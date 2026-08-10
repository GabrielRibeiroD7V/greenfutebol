-- Data-driven sportsbook catalog. Templates never contain odds and only create DRAFT rows.
ALTER TABLE public.fixture_markets ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.fixture_markets ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.fixture_markets ADD COLUMN IF NOT EXISTS settlement_mode text NOT NULL DEFAULT 'MANUAL_SETTLE';

CREATE TABLE IF NOT EXISTS public.market_catalog_templates (
  code text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  period text NOT NULL DEFAULT 'FULL_TIME',
  settlement_mode text NOT NULL CHECK (settlement_mode IN ('AUTO_SETTLE', 'MANUAL_SETTLE')),
  sort_order integer NOT NULL DEFAULT 0,
  line_required boolean NOT NULL DEFAULT false,
  default_lines numeric[] NOT NULL DEFAULT '{}'::numeric[],
  selection_blueprint jsonb NOT NULL,
  requires_players boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_catalog_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read market catalog templates" ON public.market_catalog_templates;
CREATE POLICY "Anyone can read market catalog templates" ON public.market_catalog_templates
  FOR SELECT USING (active = true);
GRANT SELECT ON public.market_catalog_templates TO anon, authenticated;
GRANT ALL ON public.market_catalog_templates TO service_role;

INSERT INTO public.market_catalog_templates
  (code,name,category,period,settlement_mode,sort_order,line_required,default_lines,selection_blueprint,requires_players)
VALUES
('MATCH_RESULT','Resultado Final','MAIN','FULL_TIME','MANUAL_SETTLE',10,false,'{}','[{"key":"HOME","label":"Casa"},{"key":"DRAW","label":"Empate"},{"key":"AWAY","label":"Visitante"}]',false),
('DOUBLE_CHANCE','Dupla Chance','MAIN','FULL_TIME','AUTO_SETTLE',50,false,'{}','[{"key":"HOME_OR_DRAW","label":"Casa ou Empate"},{"key":"HOME_OR_AWAY","label":"Casa ou Visitante"},{"key":"DRAW_OR_AWAY","label":"Empate ou Visitante"}]',false),
('DRAW_NO_BET','Empate Anula','MAIN','FULL_TIME','AUTO_SETTLE',40,false,'{}','[{"key":"HOME","label":"Casa — Empate Anula"},{"key":"AWAY","label":"Visitante — Empate Anula"}]',false),
('EURO_HANDICAP','Handicap Europeu','HANDICAPS','FULL_TIME','MANUAL_SETTLE',45,true,ARRAY[-2,-1,1,2]::numeric[],'[{"key":"HOME","label":"Casa {{line}}"},{"key":"DRAW","label":"Empate {{line}}"},{"key":"AWAY","label":"Visitante {{line}}"}]',false),
('ASIAN_HANDICAP','Handicap Asiático','HANDICAPS','FULL_TIME','MANUAL_SETTLE',46,true,ARRAY[-2,-1.75,-1.5,-1.25,-1,-0.75,-0.5,-0.25,0.25,0.5,0.75,1,1.25,1.5,1.75,2]::numeric[],'[{"key":"HOME","label":"Casa {{line}}"},{"key":"AWAY","label":"Visitante {{opposite_line}}"}]',false),
('TOTAL_GOALS','Total de Gols','GOALS','FULL_TIME','AUTO_SETTLE',20,true,ARRAY[0.5,1.5,2.5,3.5,4.5,5.5,6.5]::numeric[],'[{"key":"OVER","label":"Mais de {{line}}"},{"key":"UNDER","label":"Menos de {{line}}"}]',false),
('HOME_TOTAL_GOALS','Casa — Total de Gols','TEAMS','FULL_TIME','MANUAL_SETTLE',60,true,ARRAY[0.5,1.5,2.5,3.5,4.5]::numeric[],'[{"key":"OVER","label":"Mais de {{line}}"},{"key":"UNDER","label":"Menos de {{line}}"}]',false),
('AWAY_TOTAL_GOALS','Visitante — Total de Gols','TEAMS','FULL_TIME','MANUAL_SETTLE',61,true,ARRAY[0.5,1.5,2.5,3.5,4.5]::numeric[],'[{"key":"OVER","label":"Mais de {{line}}"},{"key":"UNDER","label":"Menos de {{line}}"}]',false),
('BOTH_TEAMS_SCORE','Ambas as Equipes Marcam','GOALS','FULL_TIME','MANUAL_SETTLE',30,false,'{}','[{"key":"YES","label":"Sim"},{"key":"NO","label":"Não"}]',false),
('TEAM_TO_SCORE','Qual Equipe Marca','TEAMS','FULL_TIME','MANUAL_SETTLE',62,false,'{}','[{"key":"HOME_ONLY","label":"Apenas Casa"},{"key":"AWAY_ONLY","label":"Apenas Visitante"},{"key":"BOTH","label":"Ambas"},{"key":"NONE","label":"Nenhuma"}]',false),
('FIRST_TEAM_SCORE','Primeira Equipe a Marcar','TEAMS','FULL_TIME','MANUAL_SETTLE',63,false,'{}','[{"key":"HOME","label":"Casa"},{"key":"AWAY","label":"Visitante"},{"key":"NO_GOAL","label":"Sem gol"}]',false),
('LAST_TEAM_SCORE','Última Equipe a Marcar','TEAMS','FULL_TIME','MANUAL_SETTLE',64,false,'{}','[{"key":"HOME","label":"Casa"},{"key":"AWAY","label":"Visitante"},{"key":"NO_GOAL","label":"Sem gol"}]',false),
('HOME_TO_SCORE','Casa Marca','TEAMS','FULL_TIME','MANUAL_SETTLE',65,false,'{}','[{"key":"YES","label":"Sim"},{"key":"NO","label":"Não"}]',false),
('AWAY_TO_SCORE','Visitante Marca','TEAMS','FULL_TIME','MANUAL_SETTLE',66,false,'{}','[{"key":"YES","label":"Sim"},{"key":"NO","label":"Não"}]',false),
('FIRST_HALF_RESULT','Resultado do Primeiro Tempo','FIRST_HALF','FIRST_HALF','AUTO_SETTLE',70,false,'{}','[{"key":"HOME","label":"Casa"},{"key":"DRAW","label":"Empate"},{"key":"AWAY","label":"Visitante"}]',false),
('FIRST_HALF_DOUBLE_CHANCE','Dupla Chance — Primeiro Tempo','FIRST_HALF','FIRST_HALF','MANUAL_SETTLE',71,false,'{}','[{"key":"HOME_OR_DRAW","label":"1X"},{"key":"HOME_OR_AWAY","label":"12"},{"key":"DRAW_OR_AWAY","label":"X2"}]',false),
('FIRST_HALF_TOTAL_GOALS','Total de Gols — Primeiro Tempo','FIRST_HALF','FIRST_HALF','AUTO_SETTLE',72,true,ARRAY[0.5,1.5,2.5,3.5]::numeric[],'[{"key":"OVER","label":"Mais de {{line}}"},{"key":"UNDER","label":"Menos de {{line}}"}]',false),
('FIRST_HALF_BTTS','Ambas Marcam — Primeiro Tempo','FIRST_HALF','FIRST_HALF','MANUAL_SETTLE',73,false,'{}','[{"key":"YES","label":"Sim"},{"key":"NO","label":"Não"}]',false),
('CORRECT_SCORE','Resultado Correto','SCORE','FULL_TIME','MANUAL_SETTLE',80,false,'{}','[{"key":"0_0","label":"0x0"},{"key":"1_0","label":"1x0"},{"key":"0_1","label":"0x1"},{"key":"1_1","label":"1x1"},{"key":"2_0","label":"2x0"},{"key":"0_2","label":"0x2"},{"key":"2_1","label":"2x1"},{"key":"1_2","label":"1x2"},{"key":"2_2","label":"2x2"},{"key":"3_0","label":"3x0"},{"key":"0_3","label":"0x3"},{"key":"3_1","label":"3x1"},{"key":"1_3","label":"1x3"},{"key":"3_2","label":"3x2"},{"key":"2_3","label":"2x3"},{"key":"3_3","label":"3x3"}]',false),
('FIRST_HALF_CORRECT_SCORE','Placar Exato — Primeiro Tempo','SCORE','FIRST_HALF','MANUAL_SETTLE',81,false,'{}','[{"key":"0_0","label":"0x0"},{"key":"1_0","label":"1x0"},{"key":"0_1","label":"0x1"},{"key":"1_1","label":"1x1"},{"key":"2_0","label":"2x0"},{"key":"0_2","label":"0x2"},{"key":"2_1","label":"2x1"},{"key":"1_2","label":"1x2"},{"key":"2_2","label":"2x2"}]',false),
('TOTAL_CORNERS','Total de Escanteios','CORNERS','FULL_TIME','AUTO_SETTLE',90,true,ARRAY[4.5,5.5,6.5,7.5,8.5,9.5,10.5,11.5,12.5,13.5,14.5]::numeric[],'[{"key":"OVER","label":"Mais de {{line}}"},{"key":"UNDER","label":"Menos de {{line}}"}]',false),
('HOME_CORNERS','Escanteios do Mandante','CORNERS','FULL_TIME','MANUAL_SETTLE',91,true,ARRAY[2.5,3.5,4.5,5.5,6.5]::numeric[],'[{"key":"OVER","label":"Mais de {{line}}"},{"key":"UNDER","label":"Menos de {{line}}"}]',false),
('AWAY_CORNERS','Escanteios do Visitante','CORNERS','FULL_TIME','MANUAL_SETTLE',92,true,ARRAY[2.5,3.5,4.5,5.5,6.5]::numeric[],'[{"key":"OVER","label":"Mais de {{line}}"},{"key":"UNDER","label":"Menos de {{line}}"}]',false),
('MOST_CORNERS','Mais Escanteios','CORNERS','FULL_TIME','MANUAL_SETTLE',93,false,'{}','[{"key":"HOME","label":"Casa"},{"key":"DRAW","label":"Empate"},{"key":"AWAY","label":"Visitante"}]',false),
('FIRST_HALF_CORNERS','Escanteios — Primeiro Tempo','CORNERS','FIRST_HALF','MANUAL_SETTLE',94,true,ARRAY[2.5,3.5,4.5,5.5,6.5]::numeric[],'[{"key":"OVER","label":"Mais de {{line}}"},{"key":"UNDER","label":"Menos de {{line}}"}]',false),
('FIRST_CORNER','Primeiro Escanteio','CORNERS','FULL_TIME','MANUAL_SETTLE',95,false,'{}','[{"key":"HOME","label":"Casa"},{"key":"AWAY","label":"Visitante"}]',false),
('TOTAL_CARDS','Total de Cartões','CARDS','FULL_TIME','AUTO_SETTLE',100,true,ARRAY[1.5,2.5,3.5,4.5,5.5,6.5,7.5]::numeric[],'[{"key":"OVER","label":"Mais de {{line}}"},{"key":"UNDER","label":"Menos de {{line}}"}]',false),
('HOME_CARDS','Cartões do Mandante','CARDS','FULL_TIME','MANUAL_SETTLE',101,true,ARRAY[0.5,1.5,2.5,3.5]::numeric[],'[{"key":"OVER","label":"Mais de {{line}}"},{"key":"UNDER","label":"Menos de {{line}}"}]',false),
('AWAY_CARDS','Cartões do Visitante','CARDS','FULL_TIME','MANUAL_SETTLE',102,true,ARRAY[0.5,1.5,2.5,3.5]::numeric[],'[{"key":"OVER","label":"Mais de {{line}}"},{"key":"UNDER","label":"Menos de {{line}}"}]',false),
('MOST_CARDS','Mais Cartões','CARDS','FULL_TIME','MANUAL_SETTLE',103,false,'{}','[{"key":"HOME","label":"Casa"},{"key":"DRAW","label":"Empate"},{"key":"AWAY","label":"Visitante"}]',false),
('PLAYER_TO_SCORE','Jogador para Marcar','PLAYERS','FULL_TIME','MANUAL_SETTLE',110,false,'{}','[]',true),
('FIRST_SCORER','Primeiro Marcador','PLAYERS','FULL_TIME','MANUAL_SETTLE',111,false,'{}','[]',true),
('LAST_SCORER','Último Marcador','PLAYERS','FULL_TIME','MANUAL_SETTLE',112,false,'{}','[]',true),
('PLAYER_TWO_GOALS','Jogador 2+ Gols','PLAYERS','FULL_TIME','MANUAL_SETTLE',113,false,'{}','[]',true),
('PLAYER_CARD','Jogador Receber Cartão','PLAYERS','FULL_TIME','MANUAL_SETTLE',114,false,'{}','[]',true),
('PLAYER_SHOTS','Finalizações do Jogador','PLAYERS','FULL_TIME','MANUAL_SETTLE',115,true,ARRAY[0.5,1.5,2.5,3.5]::numeric[],'[]',true),
('PLAYER_SHOTS_ON_TARGET','Finalizações no Alvo','PLAYERS','FULL_TIME','MANUAL_SETTLE',116,true,ARRAY[0.5,1.5,2.5,3.5]::numeric[],'[]',true),
('PLAYER_ASSIST','Jogador Dar Assistência','PLAYERS','FULL_TIME','MANUAL_SETTLE',117,false,'{}','[]',true),
('COMBINED_RESULT','Mercado Combinado','COMBINATIONS','FULL_TIME','MANUAL_SETTLE',120,false,'{}','[{"key":"HOME_OVER_1_5","label":"Casa + Over 1.5"},{"key":"HOME_OVER_2_5","label":"Casa + Over 2.5"},{"key":"HOME_BTTS","label":"Casa + Ambas Marcam"},{"key":"DRAW_UNDER_2_5","label":"Empate + Under 2.5"},{"key":"AWAY_OVER_2_5","label":"Visitante + Over 2.5"},{"key":"DC_OVER_1_5","label":"Dupla Chance + Over 1.5"}]',false)
ON CONFLICT (code) DO UPDATE SET
  name=excluded.name, category=excluded.category, period=excluded.period,
  settlement_mode=excluded.settlement_mode, sort_order=excluded.sort_order,
  line_required=excluded.line_required, default_lines=excluded.default_lines,
  selection_blueprint=excluded.selection_blueprint, requires_players=excluded.requires_players,
  active=true, updated_at=now();

-- Keep the established catalog table complete for reporting and compatibility.
INSERT INTO public.market_types (code,name,category,settlement_type,period,active)
SELECT code,name,category,settlement_mode,period,true FROM public.market_catalog_templates
ON CONFLICT (code) DO UPDATE SET name=excluded.name,category=excluded.category,
  settlement_type=excluded.settlement_type,period=excluded.period,active=true,updated_at=now();

CREATE OR REPLACE FUNCTION public.add_fixture_market_from_template(
  p_fixture_id bigint, p_template_code text, p_line numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_fixture public.fixtures%ROWTYPE;
  v_template public.market_catalog_templates%ROWTYPE;
  v_market_id uuid;
  v_selection jsonb;
  v_label text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_fixture FROM public.fixtures WHERE provider_fixture_id=p_fixture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FIXTURE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_fixture.kickoff_at<=now() OR v_fixture.status<>'NS' THEN RAISE EXCEPTION 'FIXTURE_NOT_ELIGIBLE' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_template FROM public.market_catalog_templates WHERE code=p_template_code AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEMPLATE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_template.requires_players THEN RAISE EXCEPTION 'PLAYERS_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF v_template.line_required AND p_line IS NULL THEN RAISE EXCEPTION 'LINE_REQUIRED' USING ERRCODE='22023'; END IF;

  SELECT id INTO v_market_id FROM public.fixture_markets
   WHERE fixture_id=p_fixture_id AND market_type=p_template_code AND line IS NOT DISTINCT FROM p_line LIMIT 1;
  IF v_market_id IS NULL THEN
    INSERT INTO public.fixture_markets
      (fixture_id,competition_code,market_type,market_name,market_group,line,period,status,kickoff_at,home_team,away_team,metadata,sort_order,settlement_mode)
    VALUES (p_fixture_id,v_fixture.competition_code,v_template.code,v_template.name,v_template.category,p_line,v_template.period,'DRAFT',v_fixture.kickoff_at,v_fixture.home_team_name,v_fixture.away_team_name,
      jsonb_build_object('template_code',v_template.code),v_template.sort_order,v_template.settlement_mode)
    RETURNING id INTO v_market_id;
  END IF;

  FOR v_selection IN SELECT value FROM jsonb_array_elements(v_template.selection_blueprint)
  LOOP
    v_label := replace(v_selection->>'label','{{line}}',coalesce(p_line::text,''));
    v_label := replace(v_label,'{{opposite_line}}',coalesce((-p_line)::text,''));
    INSERT INTO public.fixture_market_selections (market_id,selection_key,selection_name,odd,status,sort_order,metadata)
    VALUES (v_market_id,v_selection->>'key',v_label,NULL,'DRAFT',
      coalesce((v_selection->>'sort_order')::integer,(SELECT count(*) FROM public.fixture_market_selections WHERE market_id=v_market_id)),
      jsonb_build_object('line',p_line,'template_code',v_template.code))
    ON CONFLICT (market_id,selection_key) DO NOTHING;
  END LOOP;
  RETURN jsonb_build_object('success',true,'market_id',v_market_id,'status','DRAFT');
END; $$;

CREATE OR REPLACE FUNCTION public.prepare_fixture_markets(p_fixture_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE='42501'; END IF;
  PERFORM public.add_fixture_market_from_template(p_fixture_id,'MATCH_RESULT',NULL);
  PERFORM public.add_fixture_market_from_template(p_fixture_id,'TOTAL_GOALS',2.5);
  PERFORM public.add_fixture_market_from_template(p_fixture_id,'BOTH_TEAMS_SCORE',NULL);
  PERFORM public.add_fixture_market_from_template(p_fixture_id,'DOUBLE_CHANCE',NULL);
  PERFORM public.add_fixture_market_from_template(p_fixture_id,'FIRST_HALF_RESULT',NULL);
  RETURN jsonb_build_object('success',true,'fixture_id',p_fixture_id,'market_count',(SELECT count(*) FROM public.fixture_markets WHERE fixture_id=p_fixture_id));
END; $$;

REVOKE ALL ON FUNCTION public.add_fixture_market_from_template(bigint,text,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_fixture_market_from_template(bigint,text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_fixture_markets(bigint) TO authenticated;
