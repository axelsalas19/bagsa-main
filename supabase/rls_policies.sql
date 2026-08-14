-- =====================================================================
--  RLS + Supabase Auth para el Geoportal BAGSA
--  Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- =====================================================================

-- 1) Habilitar RLS en TODAS las tablas utilizadas por el geoportal.
--    Las vistas NO soportan RLS directo en Postgres 14, pero se configuran
--    con security_invoker = true para que apliquen las políticas de las
--    tablas base (lectura pública, escritura solo autenticados).
DO $$
DECLARE
    obj RECORD;
BEGIN
    FOR obj IN
        SELECT c.relname, c.relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN (
              'municipios', 'localidades', 'suministros', 'parcelas',
              'calles', 'red_de_gas', 'v_suministros_activos'
          )
    LOOP
        IF obj.relkind IN ('v', 'm') THEN
            EXECUTE format('ALTER VIEW %I SET (security_invoker = true)', obj.relname);
        ELSE
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', obj.relname);
        END IF;
    END LOOP;
END $$;

-- 2) Políticas sobre TABLAS (las vistas heredan vía security_invoker):
--      - Lectura pública (anon + authenticated).
--      - Escritura (UPDATE/INSERT) SOLO para usuarios autenticados en suministros.
DO $$
DECLARE
    obj RECORD;
BEGIN
    FOR obj IN
        SELECT c.relname, c.relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p', 'f')   -- solo tablas reales
          AND c.relname IN (
              'municipios', 'localidades', 'suministros', 'parcelas',
              'calles', 'red_de_gas'
          )
    LOOP
        -- Lectura pública (todo el mundo puede ver el mapa)
        EXECUTE format('DROP POLICY IF EXISTS "geoportal_lectura_publica" ON %I', obj.relname);
        EXECUTE format(
            'CREATE POLICY "geoportal_lectura_publica" ON %I FOR SELECT TO public USING (true)',
            obj.relname
        );

        -- Escritura solo para usuarios con sesión iniciada (suministros)
        IF obj.relname = 'suministros' THEN
            EXECUTE format('DROP POLICY IF EXISTS "geoportal_edicion_autenticados" ON %I', obj.relname);
            EXECUTE format(
                'CREATE POLICY "geoportal_edicion_autenticados" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
                obj.relname
            );
            EXECUTE format('DROP POLICY IF EXISTS "geoportal_insercion_autenticados" ON %I', obj.relname);
            EXECUTE format(
                'CREATE POLICY "geoportal_insercion_autenticados" ON %I FOR INSERT TO authenticated WITH CHECK (true)',
                obj.relname
            );
        END IF;
    END LOOP;
END $$;

-- 3) Asegurar permisos de lectura para los roles del cliente (mapa público)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- 4) Las funciones RPC de lectura se ejecutan con privilegios del definer
--    (postgres) para que sigan devolviendo geometrías con RLS activo.
DO $$
DECLARE
    fn RECORD;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure::text AS signature
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'get_streets_by_localidad',
              'get_gas_network_by_localidad',
              'get_parcelas_by_localidad'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', fn.signature);
    END LOOP;
END $$;
