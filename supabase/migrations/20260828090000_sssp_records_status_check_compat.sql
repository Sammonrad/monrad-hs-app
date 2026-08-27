-- Widen sssp_records.status CHECK so hybrid live DBs accept both:
--   - legacy dump Title Case values (Draft, Ready for Review, …)
--   - frontend snake_case values (draft, ready_for_review, …, archived)
-- Does NOT drop NOT NULL constraints or rename columns.

ALTER TABLE public.sssp_records
  DROP CONSTRAINT IF EXISTS sssp_records_status_check;

ALTER TABLE public.sssp_records
  ADD CONSTRAINT sssp_records_status_check CHECK (
    status = ANY (
      ARRAY[
        'Draft'::text,
        'Ready for Review'::text,
        'Approved'::text,
        'Submitted'::text,
        'Closed'::text,
        'Archived'::text,
        'draft'::text,
        'ready_for_review'::text,
        'approved'::text,
        'submitted'::text,
        'closed'::text,
        'archived'::text
      ]
    )
  );
