/**
 * COUNTRY DATA v1.0
 * Top 30 CO₂ emitting countries with 2023 data from Global Carbon Budget / OWID
 * Used for personalized "Your Delegation" entry points
 * 
 * Data sources:
 * - Global Carbon Budget 2025
 * - OWID CO2 Dataset (ourworldindata.org/co2-and-greenhouse-gas-emissions)
 * - Per capita emissions from World Bank
 */

const COUNTRY_DATA = (() => {
  // ── Top 30 emitting countries (2023 data, Mt CO₂) ──
  const COUNTRIES = {
    CHN: { name: "China", emissions: 11903, perCapita: 8.4, share: 31.5, flag: "🇨🇳" },
    USA: { name: "United States", emissions: 4911, perCapita: 14.3, share: 13.0, flag: "🇺🇸" },
    IND: { name: "India", emissions: 3062, perCapita: 2.1, share: 8.1, flag: "🇮🇳" },
    RUS: { name: "Russia", emissions: 1816, perCapita: 12.5, share: 4.8, flag: "🇷🇺" },
    JPN: { name: "Japan", emissions: 989, perCapita: 8.0, share: 2.6, flag: "🇯🇵" },
    IRN: { name: "Iran", emissions: 818, perCapita: 9.0, share: 2.2, flag: "🇮🇷" },
    SAU: { name: "Saudi Arabia", emissions: 736, perCapita: 22.1, share: 1.9, flag: "🇸🇦" },
    IDN: { name: "Indonesia", emissions: 733, perCapita: 2.6, share: 1.9, flag: "🇮🇩" },
    DEU: { name: "Germany", emissions: 596, perCapita: 7.1, share: 1.6, flag: "🇩🇪" },
    KOR: { name: "South Korea", emissions: 577, perCapita: 11.2, share: 1.5, flag: "🇰🇷" },
    BRA: { name: "Brazil", emissions: 568, perCapita: 2.7, share: 1.5, flag: "🇧🇷" },
    CAN: { name: "Canada", emissions: 555, perCapita: 13.9, share: 1.5, flag: "🇨🇦" },
    TUR: { name: "Turkey", emissions: 534, perCapita: 6.2, share: 1.4, flag: "🇹🇷" },
    GBR: { name: "United Kingdom", emissions: 349, perCapita: 5.1, share: 0.9, flag: "🇬🇧" },
    AUS: { name: "Australia", emissions: 344, perCapita: 12.9, share: 0.9, flag: "🇦🇺" },
    ITA: { name: "Italy", emissions: 337, perCapita: 5.7, share: 0.9, flag: "🇮🇹" },
    FRA: { name: "France", emissions: 315, perCapita: 4.6, share: 0.8, flag: "🇫🇷" },
    POL: { name: "Poland", emissions: 312, perCapita: 8.2, share: 0.8, flag: "🇵🇱" },
    MEX: { name: "Mexico", emissions: 488, perCapita: 3.7, share: 1.3, flag: "🇲🇽" },
    ZAF: { name: "South Africa", emissions: 435, perCapita: 7.1, share: 1.2, flag: "🇿🇦" },
    THA: { name: "Thailand", emissions: 292, perCapita: 4.1, share: 0.8, flag: "🇹🇭" },
    EGY: { name: "Egypt", emissions: 270, perCapita: 2.5, share: 0.7, flag: "🇪🇬" },
    VNM: { name: "Vietnam", emissions: 310, perCapita: 3.1, share: 0.8, flag: "🇻🇳" },
    ARG: { name: "Argentina", emissions: 198, perCapita: 4.3, share: 0.5, flag: "🇦🇷" },
    NGA: { name: "Nigeria", emissions: 152, perCapita: 0.7, share: 0.4, flag: "🇳🇬" },
    PAK: { name: "Pakistan", emissions: 196, perCapita: 0.8, share: 0.5, flag: "🇵🇰" },
    BGD: { name: "Bangladesh", emissions: 96, perCapita: 0.6, share: 0.3, flag: "🇧🇩" },
    NLD: { name: "Netherlands", emissions: 140, perCapita: 7.9, share: 0.4, flag: "🇳🇱" },
    ESP: { name: "Spain", emissions: 255, perCapita: 5.4, share: 0.7, flag: "🇪🇸" },
    ARE: { name: "UAE", emissions: 205, perCapita: 20.5, share: 0.5, flag: "🇦🇪" },
  };

  // ── Browser language → country code mapping (top 50) ──
  const LANG_MAP = {
    zh: "CN", "zh-CN": "CN", "zh-TW": "CN", "zh-HK": "CN",
    en: "US", "en-US": "US", "en-GB": "GB", "en-AU": "AU", "en-CA": "CA", "en-IN": "IN", "en-NG": "NG", "en-ZA": "ZA",
    hi: "IN",
    es: "MX", "es-ES": "ES", "es-AR": "AR", "es-MX": "MX",
    fr: "FR", "fr-FR": "FR", "fr-CA": "CA",
    de: "DE", "de-DE": "DE",
    ja: "JP",
    ko: "KR",
    pt: "BR", "pt-BR": "BR",
    ru: "RU",
    ar: "SA", "ar-SA": "SA", "ar-EG": "EG", "ar-AE": "AE",
    tr: "TR",
    it: "IT",
    pl: "PL",
    nl: "NL",
    th: "TH",
    vi: "VN",
    id: "ID",
    ms: "MY",
    fa: "IR",
    ur: "PK",
    bn: "BD",
    ta: "IN",
    te: "IN",
    mr: "IN",
    gu: "IN",
    kn: "IN",
    ml: "IN",
    pa: "IN",
    or: "IN",
    as: "IN",
    ne: "NP",
    si: "LK",
    my: "MM",
    km: "KH",
    lo: "LA",
    tl: "PH",
    sw: "KE",
    am: "ET",
    yo: "NG",
    ig: "NG",
    ha: "NG",
    zu: "ZA",
    xh: "ZA",
    af: "ZA",
  };

  // ── Detect country from browser ──
  function detectCountry() {
    // 1. Try browser language
    const lang = navigator.language || navigator.userLanguage || "en";
    const langCode = lang.split("-")[0].toLowerCase();
    const fullLang = lang.toLowerCase();
    
    // Try full language tag first (e.g., "en-US"), then just language code
    let countryCode = LANG_MAP[fullLang] || LANG_MAP[langCode];
    
    if (countryCode && COUNTRIES[countryCode]) {
      return { code: countryCode, source: "browser_language", confidence: "medium" };
    }

    // 2. Try timezone as fallback
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzCountryMap = {
        "Asia/Shanghai": "CHN", "Asia/Hong_Kong": "CHN", "Asia/Taipei": "CHN",
        "America/New_York": "USA", "America/Chicago": "USA", "America/Denver": "USA",
        "America/Los_Angeles": "USA", "America/Toronto": "CAN", "America/Vancouver": "CAN",
        "Europe/London": "GBR", "Europe/Paris": "FRA", "Europe/Berlin": "DEU",
        "Europe/Moscow": "RUS", "Europe/Rome": "ITA", "Europe/Madrid": "ESP",
        "Europe/Amsterdam": "NLD", "Europe/Warsaw": "POL",
        "Asia/Tokyo": "JPN", "Asia/Seoul": "KOR", "Asia/Kolkata": "IND",
        "Asia/Jakarta": "IDN", "Asia/Bangkok": "THA", "Asia/Ho_Chi_Minh": "VNM",
        "Asia/Karachi": "PAK", "Asia/Dhaka": "BGD", "Asia/Tehran": "IRN",
        "Asia/Riyadh": "SAU", "Asia/Dubai": "ARE", "Asia/Kuwait": "SAU",
        "Australia/Sydney": "AUS", "Australia/Melbourne": "AUS",
        "America/Sao_Paulo": "BRA", "America/Buenos_Aires": "ARG",
        "America/Mexico_City": "MEX", "America/Bogota": "BRA",
        "Africa/Cairo": "EGY", "Africa/Lagos": "NGA", "Africa/Johannesburg": "ZAF",
        "Africa/Nairobi": "NGA", "Africa/Addis_Ababa": "ETH",
        "Asia/Manila": "IDN", "Asia/Kuala_Lumpur": "IDN",
        "Pacific/Auckland": "AUS",
        "Europe/Istanbul": "TUR",
      };
      const tzCode = tzCountryMap[tz];
      if (tzCode && COUNTRIES[tzCode]) {
        return { code: tzCode, source: "timezone", confidence: "low" };
      }
    } catch (e) { /* ignore */ }

    // 3. Default: unknown
    return { code: null, source: "none", confidence: "none" };
  }

  // ── Get country data ──
  function getCountry(code) {
    if (!code) return null;
    const upper = code.toUpperCase();
    return COUNTRIES[upper] ? { code: upper, ...COUNTRIES[upper] } : null;
  }

  // ── Get all countries sorted by emissions ──
  function getAllCountries() {
    return Object.entries(COUNTRIES)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.emissions - a.emissions);
  }

  // ── Format emissions for display ──
  function formatEmissions(mt) {
    if (mt >= 1000) return (mt / 1000).toFixed(1) + ' Gt';
    return mt.toLocaleString() + ' Mt';
  }

  // ── Get comparison context ──
  function getComparison(code) {
    const country = getCountry(code);
    if (!country) return null;

    const carsEquivalent = Math.round(country.emissions * 1e6 / 4.6); // 4.6 t CO₂/car/year
    const treesNeeded = Math.round(country.emissions * 1e6 / 0.022); // 22 kg CO₂/tree/year
    const secondsPerTon = (365.25 * 24 * 60 * 60) / (country.emissions * 1e6); // seconds per ton for this country

    return {
      ...country,
      formattedEmissions: formatEmissions(country.emissions),
      carsEquivalent: carsEquivalent.toLocaleString(),
      treesNeeded: (treesNeeded / 1e9).toFixed(1) + ' billion',
      secondsPerTon: secondsPerTon < 1 ? '< 1' : Math.round(secondsPerTon).toString(),
      globalRank: getAllCountries().findIndex(c => c.code === code) + 1,
    };
  }

  return {
    detectCountry,
    getCountry,
    getAllCountries,
    getComparison,
    formatEmissions,
    COUNTRIES,
  };
})();
