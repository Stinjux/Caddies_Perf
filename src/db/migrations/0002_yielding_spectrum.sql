-- Consolide dans 0000 : la contrainte UNIQUE doit preceder la cle etrangere
-- composite de "evaluation" qui la reference. Conserve ici pour que le journal
-- de migration reste coherent, et rendu idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_assignment_course_id'
  ) THEN
    ALTER TABLE "assignment"
      ADD CONSTRAINT "uq_assignment_course_id" UNIQUE("golf_course_id","id");
  END IF;
END
$$;
