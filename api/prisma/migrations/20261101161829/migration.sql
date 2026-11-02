CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent não é IMMUTABLE, e coluna gerada exige isso
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

ALTER TABLE document_chunks
  ADD COLUMN content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', immutable_unaccent(content))) STORED;

CREATE INDEX document_chunks_tsv_idx
  ON document_chunks USING gin (content_tsv);