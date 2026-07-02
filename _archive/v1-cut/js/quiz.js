// ═══════════════════════════════════════════════
// QUIZ — Interactive quiz widget
// ═══════════════════════════════════════════════

const Quiz = {
  questions: [
    {
      q: "How much CO₂ does humanity add to the atmosphere each year?",
      options: ["5 Gt", "20 Gt", "100 Gt", "500 Gt"],
      correct: 1,
      explain: "Humanity emitted ~42 GtCO₂ in 2025. About half stayed in the atmosphere (~20 Gt/yr net increase). The rest was absorbed by land and ocean sinks."
    },
    {
      q: "Which ecosystem stores the most carbon per hectare?",
      options: ["Tropical rainforest", "Grassland", "Mangrove forest", "Temperate pine forest"],
      correct: 2,
      explain: "Mangroves store ~950 tC/ha — nearly 3x more than tropical rainforests. Their waterlogged soil locks carbon away for millennia."
    },
    {
      q: "If you restore 100 hectares of degraded land to tropical rainforest, how much CO₂ could it sequester over 30 years?",
      options: ["~100,000 t", "~350,000 t", "~1,000,000 t", "~10,000,000 t"],
      correct: 0,
      explain: "The stock recovery is ~340 tC/ha × 100 ha × 3.67 = ~125,000 tCO₂. Even adding 30 years of annual accumulation, the total stays in the ~100,000 t range — far below millions."
    },
    {
      q: "What percentage of one year's global net emissions would restoring 2,500 ha of mangrove offset annually?",
      options: ["~0.0003%", "~0.003%", "~0.03%", "~0.3%"],
      correct: 0,
      explain: "2,500 ha × 6.5 tC/ha/yr × 3.67 = ~60,000 tCO₂/yr. That's ~0.0003% of annual net emissions (~20 Gt). Small, but every bit counts — and mangroves protect coasts, store centuries of carbon, and support fisheries too."
    }
  ],

  idx: 0,
  score: 0,

  init() {
    this.render();
  },

  render() {
    const q = this.questions[this.idx];
    if (!$('q-text') || !$('q-options')) return; // quiz DOM not present
    $text('q-text', `${this.idx + 1}. ${q.q}`);
    $html('q-options', q.options.map((o, i) =>
      `<div class="quiz-option" onclick="Quiz.answer(${i})">${o}</div>`
    ).join(''));
    const fb = $('q-feedback');
    if (fb) { fb.className = 'quiz-feedback'; fb.innerHTML = ''; }
    $text('q-score', `Question ${this.idx + 1} of ${this.questions.length}`);
  },

  answer(i) {
    const q = this.questions[this.idx];
    const opts = document.querySelectorAll('#q-options .quiz-option');
    opts.forEach((o, j) => {
      o.classList.add('disabled');
      if (j === q.correct) o.classList.add('correct');
      if (j === i && j !== q.correct) o.classList.add('wrong');
    });
    if (i === q.correct) this.score++;
    const fb = $('q-feedback');
    if (fb) {
      fb.className = 'quiz-feedback show ' + (i === q.correct ? 'correct' : 'wrong');
      fb.innerHTML = (i === q.correct ? '✅ Correct! ' : '❌ Not quite. ') + q.explain;
    }
    $text('q-score', `${this.score}/${this.idx + 1} correct`);

    setTimeout(() => {
      this.idx++;
      if (this.idx < this.questions.length) this.render();
      else {
        $text('q-text', "Great job! You've got the basics.");
        $html('q-options', `<div class="quiz-option correct" style="text-align:center">Score: ${this.score}/${this.questions.length} — ${this.score === this.questions.length ? 'Perfect! 🎉' : this.score >= 2 ? 'Solid understanding! 💪' : 'Keep learning! 📚'}</div>`);
        $text('q-score', '');
      }
    }, 3000);
  },

  start() {
    console.debug('[Stub] Quiz.start');
    return true;
  },

  next() {
    console.debug('[Stub] Quiz.next');
    return true;
  },

  getResult() {
    console.debug('[Stub] Quiz.getResult');
    return true;
  },

  // ── Standard Module Lifecycle (SML) ──
  reset() {
    console.debug('[SML] Quiz.reset');
    return true;
  },

  destroy() {
    console.debug('[SML] Quiz.destroy');
    return true;
  },

  getState() {
    return {};
  },
};

window.Quiz = Quiz;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('Quiz', {
    provides: ['init', 'start', 'next', 'answer', 'getResult', 'reset', 'destroy', 'getState'],
    requires: [],
  });
}
