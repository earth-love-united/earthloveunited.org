/**
 * DELEGATION GREETING v1.0
 * Personalized country-specific entry point for COP31 delegates
 * Detects visitor's country and shows tailored emissions data
 */

const DELEGATION = (() => {
  let detected = null;
  let countryData = null;
  let greetingEl = null;

  // ── Create the delegation greeting overlay ──
  function createGreeting() {
    if (greetingEl) return;

    if (typeof COUNTRY_DATA === 'undefined') return;
    detected = COUNTRY_DATA.detectCountry();
    countryData = detected.code ? COUNTRY_DATA.getComparison(detected.code) : null;

    // Only show if we detected a country with data
    if (!countryData) return;

    greetingEl = document.createElement('div');
    greetingEl.id = 'delegation-greeting';
    greetingEl.innerHTML = buildGreetingHTML();

    // Inject into the hero container
    const container = $('hero-delegation');
    if (container) {
      container.appendChild(greetingEl);
    } else {
      // Fallback: insert at top of hero
      const hero = $('hero');
      if (hero) {
        hero.insertBefore(greetingEl, hero.firstChild);
      }
    }

    // Animate in
    requestAnimationFrame(() => {
      greetingEl.classList.add('visible');
    });

    // Track engagement
    if (hasModule('GAIA_ENGAGEMENT')) {
      GAIA_ENGAGEMENT.addSignal('site_tap');
      GAIA_ENGAGEMENT.addMoodSignal('urgency');
    }
  }

  // ── Build the greeting HTML ──
  function buildGreetingHTML() {
    const c = countryData;
    const isHighEmitter = c.globalRank <= 10;
    const isTop3 = c.globalRank <= 3;

    let tone = 'neutral';
    if (isTop3) tone = 'urgent';
    else if (isHighEmitter) tone = 'concerned';
    else if (c.perCapita > 10) tone = 'personal';

    const toneColors = {
      urgent: '#c45c4a',
      concerned: '#d4a574',
      personal: '#8b7fc7',
      neutral: '#4ecdc4',
    };
    const accentColor = toneColors[tone];

    return `
      <div class="dg-card" style="--delegate-accent: ${accentColor}">
        <span class="dg-flag" aria-hidden="true">${c.flag}</span>
        <span class="dg-country">${c.name}:</span>
        <span class="dg-emissions">${c.formattedEmissions} CO₂ in 2023</span>
        <span class="dg-sep">·</span>
        <span class="dg-rank">#${c.globalRank} globally</span>
        <span class="dg-sep">·</span>
        <span class="dg-person">${c.perCapita} t/person</span>
      </div>
    `;
  }

  // ── Get personalized greeting text ──
  function getGreetingText(c, tone) {
    const greetings = {
      urgent: [
        `Welcome, delegate from ${c.name}. Your country is one of the top 3 emitters on Earth.`,
        `${c.name} emits ${c.formattedEmissions} of CO₂ every year. That's ${c.share}% of the global total.`,
      ],
      concerned: [
        `Welcome, delegate from ${c.name}. Your country ranks #${c.globalRank} in global emissions.`,
        `${c.name} emitted ${c.formattedEmissions} of CO₂ in 2023. That's ${c.perCapita} tons per person.`,
      ],
      personal: [
        `Welcome, delegate from ${c.name}. Each person in your country emits ${c.perCapita} tons of CO₂ per year.`,
        `${c.name}: ${c.perCapita} tons of CO₂ per capita. That's ${c.share}% of global emissions.`,
      ],
      neutral: [
        `Welcome, delegate from ${c.name}. Here's your country's carbon footprint.`,
        `${c.name} emitted ${c.formattedEmissions} of CO₂ in 2023. Rank: #${c.globalRank} globally.`,
      ],
    };

    const pool = greetings[tone] || greetings.neutral;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Get context text ──
  function getComparisonContext(c) {
    const contexts = [
      `That's equivalent to ${c.carsEquivalent} cars on the road for a year.`,
      `It would take ${c.treesNeeded} trees to offset one year of ${c.name}'s emissions.`,
      `Every ${c.secondsPerTon} seconds, ${c.name} emits another ton of CO₂.`,
      `${c.name}'s emissions alone account for ${c.share}% of the global total.`,
    ];
    return contexts[Math.floor(Math.random() * contexts.length)];
  }

  function getContextText(c) {
    return getComparisonContext(c);
  }

  // ── Explore country story ──
  function exploreCountry() {
    if (!countryData) return;

    // Scroll to the globe section
    const globe = $('globeViz');
    if (globe) {
      globe.scrollIntoView({ behavior: 'smooth' });
    }

    // Show GAIA speaking about the country
    if (hasModule('GAIA_BUBBLE')) {
      GAIA_BUBBLE.speak(
        `${countryData.flag} ${countryData.name}: ${countryData.formattedEmissions} in 2023. ${getComparisonContext(countryData)}`,
        'urgent',
        8000
      );
    }

    // Dismiss the greeting
    dismiss();
  }

  // ── Dismiss greeting ──
  function dismiss() {
    if (greetingEl) {
      greetingEl.classList.remove('visible');
      setTimeout(() => {
        if (greetingEl && greetingEl.parentNode) {
          greetingEl.parentNode.removeChild(greetingEl);
        }
        greetingEl = null;
      }, 400);
    }
  }

  // ── Init ──
  function init() {
    // Small delay to let the page settle
    setTimeout(createGreeting, 500);
  }

  // ── Standard Module Lifecycle (SML) ──
  const _reset = () => { console.debug('[SML] DELEGATION.reset'); return true; };
  const _destroy = () => { console.debug('[SML] DELEGATION.destroy'); return true; };
  const _getState = () => ({ detected: detected ? { ...detected } : null, hasCountry: !!countryData });

  return {
    init, createGreeting, dismiss, exploreCountry,
    getDetected: () => detected,
    getCountryData: () => countryData,
    reset: _reset,
    destroy: _destroy,
    getState: _getState,
  };
})();
window.DELEGATION = DELEGATION;

  MODULE_CONTRACTS.register('DELEGATION', {
    provides: ['init', 'getDetected', 'getCountryData', 'destroy', 'reset', 'getState'],
    requires: ['GAIA_BUBBLE'],
  });
