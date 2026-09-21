-- DEUX NIVEAUX D'ADMINISTRATION.
--
-- « admin »         : administrateur d'UN parcours, via account_golf_course.
-- « admin general » : administrateur de TOUS les parcours, present et a venir.
--
-- Le niveau general ne peut pas vivre dans account_golf_course : il faudrait
-- y inscrire une ligne par parcours, et un parcours cree demain naitrait hors
-- de sa portee. C'est une propriete du COMPTE, pas du rattachement.
--
-- Le cloisonnement n'est pas affaibli : un administrateur general reste, a
-- chaque instant, dans la portee d'un seul parcours (app.golf_course_id).
-- Il peut en CHANGER sans rattachement prealable ; il ne peut jamais en voir
-- deux a la fois. Le RLS demeure donc la barriere, inchangee.

ALTER TABLE account
  ADD COLUMN IF NOT EXISTS general_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN account.general_admin IS
  'Administrateur general : portee admin sur tous les parcours actifs, y compris ceux crees apres lui.';

-- Retrouver les administrateurs generaux doit rester immediat meme quand la
-- table des comptes grandit ; ils sont par nature une poignee.
CREATE INDEX IF NOT EXISTS idx_account_general_admin
  ON account (general_admin)
  WHERE general_admin;

-- ---------------------------------------------------------------------------
-- Un administrateur general est visible depuis n'importe quel parcours.
-- ---------------------------------------------------------------------------
-- Les politiques existantes ne montrent, sous portee, que les comptes
-- RATTACHES au parcours courant. Un administrateur general peut ne l'etre a
-- aucun : sans la regle ci-dessous, il serait invisible partout, et nul ne
-- saurait meme qui detient ce niveau.
--
-- Le cloisonnement n'y perd rien. Le masquer n'aurait aucun sens : il a par
-- construction acces a tous les parcours. Et la ligne d'un compte ne porte
-- aucune donnee de caddie — c'est le RLS des tables caddie, evaluation et
-- caddie_personal_data qui protege les personnes, et il reste intact.
--
-- LECTURE SEULE, ET C'EST DELIBERE.
--
-- On serait tente d'ajouter la politique d'ECRITURE symetrique, pour pouvoir
-- retirer le niveau a n'importe qui le porte. Elle ne fonctionnerait pas, et
-- la raison merite d'etre consignee : PostgreSQL exige qu'une ligne modifiee
-- reste VISIBLE apres coup. Or retirer le niveau general a un compte non
-- rattache le fait disparaitre de la seule politique qui le montrait. La
-- ligne cesserait d'etre lisible a l'instant meme ou on la reecrit, et
-- l'ecriture est donc refusee — meme avec un WITH CHECK permissif. Mesure
-- sur PostgreSQL 14.
--
-- L'application s'aligne sur cette contrainte plutot que de la contourner :
-- on accorde et on retire le niveau general DEPUIS le parcours ou la
-- personne est rattachee. C'est aussi la bonne regle humaine — on ne modifie
-- les droits que de quelqu'un que l'on cotoie.

DROP POLICY IF EXISTS p_compte_general_lecture ON account;
CREATE POLICY p_compte_general_lecture ON account FOR SELECT
  USING (general_admin);

-- Cette politique a existe le temps d'un essai ; elle ne pouvait pas tenir,
-- pour la raison ci-dessus. Le DROP la retire des bases ou elle a ete posee.
DROP POLICY IF EXISTS p_compte_general_modification ON account;

-- ---------------------------------------------------------------------------
-- Installations existantes : quelqu'un doit porter le niveau general.
-- ---------------------------------------------------------------------------
-- Sur une base deja en service, la colonne nait a false pour tout le monde.
-- Plus personne ne pourrait alors creer un parcours, ni accorder le niveau a
-- qui que ce soit : l'application se fermerait a elle-meme une porte qu'elle
-- vient d'inventer.
--
-- Le niveau revient au PLUS ANCIEN compte administrateur — celui qui a
-- installe le service, et qui detenait deja, de fait, tous les pouvoirs.
-- La promotion n'a lieu que si aucun administrateur general n'existe :
-- rejouee, elle ne fait rien.

UPDATE account SET general_admin = true
WHERE id = (
  SELECT a.id FROM account a
  JOIN account_golf_course agc ON agc.account_id = a.id AND agc.role = 'admin'
  WHERE a.status = 'active'
  ORDER BY a.created_at, a.id
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM account WHERE general_admin);
