// SVG de la mascotte, une pose par niveau de forme.
function meerkitSVG(state) {
  const score = {TM:0,M:1,Moy:2,B:3,TB:4}[state] ?? -1;
  const tan='#C4945A',dtan='#8B6335',cream='#E8D5A8',earPink='#D4916E',dk='#3C1F0A';

  // ── TM : endormi paisiblement, assis, gros Zzz bien visibles ────────────────
  if (score===0) return `<svg viewBox="0 0 88 145" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
    <!-- Zzz gros et lisibles -->
    <text x="56" y="34" font-size="22" fill="#5b8dbf" font-family="'Segoe UI',system-ui,sans-serif" font-weight="bold">Z</text>
    <text x="70" y="20" font-size="15" fill="#5b8dbf" opacity="0.75" font-family="'Segoe UI',system-ui,sans-serif" font-weight="bold">z</text>
    <text x="80" y="10" font-size="10" fill="#5b8dbf" opacity="0.5" font-family="'Segoe UI',system-ui,sans-serif" font-weight="bold">z</text>
    <!-- queue -->
    <path d="M55,128 Q75,112 72,88 Q69,72 60,74" stroke="${dtan}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M55,128 Q75,112 72,88 Q69,72 60,74" stroke="${tan}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="6,7"/>
    <!-- corps assis détendu -->
    <ellipse cx="42" cy="105" rx="22" ry="26" fill="${tan}"/>
    <ellipse cx="42" cy="107" rx="13" ry="18" fill="${cream}"/>
    <!-- bras posés sur le ventre -->
    <ellipse cx="24" cy="112" rx="7" ry="9" fill="${tan}" transform="rotate(20,24,112)"/>
    <ellipse cx="60" cy="112" rx="7" ry="9" fill="${tan}" transform="rotate(-20,60,112)"/>
    <!-- pieds posés au sol -->
    <ellipse cx="33" cy="132" rx="10" ry="5" fill="${dtan}"/>
    <ellipse cx="51" cy="132" rx="10" ry="5" fill="${dtan}"/>
    <!-- tête légèrement penchée, expression paisible -->
    <g transform="rotate(8,43,80)">
      <circle cx="43" cy="58" r="26" fill="${tan}"/>
      <circle cx="21" cy="38" r="9" fill="${tan}"/>
      <circle cx="65" cy="38" r="9" fill="${tan}"/>
      <circle cx="21" cy="38" r="5.5" fill="${earPink}"/>
      <circle cx="65" cy="38" r="5.5" fill="${earPink}"/>
      <!-- patches oculaires -->
      <circle cx="31" cy="56" r="12" fill="${dtan}" opacity="0.4"/>
      <circle cx="55" cy="56" r="12" fill="${dtan}" opacity="0.4"/>
      <!-- cernes marquées : deux couches sous chaque œil -->
      <ellipse cx="31" cy="64" rx="10" ry="4.5" fill="#5B4A9E" opacity="0.55"/>
      <ellipse cx="55" cy="64" rx="10" ry="4.5" fill="#5B4A9E" opacity="0.55"/>
      <ellipse cx="31" cy="67" rx="8" ry="2.6" fill="#4A3A85" opacity="0.45"/>
      <ellipse cx="55" cy="67" rx="8" ry="2.6" fill="#4A3A85" opacity="0.45"/>
      <path d="M23,62 Q31,67 39,62" stroke="#4A3A85" stroke-width="1.4" fill="none" opacity="0.6" stroke-linecap="round"/>
      <path d="M47,62 Q55,67 63,62" stroke="#4A3A85" stroke-width="1.4" fill="none" opacity="0.6" stroke-linecap="round"/>
      <!-- sourcils tombants vers l'extérieur : air malheureux -->
      <path d="M23,46 Q31,42 38,47" stroke="${dtan}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M48,47 Q55,42 63,46" stroke="${dtan}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <!-- yeux fermés, paupières lourdes tombant vers l'extérieur -->
      <path d="M24,55 Q31,61 38,56" stroke="${dk}" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M48,56 Q55,61 62,55" stroke="${dk}" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <!-- nez -->
      <ellipse cx="43" cy="72" rx="4.5" ry="3" fill="${dk}"/>
      <!-- bouche tombante : malheureux -->
      <path d="M37,81 Q43,76 49,81" stroke="${dk}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;

  // ── M: tired, rubbing an eye ────────────────────────────────────────────────
  if (score===1) return `<svg viewBox="0 0 88 140" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
    <path d="M57,126 Q78,108 74,84 Q70,68 62,70" stroke="${dtan}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M57,126 Q78,108 74,84 Q70,68 62,70" stroke="${tan}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="6,7"/>
    <ellipse cx="43" cy="102" rx="22" ry="27" fill="${tan}"/>
    <ellipse cx="43" cy="104" rx="13" ry="19" fill="${cream}"/>
    <!-- bras gauche : se frotte l'œil -->
    <path d="M24,100 Q18,85 25,70 Q30,60 33,55" stroke="${tan}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <!-- bras droit pendant -->
    <ellipse cx="62" cy="112" rx="7" ry="9" fill="${tan}" transform="rotate(-8,62,112)"/>
    <ellipse cx="33" cy="128" rx="10" ry="5" fill="${dtan}"/>
    <ellipse cx="53" cy="128" rx="10" ry="5" fill="${dtan}"/>
    <!-- tête légèrement inclinée -->
    <g transform="rotate(8,43,75)">
      <circle cx="43" cy="52" r="27" fill="${tan}"/>
      <circle cx="20" cy="31" r="9.5" fill="${tan}"/>
      <circle cx="66" cy="31" r="9.5" fill="${tan}"/>
      <circle cx="20" cy="31" r="6" fill="${earPink}"/>
      <circle cx="66" cy="31" r="6" fill="${earPink}"/>
      <circle cx="31" cy="52" r="12.5" fill="${dtan}" opacity="0.4"/>
      <circle cx="55" cy="52" r="12.5" fill="${dtan}" opacity="0.4"/>
      <!-- sourcils tombants -->
      <path d="M25,41 Q31,44 37,41" stroke="${dtan}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M49,41 Q55,44 61,41" stroke="${dtan}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- œil gauche fermé (se frotte) -->
      <ellipse cx="31" cy="53" rx="9" ry="2" fill="${dk}"/>
      <rect x="22" y="43" width="18" height="12" fill="${tan}" rx="2"/>
      <path d="M23,53 Q31,56 39,53" stroke="${dk}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <!-- main qui se frotte l'œil -->
      <ellipse cx="28" cy="47" rx="7" ry="5" fill="${tan}" transform="rotate(-20,28,47)"/>
      <!-- œil droit mi-clos, pupille à peine visible -->
      <circle cx="55" cy="54" r="7.5" fill="${dk}"/>
      <circle cx="57" cy="52" r="2" fill="white"/>
      <rect x="46" y="43" width="18" height="13" fill="${tan}" rx="2"/>
      <path d="M47,52 Q55,55 63,52" stroke="${dk}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- cerne œil droit -->
      <ellipse cx="55" cy="62" rx="8" ry="3.5" fill="#6050A8" opacity="0.35"/>
      <!-- nez + bouche fatiguée -->
      <ellipse cx="43" cy="62" rx="4.5" ry="3" fill="${dk}"/>
      <path d="M36,68 Q43,67 50,68" stroke="${dk}" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;

  // ── Moy : debout, posture normale ───────────────────────────────────────────
  if (score===2 || score<0) return `<svg viewBox="0 0 88 135" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
    <path d="M58,125 Q80,105 76,80 Q72,65 63,68" stroke="${dtan}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M58,125 Q80,105 76,80 Q72,65 63,68" stroke="${tan}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="6,7"/>
    <ellipse cx="43" cy="100" rx="22" ry="28" fill="${tan}"/>
    <ellipse cx="43" cy="102" rx="13" ry="20" fill="${cream}"/>
    <ellipse cx="24" cy="108" rx="9" ry="6" fill="${tan}" transform="rotate(-20,24,108)"/>
    <ellipse cx="62" cy="108" rx="9" ry="6" fill="${tan}" transform="rotate(20,62,108)"/>
    <ellipse cx="33" cy="126" rx="10" ry="5" fill="${dtan}"/>
    <ellipse cx="53" cy="126" rx="10" ry="5" fill="${dtan}"/>
    <circle cx="43" cy="50" r="28" fill="${tan}"/>
    <circle cx="19" cy="28" r="10" fill="${tan}"/>
    <circle cx="67" cy="28" r="10" fill="${tan}"/>
    <circle cx="19" cy="28" r="6" fill="${earPink}"/>
    <circle cx="67" cy="28" r="6" fill="${earPink}"/>
    <circle cx="31" cy="50" r="13" fill="${dtan}" opacity="0.4"/>
    <circle cx="55" cy="50" r="13" fill="${dtan}" opacity="0.4"/>
    <circle cx="31" cy="50" r="7" fill="${dk}"/><circle cx="33" cy="48" r="2.5" fill="white"/>
    <circle cx="55" cy="50" r="7" fill="${dk}"/><circle cx="57" cy="48" r="2.5" fill="white"/>
    <ellipse cx="43" cy="61" rx="5" ry="3.5" fill="${dk}"/>
    <line x1="36" y1="67" x2="50" y2="67" stroke="${dk}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  // ── B: in good shape, walking briskly, arm swinging ─────────────────────────
  if (score===3) return `<svg viewBox="0 0 96 140" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
    <!-- queue relevée (énergie) -->
    <path d="M62,122 Q82,100 78,74 Q75,58 68,55" stroke="${dtan}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M62,122 Q82,100 78,74 Q75,58 68,55" stroke="${tan}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="6,7"/>
    <!-- corps légèrement penché en avant -->
    <g transform="rotate(-5,47,105)">
      <ellipse cx="47" cy="105" rx="22" ry="27" fill="${tan}"/>
      <ellipse cx="47" cy="107" rx="13" ry="19" fill="${cream}"/>
    </g>
    <!-- bras gauche en avant (marche) -->
    <path d="M28,96 Q16,82 18,68" stroke="${tan}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <ellipse cx="18" cy="64" rx="7" ry="5" fill="${tan}"/>
    <!-- bras droit en arrière -->
    <path d="M66,96 Q76,108 72,120" stroke="${tan}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <!-- jambe gauche en avant -->
    <path d="M38,128 Q34,136 28,138" stroke="${tan}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <ellipse cx="26" cy="138" rx="9" ry="4" fill="${dtan}" transform="rotate(30,26,138)"/>
    <!-- jambe droite en arrière -->
    <path d="M54,128 Q60,134 64,130" stroke="${tan}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <ellipse cx="66" cy="130" rx="8" ry="4" fill="${dtan}" transform="rotate(-20,66,130)"/>
    <!-- tête -->
    <circle cx="47" cy="50" r="27" fill="${tan}"/>
    <circle cx="24" cy="29" r="9.5" fill="${tan}"/>
    <circle cx="70" cy="29" r="9.5" fill="${tan}"/>
    <circle cx="24" cy="29" r="6" fill="${earPink}"/>
    <circle cx="70" cy="29" r="6" fill="${earPink}"/>
    <circle cx="35" cy="50" r="12.5" fill="${dtan}" opacity="0.4"/>
    <circle cx="59" cy="50" r="12.5" fill="${dtan}" opacity="0.4"/>
    <!-- sourcils relevés -->
    <path d="M29,38 Q35,34 41,37" stroke="${dtan}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M53,37 Q59,34 65,38" stroke="${dtan}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <!-- yeux grands ouverts -->
    <circle cx="35" cy="50" r="8" fill="${dk}"/><circle cx="37.5" cy="47.5" r="3" fill="white"/>
    <circle cx="59" cy="50" r="8" fill="${dk}"/><circle cx="61.5" cy="47.5" r="3" fill="white"/>
    <ellipse cx="47" cy="61" rx="5" ry="3.5" fill="${dk}"/>
    <path d="M38,66 Q47,71 56,66" stroke="${dk}" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`;

  // ── TB: bursting with energy, lifting a barbell overhead ────────────────────
  return `<svg viewBox="0 0 100 148" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
    <!-- étincelles d'effort -->
    <line x1="8"  y1="44" x2="2"  y2="38" stroke="#F5C518" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="92" y1="44" x2="98" y2="38" stroke="#F5C518" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="24" y1="12" x2="20" y2="6"  stroke="#F5C518" stroke-width="2"   stroke-linecap="round"/>
    <line x1="76" y1="12" x2="80" y2="6"  stroke="#F5C518" stroke-width="2"   stroke-linecap="round"/>
    <!-- queue dynamique -->
    <path d="M65,128 Q88,108 84,80 Q82,62 75,56" stroke="${dtan}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M65,128 Q88,108 84,80 Q82,62 75,56" stroke="${tan}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="6,7"/>
    <!-- barre d'haltères au-dessus de la tête -->
    <line x1="13" y1="22" x2="87" y2="22" stroke="#5a6b7d" stroke-width="4" stroke-linecap="round"/>
    <rect x="8"  y="10" width="9" height="24" rx="3" fill="#3d4a59"/>
    <rect x="83" y="10" width="9" height="24" rx="3" fill="#3d4a59"/>
    <rect x="17" y="14" width="6" height="16" rx="2" fill="#5a6b7d"/>
    <rect x="77" y="14" width="6" height="16" rx="2" fill="#5a6b7d"/>
    <!-- corps debout, jambes fléchies (effort) -->
    <ellipse cx="50" cy="106" rx="21" ry="25" fill="${tan}"/>
    <ellipse cx="50" cy="108" rx="12" ry="18" fill="${cream}"/>
    <!-- jambes écartées fléchies -->
    <path d="M40,128 Q34,138 26,140" stroke="${tan}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <ellipse cx="24" cy="140" rx="10" ry="5" fill="${dtan}" transform="rotate(15,24,140)"/>
    <path d="M60,128 Q66,138 74,140" stroke="${tan}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <ellipse cx="76" cy="140" rx="10" ry="5" fill="${dtan}" transform="rotate(-15,76,140)"/>
    <!-- bras tendus vers la barre -->
    <path d="M36,94 Q28,60 30,28" stroke="${tan}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <ellipse cx="30" cy="25" rx="7" ry="6" fill="${tan}"/>
    <path d="M64,94 Q72,60 70,28" stroke="${tan}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <ellipse cx="70" cy="25" rx="7" ry="6" fill="${tan}"/>
    <!-- tête -->
    <circle cx="50" cy="54" r="26" fill="${tan}"/>
    <circle cx="28" cy="34" r="9.5" fill="${tan}"/>
    <circle cx="72" cy="34" r="9.5" fill="${tan}"/>
    <circle cx="28" cy="34" r="6" fill="${earPink}"/>
    <circle cx="72" cy="34" r="6" fill="${earPink}"/>
    <circle cx="39" cy="54" r="12.5" fill="${dtan}" opacity="0.4"/>
    <circle cx="61" cy="54" r="12.5" fill="${dtan}" opacity="0.4"/>
    <!-- sourcils relevés, déterminés -->
    <path d="M33,42 Q39,37 45,41" stroke="${dtan}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M55,41 Q61,37 67,42" stroke="${dtan}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <!-- yeux grands ouverts, brillants -->
    <circle cx="39" cy="54" r="8.5" fill="${dk}"/><circle cx="41.5" cy="51.5" r="3" fill="white"/>
    <circle cx="61" cy="54" r="8.5" fill="${dk}"/><circle cx="63.5" cy="51.5" r="3" fill="white"/>
    <!-- joues rosées -->
    <ellipse cx="30" cy="63" rx="5.5" ry="5" fill="#E07060" opacity="0.3"/>
    <ellipse cx="70" cy="63" rx="5.5" ry="5" fill="#E07060" opacity="0.3"/>
    <ellipse cx="50" cy="64" rx="5" ry="3.5" fill="${dk}"/>
    <!-- grand sourire d'effort joyeux -->
    <path d="M39,70 Q50,79 61,70" stroke="${dk}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}

// Identifiants uniques pour les clipPath des mini nuages de points
