/**
 * ModuleEngine — Calculation Helpers
 * Extended calculator functions for slider/calculator stages
 * These are called by stage.calculate property
 */

window.__ELU_CALC = {

  // Carbon Budget Game (Module 3)
  calculateBudget: function(custom) {
    var total = (custom.slider_0 || 0) + (custom.slider_1 || 0) + (custom.slider_2 || 0) + (custom.slider_3 || 0);
    return total;
  },

  getBudgetTotal: function(custom) {
    return this.calculateBudget(custom);
  },

  // Drawdown Solutions (Module 6)
  calculateImpact: function(custom) {
    // Each slider is 0-100 scale of deployment
    // Multiply by max potential for each solution category
    var weights = {
      slider_0: 22.0,   // Renewable energy (GtCO2 per 100%)
      slider_1: 15.0,   // Reforestation
      slider_2: 8.0,    // Food waste
      slider_3: 6.0     // Building efficiency
    };
    var total = 0;
    for (var key in weights) {
      total += (custom[key] || 0) * weights[key];
    }
    return Math.round(total * 10) / 10; // Round to 0.1
  },

  getImpactTotal: function(custom) {
    return this.calculateImpact(custom);
  },

  // Carbon Footprint Calculator (Module 7)
  calculateFootprint: function(custom) {
    // Electricity: avg US ~0.4 kg CO2/kWh, ~900 kWh/month at $120/mo
    var electricity = (custom.slider_0 || 120) * 0.0074 * 12; // ~7.4 kg/kWh * usage factor

    // Car commute: avg US car ~0.4 kg CO2/mile
    var commute = (custom.slider_1 || 30) * 0.4 * 260; // 260 workdays

    // Flights: ~1.6 tons per long-haul round trip
    var flights = (custom.slider_2 || 2) * 1.6;

    // Diet: meat-heavy ~3.3 kg/day, plant-based ~1.5 kg/day
    // Baseline: 2.5 kg/day, adjust by meat meals
    var meatMeals = custom.slider_3 || 10;
    var food = (2.5 + (meatMeals - 10) * 0.08) * 365 / 1000; // Convert kg to tons

    var total = electricity + commute + flights + food;
    return Math.round(total * 10) / 10;
  },

  getFootprintResult: function(custom) {
    return this.calculateFootprint(custom);
  }
};

// Back-reference from module definitions
// Use: "calculate": "custom.calculateFootprint" in module JSON
// The engine resolves this to window.__ELU_CALC[methodName]

// Patch ModuleEngine to resolve calculate strings
(function() {
  if (typeof ModuleEngine === 'undefined') return;

  var _origRenderStage = ModuleEngine.prototype._renderStage;
  ModuleEngine.prototype._renderStage = function(index) {
    var stage = this.definition.stages[index];
    if (stage && stage.calculate && typeof stage.calculate === 'string') {
      var parts = stage.calculate.split('.');
      if (parts.length === 2 && window[parts[0]] && typeof window[parts[0]][parts[1]] === 'function') {
        stage._calcFunc = window[parts[0]][parts[1]];
      }
    }
    _origRenderStage.call(this, index);
  };
})();

console.log('[ELU-Calculator] Calculation helpers loaded');