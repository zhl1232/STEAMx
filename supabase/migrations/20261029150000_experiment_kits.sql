CREATE TABLE public.experiment_kits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
 name text NOT NULL, kind text NOT NULL CHECK(kind IN ('material_pack','general_materials')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),edit_version integer NOT NULL DEFAULT 1 CHECK(edit_version>0),status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 cover_url text,gallery_urls text[] NOT NULL DEFAULT '{}',materials jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(materials)='array'),
 catalog jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(catalog)='array'),preparation_note text NOT NULL DEFAULT '',
 source_evidence jsonb NOT NULL DEFAULT '{}',sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE public.experiment_kit_projects (
 kit_id uuid NOT NULL REFERENCES public.experiment_kits(id) ON DELETE CASCADE,
 project_id bigint NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','confirmed','excluded')),
 preparation_status text NOT NULL DEFAULT 'unknown' CHECK(preparation_status IN ('unknown','ready','extras')),
 extras jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(extras)='array'),evidence jsonb NOT NULL DEFAULT '{}',
 project_hash text,kit_revision integer NOT NULL,sort_order integer NOT NULL DEFAULT 0,
 PRIMARY KEY(kit_id,project_id),CHECK(status<>'confirmed' OR (project_hash IS NOT NULL AND evidence<>'{}'::jsonb)),
 CHECK(preparation_status<>'extras' OR jsonb_array_length(extras)>0)
);
CREATE INDEX experiment_kit_projects_project_idx ON public.experiment_kit_projects(project_id);
CREATE TABLE public.store_variant_kits (
 variant_id uuid PRIMARY KEY REFERENCES public.store_product_variants(id) ON DELETE CASCADE,
 kit_id uuid NOT NULL REFERENCES public.experiment_kits(id) ON DELETE RESTRICT,
 kit_revision integer NOT NULL,verified boolean NOT NULL DEFAULT false,evidence jsonb NOT NULL DEFAULT '{}',
 CHECK(NOT verified OR evidence<>'{}'::jsonb)
);
CREATE INDEX store_variant_kits_kit_idx ON public.store_variant_kits(kit_id);
ALTER TABLE public.experiment_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_kit_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_variant_kits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.experiment_kits,public.experiment_kit_projects,public.store_variant_kits FROM anon,authenticated;
GRANT ALL ON public.experiment_kits,public.experiment_kit_projects,public.store_variant_kits TO service_role;
CREATE FUNCTION public.bump_experiment_kit_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 NEW.edit_version:=OLD.edit_version+1;
 IF (NEW.name,NEW.kind,NEW.materials,NEW.catalog,NEW.preparation_note,NEW.gallery_urls,NEW.cover_url,NEW.source_evidence)
 IS DISTINCT FROM (OLD.name,OLD.kind,OLD.materials,OLD.catalog,OLD.preparation_note,OLD.gallery_urls,OLD.cover_url,OLD.source_evidence)
 THEN NEW.revision:=OLD.revision+1; ELSE NEW.revision:=OLD.revision; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER experiment_kit_revision BEFORE UPDATE ON public.experiment_kits FOR EACH ROW EXECUTE FUNCTION public.bump_experiment_kit_revision();
