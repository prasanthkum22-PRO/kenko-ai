/**
 * KENKO-AI professional SVG icon set.
 * Consistent 24x24 stroke icons — replaces all emoji glyphs across the UI.
 */
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Svg({ children, size = 24, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...base}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconMenu = (p) => (
  <Svg {...p}><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></Svg>
);

export const IconHome = (p) => (
  <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></Svg>
);

export const IconDashboard = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>
);

export const IconVideo = (p) => (
  <Svg {...p}><rect x="2" y="6" width="13" height="12" rx="2" /><path d="m15 10 6-3.5v11L15 14" /></Svg>
);

export const IconMic = (p) => (
  <Svg {...p}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4" /><path d="M8 21h8" /></Svg>
);

export const IconWave = (p) => (
  <Svg {...p}><path d="M2 12h2l2-6 3 12 3-16 3 14 2-4h5" /></Svg>
);

export const IconDoc = (p) => (
  <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h6" /></Svg>
);

export const IconScan = (p) => (
  <Svg {...p}><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M8 12h8" /><path d="M10 8h4" /><path d="M10 16h4" /></Svg>
);

export const IconRx = (p) => (
  <Svg {...p}><path d="M6 3h12" /><path d="M10 3v18" /><path d="M8 21h4" /><path d="m14 12 6 6" /><path d="m20 12-6 6" /></Svg>
);

export const IconPill = (p) => (
  <Svg {...p}><path d="M10.5 20.5a6 6 0 0 1-8.49-8.49l8.49 8.49Z" /><path d="m10.5 20.5 8.49-8.49a6 6 0 1 0-8.49 8.49Z" /><path d="M3.5 10.5 10.5 3.5" /></Svg>
);

export const IconFlask = (p) => (
  <Svg {...p}><path d="M10 2v6l-6 11a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L14 8V2" /><path d="M8.5 2h7" /><path d="M7 15h10" /></Svg>
);

export const IconUsers = (p) => (
  <Svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
);

export const IconShield = (p) => (
  <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></Svg>
);

export const IconClock = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);

export const IconCalendar = (p) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 9h18" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /></Svg>
);

export const IconActivity = (p) => (
  <Svg {...p}><path d="M22 12h-4l-3 8-6-16-3 8H2" /></Svg>
);

export const IconStethoscope = (p) => (
  <Svg {...p}><path d="M4 3v6a5 5 0 0 0 10 0V3" /><path d="M4 3H2" /><path d="M14 3h-2" /><path d="M9 14v2a6 6 0 0 0 12 0v-1" /><circle cx="19" cy="12" r="2.5" /></Svg>
);

export const IconHeart = (p) => (
  <Svg {...p}><path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.6a5 5 0 1 1 7.5 6Z" /></Svg>
);

export const IconLogout = (p) => (
  <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Svg>
);

export const IconSun = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></Svg>
);

export const IconMoon = (p) => (
  <Svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Svg>
);

export const IconChevronDown = (p) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
);

export const IconBell = (p) => (
  <Svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Svg>
);

export const IconHelp = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" /><path d="M12 17h.01" /></Svg>
);

export const IconSearch = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Svg>
);

export const IconPlus = (p) => (
  <Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>
);

export const IconCheck = (p) => (
  <Svg {...p}><path d="m4 12.5 5 5L20 6.5" /></Svg>
);

export const IconX = (p) => (
  <Svg {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>
);

export const IconArrowRight = (p) => (
  <Svg {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Svg>
);

export const IconSparkle = (p) => (
  <Svg {...p}><path d="M12 3v4" /><path d="M12 17v4" /><path d="M3 12h4" /><path d="M17 12h4" /><path d="m6 6 2.5 2.5" /><path d="m15.5 15.5 2.5 2.5" /><path d="m18 6-2.5 2.5" /><path d="m8.5 15.5-2.5 2.5" /></Svg>
);

export const IconRefresh = (p) => (
  <Svg {...p}><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></Svg>
);

export const IconUpload = (p) => (
  <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></Svg>
);

export const IconClipboard = (p) => (
  <Svg {...p}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6" /><path d="M9 16h4" /></Svg>
);

export const IconHospital = (p) => (
  <Svg {...p}><path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /><path d="M9 21v-4h6v4" /><path d="M9 8h6" /><path d="M9 12h6" /></Svg>
);

export const IconUser = (p) => (
  <Svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Svg>
);

export const IconAlert = (p) => (
  <Svg {...p}><path d="M12 3 2 21h20L12 3Z" /><path d="M12 10v5" /><path d="M12 18h.01" /></Svg>
);

export const IconInfo = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-5" /><path d="M12 8h.01" /></Svg>
);

export const IconChart = (p) => (
  <Svg {...p}><path d="M3 3v18h18" /><path d="m7 15 4-5 3 3 5-7" /></Svg>
);

export const IconSettings = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></Svg>
);

export const IconEye = (p) => (
  <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Svg>
);

export const IconEyeOff = (p) => (
  <Svg {...p}><path d="M2 4.5 4.5 7m0 0A15.3 15.3 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.5-1M5.5 9.5A13 13 0 0 0 2 12s3.5 7 10 7c1.6 0 3-.4 4.5-1" /><path d="m15.5 7.4 .6-2.9a13 13 0 0 1 5.9 7.5s-3.5 7-10 7c-1 0-2-.2-2.9-.5" /></Svg>
);

export const IconMapPin = (p) => (
  <Svg {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Svg>
);

export const IconPrinter = (p) => (
  <Svg {...p}><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></Svg>
);

export const IconStop = (p) => (
  <Svg {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></Svg>
);

export const IconPlay = (p) => (
  <Svg {...p}><path d="m7 4 13 8-13 8V4Z" /></Svg>
);

export const IconPause = (p) => (
  <Svg {...p}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></Svg>
);

export const IconSend = (p) => (
  <Svg {...p}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Svg>
);

export const IconFilter = (p) => (
  <Svg {...p}><path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z" /></Svg>
);

export default Svg;