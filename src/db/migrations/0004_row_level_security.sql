-- FR-023b — CLOISONNEMENT PAR TERRAIN GARANTI PAR POSTGRESQL.
--
-- Troisieme barriere, apres les cles etrangeres composites et le type Scope :
-- ici, c'est le moteur qui refuse de RENDRE une ligne d'un autre terrain,
-- meme si la requete applicative a oublie sa clause WHERE.
--
-- POINT CAPITAL : un SUPERUTILISATEUR contourne toujours le RLS, en silence.
-- L'application doit donc se connecter avec le role caddieperf_app, qui n'est
-- ni superutilisateur ni proprietaire des tables. Sans cela, tout ce fichier
-- est decoratif. Le test tests/integration/isolation/rls.test.ts s'en assure
-- en se connectant explicitement avec ce role.
--
-- Compatible PostgreSQL 14 et versions ulterieures.

-- ---------------------------------------------------------------------------
-- Le terrain de la requete en cours
-- ---------------------------------------------------------------------------
-- Positionne par withScope() au debut de chaque transaction applicative.
-- `true` en second argument : ne leve pas d'erreur si le reglage est absent.
-- Absent => NULL => toutes les comparaisons sont fausses => rien ne sort.

CREATE OR REPLACE FUNCTION app_current_course() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.golf_course_id', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Le role applicatif peut se connecter
-- ---------------------------------------------------------------------------
-- Le MOT DE PASSE n'est deliberement pas ici : ce fichier est dans Git.
-- Il se pose une fois, hors du depot :
--   ALTER ROLE caddieperf_app WITH PASSWORD '<secret>';

ALTER ROLE caddieperf_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO caddieperf_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO caddieperf_app;
GRANT EXECUTE ON FUNCTION app_current_course() TO caddieperf_app;

-- Le journal reste en ecriture seule (FR-038), y compris sous RLS.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_log FROM caddieperf_app;
GRANT SELECT, INSERT ON TABLE audit_log TO caddieperf_app;

-- ---------------------------------------------------------------------------
-- Groupe 1 — donnees d'exploitation : STRICTEMENT cloisonnees
-- ---------------------------------------------------------------------------
-- Sans terrain courant, ces tables ne rendent AUCUNE ligne. C'est voulu :
-- aucune de ces donnees n'a de sens hors d'un terrain.

ALTER TABLE caddie              ENABLE ROW LEVEL SECURITY;
ALTER TABLE caddie              FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_caddie_terrain ON caddie FOR ALL
  USING (golf_course_id = app_current_course())
  WITH CHECK (golf_course_id = app_current_course());

ALTER TABLE booking             ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking             FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_booking_terrain ON booking FOR ALL
  USING (golf_course_id = app_current_course())
  WITH CHECK (golf_course_id = app_current_course());

ALTER TABLE assignment          ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment          FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_assignment_terrain ON assignment FOR ALL
  USING (golf_course_id = app_current_course())
  WITH CHECK (golf_course_id = app_current_course());

ALTER TABLE evaluation          ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation          FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_evaluation_terrain ON evaluation FOR ALL
  USING (golf_course_id = app_current_course())
  WITH CHECK (golf_course_id = app_current_course());

ALTER TABLE wrong_caddie_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrong_caddie_report FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_wrong_caddie_terrain ON wrong_caddie_report FOR ALL
  USING (golf_course_id = app_current_course())
  WITH CHECK (golf_course_id = app_current_course());

ALTER TABLE google_review_click ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_review_click FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_google_click_terrain ON google_review_click FOR ALL
  USING (golf_course_id = app_current_course())
  WITH CHECK (golf_course_id = app_current_course());

ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_audit_terrain ON audit_log FOR ALL
  USING (golf_course_id = app_current_course())
  WITH CHECK (golf_course_id = app_current_course());

-- ---------------------------------------------------------------------------
-- Groupe 2 — tables sans colonne de terrain : rattachement par leur parent
-- ---------------------------------------------------------------------------

-- L'annee de naissance suit le cloisonnement du caddie auquel elle appartient.
ALTER TABLE caddie_personal_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE caddie_personal_data FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_pii_terrain ON caddie_personal_data FOR ALL
  USING (EXISTS (SELECT 1 FROM caddie c
                 WHERE c.id = caddie_personal_data.caddie_id
                   AND c.golf_course_id = app_current_course()))
  WITH CHECK (EXISTS (SELECT 1 FROM caddie c
                      WHERE c.id = caddie_personal_data.caddie_id
                        AND c.golf_course_id = app_current_course()));

