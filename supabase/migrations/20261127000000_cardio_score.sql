-- Racket sports and volleyball: each set's score from a live session, e.g. "6-4, 3-6, 2-1".
alter table public.cardio_logs add column if not exists score text;
alter table public.cardio_logs drop constraint if exists cardio_logs_score_ok;
alter table public.cardio_logs add constraint cardio_logs_score_ok check (score is null or char_length(score) <= 120);
