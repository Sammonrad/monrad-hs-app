-- Additive only: ensure sssp_records has every column the frontend mapSsspToRow writes.
-- Does NOT drop/rename columns, rewrite data, or change RLS policies.
-- Safe to re-run (IF NOT EXISTS). Apply in Supabase SQL editor or via migration runner.
--
-- Confirmed live failure: PostgREST "Could not find the 'approved_by' column of 'sssp_records'".
-- This migration also adds any other client columns that may be missing on partially aligned DBs.

ALTER TABLE public.sssp_records
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS record_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS project text,
  ADD COLUMN IF NOT EXISTS client text,
  ADD COLUMN IF NOT EXISTS principal_contractor text,
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS contract_ref text,
  ADD COLUMN IF NOT EXISTS revision integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prepared_by text,
  ADD COLUMN IF NOT EXISTS prepared_by_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS review_date date,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_by_name text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- Helpful indexes (idempotent). Prefer new column names used by the app.
CREATE INDEX IF NOT EXISTS sssp_records_user_id_idx
  ON public.sssp_records (user_id);

CREATE INDEX IF NOT EXISTS sssp_records_project_text_idx
  ON public.sssp_records (project);

CREATE INDEX IF NOT EXISTS sssp_records_updated_at_desc_idx
  ON public.sssp_records (updated_at DESC);

-- Optional: hazard columns the frontend syncHazards path writes (additive only).
-- Soft-archive remains in hazard_data JSON; do not require a DB archived column.
ALTER TABLE public.sssp_hazards
  ADD COLUMN IF NOT EXISTS hazard_index integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hazard_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS activity text,
  ADD COLUMN IF NOT EXISTS hazard text,
  ADD COLUMN IF NOT EXISTS initial_risk integer,
  ADD COLUMN IF NOT EXISTS residual_risk integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE INDEX IF NOT EXISTS sssp_hazards_sssp_id_hazard_index_idx
  ON public.sssp_hazards (sssp_id, hazard_index);

-- Optional: acknowledgement columns used by saveSsspAcknowledgement (additive only).
ALTER TABLE public.sssp_acknowledgements
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revision integer,
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS sssp_ack_sssp_user_revision_idx
  ON public.sssp_acknowledgements (sssp_id, user_id, revision);
