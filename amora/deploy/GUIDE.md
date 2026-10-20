# Mettre Amora en ligne — guide pas à pas

Ce guide part de zéro : pas de serveur, pas de nom de domaine, pas de compte Stripe.
L'ordre conseillé est le suivant :

1. **Aujourd'hui** : un serveur et le site en ligne en **mode démo** (environ 20 minutes, 5 €/mois).
2. **Ensuite** : votre propre nom de domaine (environ 10 €/an).
3. **Avant l'ouverture au public** : Stripe pour encaisser les vrais abonnements.

> ⚠️ En mode démo, les paiements sont simulés : n'importe qui peut « s'abonner » gratuitement.
> Ce mode sert à tester et à faire des démonstrations. N'ouvrez pas le site au public
> avant d'avoir configuré Stripe (étape 3).

---

## Étape 0 — Fusionner la pull request

Le script installe la branche `main`. Fusionnez donc d'abord la pull request sur GitHub
(bouton **Merge pull request**).

Pour tester sans fusionner, ajoutez `BRANCH=claude/dating-app-subscriptions-90eoap` devant
la commande de l'étape 2.

## Étape 1 — Louer un serveur (VPS)

Choisissez **un** des deux hébergeurs. Les deux hébergent dans l'UE.

| Hébergeur | Offre conseillée | Prix | Lieu |
|---|---|---|---|
| **Hetzner** — hetzner.com/cloud | CX22 (2 processeurs, 4 Go de mémoire) | ≈ 4,50 €/mois | Allemagne / Finlande |
| **OVHcloud** — ovhcloud.com › VPS | VPS-1 | ≈ 5 à 7 €/mois | France |

À la commande :
- **Système d'exploitation : Ubuntu 24.04**.
- Notez l'**adresse IP** du serveur (par exemple `203.0.113.10`) et le **mot de passe root**,
  envoyé par e-mail ou affiché à l'écran.

## Étape 2 — Installer Amora (une seule commande)

**Se connecter au serveur :**
- **Windows** : ouvrez *PowerShell* (menu Démarrer › tapez « PowerShell »).
- **Mac** : ouvrez *Terminal*.

Tapez la commande suivante, en remplaçant l'IP par la vôtre :
```bash
ssh root@203.0.113.10
```
Répondez `yes` à la première question, puis saisissez le mot de passe. Rien ne s'affiche
pendant la saisie, c'est normal.

**Lancer l'installation :**
```bash
curl -fsSL https://raw.githubusercontent.com/Adocool003/projet/main/amora/deploy/install.sh | bash
```

En 3 à 5 minutes, le script installe et configure tout :
- Node.js et l'application ;
- le serveur web avec un certificat HTTPS gratuit ;
- le démarrage automatique ;
- le pare-feu ;
- les sauvegardes quotidiennes.

À la fin, il affiche l'adresse du site, par exemple :
```
✔ Amora est en ligne : https://203-0-113-10.sslip.io
```
Cette adresse provisoire, gratuite, fonctionne en HTTPS en attendant votre nom de domaine.

**Devenir administrateur.** Ouvrez le site, créez votre compte, puis tapez sur le serveur :
```bash
cd /opt/amora/amora/server && sudo -u amora npm run make-admin -- votre@email.fr
```
Reconnectez-vous : l'icône de bouclier (Modération) apparaît en haut de l'écran.

## Étape 3 — Votre nom de domaine

1. Achetez un domaine chez **OVHcloud**, **Gandi** ou **Ionos**, par exemple `amora-rencontre.fr`.
2. Dans la zone DNS du domaine, créez deux enregistrements de **type A** :
   - `@` → l'IP de votre serveur ;
   - `www` → l'IP de votre serveur.
3. Patientez 10 minutes à 1 heure, le temps que le domaine se propage.
4. Sur le serveur, relancez le script avec votre domaine :
   ```bash
   DOMAIN=www.amora-rencontre.fr bash /opt/amora/amora/deploy/install.sh
   ```
   Le certificat HTTPS du nouveau domaine est créé automatiquement. Vos données sont conservées.

## Étape 4 — Encaisser les abonnements avec Stripe

**Prérequis** : une **micro-entreprise** ou une société, donc un numéro SIRET.
La micro-entreprise se crée gratuitement en ligne sur *formalites.entreprises.gouv.fr*.

1. Créez un compte sur **stripe.com**. Laissez-le d'abord en **mode test**.
2. Allez dans **Catalogue de produits** et créez 3 produits, chacun avec un prix
   **récurrent, mensuel, en EUR, TVA incluse** :
   - Amora Plus : 9,99 € ;
   - Amora Gold : 19,99 € ;
   - Amora Platinum : 29,99 €.

   Copiez l'identifiant de chaque prix, qui commence par `price_…`.
