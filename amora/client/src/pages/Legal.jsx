import { Link, Navigate, useParams } from 'react-router-dom';
import { Logo } from '../components/ui.jsx';
import { useApp } from '../state.jsx';

// Modèles de documents légaux. Les mentions entre crochets [ ] sont à
// compléter, et l'ensemble doit être relu par un professionnel du droit
// avant la mise en production.
const EDITOR = '[Raison sociale], [forme juridique] au capital de [montant] €, RCS [ville] [numéro], siège social : [adresse], France. TVA intracommunautaire : [numéro].';

const DOCS = {
  'mentions-legales': {
    title: 'Mentions légales',
    sections: [
      ['Éditeur', `Le service Amora est édité par ${EDITOR} Directeur de la publication : [nom]. Contact : [e-mail de contact].`],
      ['Hébergement', "Le service est hébergé au sein de l'Union européenne par [nom de l'hébergeur], [adresse], [téléphone]."],
      ['Médiation de la consommation', "Conformément à l'article L612-1 du Code de la consommation, vous pouvez recourir gratuitement au médiateur de la consommation : [nom et coordonnées du médiateur]. Plateforme européenne de règlement en ligne des litiges : https://ec.europa.eu/consumers/odr."],
      ['Signalement de contenus illicites', 'Conformément au règlement européen sur les services numériques (DSA), tout contenu illicite peut être signalé depuis l’application (bouton « Signaler ») ou à l’adresse [e-mail de signalement]. Point de contact unique pour les autorités : [e-mail].'],
    ],
  },
  cgu: {
    title: "Conditions générales d'utilisation",
    sections: [
      ['Objet', "Les présentes CGU encadrent l'utilisation d'Amora, service de mise en relation entre personnes majeures souhaitant faire des rencontres. Toute inscription vaut acceptation des CGU."],
      ['Accès au service', 'Le service est strictement réservé aux personnes âgées de 18 ans ou plus. Le membre garantit l’exactitude de sa date de naissance. Tout compte d’une personne mineure est supprimé sans préavis.'],
      ['Compte', 'Le membre est responsable de la confidentialité de ses identifiants. Un seul compte par personne est autorisé. Les profils doivent représenter la personne réelle qui les utilise.'],
      ['Règles de conduite', 'Sont notamment interdits : le harcèlement, les propos haineux ou discriminatoires, la nudité et les contenus sexuels explicites, l’usurpation d’identité, la prostitution, les arnaques (y compris sentimentales), la sollicitation commerciale et la publication de coordonnées de tiers.'],
      ['Modération', "Amora peut retirer tout contenu contraire aux CGU et suspendre ou supprimer un compte, après examen des signalements. Le membre concerné est informé de la décision et de ses motifs et peut la contester à [e-mail] (art. 17 et 20 du DSA)."],
      ['Fonctionnalités payantes', 'Certaines fonctionnalités sont accessibles par abonnement mensuel. Leurs conditions sont détaillées dans les Conditions générales de vente.'],
      ['Responsabilité', "Amora met en relation des membres et n'est pas partie aux rencontres qui en résultent. Nous recommandons de suivre nos conseils de sécurité : rencontrez-vous dans un lieu public, prévenez un proche, ne transmettez jamais d'argent."],
      ['Résiliation', 'Le membre peut supprimer son compte à tout moment depuis Réglages › Mes données. La suppression est définitive.'],
      ['Droit applicable', 'Les présentes CGU sont soumises au droit français. Le consommateur bénéficie en outre des dispositions impératives de la loi de son pays de résidence dans l’Union européenne.'],
    ],
  },
  cgv: {
    title: 'Conditions générales de vente',
    sections: [
      ['Formules', 'Amora propose une formule gratuite et trois abonnements mensuels : Plus (9,99 € TTC/mois), Gold (19,99 € TTC/mois) et Platinum (29,99 € TTC/mois). Le contenu de chaque formule est décrit sur la page Abonnements. Les prix incluent la TVA applicable dans votre pays de résidence.'],
      ['Durée et renouvellement', "L'abonnement est souscrit pour une durée d'un mois, renouvelée tacitement chaque mois au même tarif, jusqu'à résiliation. Conformément à l'article L215-1 du Code de la consommation, le membre est informé de la date de renouvellement sur la page Abonnements."],
      ['Paiement', 'Le paiement est effectué par carte bancaire ou autre moyen proposé, via notre prestataire de paiement sécurisé [Stripe Payments Europe Ltd.]. Amora ne conserve aucune donnée bancaire.'],
      ['Changement de formule', 'Le passage à une formule supérieure ou inférieure prend effet immédiatement ; la différence de prix est calculée au prorata de la période en cours.'],
      ['Résiliation', "Le membre peut résilier son abonnement à tout moment, en quelques clics, via le bouton « Résilier mon abonnement » (art. L215-1-1 du Code de la consommation). La résiliation prend effet à la fin de la période en cours ; les avantages restent accessibles jusqu'à cette date. Aucun frais n'est appliqué."],
      ['Droit de rétractation', "Le consommateur dispose d'un délai de 14 jours à compter de la souscription pour se rétracter (art. L221-18). En demandant expressément l'accès immédiat au service, il reconnaît que le montant correspondant au service fourni jusqu'à la rétractation restera dû (art. L221-25). Pour l'exercer : [e-mail] ou formulaire de rétractation ci-dessous. Le remboursement intervient sous 14 jours."],
      ['Formulaire de rétractation', "À l'attention de [raison sociale, adresse, e-mail] : Je vous notifie par la présente ma rétractation du contrat portant sur l'abonnement [formule] souscrit le [date]. Nom, adresse e-mail du compte, date, signature (en cas de notification papier)."],
      ['Garanties et réclamations', 'Les services numériques bénéficient de la garantie légale de conformité (art. L224-25-12 et suivants). Toute réclamation peut être adressée à [e-mail du service client].'],
    ],
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    sections: [
      ['Responsable du traitement', `${EDITOR} Délégué à la protection des données : [e-mail du DPO].`],
      ['Données traitées', 'Données de compte (e-mail, mot de passe chiffré, prénom, date de naissance), profil (photos, bio, profession, centres d’intérêt, genre, ville), préférences de rencontre, interactions (likes, matchs, messages), signalements, données d’abonnement et de facturation, journal des consentements.'],
      ['Données sensibles', "Vos préférences de rencontre peuvent révéler votre orientation sexuelle, donnée sensible au sens de l'article 9 du RGPD. Elles ne sont traitées qu'avec votre consentement explicite, recueilli à l'inscription, et uniquement pour vous proposer des profils compatibles. Elles ne sont jamais utilisées à des fins publicitaires ni vendues."],
      ['Localisation', "Nous n'utilisons jamais votre position GPS : seule la ville que vous choisissez est utilisée. Les distances affichées aux autres membres sont arrondies au kilomètre."],
      ['Finalités et bases légales', 'Fourniture du service de rencontre (exécution du contrat), traitement des préférences (consentement explicite), sécurité et modération (intérêt légitime et obligations du DSA), facturation (obligation légale), prospection par e-mail (consentement, facultatif).'],
      ['Destinataires', 'Les autres membres (profil public uniquement : prénom, âge, ville, photos, bio), nos sous-traitants techniques situés dans l’UE (hébergement, envoi d’e-mails) et notre prestataire de paiement. Aucun transfert hors UE sans garanties appropriées.'],
      ['Durées de conservation', "Les données du compte sont conservées tant que le compte est actif et supprimées dès sa suppression ; les comptes inactifs depuis 2 ans sont automatiquement supprimés. Les pièces comptables sont conservées 10 ans (art. L123-22 du Code de commerce), sous forme anonymisée."],
      ['Vos droits', "Vous disposez des droits d'accès, de rectification, d'effacement, de portabilité, de limitation et d'opposition, ainsi que du droit de retirer votre consentement et de définir des directives post-mortem. L'export et la suppression sont disponibles directement dans Réglages › Mes données. Pour toute autre demande : [e-mail du DPO]. Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr) ou de l'autorité de votre pays de résidence."],
      ['Sécurité', 'Mots de passe hachés (bcrypt), connexions chiffrées (HTTPS), cookies de session sécurisés, contrôle des fichiers envoyés, accès restreint aux données.'],
    ],
  },
  cookies: {
    title: 'Cookies et traceurs',
    sections: [
      ['Cookies utilisés', 'Amora dépose un unique cookie, « amora_session », strictement nécessaire au maintien de votre connexion (durée : 30 jours). Conformément à l’article 82 de la loi Informatique et Libertés, il est exempté de consentement.'],
      ['Stockage local', 'Votre navigateur conserve localement votre choix de langue et la fermeture de ce bandeau d’information. Ces données ne nous sont pas transmises.'],
      ['Aucun traceur tiers', "Amora n'utilise aucun cookie publicitaire, de réseau social ou de mesure d'audience, et ne charge aucune police ou script depuis des serveurs tiers."],
    ],
  },
};

export default function Legal() {
  const { doc } = useParams();
  const { user } = useApp();
  const content = DOCS[doc];
  if (!content) return <Navigate to="/" replace />;
  return (
    <div className="legal">
      <header className="legal-nav">
        <Logo to={user ? '/decouvrir' : '/'} />
        <Link to={user ? '/reglages' : '/'} className="btn btn-small btn-ghost">←</Link>
      </header>
      <article className="legal-doc">
        <h1>{content.title}</h1>
        <p className="muted small">Version en vigueur : octobre 2026</p>
        {content.sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </article>
    </div>
  );
}
