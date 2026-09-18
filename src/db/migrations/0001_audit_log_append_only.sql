-- T022 — FR-038 : le journal est en ECRITURE SEULE.
--
-- Retirer UPDATE et DELETE a l'utilisateur applicatif au niveau de PostgreSQL
-- rend l'exigence vraie meme si le code applicatif est bogue ou compromis,
-- ce qu'un controle applicatif ne garantit jamais.
--
-- Compatible PostgreSQL 14 et versions ulterieures.
--
-- Remplacer :role_applicatif par le role reel au deploiement. En developpement,
-- le proprietaire de la base conserve tous ses droits : la garantie se verifie
-- alors via le role dedie cree ci-dessous.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'caddieperf_app') THEN
    CREATE ROLE caddieperf_app NOLOGIN;
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO caddieperf_app;

-- Le journal fait exception : insertion et lecture seulement.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_log FROM caddieperf_app;
GRANT SELECT, INSERT ON TABLE audit_log TO caddieperf_app;
