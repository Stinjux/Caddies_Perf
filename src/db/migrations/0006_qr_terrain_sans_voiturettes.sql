-- CHANGEMENT DE MODELE : UN QR PAR TERRAIN, PLUS DE VOITURETTES.
--
-- Le client ne scanne plus la voiturette qui lui a ete attribuee : il scanne
-- un QR unique, affiche au depart, et choisit son caddie dans une liste.
--
-- CE QUE CELA COUTE, ecrit ici pour que personne ne le redecouvre plus tard :
-- l'evaluation n'est plus rattachee a une partie precise. Il n'existe donc
-- plus de denominateur — ni jours travailles, ni taux de reponse, ni limite
-- de quatre reponses par partie. Le seuil de pertinence de cinq evaluations
-- devient le seul garde-fou statistique.
--
-- Compatible PostgreSQL 14 et versions ulterieures.

-- ---------------------------------------------------------------------------
-- 1. Le QR appartient desormais au TERRAIN
-- ---------------------------------------------------------------------------
-- Opaque et permanent, comme l'etait celui des voiturettes : il ne contient
-- ni nom, ni reservation, ni aucune donnee personnelle.

ALTER TABLE golf_course ADD COLUMN IF NOT EXISTS qr_token text;

-- sha256() est disponible en standard depuis PostgreSQL 11 ; gen_random_bytes
-- exige l'extension pgcrypto, qu'on ne peut pas supposer installee chez un
-- hebergeur. Le resultat est traduit en base64url : le jeton voyage dans une
-- adresse, ou « + » et « / » seraient a echapper.
UPDATE golf_course
SET qr_token = replace(
      translate(encode(sha256((random()::text || clock_timestamp()::text)::bytea), 'base64'),
                '+/', '-_'),
      '=', '')
WHERE qr_token IS NULL;

ALTER TABLE golf_course ALTER COLUMN qr_token SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_golf_course_qr_token') THEN
    ALTER TABLE golf_course ADD CONSTRAINT uq_golf_course_qr_token UNIQUE (qr_token);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. L'evaluation vise le CADDIE, non l'affectation
-- ---------------------------------------------------------------------------

ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS caddie_id uuid;

-- Report de l'historique AVANT de perdre le chemin qui y menait.
UPDATE evaluation e
SET caddie_id = a.caddie_id
FROM assignment a
WHERE e.assignment_id = a.id AND e.caddie_id IS NULL;

-- Une evaluation orpheline n'a plus de sujet : elle fausserait toute moyenne.
DELETE FROM evaluation_criterion_answer
WHERE evaluation_id IN (SELECT id FROM evaluation WHERE caddie_id IS NULL);
DELETE FROM google_review_click
WHERE evaluation_id IN (SELECT id FROM evaluation WHERE caddie_id IS NULL);
DELETE FROM evaluation WHERE caddie_id IS NULL;

ALTER TABLE evaluation ALTER COLUMN caddie_id SET NOT NULL;

ALTER TABLE evaluation DROP CONSTRAINT IF EXISTS fk_evaluation_assignment_same_course;
ALTER TABLE evaluation DROP COLUMN IF EXISTS assignment_id;

-- CLE ETRANGERE COMPOSITE : PostgreSQL refuse lui-meme qu'une evaluation
-- designe un caddie d'un autre terrain. Le cloisonnement ne depend pas du
-- code applicatif (FR-023).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_evaluation_caddie_same_course') THEN
    ALTER TABLE evaluation
      ADD CONSTRAINT fk_evaluation_caddie_same_course
      FOREIGN KEY (golf_course_id, caddie_id)
      REFERENCES caddie (golf_course_id, id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_evaluation_caddie ON evaluation (caddie_id, submitted_at);

-- ---------------------------------------------------------------------------
-- 3. Disparition des voiturettes, affectations et reservations
-- ---------------------------------------------------------------------------
-- « Ce n'est pas mon caddie » perd son objet : c'est desormais le client qui
-- choisit. L'ordre suit les dependances.

DROP TABLE IF EXISTS wrong_caddie_report;
DROP TABLE IF EXISTS assignment;
DROP TABLE IF EXISTS booking;
DROP TABLE IF EXISTS cart;

-- ---------------------------------------------------------------------------
-- 4. Le role Starter n'a plus de fonction
-- ---------------------------------------------------------------------------
-- Son seul travail etait d'associer caddie, voiturette et reservation.
--
-- La VALEUR de l'enumeration est conservee : la retirer exige de recreer le
-- type, donc de demonter puis remonter la colonne, ses index et ses
-- politiques — un risque sans contrepartie. Aucun rattachement ne la porte
-- plus, et un test le verifie.

DELETE FROM account_golf_course WHERE role = 'starter';

-- ---------------------------------------------------------------------------
-- 5. Droits du role applicatif sur ce qui subsiste
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO caddieperf_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_log FROM caddieperf_app;
