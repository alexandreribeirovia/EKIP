-- ============================================================================
-- Migration: Fix timesheet_detail_report function
-- Date: 2026-02-16
-- Description: 
--   Recria a function timesheet_detail_report com JOIN correto na tabela
--   `employees` (anteriormente `users`, renomeada na migração 001).
--   Corrige o erro: "column u.user_id does not exist"
--
-- Uso: Aplicar via Supabase Dashboard > SQL Editor
-- ============================================================================

DROP FUNCTION IF EXISTS timesheet_detail_report(date, date, text[], text);

CREATE OR REPLACE FUNCTION timesheet_detail_report(
  p_start_date date,
  p_end_date date,
  p_user_ids text[] DEFAULT NULL,
  p_status text DEFAULT 'active'
)
RETURNS TABLE (
  out_user_id text,
  out_user_name text,
  out_expected_hours numeric,
  out_worked_hours numeric,
  out_expected_hours_until_yesterday numeric,
  out_overtime_hours_in_period numeric,
  out_positive_comp_hours_in_period numeric,
  out_negative_comp_hours_in_period numeric,
  out_total_positive_comp_hours numeric,
  out_total_negative_comp_hours numeric,
  out_time_balance numeric,
  out_daily_details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  day_rec RECORD;
  v_expected numeric;
  v_worked numeric;
  v_day_expected numeric;
  v_day_worked numeric;
  v_comp_positive numeric;
  v_comp_negative numeric;
  v_daily_details jsonb;
  v_expected_until_yesterday numeric;
  v_overtime numeric;
  v_positive_comp_period numeric;
  v_negative_comp_period numeric;
  v_total_positive_comp numeric;
  v_total_negative_comp numeric;
  v_yesterday date;
  v_day_name text;
  v_is_weekend boolean;
  v_is_off_day boolean;
BEGIN
  -- "Ontem" para cálculo de expected_hours_until_yesterday
  v_yesterday := CURRENT_DATE - INTERVAL '1 day';

  -- Iterar sobre cada employee que lança horas
  FOR rec IN
    SELECT e.user_id, e.name
    FROM employees e
    WHERE e.log_hours = true
      AND (
        p_status = 'all'
        OR (p_status = 'active' AND e.is_active = true)
        OR (p_status = 'inactive' AND e.is_active = false)
      )
      AND (
        p_user_ids IS NULL
        OR e.user_id = ANY(p_user_ids)
      )
    ORDER BY e.name
  LOOP
    v_expected := 0;
    v_worked := 0;
    v_expected_until_yesterday := 0;
    v_overtime := 0;
    v_positive_comp_period := 0;
    v_negative_comp_period := 0;
    v_total_positive_comp := 0;
    v_total_negative_comp := 0;
    v_daily_details := '[]'::jsonb;

    -- Gerar série de dias no período e calcular por dia
    FOR day_rec IN
      SELECT d::date AS day_date
      FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d
    LOOP
      -- Verificar se é fim de semana (0=domingo, 6=sábado)
      v_is_weekend := EXTRACT(DOW FROM day_rec.day_date) IN (0, 6);

      -- Verificar se é feriado/off_day
      SELECT EXISTS(
        SELECT 1 FROM off_days WHERE day = day_rec.day_date
      ) INTO v_is_off_day;

      -- Horas esperadas: 8h em dias úteis, 0 em fins de semana e feriados
      IF v_is_weekend OR v_is_off_day THEN
        v_day_expected := 0;
      ELSE
        v_day_expected := 8;
      END IF;

      -- Horas trabalhadas neste dia (time está em segundos)
      SELECT COALESCE(SUM(tw.time), 0) / 3600.0
      INTO v_day_worked
      FROM time_worked tw
      WHERE tw.user_id = rec.user_id
        AND tw.time_worked_date = day_rec.day_date;

      -- Compensação do dia
      v_comp_positive := 0;
      v_comp_negative := 0;

      IF v_day_expected > 0 THEN
        IF v_day_worked > v_day_expected THEN
          v_comp_positive := v_day_worked - v_day_expected;
        ELSIF v_day_worked < v_day_expected THEN
          v_comp_negative := v_day_expected - v_day_worked;
        END IF;
      ELSE
        -- Fim de semana ou feriado: toda hora trabalhada é extra/positiva
        IF v_day_worked > 0 THEN
          v_comp_positive := v_day_worked;
        END IF;
      END IF;

      -- Nome do dia da semana em português
      v_day_name := CASE EXTRACT(DOW FROM day_rec.day_date)
        WHEN 0 THEN 'Dom'
        WHEN 1 THEN 'Seg'
        WHEN 2 THEN 'Ter'
        WHEN 3 THEN 'Qua'
        WHEN 4 THEN 'Qui'
        WHEN 5 THEN 'Sex'
        WHEN 6 THEN 'Sáb'
      END;

      -- Acumular totais
      v_expected := v_expected + v_day_expected;
      v_worked := v_worked + v_day_worked;
      v_positive_comp_period := v_positive_comp_period + v_comp_positive;
      v_negative_comp_period := v_negative_comp_period + v_comp_negative;

      -- Expected until yesterday (para cálculo de % no mês atual)
      IF day_rec.day_date <= v_yesterday THEN
        v_expected_until_yesterday := v_expected_until_yesterday + v_day_expected;
      END IF;

      -- Adicionar dia ao array de detalhes
      v_daily_details := v_daily_details || jsonb_build_array(
        jsonb_build_object(
          'date', day_rec.day_date,
          'day_of_week', v_day_name,
          'expected_hours', ROUND(v_day_expected, 2),
          'worked_hours', ROUND(v_day_worked, 2),
          'comp_positive', ROUND(v_comp_positive, 2),
          'comp_negative', ROUND(v_comp_negative, 2),
          'is_insufficient', (v_day_expected > 0 AND v_day_worked < v_day_expected),
          'is_moresufficient', (v_day_worked > v_day_expected)
        )
      );
    END LOOP;

    -- Horas extras no período (worked > expected global)
    IF v_worked > v_expected THEN
      v_overtime := v_worked - v_expected;
    ELSE
      v_overtime := 0;
    END IF;

    -- ============================================================
    -- Compensação TOTAL (acumulada desde o início - todas as datas)
    -- ============================================================
    SELECT
      COALESCE(SUM(CASE
        WHEN NOT (EXTRACT(DOW FROM tw.time_worked_date) IN (0, 6))
             AND NOT EXISTS (SELECT 1 FROM off_days od WHERE od.day = tw.time_worked_date)
        THEN GREATEST(tw_day.day_worked - 8, 0)
        ELSE tw_day.day_worked  -- fim de semana/feriado = tudo é extra
      END), 0),
      COALESCE(SUM(CASE
        WHEN NOT (EXTRACT(DOW FROM tw.time_worked_date) IN (0, 6))
             AND NOT EXISTS (SELECT 1 FROM off_days od WHERE od.day = tw.time_worked_date)
        THEN GREATEST(8 - tw_day.day_worked, 0)
        ELSE 0
      END), 0)
    INTO v_total_positive_comp, v_total_negative_comp
    FROM (
      SELECT
        tw2.time_worked_date,
        SUM(tw2.time) / 3600.0 AS day_worked
      FROM time_worked tw2
      WHERE tw2.user_id = rec.user_id
      GROUP BY tw2.time_worked_date
    ) tw_day
    JOIN time_worked tw ON tw.time_worked_date = tw_day.time_worked_date AND tw.user_id = rec.user_id
    WHERE true
    GROUP BY ();  -- agregação única

    -- Retornar linha para este employee
    out_user_id := rec.user_id;
    out_user_name := rec.name;
    out_expected_hours := ROUND(v_expected, 2);
    out_worked_hours := ROUND(v_worked, 2);
    out_expected_hours_until_yesterday := ROUND(v_expected_until_yesterday, 2);
    out_overtime_hours_in_period := ROUND(v_overtime, 2);
    out_positive_comp_hours_in_period := ROUND(v_positive_comp_period, 2);
    out_negative_comp_hours_in_period := ROUND(v_negative_comp_period, 2);
    out_total_positive_comp_hours := ROUND(v_total_positive_comp, 2);
    out_total_negative_comp_hours := ROUND(v_total_negative_comp, 2);
    out_time_balance := ROUND(v_total_positive_comp - v_total_negative_comp, 2);
    out_daily_details := v_daily_details;

    RETURN NEXT;
  END LOOP;
END;
$$;

-- Conceder permissão de execução
GRANT EXECUTE ON FUNCTION timesheet_detail_report(date, date, text[], text) TO anon, authenticated, service_role;

-- Comentário
COMMENT ON FUNCTION timesheet_detail_report IS 'Relatório de lançamento de horas por consultor com detalhamento diário. Vincula com tabela employees (não mais users). Corrigido em 2026-02-16.';
