# Amora — application de rencontre (France & Union européenne)

Application de rencontre mobile-first inspirée de Yubo / Yoyomatch / Tinder, avec swipe, matchs,
messagerie en temps réel et **4 formules d'abonnement mensuel**. Elle est pensée pour le marché
français et européen (RGPD, Code de la consommation, DSA).

- **Backend** : Node.js 22, Express, SQLite (`node:sqlite`), Socket.IO, Stripe Billing
- **Frontend** : React 18 + Vite, installable comme application (PWA), français / anglais, thème clair / sombre

## Démarrage rapide

```bash
cd amora
npm run install:all     # installe server/ et client/
npm run seed            # 160 profils de démo + comptes démo et admin
npm run dev:server      # API sur http://localhost:4000
npm run dev:client      # dans un 2e terminal → http://localhost:5173
```

Comptes de démonstration (mot de passe `motdepasse123`) :

| Compte | Rôle |
|---|---|
| `demo@amora.local` | membre (formule gratuite, a déjà reçu des likes et un super like) |
| `admin@amora.local` | administrateur (onglet Modération, statistiques et MRR) |

Sans clé Stripe, l'application tourne en **mode démo** : les paiements sont simulés, mais tout le
parcours d'abonnement fonctionne (souscription, changement de formule, résiliation, renouvellement).

