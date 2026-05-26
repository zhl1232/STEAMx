#!/usr/bin/env node
/**
 * Render insect.json into a Supabase migration that UPSERTs the species
 * rows, mirroring 20260513110000_import_tree_species.sql.
 *
 * Usage:
 *   node scripts/build-insect-migration.mjs > supabase/migrations/<ts>_import_insect_species.sql
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INPUT = path.join(ROOT, "insect.json");

const raw = await fs.readFile(INPUT, "utf8");
const items = JSON.parse(raw);

if (!Array.isArray(items) || items.length === 0) {
  throw new Error("insect.json is empty or not an array");
}

const payload = JSON.stringify(items);
if (payload.includes("$insects$")) {
  throw new Error("payload contains dollar-quote delimiter $insects$");
}

const sql = `-- ============================================
-- 从 insect.json 同步昆虫物种到自然观察数据层
-- ============================================

WITH source AS (
  SELECT *
  FROM jsonb_to_recordset($insects$${payload}$insects$::jsonb) AS item(
    slug TEXT,
    common_name TEXT,
    scientific_name TEXT,
    aliases TEXT[],
    taxon_group TEXT,
    identification_notes TEXT,
    habitat_notes TEXT,
    seasonality_notes TEXT,
    cover_image_url TEXT,
    is_active BOOLEAN
  )
),
sanitized_source AS (
  SELECT
    slug,
    common_name,
    NULLIF(scientific_name, '') AS scientific_name,
    COALESCE(aliases, ARRAY[]::TEXT[]) AS aliases,
    NULLIF(taxon_group, '') AS taxon_group,
    'insects'::TEXT AS nature_topic,
    NULLIF(identification_notes, '') AS identification_notes,
    NULLIF(habitat_notes, '') AS habitat_notes,
    NULLIF(seasonality_notes, '') AS seasonality_notes,
    NULLIF(cover_image_url, '') AS cover_image_url,
    COALESCE(is_active, TRUE) AS is_active
  FROM source
),
updated_species AS (
  UPDATE public.species AS target
     SET common_name = src.common_name,
         scientific_name = src.scientific_name,
         aliases = src.aliases,
         taxon_group = src.taxon_group,
         nature_topic = src.nature_topic,
         identification_notes = src.identification_notes,
         habitat_notes = src.habitat_notes,
         seasonality_notes = src.seasonality_notes,
         cover_image_url = COALESCE(src.cover_image_url, target.cover_image_url),
         is_active = src.is_active,
         updated_at = now()
    FROM sanitized_source AS src
   WHERE target.slug = src.slug
      OR (target.scientific_name IS NOT NULL AND target.scientific_name = src.scientific_name)
  RETURNING target.id
)
INSERT INTO public.species (
  slug,
  common_name,
  scientific_name,
  aliases,
  taxon_group,
  nature_topic,
  identification_notes,
  habitat_notes,
  seasonality_notes,
  cover_image_url,
  is_active
)
SELECT
  src.slug,
  src.common_name,
  src.scientific_name,
  src.aliases,
  src.taxon_group,
  src.nature_topic,
  src.identification_notes,
  src.habitat_notes,
  src.seasonality_notes,
  src.cover_image_url,
  src.is_active
FROM sanitized_source AS src
WHERE NOT EXISTS (
  SELECT 1
  FROM public.species AS target
  WHERE target.slug = src.slug
     OR (target.scientific_name IS NOT NULL AND target.scientific_name = src.scientific_name)
);
`;

process.stdout.write(sql);
