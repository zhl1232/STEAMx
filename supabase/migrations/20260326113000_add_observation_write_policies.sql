-- ============================================
-- Observation 写入策略
-- 允许认证用户写入/更新/删除自己的观察记录
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_events'
           AND policyname = 'observation_events_select_own'
    ) THEN
        CREATE POLICY observation_events_select_own
            ON public.observation_events
            FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_events'
           AND policyname = 'observation_events_insert_own'
    ) THEN
        CREATE POLICY observation_events_insert_own
            ON public.observation_events
            FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_events'
           AND policyname = 'observation_events_update_own'
    ) THEN
        CREATE POLICY observation_events_update_own
            ON public.observation_events
            FOR UPDATE
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_events'
           AND policyname = 'observation_events_delete_own'
    ) THEN
        CREATE POLICY observation_events_delete_own
            ON public.observation_events
            FOR DELETE
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_event_species'
           AND policyname = 'observation_event_species_select_own'
    ) THEN
        CREATE POLICY observation_event_species_select_own
            ON public.observation_event_species
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1
                      FROM public.observation_events oe
                     WHERE oe.id = observation_event_id
                       AND oe.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_event_species'
           AND policyname = 'observation_event_species_insert_own'
    ) THEN
        CREATE POLICY observation_event_species_insert_own
            ON public.observation_event_species
            FOR INSERT
            TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1
                      FROM public.observation_events oe
                     WHERE oe.id = observation_event_id
                       AND oe.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_event_species'
           AND policyname = 'observation_event_species_update_own'
    ) THEN
        CREATE POLICY observation_event_species_update_own
            ON public.observation_event_species
            FOR UPDATE
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1
                      FROM public.observation_events oe
                     WHERE oe.id = observation_event_id
                       AND oe.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1
                      FROM public.observation_events oe
                     WHERE oe.id = observation_event_id
                       AND oe.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_event_species'
           AND policyname = 'observation_event_species_delete_own'
    ) THEN
        CREATE POLICY observation_event_species_delete_own
            ON public.observation_event_species
            FOR DELETE
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1
                      FROM public.observation_events oe
                     WHERE oe.id = observation_event_id
                       AND oe.user_id = auth.uid()
                )
            );
    END IF;
END $$;
