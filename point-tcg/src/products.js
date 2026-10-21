// src/products.js
// Point TCG - Pokémon Card Drawings Catalog
// E-commerce Storeframe Showcase Images

const escapeXml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Generates an authentic E-Commerce Game Store Product Showcase Image:
 *  - 1:1 Clean Studio White Canvas with realistic contact drop shadow.
 *  - Bold Red Outer Border Frame with rounded corners.
 *  - Top Header: "CHÍNH HÃNG - UY TÍN - CHẤT LƯỢNG".
 *  - Top-Left Sale / Discount Tag: e.g. "-35% OFF", "-28% OFF", "HOT DEAL".
 *  - High-Detail 3D Product Packaging in the center (Blister 3-pack, Booster Box, UPC Luxury Box, Window Display Box, Mini Tin display, Booster Bundle).
 *  - Bottom-Left Certification Pills: [TCG Blue] [Nintendo Switch Red] [Pokéball Official Seal].
 *  - Bottom-Right Store Branding: Point TCG GAMESTORE.
 */
export const createShowcaseBoxSvg = (options = {}) => {
  const {
    title = 'POKÉMON TCG',
    boxSubtitle = 'SEALED COLLECTION',
    themeGradient = '<stop offset="0%" stop-color="#ea580c"/><stop offset="100%" stop-color="#7c2d12"/>',
    accentColor = '#ea580c',
    badgeText = '-35%',
    badgeSubText = 'OFF',
    boxType = 'blister', // 'blister' | 'booster_box' | 'upc' | 'pikachu_window' | 'mini_tin_display' | 'bundle'
    emoji = '🔥',
    featuredName = 'CHARIZARD',
    packCount = '3 PACKS'
  } = options;

  const uid = Math.random().toString(36).substring(2, 8);
  const bgGradId = `bgGrad_${uid}`;
  const goldGradId = `goldGrad_${uid}`;

  const safeTitle = escapeXml(title);
  const safeSubtitle = escapeXml(boxSubtitle);
  const safeFeatured = escapeXml(featuredName);
  const safePacks = escapeXml(packCount);
  const safeBadge = escapeXml(badgeText);
  const safeBadgeSub = escapeXml(badgeSubText);

  // Center package illustration based on boxType
  let productPackagingMarkup = '';

  if (boxType === 'blister') {
    // 3-Pack Blister with Promo Card
    productPackagingMarkup = `
      <!-- BLISTER CARD BACKING -->
      <g filter="url(#dropShadow)">
        <rect x="110" y="65" width="280" height="345" rx="14" fill="url(#${bgGradId})" stroke="#cbd5e1" stroke-width="1.5"/>
        
        <!-- Peg slot at top -->
        <rect x="230" y="78" width="40" height="9" rx="4.5" fill="#ffffff" stroke="#94a3b8" stroke-width="1"/>
        
        <!-- Backing card header branding -->
        <rect x="130" y="96" width="240" height="20" rx="10" fill="#0b1b3d" fill-opacity="0.85"/>
        <text x="250" y="110" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="10.5" font-weight="900" fill="#ffc220" text-anchor="middle" letter-spacing="1">POKÉMON TRADING CARD GAME</text>
        
        <!-- Blister thermoformed clear plastic dome -->
        <rect x="125" y="125" width="250" height="265" rx="12" fill="#ffffff" fill-opacity="0.2" stroke="#ffffff" stroke-width="2.5" stroke-opacity="0.9"/>
        
        <!-- 3 Booster Packs inside bubble -->
        <!-- Pack 1 (Left) -->
        <g transform="translate(140, 140) rotate(-6)">
          <rect x="0" y="0" width="70" height="125" rx="4" fill="#1e293b" stroke="#cbd5e1" stroke-width="1"/>
          <line x1="0" y1="8" x2="70" y2="8" stroke="#94a3b8" stroke-width="2" stroke-dasharray="2,2"/>
          <line x1="0" y1="117" x2="70" y2="117" stroke="#94a3b8" stroke-width="2" stroke-dasharray="2,2"/>
          <rect x="8" y="20" width="54" height="75" rx="3" fill="${accentColor}" fill-opacity="0.8"/>
          <text x="35" y="62" font-size="28" text-anchor="middle">${emoji}</text>
          <text x="35" y="106" font-family="-apple-system, sans-serif" font-size="7" font-weight="800" fill="#ffffff" text-anchor="middle">BOOSTER</text>
        </g>
        
        <!-- Pack 3 (Right) -->
        <g transform="translate(290, 140) rotate(6)">
          <rect x="0" y="0" width="70" height="125" rx="4" fill="#0f172a" stroke="#cbd5e1" stroke-width="1"/>
          <line x1="0" y1="8" x2="70" y2="8" stroke="#94a3b8" stroke-width="2" stroke-dasharray="2,2"/>
          <line x1="0" y1="117" x2="70" y2="117" stroke="#94a3b8" stroke-width="2" stroke-dasharray="2,2"/>
          <rect x="8" y="20" width="54" height="75" rx="3" fill="${accentColor}" fill-opacity="0.6"/>
          <text x="35" y="62" font-size="28" text-anchor="middle">⚡</text>
          <text x="35" y="106" font-family="-apple-system, sans-serif" font-size="7" font-weight="800" fill="#ffffff" text-anchor="middle">BOOSTER</text>
        </g>
        
        <!-- Pack 2 (Center) -->
        <g transform="translate(215, 135)">
          <rect x="0" y="0" width="70" height="125" rx="4" fill="#0b1b3d" stroke="#f1f5f9" stroke-width="1.5"/>
          <line x1="0" y1="8" x2="70" y2="8" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="2,2"/>
          <line x1="0" y1="117" x2="70" y2="117" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="2,2"/>
          <rect x="8" y="20" width="54" height="75" rx="3" fill="#3b82f6" fill-opacity="0.8"/>
          <text x="35" y="62" font-size="28" text-anchor="middle">✨</text>
          <text x="35" y="106" font-family="-apple-system, sans-serif" font-size="7" font-weight="800" fill="#ffffff" text-anchor="middle">10 CARDS</text>
        </g>

        <!-- Foil Promo Card in Front -->
        <g transform="translate(195, 230)" filter="url(#dropShadow)">
          <rect x="0" y="0" width="110" height="152" rx="6" fill="#0f172a" stroke="url(#${goldGradId})" stroke-width="2.5"/>
          <rect x="6" y="6" width="98" height="140" rx="4" fill="#1e1b4b"/>
          <!-- Card Header -->
          <text x="12" y="20" font-family="-apple-system, sans-serif" font-size="8" font-weight="800" fill="#ffffff">${safeFeatured}</text>
          <text x="96" y="20" font-family="-apple-system, sans-serif" font-size="7.5" font-weight="900" fill="#ef4444" text-anchor="end">HP 130</text>
          <!-- Card Art Window -->
          <rect x="10" y="26" width="90" height="66" rx="4" fill="url(#${bgGradId})"/>
          <text x="55" y="68" font-size="38" text-anchor="middle">${emoji}</text>
          <!-- Holo Sheen -->
          <polygon points="10,26 40,26 10,92" fill="#ffffff" fill-opacity="0.25"/>
          <polygon points="60,26 90,26 30,92 10,92" fill="#ffffff" fill-opacity="0.15"/>
          <!-- Attack bar & Holo Foil Stamp -->
          <rect x="12" y="98" width="86" height="34" rx="3" fill="#0f172a" fill-opacity="0.7"/>
          <text x="18" y="112" font-family="-apple-system, sans-serif" font-size="7" font-weight="700" fill="#fbbf24">★ SPECIAL PROMO</text>
          <text x="18" y="124" font-family="-apple-system, sans-serif" font-size="6" fill="#94a3b8">Verified Factory Sealed Foil</text>
          <circle cx="88" cy="116" r="6" fill="#ffc220" fill-opacity="0.3"/>
          <text x="88" y="119" font-family="-apple-system, sans-serif" font-size="7" font-weight="900" fill="#ffffff" text-anchor="middle">★</text>
        </g>

        <!-- Blister Footer Plaque -->
        <rect x="135" y="366" width="230" height="32" rx="6" fill="#0f172a" stroke="#cbd5e1" stroke-width="1"/>
        <text x="250" y="380" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="10.5" font-weight="800" fill="#ffffff" text-anchor="middle">${safeSubtitle}</text>
        <text x="250" y="392" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="7.5" font-weight="700" fill="#93c5fd" text-anchor="middle" letter-spacing="0.5">3 BOOSTER PACKS + 1 FOIL PROMO CARD</text>
      </g>
    `;
  } else if (boxType === 'booster_box') {
    // 36-Pack Sealed Booster Display Box (Evolving Skies / Chaos Rising)
    productPackagingMarkup = `
      <g filter="url(#dropShadow)">
        <!-- Header Fold-Up Sign -->
        <polygon points="120,80 380,80 370,170 130,170" fill="url(#${bgGradId})" stroke="url(#${goldGradId})" stroke-width="2"/>
        <rect x="135" y="90" width="230" height="22" rx="4" fill="#0b1b3d" fill-opacity="0.85"/>
        <text x="250" y="105" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="12" font-weight="900" fill="#ffc220" text-anchor="middle" letter-spacing="1">POKÉMON BOOSTER BOX</text>
        <text x="250" y="132" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="16" font-weight="900" fill="#ffffff" text-anchor="middle">${safeFeatured}</text>
        <text x="250" y="152" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="9" font-weight="800" fill="#6ee7b7" text-anchor="middle" letter-spacing="0.8">36 BOOSTER PACKS • FACTORY SEALED</text>
        <text x="160" y="150" font-size="28" text-anchor="middle">${emoji}</text>
        <text x="340" y="150" font-size="28" text-anchor="middle">${emoji}</text>

        <!-- Main Display Carton Body -->
        <rect x="110" y="165" width="280" height="240" rx="10" fill="#0f172a" stroke="url(#${goldGradId})" stroke-width="2.5"/>
        
        <!-- Left Column of 18 Packs -->
        <g transform="translate(125, 180)">
          <rect x="0" y="0" width="120" height="150" rx="6" fill="#1e293b" stroke="#475569" stroke-width="1"/>
          <line x1="0" y1="12" x2="120" y2="12" stroke="#cbd5e1" stroke-width="2"/>
          <line x1="0" y1="24" x2="120" y2="24" stroke="#cbd5e1" stroke-width="1.5"/>
          <line x1="0" y1="36" x2="120" y2="36" stroke="#cbd5e1" stroke-width="1.5"/>
          <rect x="10" y="45" width="100" height="95" rx="4" fill="url(#${bgGradId})"/>
          <text x="60" y="95" font-size="34" text-anchor="middle">${emoji}</text>
          <text x="60" y="128" font-family="-apple-system, sans-serif" font-size="8" font-weight="900" fill="#ffffff" text-anchor="middle">BOOSTER 10 CARDS</text>
        </g>

        <!-- Right Column of 18 Packs -->
        <g transform="translate(255, 180)">
          <rect x="0" y="0" width="120" height="150" rx="6" fill="#1e293b" stroke="#475569" stroke-width="1"/>
          <line x1="0" y1="12" x2="120" y2="12" stroke="#cbd5e1" stroke-width="2"/>
          <line x1="0" y1="24" x2="120" y2="24" stroke="#cbd5e1" stroke-width="1.5"/>
          <line x1="0" y1="36" x2="120" y2="36" stroke="#cbd5e1" stroke-width="1.5"/>
          <rect x="10" y="45" width="100" height="95" rx="4" fill="url(#${bgGradId})"/>
          <text x="60" y="95" font-size="34" text-anchor="middle">${emoji}</text>
          <text x="60" y="128" font-family="-apple-system, sans-serif" font-size="8" font-weight="900" fill="#ffffff" text-anchor="middle">BOOSTER 10 CARDS</text>
        </g>

        <!-- Front Lip Plaque -->
        <rect x="110" y="340" width="280" height="65" rx="8" fill="#0b1b3d" stroke="#f59e0b" stroke-width="2"/>
        <text x="250" y="365" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="13" font-weight="900" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
        <text x="250" y="388" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="9" font-weight="800" fill="#38bdf8" text-anchor="middle" letter-spacing="1">FACTORY SEALED SHRINK-WRAP • AUTHENTIC</text>

        <!-- Cellophane shrink-wrap shimmer & Pokéball stamps -->
        <polygon points="110,165 240,165 110,320" fill="#ffffff" fill-opacity="0.12"/>
        <polygon points="260,165 390,165 170,405 110,405" fill="#ffffff" fill-opacity="0.08"/>
        <circle cx="160" cy="240" r="14" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.35"/>
        <line x1="146" y1="240" x2="174" y2="240" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.35"/>
        <circle cx="340" cy="280" r="14" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.35"/>
        <line x1="326" y1="280" x2="354" y2="280" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.35"/>
      </g>
    `;
  } else if (boxType === 'upc') {
    // Ultra-Premium Collection Box (Scarlet & Violet 151 UPC / Prismatic Eevee)
    productPackagingMarkup = `
      <g filter="url(#dropShadow)">
        <rect x="75" y="115" width="350" height="280" rx="14" fill="#0b0f19" stroke="url(#${goldGradId})" stroke-width="3"/>
        <rect x="85" y="125" width="330" height="260" rx="10" fill="url(#${bgGradId})"/>
        
        <!-- Gold Leaf Corner Accents -->
        <path d="M 95 145 L 95 135 L 105 135" fill="none" stroke="#fbbf24" stroke-width="2.5"/>
        <path d="M 405 145 L 405 135 L 395 135" fill="none" stroke="#fbbf24" stroke-width="2.5"/>
        <path d="M 95 365 L 95 375 L 105 375" fill="none" stroke="#fbbf24" stroke-width="2.5"/>
        <path d="M 405 365 L 405 375 L 395 375" fill="none" stroke="#fbbf24" stroke-width="2.5"/>

        <!-- Top Gold Ribbon -->
        <rect x="140" y="140" width="220" height="26" rx="13" fill="#0b1b3d" stroke="#f59e0b" stroke-width="1.5"/>
        <text x="250" y="157" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="11" font-weight="900" fill="#fef08a" text-anchor="middle" letter-spacing="1.5">ULTRA-PREMIUM COLLECTION</text>

        <!-- Center Embossed Mew / Pokémon Crest -->
        <circle cx="250" cy="235" r="54" fill="#0f172a" stroke="url(#${goldGradId})" stroke-width="2.5"/>
        <circle cx="250" cy="235" r="44" fill="#ffffff" fill-opacity="0.1"/>
        <text x="250" y="255" font-size="52" text-anchor="middle" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.5))">${emoji}</text>

        <!-- Foil Pack Peeks Behind Tray -->
        <g transform="translate(100, 290)">
          <rect x="0" y="0" width="60" height="40" rx="4" fill="#1e293b" stroke="#fbbf24" stroke-width="1"/>
          <text x="30" y="24" font-size="16" text-anchor="middle">🔥</text>
        </g>
        <g transform="translate(340, 290)">
          <rect x="0" y="0" width="60" height="40" rx="4" fill="#1e293b" stroke="#fbbf24" stroke-width="1"/>
          <text x="30" y="24" font-size="16" text-anchor="middle">✨</text>
        </g>

        <!-- Engraved Gold Metal Plaque at Bottom -->
        <rect x="110" y="315" width="280" height="55" rx="8" fill="#0f172a" stroke="url(#${goldGradId})" stroke-width="2"/>
        <text x="250" y="338" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="13" font-weight="900" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
        <text x="250" y="356" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="9" font-weight="700" fill="#93c5fd" text-anchor="middle" letter-spacing="1">16 BOOSTER PACKS • ETCHED METAL CARDS • PLAYMAT</text>

        <polygon points="75,115 150,115 425,315 425,395" fill="#ffffff" fill-opacity="0.08"/>
      </g>
    `;
  } else if (boxType === 'pikachu_window') {
    // Window Display Box (Crown Zenith Pikachu VMAX / Unova Box)
    productPackagingMarkup = `
      <g filter="url(#dropShadow)">
        <rect x="85" y="90" width="330" height="315" rx="14" fill="#0f172a" stroke="#f59e0b" stroke-width="2.5"/>
        <rect x="95" y="100" width="310" height="295" rx="10" fill="url(#${bgGradId})"/>

        <!-- Top Header Strip -->
        <rect x="110" y="112" width="280" height="28" rx="6" fill="#0b1b3d" stroke="#facc15" stroke-width="1.5"/>
        <text x="250" y="131" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="12" font-weight="900" fill="#facc15" text-anchor="middle" letter-spacing="1">${safeSubtitle}</text>

        <!-- Big Window Frame -->
        <rect x="110" y="150" width="280" height="195" rx="8" fill="#0b0f19" stroke="#ffffff" stroke-width="2"/>

        <!-- Left: Boosters Stack -->
        <g transform="translate(122, 162)">
          <rect x="0" y="0" width="85" height="165" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="1"/>
          <rect x="6" y="8" width="73" height="42" rx="3" fill="#2563eb"/>
          <text x="42" y="34" font-size="18" text-anchor="middle">⚡</text>
          <rect x="6" y="56" width="73" height="42" rx="3" fill="#059669"/>
          <text x="42" y="82" font-size="18" text-anchor="middle">🐉</text>
          <rect x="6" y="104" width="73" height="52" rx="3" fill="#dc2626"/>
          <text x="42" y="134" font-size="20" text-anchor="middle">${emoji}</text>
        </g>

        <!-- Right: Oversize Pikachu VMAX Card -->
        <g transform="translate(220, 160)" filter="url(#dropShadow)">
          <rect x="0" y="0" width="158" height="175" rx="8" fill="#1e1b4b" stroke="#eab308" stroke-width="2.5"/>
          <text x="12" y="20" font-family="-apple-system, sans-serif" font-size="10" font-weight="900" fill="#fef08a">${safeFeatured}</text>
          <text x="146" y="20" font-family="-apple-system, sans-serif" font-size="9" font-weight="900" fill="#ef4444" text-anchor="end">HP 310</text>
          <rect x="10" y="28" width="138" height="100" rx="5" fill="#0f172a"/>
          <circle cx="79" cy="78" r="38" fill="#eab308" fill-opacity="0.2"/>
          <text x="79" y="96" font-size="58" text-anchor="middle">${emoji}</text>
          <text x="79" y="148" font-family="-apple-system, sans-serif" font-size="9" font-weight="800" fill="#ffffff" text-anchor="middle">G-MAX VOLT TACKLE</text>
          <text x="79" y="162" font-family="-apple-system, sans-serif" font-size="8" font-weight="700" fill="#facc15" text-anchor="middle">OVERSIZE JUMBO CARD</text>
        </g>

        <!-- Bottom Banner Title -->
        <rect x="110" y="354" width="280" height="34" rx="6" fill="#0f172a" stroke="#f59e0b" stroke-width="1.5"/>
        <text x="250" y="375" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
      </g>
    `;
  } else if (boxType === 'mini_tin_display') {
    // 10-Count Mini Tin Counter Display Box
    productPackagingMarkup = `
      <g filter="url(#dropShadow)">
        <polygon points="110,85 390,85 380,165 120,165" fill="url(#${bgGradId})" stroke="url(#${goldGradId})" stroke-width="2"/>
        <text x="250" y="118" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="15" font-weight="900" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
        <text x="250" y="142" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="10" font-weight="800" fill="#38bdf8" text-anchor="middle" letter-spacing="1">10 MINI TINS FACTORY DISPLAY BOX</text>
        <text x="145" y="135" font-size="28" text-anchor="middle">${emoji}</text>
        <text x="355" y="135" font-size="28" text-anchor="middle">${emoji}</text>

        <rect x="100" y="160" width="300" height="245" rx="12" fill="#0f172a" stroke="url(#${goldGradId})" stroke-width="2"/>

        <!-- Row 1: 5 Mini Tins -->
        <g transform="translate(115, 175)">
          <g transform="translate(0, 0)"><rect width="48" height="85" rx="14" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/><circle cx="24" cy="36" r="16" fill="#0f172a"/><text x="24" y="44" font-size="18" text-anchor="middle">✨</text><rect x="6" y="62" width="36" height="14" rx="4" fill="#0284c7"/><text x="24" y="72" font-family="-apple-system, sans-serif" font-size="6.5" font-weight="900" fill="#ffffff" text-anchor="middle">TIN</text></g>
          <g transform="translate(56, 0)"><rect width="48" height="85" rx="14" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/><circle cx="24" cy="36" r="16" fill="#0f172a"/><text x="24" y="44" font-size="18" text-anchor="middle">🔥</text><rect x="6" y="62" width="36" height="14" rx="4" fill="#0284c7"/><text x="24" y="72" font-family="-apple-system, sans-serif" font-size="6.5" font-weight="900" fill="#ffffff" text-anchor="middle">TIN</text></g>
          <g transform="translate(112, 0)"><rect width="48" height="85" rx="14" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/><circle cx="24" cy="36" r="16" fill="#0f172a"/><text x="24" y="44" font-size="18" text-anchor="middle">⚡</text><rect x="6" y="62" width="36" height="14" rx="4" fill="#0284c7"/><text x="24" y="72" font-family="-apple-system, sans-serif" font-size="6.5" font-weight="900" fill="#ffffff" text-anchor="middle">TIN</text></g>
          <g transform="translate(168, 0)"><rect width="48" height="85" rx="14" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/><circle cx="24" cy="36" r="16" fill="#0f172a"/><text x="24" y="44" font-size="18" text-anchor="middle">🐉</text><rect x="6" y="62" width="36" height="14" rx="4" fill="#0284c7"/><text x="24" y="72" font-family="-apple-system, sans-serif" font-size="6.5" font-weight="900" fill="#ffffff" text-anchor="middle">TIN</text></g>
          <g transform="translate(224, 0)"><rect width="48" height="85" rx="14" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/><circle cx="24" cy="36" r="16" fill="#0f172a"/><text x="24" y="44" font-size="18" text-anchor="middle">🦊</text><rect x="6" y="62" width="36" height="14" rx="4" fill="#0284c7"/><text x="24" y="72" font-family="-apple-system, sans-serif" font-size="6.5" font-weight="900" fill="#ffffff" text-anchor="middle">TIN</text></g>
        </g>

        <!-- Row 2: 5 Mini Tins -->
        <g transform="translate(115, 275)">
          <g transform="translate(0, 0)"><rect width="48" height="85" rx="14" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/><circle cx="24" cy="36" r="16" fill="#1e293b"/><text x="24" y="44" font-size="18" text-anchor="middle">🌙</text><rect x="6" y="62" width="36" height="14" rx="4" fill="#0284c7"/><text x="24" y="72" font-family="-apple-system, sans-serif" font-size="6.5" font-weight="900" fill="#ffffff" text-anchor="middle">TIN</text></g>
          <g transform="translate(56, 0)"><rect width="48" height="85" rx="14" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/><circle cx="24" cy="36" r="16" fill="#1e293b"/><text x="24" y="44" font-size="18" text-anchor="middle">🍃</text><rect x="6" y="62" width="36" height="14" rx="4" fill="#0284c7"/><text x="24" y="72" font-family="-apple-system, sans-serif" font-size="6.5" font-weight="900" fill="#ffffff" text-anchor="middle">TIN</text></g>
          <g transform="translate(112, 0)"><rect width="48" height="85" rx="14" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/><circle cx="24" cy="36" r="16" fill="#1e293b"/><text x="24" y="44" font-size="18" text-anchor="middle">🎨</text><rect x="6" y="62" width="36" height="14" rx="4" fill="#0284c7"/><text x="24" y="72" font-family="-apple-system, sans-serif" font-size="6.5" font-weight="900" fill="#ffffff" text-anchor="middle">TIN</text></g>
          <g transform="translate(168, 0)"><rect width="48" height="85" rx="14" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/><circle cx="24" cy="36" r="16" fill="#1e293b"/><text x="24" y="44" font-size="18" text-anchor="middle">⚡</text><rect x="6" y="62" width="36" height="14" rx="4" fill="#0284c7"/><text x="24" y="72" font-family="-apple-system, sans-serif" font-size="6.5" font-weight="900" fill="#ffffff" text-anchor="middle">TIN</text></g>
          <g transform="translate(224, 0)"><rect width="48" height="85" rx="14" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/><circle cx="24" cy="36" r="16" fill="#1e293b"/><text x="24" y="44" font-size="18" text-anchor="middle">✨</text><rect x="6" y="62" width="36" height="14" rx="4" fill="#0284c7"/><text x="24" y="72" font-family="-apple-system, sans-serif" font-size="6.5" font-weight="900" fill="#ffffff" text-anchor="middle">TIN</text></g>
        </g>

        <!-- Bottom Display Base Bar -->
        <rect x="100" y="370" width="300" height="35" rx="6" fill="#0284c7"/>
        <text x="250" y="392" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="10.5" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">EACH TIN CONTAINS 2 PACKS + 1 ART CARD + COIN</text>
      </g>
    `;
  } else {
    // bundle: Retail Booster Bundle Box (6 packs or 2-pack bundle)
    productPackagingMarkup = `
      <g filter="url(#dropShadow)">
        <rect x="125" y="90" width="250" height="315" rx="12" fill="#0f172a" stroke="#cbd5e1" stroke-width="2"/>
        <rect x="135" y="100" width="230" height="295" rx="8" fill="url(#${bgGradId})"/>

        <!-- Top Retail Seal Sticker -->
        <rect x="160" y="112" width="180" height="26" rx="13" fill="#e11d48"/>
        <text x="250" y="129" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">FACTORY SEALED BUNDLE</text>

        <!-- Center Pokémon Set Logo & Artwork -->
        <circle cx="250" cy="225" r="62" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
        <text x="250" y="248" font-size="58" text-anchor="middle">${emoji}</text>

        <!-- Pack Count Badge -->
        <rect x="165" y="305" width="170" height="32" rx="16" fill="#0b1b3d" stroke="#f59e0b" stroke-width="1.5"/>
        <text x="250" y="325" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="12" font-weight="900" fill="#facc15" text-anchor="middle">${safePacks}</text>

        <!-- Bottom Title Strip -->
        <rect x="135" y="348" width="230" height="42" rx="6" fill="#0f172a"/>
        <text x="250" y="366" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="11.5" font-weight="900" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
        <text x="250" y="380" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="8" font-weight="700" fill="#38bdf8" text-anchor="middle">VERIFIED UNTAMPERED • POINT TCG</text>
      </g>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
    <defs>
      <linearGradient id="${bgGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        ${themeGradient}
      </linearGradient>
      
      <linearGradient id="${goldGradId}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#fbbf24"/>
        <stop offset="50%" stop-color="#fef08a"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>

      <!-- Soft Drop Shadow Filter for Realistic Product Look -->
      <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.22"/>
      </filter>
    </defs>

    <!-- 1. Pure White Canvas Background -->
    <rect width="500" height="500" rx="14" fill="#ffffff"/>

    <!-- 2. Outer Red Border Frame -->
    <rect x="8" y="8" width="484" height="484" rx="14" fill="none" stroke="#0053e2" stroke-width="3.5"/>

    <!-- 3. Top Banner Header: CHÍNH HÃNG - UY TÍN - CHẤT LƯỢNG -->
    <text x="250" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif" font-size="14.5" font-weight="900" fill="#0053e2" text-anchor="middle" letter-spacing="1.2">CHÍNH HÃNG - UY TÍN - CHẤT LƯỢNG</text>
    <line x1="45" y1="42" x2="455" y2="42" stroke="#bfdbfe" stroke-width="1"/>

    <!-- 4. Top-Left Red Discount / Sale Tag -->
    ${safeBadge ? `
    <g transform="translate(16, 16)" filter="drop-shadow(0 2px 5px rgba(0,83,226,0.35))">
      <rect x="0" y="0" width="58" height="42" rx="6" fill="#0053e2"/>
      <text x="29" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="15.5" font-weight="900" fill="#ffffff" text-anchor="middle">${safeBadge}</text>
      <text x="29" y="36" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="9" font-weight="800" fill="#dbeafe" text-anchor="middle" letter-spacing="0.5">${safeBadgeSub}</text>
    </g>` : ''}

    <!-- 5. Studio Floor Contact Drop Shadow -->
    <ellipse cx="250" cy="416" rx="165" ry="14" fill="#000000" fill-opacity="0.12"/>

    <!-- 6. Main 3D Product Packaging Graphics -->
    ${productPackagingMarkup}

    <!-- 7. Bottom Bar: Platform / Certification Badges (Left) -->
    <g transform="translate(18, 452)">
      <!-- Blue TCG Icon -->
      <rect x="0" y="0" width="28" height="28" rx="6" fill="#003791"/>
      <text x="14" y="19" font-family="-apple-system, sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle">TCG</text>

      <!-- Red Nintendo Switch Icon -->
      <rect x="34" y="0" width="28" height="28" rx="6" fill="#1d4ed8"/>
      <circle cx="43" cy="14" r="5" fill="#ffffff"/>
      <circle cx="53" cy="14" r="5" fill="#1d4ed8"/>
      <rect x="47" y="9" width="7" height="10" rx="2" fill="#ffffff"/>

      <!-- Pokémon Official Pokéball Seal Icon -->
      <rect x="68" y="0" width="28" height="28" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="82" cy="14" r="9" fill="#2563eb"/>
      <circle cx="82" cy="14" r="4" fill="#ffffff"/>
      <line x1="73" y1="14" x2="91" y2="14" stroke="#ffffff" stroke-width="2"/>
      <circle cx="82" cy="14" r="2" fill="#0f172a"/>
    </g>

    <!-- 8. Bottom Bar: Store Name & Logo (Right) -->
    <g transform="translate(482, 455)">
      <circle cx="-102" cy="13" r="11" fill="#ffc220"/>
      <polygon points="-104,7 -99,13 -105,13 -99,19 -101,14 -97,14" fill="#0053e2"/>
      <text x="-86" y="15" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="14.5" font-weight="900" fill="#0f172a" text-anchor="start">Point TCG</text>
      <text x="-86" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="9" font-weight="800" fill="#0053e2" text-anchor="start" letter-spacing="1">GAMESTORE</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Backwards compatibility alias for createCardSvg:
export const createCardSvg = (emoji, title, bgGradient, subText = 'POKÉMON TCG') => {
  return createShowcaseBoxSvg({
    title,
    boxSubtitle: subText,
    themeGradient: bgGradient,
    badgeText: 'HOT',
    badgeSubText: 'SEALED',
    boxType: 'blister',
    emoji,
    featuredName: title.split(':')[0] || 'POKÉMON'
  });
};

// Preset motifs for admin adding products easily
export const PRESET_CARD_STYLES = [
  { label: '🔥 Charizard / Fire (Blister 3-Pack)', emoji: '🔥', gradient: '<stop offset="0%" stop-color="#ea580c"/><stop offset="100%" stop-color="#7c2d12"/>' },
  { label: '⚡ Pikachu / Lightning (Window Box)', emoji: '⚡', gradient: '<stop offset="0%" stop-color="#eab308"/><stop offset="100%" stop-color="#854d0e"/>' },
  { label: '🐉 Rayquaza / Dragon (Booster Box)', emoji: '🐉', gradient: '<stop offset="0%" stop-color="#059669"/><stop offset="100%" stop-color="#064e3b"/>' },
  { label: '🦊 Eevee / Prismatic (Figure Collection)', emoji: '🦊', gradient: '<stop offset="0%" stop-color="#d97706"/><stop offset="100%" stop-color="#78350f"/>' },
  { label: '🌙 Umbreon / Dark Moon (Booster Bundle)', emoji: '🌙', gradient: '<stop offset="0%" stop-color="#475569"/><stop offset="100%" stop-color="#0f172a"/>' },
  { label: '✨ Mew / Celestial (UPC Luxury Box)', emoji: '✨', gradient: '<stop offset="0%" stop-color="#2563eb"/><stop offset="100%" stop-color="#1e3a8a"/>' },
  { label: '🍃 Venusaur / Grass (Blister Pack)', emoji: '🍃', gradient: '<stop offset="0%" stop-color="#16a34a"/><stop offset="100%" stop-color="#14532d"/>' },
  { label: '🎨 Unova / Psychic (Poster Box)', emoji: '🎨', gradient: '<stop offset="0%" stop-color="#9333ea"/><stop offset="100%" stop-color="#581c87"/>' }
];

// ==========================================
// 1. OPEN DRAWINGS (Live Drawings with countdown)
// ==========================================
export const openDrawings = [
  {
    id: 'open-1',
    title: 'Pokémon TCG: Scarlet & Violet 151 Ultra-Premium Collection Box',
    price: 119.99,
    wasPrice: 169.99,
    isSale: true,
    badge: 'HOT',
    optionsText: '+ 3 options',
    unitPrice: null,
    rating: 4.9,
    reviewsCount: 1420,
    secondsRemaining: 8073, // approx 02:14:33
    status: 'open',
    stock: 25,
    image: createShowcaseBoxSvg({
      title: 'Pokémon TCG: Scarlet & Violet 151',
      boxSubtitle: 'ULTRA-PREMIUM COLLECTION',
      boxType: 'upc',
      badgeText: '-29%',
      badgeSubText: 'OFF',
      emoji: '🔥',
      featuredName: '151 MEW & MEWTWO',
      themeGradient: '<stop offset="0%" stop-color="#4a044e"/><stop offset="50%" stop-color="#831843"/><stop offset="100%" stop-color="#1e1b4b"/>',
      accentColor: '#f59e0b'
    }),
    description: 'The definitive Pokémon 151 collection featuring Mew ex etched foil promo, Mewtwo illustration rare promo, premium playmat, deck box, metal coin, and 16 booster packs from Scarlet & Violet—151.',
    drawingDetails: {
      totalEntries: 4892,
      maxWinners: 75,
      entryFee: 'Free Request',
      eligibility: 'Point TCG Verified Members',
      drawingDate: 'Ends in 02:14:33'
    }
  },
  {
    id: 'open-2',
    title: 'Pokémon TCG: Crown Zenith Special Collection — Pikachu VMAX Box',
    price: 49.99,
    wasPrice: 69.99,
    isSale: true,
    badge: 'x2',
    optionsText: null,
    unitPrice: '$12.50/pk',
    rating: 4.8,
    reviewsCount: 654,
    secondsRemaining: 18450, // approx 05:07:30
    status: 'open',
    stock: 50,
    image: createShowcaseBoxSvg({
      title: 'Pokémon TCG: Crown Zenith',
      boxSubtitle: 'SPECIAL COLLECTION • 5 PACKS',
      boxType: 'pikachu_window',
      badgeText: '-28%',
      badgeSubText: 'OFF',
      emoji: '⚡',
      featuredName: 'PIKACHU VMAX',
      themeGradient: '<stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#0f172a"/>',
      accentColor: '#eab308'
    }),
    description: 'Gigantamax lightning power! Includes Pikachu VMAX etched foil promo card, Pikachu V promo card, an oversize Pikachu VMAX display card, and 5 Crown Zenith booster packs.',
    drawingDetails: {
      totalEntries: 2780,
      maxWinners: 120,
      entryFee: 'Free Request',
      eligibility: 'All Members',
      drawingDate: 'Ends in 05:07:30'
    }
  },
  {
    id: 'open-3',
    title: 'Pokémon TCG: Evolving Skies Booster Box (36 Packs Factory Sealed)',
    price: 489.00,
    wasPrice: null,
    isSale: false,
    badge: 'GRAIL',
    optionsText: null,
    unitPrice: '$13.58/pk',
    rating: 5.0,
    reviewsCount: 312,
    secondsRemaining: 34912, // approx 09:41:52
    status: 'open',
    stock: 8,
    image: createShowcaseBoxSvg({
      title: 'Pokémon TCG: Evolving Skies',
      boxSubtitle: '36 BOOSTER PACKS DISPLAY',
      boxType: 'booster_box',
      badgeText: 'GRAIL',
      badgeSubText: 'SEALED',
      emoji: '🐉',
      featuredName: 'RAYQUAZA & UMBREON',
      themeGradient: '<stop offset="0%" stop-color="#064e3b"/><stop offset="50%" stop-color="#047857"/><stop offset="100%" stop-color="#022c22"/>',
      accentColor: '#10b981'
    }),
    description: 'The most sought-after Modern era booster box. Hunt the legendary Umbreon VMAX Alt Art Moonbreon and Rayquaza VMAX Alt Art. 100% authenticated and untampered with.',
    drawingDetails: {
      totalEntries: 9540,
      maxWinners: 20,
      entryFee: 'Free Request',
      eligibility: 'Point TCG VIP Tier',
      drawingDate: 'Ends in 09:41:52'
    }
  }
];

// ==========================================
// 2. CLOSED DRAWINGS (6 items from prompt specification)
// ==========================================
export const closedDrawings = [
  {
    id: 'closed-1',
    title: 'Pokemon Trading Card Games First Partner Illustration Collection Series 3',
    price: 17.97,
    wasPrice: 39.99,
    isSale: true,
    badge: null,
    optionsText: null,
    unitPrice: null,
    rating: 4.8,
    reviewsCount: 402,
    status: 'closed',
    stock: 30,
    statusText: 'Drawing ended today, 10:00am PDT',
    statusTime: '10:00am PDT',
    image: createShowcaseBoxSvg({
      title: 'Pokemon Trading Card Games',
      boxSubtitle: 'FIRST PARTNER COLLECTION S3',
      boxType: 'blister',
      badgeText: '-55%',
      badgeSubText: 'OFF',
      emoji: '🍃',
      featuredName: 'FIRST PARTNER S3',
      themeGradient: '<stop offset="0%" stop-color="#15803d"/><stop offset="100%" stop-color="#052e16"/>',
      accentColor: '#22c55e'
    }),
    description: 'Celebrate classic partner Pokémon from across the generations! Features 3 oversize foil promo cards highlighting favorite first partners, plus 2 Pokémon TCG booster packs.',
    drawingDetails: {
      totalEntries: 6120,
      maxWinners: 250,
      status: 'Closed & Winners Selected',
      drawingDate: 'Today, 10:00am PDT'
    }
  },
  {
    id: 'closed-2',
    title: 'Pokémon TCG: 30th Celebration Mini Tin 10-Count Display Box',
    price: 129.00,
    wasPrice: null,
    isSale: false,
    badge: null,
    optionsText: null,
    unitPrice: null,
    rating: 4.9,
    reviewsCount: 86,
    status: 'closed',
    stock: 12,
    statusText: 'Drawing ended today, 10:00am PDT',
    statusTime: '10:00am PDT',
    image: createShowcaseBoxSvg({
      title: 'Pokémon TCG: 30th Celebration',
      boxSubtitle: '10-COUNT DISPLAY BOX',
      boxType: 'mini_tin_display',
      badgeText: '30TH',
      badgeSubText: 'LIMITED',
      emoji: '✨',
      featuredName: 'MINI TINS DISPLAY',
      themeGradient: '<stop offset="0%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#0f172a"/>',
      accentColor: '#38bdf8'
    }),
    description: 'Factory sealed counter display case containing 10 mini tins celebrating the 30th milestone of Pokémon. Each tin includes 2 booster packs, a metallic coin, and an art card.',
    drawingDetails: {
      totalEntries: 4210,
      maxWinners: 60,
      status: 'Closed & Winners Selected',
      drawingDate: 'Today, 10:00am PDT'
    }
  },
  {
    id: 'closed-3',
    title: 'Pokémon TCG: 30th Celebration Booster Bundle 2-Pack Bundle',
    price: 64.00,
    wasPrice: null,
    isSale: false,
    badge: 'x2',
    optionsText: null,
    unitPrice: null,
    rating: 5.0,
    reviewsCount: 1,
    status: 'closed',
    stock: 15,
    statusText: 'Drawing ended today, 10:00am PDT',
    statusTime: '10:00am PDT',
    image: createShowcaseBoxSvg({
      title: 'Pokémon TCG: 30th Celebration',
      boxSubtitle: '2-PACK BOOSTER BUNDLE',
      boxType: 'bundle',
      badgeText: 'x2',
      badgeSubText: 'BUNDLE',
      emoji: '📦',
      featuredName: '30TH BOOSTER 2-PACK',
      packCount: '12 PACKS',
      themeGradient: '<stop offset="0%" stop-color="#0369a1"/><stop offset="100%" stop-color="#082f49"/>',
      accentColor: '#38bdf8'
    }),
    description: 'Two separate booster bundles shrink-wrapped together. Total of 12 celebration booster packs ready to rip. High pull rates of vintage reprint holos.',
    drawingDetails: {
      totalEntries: 3890,
      maxWinners: 100,
      status: 'Closed & Winners Selected',
      drawingDate: 'Today, 10:00am PDT'
    }
  },
  {
    id: 'closed-4',
    title: 'Pokemon TCG Scarlet & Violet 10.5 Unova Poster Collection Box',
    price: 34.99,
    wasPrice: 54.87,
    isSale: true,
    badge: null,
    optionsText: '+ 5 options',
    unitPrice: null,
    rating: 4.5,
    reviewsCount: 530,
    status: 'closed',
    stock: 40,
    statusText: 'Drawing ended today, 10:00am PDT',
    statusTime: '10:00am PDT',
    image: createShowcaseBoxSvg({
      title: 'Pokemon TCG: Scarlet & Violet',
      boxSubtitle: 'UNOVA POSTER COLLECTION',
      boxType: 'pikachu_window',
      badgeText: '-36%',
      badgeSubText: 'OFF',
      emoji: '🎨',
      featuredName: 'UNOVA POSTER BOX',
      themeGradient: '<stop offset="0%" stop-color="#6b21a8"/><stop offset="100%" stop-color="#3b0764"/>',
      accentColor: '#a855f7'
    }),
    description: 'Features a full-size two-sided poster featuring the legendary Pokémon of Unova, 3 foil promo cards (Snivy, Tepig, Oshawott), and 3 special expansion booster packs.',
    drawingDetails: {
      totalEntries: 5120,
      maxWinners: 180,
      status: 'Closed & Winners Selected',
      drawingDate: 'Today, 10:00am PDT'
    }
  },
  {
    id: 'closed-5',
    title: 'Pokemon Trading Card Games SV 8.5 Prismatic Evolutions Premium Figure Collection',
    price: 149.99,
    wasPrice: 214.95,
    isSale: true,
    badge: null,
    optionsText: null,
    unitPrice: '$149.99/g',
    rating: 4.0,
    reviewsCount: 899,
    status: 'closed',
    stock: 10,
    statusText: 'Drawing ended today, 10:00am PDT',
    statusTime: '10:00am PDT',
    image: createShowcaseBoxSvg({
      title: 'Pokemon TCG: SV 8.5',
      boxSubtitle: 'PRISMATIC EVOLUTIONS FIGURE',
      boxType: 'upc',
      badgeText: '-30%',
      badgeSubText: 'OFF',
      emoji: '🦊',
      featuredName: 'EEVEE FIGURE BOX',
      themeGradient: '<stop offset="0%" stop-color="#b45309"/><stop offset="100%" stop-color="#451a03"/>',
      accentColor: '#f59e0b'
    }),
    description: 'The crown jewel of SV 8.5. Includes an exclusive sculpted Eevee & evolutions figurine, 11 booster packs of Prismatic Evolutions, etched foil promo cards, and collector display stand.',
    drawingDetails: {
      totalEntries: 11450,
      maxWinners: 45,
      status: 'Closed & Winners Selected',
      drawingDate: 'Today, 10:00am PDT'
    }
  },
  {
    id: 'closed-6',
    title: 'Pokemon Scarlet & Violet Shrouded Fable Booster Bundle Box',
    price: 44.99,
    wasPrice: 72.54,
    isSale: true,
    badge: null,
    optionsText: null,
    unitPrice: null,
    rating: 4.6,
    reviewsCount: 214,
    status: 'closed',
    stock: 22,
    statusText: 'Drawing ended today, 10:00am PDT',
    statusTime: '10:00am PDT',
    image: createShowcaseBoxSvg({
      title: 'Pokemon TCG: Shrouded Fable',
      boxSubtitle: 'BOOSTER BUNDLE BOX',
      boxType: 'bundle',
      badgeText: '-38%',
      badgeSubText: 'OFF',
      emoji: '🌙',
      featuredName: 'SHROUDED FABLE',
      packCount: '6 PACKS',
      themeGradient: '<stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/>',
      accentColor: '#c084fc'
    }),
    description: 'Enter the foggy mountains of Kitakami! Includes 6 booster packs of Scarlet & Violet—Shrouded Fable featuring Pecharunt ex, Okidogi ex, Munkidori ex, and Fezandipiti ex.',
    drawingDetails: {
      totalEntries: 3410,
      maxWinners: 150,
      status: 'Closed & Winners Selected',
      drawingDate: 'Today, 10:00am PDT'
    }
  }
];

export const allProducts = [...openDrawings, ...closedDrawings];

/**
 * Universal lookup helper to retrieve the authoritative card image for any product
 * by its ID or title, guarding against stale external URLs.
 */
export const getProductCatalogImage = (idOrItem) => {
  if (!idOrItem) return '';
  const id = typeof idOrItem === 'string' ? idOrItem : idOrItem.id;
  const title = typeof idOrItem === 'object' ? idOrItem.title : null;
  const match = allProducts.find(
    (p) =>
      (id && p.id === id) ||
      (title && p.title?.toLowerCase().trim() === title.toLowerCase().trim())
  );
  if (match && match.image) {
    return match.image;
  }
  if (typeof idOrItem === 'object' && idOrItem.image && !idOrItem.image.includes('pokemontcg.io')) {
    return idOrItem.image;
  }
  return '';
};

/**
 * Wraps any custom image (uploaded file data URL or external URL)
 * inside the official Point TCG blue retail showcase frame
 */
// Ảnh đã nằm trong khung của shop (ảnh mẫu hoặc ảnh admin tải lên có bật khung)
const FRAME_MARKER = encodeURIComponent('CHÍNH HÃNG - UY TÍN');
export const isStoreFramed = (src) =>
  typeof src === 'string' && src.startsWith('data:image/svg') && src.includes(FRAME_MARKER);

// Khung cũ màu đỏ → đổi sang khung xanh của shop (chỉ đổi màu, giữ nguyên ảnh bên trong)
const FRAME_RECOLOR = [
  ['%23d32f2f', '%230053e2'],
  ['%23fecaca', '%23bfdbfe'],
  ['%23fee2e2', '%23dbeafe'],
  ['%23e60012', '%231d4ed8'],
  ['%23ef4444', '%232563eb'],
  ['%23dc2626', '%230053e2'],
  ['rgba(211%2C47%2C47', 'rgba(0%2C83%2C226']
];
export const recolorStoreFrame = (src) => {
  if (!isStoreFramed(src) || !src.includes('%23d32f2f')) return src;
  return FRAME_RECOLOR.reduce((out, [from, to]) => out.split(from).join(to), src);
};

// Nhãn giảm giá trên khung: badge admin nhập, nếu trống thì % giảm thật từ giá cũ → giá mới
export const getFrameBadge = ({ badge, price, wasPrice } = {}) => {
  if (badge && String(badge).trim()) return String(badge).trim();
  const p = parseFloat(price);
  const w = parseFloat(wasPrice);
  if (p > 0 && w > p) return `-${Math.round(((w - p) / w) * 100)}%`;
  return '';
};

export const embedImageInStoreFrame = (imageUrl, options = {}) => {
  if (!imageUrl) return '';
  // Không bọc khung hai lần
  if (isStoreFramed(imageUrl)) return imageUrl;
  const {
    badgeText = '-35%',
    badgeSubText = 'OFF'
  } = options;

  const safeBadge = escapeXml(badgeText);
  const safeBadgeSub = escapeXml(badgeSubText);
  const safeImg = escapeXml(imageUrl);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
    <defs>
      <filter id="uploadShadow" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.2"/>
      </filter>
    </defs>

    <!-- 1. Pure White Canvas -->
    <rect width="500" height="500" rx="14" fill="#ffffff"/>

    <!-- 2. Outer Red Border Frame -->
    <rect x="8" y="8" width="484" height="484" rx="14" fill="none" stroke="#0053e2" stroke-width="3.5"/>

    <!-- 3. Top Banner: CHÍNH HÃNG - UY TÍN - CHẤT LƯỢNG -->
    <text x="250" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif" font-size="14.5" font-weight="900" fill="#0053e2" text-anchor="middle" letter-spacing="1.2">CHÍNH HÃNG - UY TÍN - CHẤT LƯỢNG</text>
    <line x1="45" y1="42" x2="455" y2="42" stroke="#bfdbfe" stroke-width="1"/>

    <!-- 4. Top-Left Red Discount / Sale Tag -->
    ${safeBadge ? `
    <g transform="translate(16, 16)" filter="drop-shadow(0 2px 5px rgba(0,83,226,0.35))">
      <rect x="0" y="0" width="58" height="42" rx="6" fill="#0053e2"/>
      <text x="29" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="15.5" font-weight="900" fill="#ffffff" text-anchor="middle">${safeBadge}</text>
      <text x="29" y="36" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="9" font-weight="800" fill="#dbeafe" text-anchor="middle" letter-spacing="0.5">${safeBadgeSub}</text>
    </g>` : ''}

    <!-- 5. Studio Floor Contact Drop Shadow -->
    <ellipse cx="250" cy="416" rx="165" ry="14" fill="#000000" fill-opacity="0.12"/>

    <!-- 6. Embedded Custom Uploaded Image -->
    <g filter="url(#uploadShadow)">
      <image href="${safeImg}" x="50" y="60" width="400" height="350" preserveAspectRatio="xMidYMid meet" />
    </g>

    <!-- 7. Bottom Bar: Platform / Certification Badges (Left) -->
    <g transform="translate(18, 452)">
      <rect x="0" y="0" width="28" height="28" rx="6" fill="#003791"/>
      <text x="14" y="19" font-family="-apple-system, sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle">TCG</text>

      <rect x="34" y="0" width="28" height="28" rx="6" fill="#1d4ed8"/>
      <circle cx="43" cy="14" r="5" fill="#ffffff"/>
      <circle cx="53" cy="14" r="5" fill="#1d4ed8"/>
      <rect x="47" y="9" width="7" height="10" rx="2" fill="#ffffff"/>

      <rect x="68" y="0" width="28" height="28" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="82" cy="14" r="9" fill="#2563eb"/>
      <circle cx="82" cy="14" r="4" fill="#ffffff"/>
      <line x1="73" y1="14" x2="91" y2="14" stroke="#ffffff" stroke-width="2"/>
      <circle cx="82" cy="14" r="2" fill="#0f172a"/>
    </g>

    <!-- 8. Bottom Bar: Store Name & Logo (Right) -->
    <g transform="translate(482, 455)">
      <circle cx="-102" cy="13" r="11" fill="#ffc220"/>
      <polygon points="-104,7 -99,13 -105,13 -99,19 -101,14 -97,14" fill="#0053e2"/>
      <text x="-86" y="15" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="14.5" font-weight="900" fill="#0f172a" text-anchor="start">Point TCG</text>
      <text x="-86" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="9" font-weight="800" fill="#0053e2" text-anchor="start" letter-spacing="1">GAMESTORE</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

