// Formules d'abonnement mensuel. Les prix sont TTC (TVA incluse), comme
// l'exige le Code de la consommation pour l'affichage aux consommateurs.
// `null` signifie « illimité ».
export const PLANS = {
  free: {
    id: 'free',
    rank: 0,
    priceCents: 0,
    features: {
      dailyLikes: 30,
      dailySuperLikes: 1,
      rewind: false,
      noAds: false,
      travel: false,
      seeLikes: false,
      readReceipts: false,
      advancedFilters: false,
      monthlyBoosts: 0,
      incognito: false,
      superLikeNote: false,
      priority: false,
    },
  },
  plus: {
    id: 'plus',
    rank: 1,
    priceCents: 999,
    features: {
      dailyLikes: null,
      dailySuperLikes: 3,
      rewind: true,
      noAds: true,
      travel: true,
      seeLikes: false,
      readReceipts: false,
      advancedFilters: false,
      monthlyBoosts: 0,
      incognito: false,
      superLikeNote: false,
      priority: false,
    },
  },
  gold: {
    id: 'gold',
    rank: 2,
    priceCents: 1999,
    popular: true,
    features: {
      dailyLikes: null,
      dailySuperLikes: 5,
      rewind: true,
      noAds: true,
      travel: true,
      seeLikes: true,
      readReceipts: true,
      advancedFilters: true,
      monthlyBoosts: 1,
      incognito: false,
      superLikeNote: false,
      priority: false,
    },
  },
  platinum: {
    id: 'platinum',
    rank: 3,
    priceCents: 2999,
    features: {
      dailyLikes: null,
      dailySuperLikes: 10,
      rewind: true,
      noAds: true,
      travel: true,
      seeLikes: true,
      readReceipts: true,
      advancedFilters: true,
      monthlyBoosts: 4,
      incognito: true,
      superLikeNote: true,
      priority: true,
    },
  },
};

export const PAID_PLANS = ['plus', 'gold', 'platinum'];
export const BOOST_MINUTES = 30;

/**
 * Formule réellement active : un abonnement expiré (ou résilié et arrivé à
 * échéance) retombe automatiquement sur la formule gratuite.
 */
export function effectivePlanId(user, now = new Date()) {
  if (!user || !PLANS[user.plan] || user.plan === 'free') return 'free';
  if (!user.plan_expires_at || new Date(user.plan_expires_at) <= now) return 'free';
  return user.plan;
}

export function featuresOf(user) {
  return PLANS[effectivePlanId(user)].features;
}

export function publicPlans() {
  return Object.values(PLANS).map((p) => ({
    id: p.id,
    rank: p.rank,
    priceCents: p.priceCents,
    currency: 'eur',
    interval: 'month',
    popular: Boolean(p.popular),
    features: p.features,
  }));
}
