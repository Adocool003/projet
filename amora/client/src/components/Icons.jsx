// Jeu d'icônes SVG minimal (aucune dépendance externe, aucune requête tierce).
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const make = (paths, filled = false) => function Icon({ size = 24, ...props }) {
  return (
    <svg {...base} width={size} height={size} fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} {...props}>
      {paths}
    </svg>
  );
};

export const IconFlame = make(<path d="M12 2c1 3.5-1.5 5-1.5 7.5A2.5 2.5 0 0 0 13 12c1.4 0 2.5-1.1 2.5-2.5 0-.6-.1-1.1-.3-1.6C17.6 9.4 19 12 19 14.5A7 7 0 0 1 5 14.5C5 9.5 9.5 7 12 2z" />);
export const IconHeart = make(<path d="M12 21s-7.5-4.6-9.5-9.6C1.2 8 3.5 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.5 0 5.8 3.5 4.5 6.9-2 5-9.5 9.6-9.5 9.6z" />, true);
export const IconHeartOutline = make(<path d="M12 21s-7.5-4.6-9.5-9.6C1.2 8 3.5 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.5 0 5.8 3.5 4.5 6.9-2 5-9.5 9.6-9.5 9.6z" />);
export const IconX = make(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const IconStar = make(<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />, true);
export const IconStarOutline = make(<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />);
export const IconRewind = make(<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>);
export const IconBolt = make(<path d="M13 2 4 14h7l-1 8 9-12h-7z" />, true);
export const IconChat = make(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />);
export const IconUser = make(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>);
export const IconSettings = make(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const IconPin = make(<><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>);
export const IconBriefcase = make(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>);
export const IconCrown = make(<path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5z" />, true);
export const IconCheck = make(<path d="m5 12 5 5L20 7" />);
export const IconLock = make(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IconShield = make(<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />);
export const IconFlag = make(<><path d="M4 22V4" /><path d="M4 4h12l-2 4 2 4H4" /></>);
export const IconPlane = make(<path d="M2.5 13.5 21 6l-3.5 14-5-5.5-4 3.5v-5L21 6" />);
export const IconEye = make(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
export const IconPlus = make(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IconChevronLeft = make(<path d="m15 18-6-6 6-6" />);
export const IconSend = make(<><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></>);
export const IconMore = make(<><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>);
