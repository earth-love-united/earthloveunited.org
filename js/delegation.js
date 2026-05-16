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

    detected = COUNTRY_DATA.detectCountry();
    countryData = detected.code ? COUNTRY_DATA.getComparison(detected.code) : null;

    // Only show if we detected a country with data
    if (!countryData) return;

    greetingEl = document.createElement('div');
    greetingEl.id = 'delegation-greeting';
    greetingEl.innerHTML = buildGreetingHTML();

    // Inject into the hero container
    const container = document.getElementById('hero-delegation');
    if (container) {
      container.appendChild(greetingEl);
    } else {
      // Fallback: insert at top of hero
      const hero = document.getElementById('hero');
      if (hero) {
        hero.insertBefore(greetingEl, hero.firstChild);
      }
    }

    // Animate in
    requestAnimationFrame(() => {
      greetingEl.classList.add('visible');
    });

    // Track engagement
    if (typeof GAIA_ENGAGEMENT !== 'undefined') {
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
      <div class="dg-card" style="border-color: ${accentColor}30">
        <div class="dg-flag">${c.flag}</div>
        <div class="dg-content">
          <div class="dg-greeting">${getGreetingText(c, tone)}</div>
          <div class="dg-stats">
            <div class="dg-stat">
              <div class="dg-stat-value" style="color: ${accentColor}">${c.formattedEmissions}</div>
              <div class="dg-stat-label">CO₂ emitted in 2023</div>
            </div>
            <div class="dg-stat">
              <div class="dg-stat-value">${c.perCapita} t</div>
              <div class="dg-stat-label">per person</div>
            </div>
            <div class="dg-stat">
              <div class="dg-stat-value">#${c.globalRank}</div>
              <div class="dg-stat-label">global rank</div>
            </div>
            <div class="dg-stat">
              <div class="dg-stat-value">${c.share}%</div>
              <div class="dg-stat-label">of global emissions</div>
            </div>
          </div>
          <div class="dg-context">${getContextText(c)}</div>
          <div class="dg-cta">
            <button class="dg-btn-primary" onclick="DELEGATION.exploreCountry()">
              Explore ${c.name}'s carbon story →
            </button>
            <button class="dg-btn-secondary" onclick="DELEGATION.dismiss()">
              Show me the planet
            </button>
          </div>
        </div>
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
    const globe = document.getElementById('globeViz');
    if (globe) {
      globe.scrollIntoView({ behavior: 'smooth' });
    }

    // Show GAIA speaking about the country
    if (typeof GAIA_BUBBLE !== 'undefined') {
      const line = GAIA_VOICE.speak('FACT', null, 'urgent');
      if (line) {
        GAIA_BUBBLE.speak(
          `${countryData.flag} ${countryData.name}: ${countryData.formattedEmissions} in 2023. ${getComparisonContext(countryData)}`,
          'urgent',
          8000
        );
      }
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

  return {
    init, createGreeting, dismiss, exploreCountry,
    getDetected: () => detected,
    getCountryData: () => countryData,
  };
})();