3. Allez dans **Développeurs › Webhooks › Ajouter un endpoint** :
   - URL : `https://www.amora-rencontre.fr/api/stripe/webhook`
   - Événements :
     - `checkout.session.completed`
     - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
     - `invoice.paid`, `invoice.payment_failed`

   Copiez la **clé secrète de signature** (`whsec_…`).
4. Allez dans **Paramètres › Portail client** et activez-le. Les membres y gèrent leur carte
   et leurs factures.
5. Facultatif mais conseillé : activez **Stripe Tax**. La TVA de chaque pays de l'UE est alors
   gérée automatiquement.
6. Sur le serveur, ouvrez la configuration :
   ```bash
   nano /opt/amora/amora/server/.env
   ```
   Remplissez les lignes suivantes :
   - `STRIPE_SECRET_KEY` : la clé secrète `sk_test_…`, puis `sk_live_…` plus tard ;
   - `STRIPE_WEBHOOK_SECRET` : la clé `whsec_…` ;
   - `STRIPE_PRICE_PLUS`, `STRIPE_PRICE_GOLD`, `STRIPE_PRICE_PLATINUM` : les 3 identifiants `price_…` ;
   - `STRIPE_AUTOMATIC_TAX` : `true` si vous avez activé Stripe Tax.

   Enregistrez avec `Ctrl+O`, `Entrée`, puis quittez avec `Ctrl+X`.
7. Redémarrez l'application :
   ```bash
   systemctl restart amora
   ```
8. Testez un abonnement avec la carte de test `4242 4242 4242 4242`, n'importe quelle date
   future et n'importe quel code.
9. Quand tout fonctionne, refaites les étapes 2 à 6 en **mode live** de Stripe. Le mode live
   a ses propres clés, ses propres prix et son propre webhook.

## Étape 5 — Avant l'ouverture au public

- [ ] Compléter les mentions entre crochets `[ ]` dans `client/src/pages/Legal.jsx`
      (raison sociale, adresse, SIRET, e-mails, médiateur de la consommation), puis relancer
      le script pour publier la mise à jour.
- [ ] Faire relire CGU, CGV et politique de confidentialité par un avocat.
- [ ] Adhérer à un **médiateur de la consommation**. C'est obligatoire pour vendre à des
      particuliers, et coûte environ 50 à 150 €/an.
- [ ] Réaliser l'**analyse d'impact RGPD** (AIPD) avec l'outil gratuit PIA de la CNIL.
- [ ] Créer une adresse e-mail de contact et de support.
- [ ] Prévoir du temps chaque jour pour traiter les signalements (onglet Modération).

---

## Au quotidien

| Besoin | Commande (sur le serveur) |
|---|---|
| Mettre à jour après une modification sur GitHub | `bash /opt/amora/amora/deploy/install.sh` |
| Voir les journaux en direct | `journalctl -u amora -f` |
| Redémarrer l'application | `systemctl restart amora` |
| Vérifier que tout tourne | `systemctl status amora caddy` |
| Lister les sauvegardes | `ls /var/backups/amora` |

**Sauvegardes.** La base et les photos sont sauvegardées chaque nuit dans `/var/backups/amora`
et conservées 14 jours. Copiez-les régulièrement **hors du serveur**. Depuis votre ordinateur :
```bash
scp -r root@203.0.113.10:/var/backups/amora ./sauvegardes-amora
```
Vous pouvez aussi activer l'option de sauvegarde automatique de l'hébergeur
(environ 1 €/mois chez Hetzner).

**Restaurer une sauvegarde**, en remplaçant `AAAA-MM-JJ` par la date voulue :
```bash
systemctl stop amora
cp /var/backups/amora/amora-AAAA-MM-JJ.db /var/lib/amora/amora.db
rm -f /var/lib/amora/amora.db-wal /var/lib/amora/amora.db-shm
tar -xzf /var/backups/amora/photos-AAAA-MM-JJ.tar.gz -C /var/lib/amora
chown -R amora:amora /var/lib/amora
systemctl start amora
```

## En cas de problème

| Symptôme | Solution |
|---|---|
| Le site ne s'affiche pas juste après l'installation | Attendez 1 à 2 minutes, le temps que le certificat HTTPS soit créé. |
| Toujours rien | Lancez `journalctl -u caddy -n 30` : Caddy explique pourquoi le certificat échoue (souvent un domaine qui ne pointe pas encore vers le serveur). |
| Message « l'application ne répond pas » | Lancez `journalctl -u amora -n 50` et envoyez-moi le résultat. |
| Impossible de se connecter en SSH | Vérifiez l'IP et le mot de passe dans l'espace client de l'hébergeur. Hetzner et OVH proposent aussi une console dans le navigateur. |
