#!/usr/bin/env bash
#
# SAUVEGARDE QUOTIDIENNE DE LA BASE CADDIEPERF.
#
# Une sauvegarde dont personne n'a jamais verifie la restauration n'est pas
# une sauvegarde : c'est une esperance. Ce script fait donc les deux — il
# ecrit la copie, puis la RELIT pour s'assurer qu'elle est exploitable.
#
# Installation (a executer sur le serveur, une fois) :
#   sudo install -m 0755 scripts/sauvegarde.sh /usr/local/bin/caddieperf-sauvegarde
#   sudo crontab -e
#   # tous les jours a 03h15, heure locale du serveur
#   15 3 * * * BACKUP_DATABASE_URL='postgresql://...' BACKUP_DIR=/var/backups/caddieperf \
#              /usr/local/bin/caddieperf-sauvegarde >> /var/log/caddieperf-sauvegarde.log 2>&1
#
# HEBERGEMENT : le repertoire de destination doit se trouver AU MAROC, comme
# la base elle-meme (principe III). Une copie posee chez un fournisseur
# etranger deplacerait les donnees que l'hebergement local entend garder ici.
#
# CHIFFREMENT : la copie contient des noms de caddies et des annees de
# naissance. Elle est donc chiffree au repos si GPG_RECIPIENT est fourni, et
# le script REFUSE de s'executer sans chiffrement en production.

set -euo pipefail

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL est absente}"
: "${BACKUP_DIR:=/var/backups/caddieperf}"
: "${RETENTION_JOURS:=30}"

horodatage="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

fichier="$BACKUP_DIR/caddieperf-$horodatage.dump"

echo "[$(date +%Y-%m-%dT%H:%M:%S%z)] Sauvegarde vers $fichier"

# Format personnalise : compresse, et restaurable table par table.
pg_dump --format=custom --no-owner --no-privileges \
        --file="$fichier" "$BACKUP_DATABASE_URL"

# VERIFICATION. pg_restore --list echoue si l'archive est tronquee ou
# corrompue. C'est ce controle, et non la presence du fichier, qui autorise a
# parler de sauvegarde.
if ! pg_restore --list "$fichier" > /dev/null; then
  echo "[$(date +%Y-%m-%dT%H:%M:%S%z)] ECHEC : l'archive est illisible, elle est supprimee." >&2
  rm -f "$fichier"
  exit 1
fi

lignes="$(pg_restore --list "$fichier" | grep -c 'TABLE DATA' || true)"
echo "[$(date +%Y-%m-%dT%H:%M:%S%z)] Archive relue : $lignes tables de donnees."

if [ "$lignes" -lt 10 ]; then
  echo "[$(date +%Y-%m-%dT%H:%M:%S%z)] ECHEC : $lignes tables seulement, la base en compte 14." >&2
  echo "Une sauvegarde presque vide passerait inapercue pendant des mois." >&2
  exit 1
fi

if [ -n "${GPG_RECIPIENT:-}" ]; then
  gpg --batch --yes --encrypt --recipient "$GPG_RECIPIENT" "$fichier"
  rm -f "$fichier"
  fichier="$fichier.gpg"
  echo "[$(date +%Y-%m-%dT%H:%M:%S%z)] Archive chiffree pour $GPG_RECIPIENT."
elif [ "${NODE_ENV:-}" = "production" ]; then
  echo "[$(date +%Y-%m-%dT%H:%M:%S%z)] ECHEC : GPG_RECIPIENT est absente." >&2
  echo "L'archive contient des noms et des annees de naissance ; elle ne doit" >&2
  echo "pas rester en clair sur le disque (principe I)." >&2
  rm -f "$fichier"
  exit 1
fi

# Purge des copies echues. -mtime compte en jours revolus.
supprimees="$(find "$BACKUP_DIR" -name 'caddieperf-*.dump*' -mtime "+$RETENTION_JOURS" -print -delete | wc -l | tr -d ' ')"
echo "[$(date +%Y-%m-%dT%H:%M:%S%z)] $supprimees archive(s) de plus de $RETENTION_JOURS jours supprimee(s)."

echo "[$(date +%Y-%m-%dT%H:%M:%S%z)] Termine : $fichier"