ALTER TABLE evaluation_criterion_answer ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_criterion_answer FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_reponse_terrain ON evaluation_criterion_answer FOR ALL
  USING (EXISTS (SELECT 1 FROM evaluation e
                 WHERE e.id = evaluation_criterion_answer.evaluation_id
                   AND e.golf_course_id = app_current_course()))
  WITH CHECK (EXISTS (SELECT 1 FROM evaluation e
                      WHERE e.id = evaluation_criterion_answer.evaluation_id
                        AND e.golf_course_id = app_current_course()));

-- ---------------------------------------------------------------------------
-- Groupe 3 — tables lues AVANT qu'un terrain soit connu
-- ---------------------------------------------------------------------------
-- Se connecter, choisir son terrain, resoudre un QR : ces trois operations
-- precedent necessairement l'existence d'un terrain courant. Deux politiques
-- se combinent alors par OU :
--   - terrain connu   => on ne voit QUE ce terrain ;
--   - terrain inconnu => on voit, faute de quoi personne ne pourrait entrer.
-- Aucune de ces tables ne porte de donnee personnelle de caddie.

ALTER TABLE golf_course ENABLE ROW LEVEL SECURITY;
ALTER TABLE golf_course FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_terrain_courant ON golf_course FOR ALL
  USING (id = app_current_course())
  WITH CHECK (id = app_current_course());
CREATE POLICY p_terrain_hors_portee ON golf_course FOR ALL
  USING (app_current_course() IS NULL)
  WITH CHECK (app_current_course() IS NULL);

-- Le jeton d'une voiturette se resout avant de savoir de quel terrain il vient.
-- Une voiturette ne porte qu'un libelle, un jeton et un statut.
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_voiturette_terrain ON cart FOR ALL
  USING (golf_course_id = app_current_course())
  WITH CHECK (golf_course_id = app_current_course());
CREATE POLICY p_voiturette_jeton ON cart FOR SELECT
  USING (app_current_course() IS NULL);

ALTER TABLE account_golf_course ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_golf_course FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_rattachement_terrain ON account_golf_course FOR ALL
  USING (golf_course_id = app_current_course())
  WITH CHECK (golf_course_id = app_current_course());
CREATE POLICY p_rattachement_connexion ON account_golf_course FOR ALL
  USING (app_current_course() IS NULL)
  WITH CHECK (app_current_course() IS NULL);

-- Un compte n'appartient pas a un terrain : il y est RATTACHE, parfois a
-- plusieurs. Sous portee, on ne voit donc que les comptes rattaches au terrain
-- courant. L'INSERT echappe a la regle : le rattachement est cree juste apres,
-- dans la meme transaction, et n'existe donc pas encore au moment du controle.
ALTER TABLE account ENABLE ROW LEVEL SECURITY;
ALTER TABLE account FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_compte_lecture ON account FOR SELECT
  USING (app_current_course() IS NULL
         OR EXISTS (SELECT 1 FROM account_golf_course acg
                    WHERE acg.account_id = account.id
                      AND acg.golf_course_id = app_current_course()));
CREATE POLICY p_compte_creation ON account FOR INSERT WITH CHECK (true);
CREATE POLICY p_compte_modification ON account FOR UPDATE
  USING (app_current_course() IS NULL
         OR EXISTS (SELECT 1 FROM account_golf_course acg
                    WHERE acg.account_id = account.id
                      AND acg.golf_course_id = app_current_course()));
CREATE POLICY p_compte_suppression ON account FOR DELETE
  USING (app_current_course() IS NULL
         OR EXISTS (SELECT 1 FROM account_golf_course acg
                    WHERE acg.account_id = account.id
                      AND acg.golf_course_id = app_current_course()));

-- Une session se retrouve par son empreinte, avant tout terrain. Elle ne porte
-- qu'une empreinte de jeton, un compte et une echeance.
ALTER TABLE session ENABLE ROW LEVEL SECURITY;
ALTER TABLE session FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_session ON session FOR ALL USING (true) WITH CHECK (true);
