-- 0008: document that attempts.deal_id stores the engine *situation_id*, not a
-- deal identifier. Assignment progress joins on deal_id = assignment.situation
-- (see 0005). Kept as-is to avoid a rename across the RPCs and UI; this column
-- comment records the intent for the next reader.

comment on column public.attempts.deal_id is
  'Engine situation_id (NOT a deal id). Assignment progress joins deal_id = situation. Name kept for historical reasons.';