Tests : `npm test` (27 tests d'API couvrant matching, quotas, abonnements, webhooks Stripe, RGPD et modération).

## Formules d'abonnement (prix TTC, mensuel, sans engagement)

| Fonctionnalité | Gratuit | Plus — 9,99 € | Gold — 19,99 € | Platinum — 29,99 € |
|---|---|---|---|---|
| Likes par jour | 30 | Illimité | Illimité | Illimité |
| Super likes par jour | 1 | 3 | 5 | 10 |
| Sans publicité | – | ✓ | ✓ | ✓ |
| Retour arrière | – | ✓ | ✓ | ✓ |
| Mode voyage (toute l'UE) | – | ✓ | ✓ | ✓ |
| Voir qui m'a liké | – | – | ✓ | ✓ |
| Accusés de lecture | – | – | ✓ | ✓ |
| Filtres avancés | – | – | ✓ | ✓ |
| Boosts (30 min) par mois | – | – | 1 | 4 |
| Mode incognito | – | – | – | ✓ |
| Message joint au super like | – | – | – | ✓ |
| Profil mis en avant | – | – | – | ✓ |

Les prix et les avantages se modifient dans un seul fichier : `server/src/plans.js`. Le client
lit la configuration via `/api/meta`.

## Fonctionnalités

- **Inscription en 3 étapes** : 18 ans minimum vérifiés côté serveur, ville choisie dans une
  liste de plus de 80 villes (France, Outre-mer et UE) et consentements RGPD journalisés.
- **Découverte par swipe** (doigt, souris ou flèches du clavier) :
  - critères réciproques : genre recherché, tranche d'âge, distance ;
  - classement par intérêts communs, activité récente, likes reçus, boosts et priorité Platinum ;
  - carte publicitaire « maison » pour la formule gratuite.
- **Match** : animation « C'est un match ! » et notification en temps réel à l'autre membre.
- **Messagerie temps réel** (Socket.IO) : indicateur de saisie, messages non lus, accusés de
  lecture (Gold et plus), historique paginé et conseil de sécurité.
- **Profil** : 6 photos maximum. Le serveur vérifie la signature binaire (JPEG, PNG, WebP) et
  renomme les fichiers aléatoirement. Bio, profession, 26 centres d'intérêt, aperçu du profil.
- **Sécurité** :
  - blocage et signalement (le signalement bloque aussi le profil) ;
  - modération par l'admin (bannir, classer) avec déconnexion immédiate du membre banni.
- **Admin** : membres actifs, répartition par formule, revenu mensuel récurrent (MRR),
  inscriptions sur 7 jours, signalements.

## Conformité France / UE

> Les éléments ci-dessous sont implémentés techniquement. Les textes légaux fournis
> (`client/src/pages/Legal.jsx`) sont des **modèles** : complétez les mentions entre crochets
> et faites-les valider par un avocat avant le lancement.

- **RGPD**
  - Consentement explicite au traitement des données sensibles (art. 9 : l'orientation sexuelle
    se déduit des préférences), journalisé avec sa version.
  - Export des données en JSON (art. 20) et suppression définitive du compte (art. 17).
  - Suppression automatique des comptes inactifs depuis 2 ans.
  - Minimisation : aucune position GPS, seulement la ville. Distances arrondies au km pour
    empêcher la triangulation. Jamais d'e-mail ni de date de naissance exposés aux autres membres.
- **Cookies** : un seul cookie de session strictement nécessaire, donc pas de consentement
  requis (art. 82 de la loi Informatique et Libertés). Aucune police ni aucun script tiers.
- **Code de la consommation**
  - Prix TTC.
  - Demande expresse d'exécution immédiate et information sur le droit de rétractation de
    14 jours (L221-18 et L221-25).
  - Bouton « Résilier mon abonnement » accessible en quelques clics (L215-1-1). L'accès reste
    actif jusqu'à l'échéance.
  - Date de renouvellement affichée (L215-1).
- **Comptabilité** : l'historique de facturation est conservé et anonymisé à la suppression d'un
  compte (L123-22 du Code de commerce).
- **DSA** : signalement de contenus en un clic et modération. Prévoir la notification motivée
  des décisions de modération.

## Mise en production

1. Créez dans Stripe 3 produits avec un **prix récurrent mensuel en EUR** (Plus, Gold, Platinum).
   Activez **Stripe Tax** pour appliquer la TVA du pays de chaque client européen (régime OSS).
2. Copiez `server/.env.example` vers `server/.env` et renseignez les clés.
3. Configurez un webhook Stripe vers `https://votre-domaine/api/stripe/webhook` avec les
   événements suivants :
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.paid`, `invoice.payment_failed`
4. Activez le **portail client Stripe** (gestion de la carte et des factures).
5. Compilez et lancez le tout. Un seul processus sert l'API et l'application React :
   ```bash
   npm run build && npm start
   ```
6. Hébergez dans l'UE (OVHcloud, Scaleway, Clever Cloud…) derrière HTTPS.

### Pistes pour la suite

- **Applications iOS / Android** : l'app est déjà une PWA installable. Pour les stores, la
  coquille peut être empaquetée avec Capacitor. Attention, Apple et Google imposent en principe
  leurs achats intégrés pour les abonnements numériques ; le DMA assouplit cette règle dans l'UE.
- **Base de données** : SQLite convient pour démarrer. Au-delà de quelques dizaines de milliers
  de membres, passez à PostgreSQL, idéalement avec PostGIS pour la géolocalisation.
- **Stockage des photos** : objet S3 compatible (Scaleway, OVH) avec redimensionnement.
- **Confiance et modération** :
  - vérification de profil par selfie ;
  - modération automatique des images ;
  - e-mails transactionnels (confirmation d'adresse, réinitialisation du mot de passe).
- **Notifications** : notifications push (Web Push ou FCM / APNs).
- **Traductions** : ajoutez d'autres langues de l'UE dans `client/src/i18n/`.

## Structure

```
amora/
├── server/
│   ├── src/
│   │   ├── app.js            # assemblage Express (sécurité, routes, statiques)
│   │   ├── index.js          # serveur HTTP + Socket.IO + purge RGPD quotidienne
│   │   ├── plans.js          # formules et avantages
│   │   ├── db.js             # schéma SQLite
│   │   ├── realtime.js       # Socket.IO (salles par membre)
│   │   ├── seed.js           # données de démo
│   │   ├── routes/           # auth, profil, découverte, matchs, sécurité, abonnement, admin
│   │   └── services/         # matching, paiements (démo / Stripe), profils, rétention
│   └── test/                 # tests node:test + supertest
└── client/
    └── src/
        ├── pages/            # Landing, Auth, Discover, Likes, Matches, Chat, Profile,
        │                     # Settings, Subscription, Admin, Legal
        ├── components/       # UI partagée (cartes, modales, grille tarifaire…)
        ├── i18n/             # fr.js, en.js
        └── styles/app.css
```
