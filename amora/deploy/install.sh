#!/usr/bin/env bash
# =============================================================================
# Installation d'Amora sur un serveur Ubuntu 22.04 / 24.04 (ou Debian 12).
#
# Usage (en root sur le serveur) :
#   curl -fsSL https://raw.githubusercontent.com/Adocool003/projet/main/amora/deploy/install.sh | bash
#
# Variables facultatives :
#   DOMAIN=www.mondomaine.fr   nom de domaine (sinon adresse provisoire <ip>.sslip.io)
#   BRANCH=main                branche Git à déployer
#   REPO_URL=https://github.com/Adocool003/projet.git
#
# Le script peut être relancé sans risque : il met à jour le code et conserve
# la base de données, les photos et les secrets déjà générés.
# =============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Adocool003/projet.git}"
APP_USER=amora
CODE_DIR=/opt/amora
# Relance sans BRANCH : on garde la branche déjà installée.
if [ -z "${BRANCH:-}" ] && [ -d "$CODE_DIR/.git" ]; then
  BRANCH=$(git -C "$CODE_DIR" rev-parse --abbrev-ref HEAD)
fi
BRANCH="${BRANCH:-main}"
DATA_DIR=/var/lib/amora
BACKUP_DIR=/var/backups/amora
SERVER_DIR="$CODE_DIR/amora/server"
CLIENT_DIR="$CODE_DIR/amora/client"
ENV_FILE="$SERVER_DIR/.env"
PORT=4000

step() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mErreur : %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "lancez ce script en root (ou avec sudo)."
command -v apt-get >/dev/null || fail "ce script est prévu pour Ubuntu ou Debian."

# --- Adresse du site ----------------------------------------------------------
# Relance sans DOMAIN : on garde l'adresse déjà configurée.
if [ -z "${DOMAIN:-}" ] && [ -f "$ENV_FILE" ]; then
  DOMAIN=$(sed -n 's|^CLIENT_URL=https://||p' "$ENV_FILE")
fi
if [ -z "${DOMAIN:-}" ]; then
  IP=$(curl -fsS4 https://api.ipify.org || curl -fsS4 https://ifconfig.me)
  [ -n "$IP" ] || fail "impossible de déterminer l'adresse IP publique. Relancez avec DOMAIN=..."
  # sslip.io : nom de domaine gratuit qui pointe vers l'IP, utile en attendant le vrai domaine.
  DOMAIN="${IP//./-}.sslip.io"
fi
step "Installation d'Amora pour https://$DOMAIN"

# --- Paquets système ----------------------------------------------------------
step "Installation des paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git sqlite3 ufw debian-keyring debian-archive-keyring apt-transport-https >/dev/null

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  step "Installation de Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi

if ! command -v caddy >/dev/null; then
  step "Installation de Caddy (serveur web + certificat HTTPS automatique)"
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi

# --- Utilisateur et dossiers --------------------------------------------------
step "Préparation des dossiers"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$DATA_DIR/uploads" "$BACKUP_DIR"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"
chmod 750 "$DATA_DIR" "$BACKUP_DIR"

# --- Code ---------------------------------------------------------------------
step "Récupération du code ($BRANCH)"
if [ -d "$CODE_DIR/.git" ]; then
  git -C "$CODE_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$CODE_DIR" checkout -q -B "$BRANCH" FETCH_HEAD
else
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$CODE_DIR"
fi
[ -f "$SERVER_DIR/package.json" ] || fail "dossier amora/ introuvable dans la branche $BRANCH (la pull request est-elle fusionnée ?)."

step "Installation des dépendances et compilation"
(cd "$SERVER_DIR" && npm ci --omit=dev --no-audit --no-fund --loglevel=error)
(cd "$CLIENT_DIR" && npm ci --no-audit --no-fund --loglevel=error && npm run build --silent)

# --- Configuration (.env) -----------------------------------------------------
set_env() { # set_env CLE valeur : remplace ou ajoute la ligne CLE=valeur
  if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi
}
if [ ! -f "$ENV_FILE" ]; then
  step "Création de la configuration"
  cat > "$ENV_FILE" <<EOF
# Configuration d'Amora — généré par install.sh. Après modification :
#   systemctl restart amora
NODE_ENV=production
PORT=$PORT
JWT_SECRET=$(openssl rand -hex 32)
DB_FILE=$DATA_DIR/amora.db
UPLOAD_DIR=$DATA_DIR/uploads

# Stripe : laissez vide pour rester en mode démo (paiements simulés).
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PLUS=
STRIPE_PRICE_GOLD=
STRIPE_PRICE_PLATINUM=
STRIPE_AUTOMATIC_TAX=false
EOF
fi
set_env CLIENT_URL "https://$DOMAIN"
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

# --- Service systemd ----------------------------------------------------------
step "Création du service (démarrage et redémarrage automatiques)"
cat > /etc/systemd/system/amora.service <<EOF
[Unit]
Description=Amora (application de rencontre)
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$SERVER_DIR
ExecStart=/usr/bin/node --env-file=$ENV_FILE --disable-warning=ExperimentalWarning src/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable -q amora
systemctl restart amora

# --- Caddy (HTTPS) ------------------------------------------------------------
step "Configuration du HTTPS"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode zstd gzip
	request_body {
		max_size 10MB
	}
	header {
		Strict-Transport-Security "max-age=31536000"
		-Server
	}
	reverse_proxy localhost:$PORT
}
EOF
systemctl enable -q caddy
systemctl reload caddy 2>/dev/null || systemctl restart caddy

# --- Pare-feu -----------------------------------------------------------------
step "Pare-feu (SSH, HTTP, HTTPS uniquement)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

# --- Sauvegardes quotidiennes -------------------------------------------------
step "Sauvegardes quotidiennes (conservées 14 jours)"
cat > /etc/cron.daily/amora-backup <<EOF
#!/bin/sh
# Sauvegarde de la base et des photos d'Amora
set -e
STAMP=\$(date +%Y-%m-%d)
sqlite3 $DATA_DIR/amora.db ".backup '$BACKUP_DIR/amora-\$STAMP.db'"
tar -czf $BACKUP_DIR/photos-\$STAMP.tar.gz -C $DATA_DIR uploads
find $BACKUP_DIR -type f -mtime +14 -delete
EOF
chmod 755 /etc/cron.daily/amora-backup

# --- Vérification -------------------------------------------------------------
step "Vérification"
for _ in $(seq 1 20); do
  curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://localhost:$PORT/api/health" >/dev/null || fail "l'application ne répond pas. Consultez : journalctl -u amora -n 50"

cat <<EOF

$(printf '\033[1;32m')✔ Amora est en ligne : https://$DOMAIN$(printf '\033[0m')
  (le certificat HTTPS peut prendre une minute à s'activer la première fois)

Prochaines étapes :
  1. Ouvrez le site et créez votre compte.
  2. Donnez-vous les droits d'administration :
       cd $SERVER_DIR && sudo -u $APP_USER npm run make-admin -- votre@email.fr
  3. Configuration : $ENV_FILE  (puis : systemctl restart amora)

Commandes utiles :
  journalctl -u amora -f          voir les journaux en direct
  systemctl restart amora         redémarrer l'application
  bash $CODE_DIR/amora/deploy/install.sh   mettre à jour (même commande)
EOF
