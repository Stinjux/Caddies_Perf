-- MFA POUR LES ADMINISTRATEURS — second facteur TOTP (RFC 6238).
--
-- Le secret est une chaine base32 de 160 bits. Il est traite comme un mot de
-- passe : jamais selectionne par les depots publics, jamais journalise.
--
-- Les codes de secours sont HACHES (scrypt, comme les mots de passe) et
-- retires du tableau des qu'ils servent : sans cela, un papier photographie
-- resterait valable indefiniment.
--
-- Compatible PostgreSQL 14 et versions ulterieures.

ALTER TABLE account ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE account ADD COLUMN IF NOT EXISTS totp_enrolled_at timestamptz;
ALTER TABLE account ADD COLUMN IF NOT EXISTS recovery_codes text[];

-- Le mot de passe a ete verifie, le code ne l'est pas encore. Une session
-- dans cet etat n'authentifie rien.
ALTER TABLE session ADD COLUMN IF NOT EXISTS mfa_pending boolean NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE account TO caddieperf_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE session TO caddieperf_app;
