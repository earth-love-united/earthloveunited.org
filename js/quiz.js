// ═══════════════════════════════════════════════
// QUIZ — Interactive quiz widget
// ═══════════════════════════════════════════════

const Quiz = {
  questions: [
    {
      q: "How much CO₂ does humanity add to the atmosphere each year?",
      options: ["5 Gt", "20 Gt", "100 Gt", "500 Gt"],
      correct: 1,
      explain: "Humanity emits ~143 Gt CO₂/yr but nature absorbs ~123 Gt. The net excess is ~20 Gt/yr — and it accumulates every year."
    },
    {
      q: "Which ecosystem stores the most carbon per hectare?",
      options: ["Tropical rainforest", "Grassland", "Mangrove forest", "Temperate pine forest"],
      correct: 2,
      explain: "Mangroves store ~950 tC/ha — nearly 3x more than tropical rainforests. Their waterlogged soil locks carbon away for millennia."
    },
    {
      q: "If you restore 100 hectares of degraded land to tropical rainforest, how much CO₂ could it sequester over 30 years?",
      options: ["~10,000 t", "~100,000 t", "~1,000,000 t", "~10,000,000 t"],
      correct: 2,
      explain: "100 ha × (350-10) tC/ha × 3.67 × 30 years ≈ 3.7 million t CO₂. That's like taking 800,000 cars off the road for a year."
    },
    {
      q: "What percentage of global annual net emissions would restoring 2,500 ha of mangrove offset?",
      options: ["0.0001%", "0.04%", "1%", "10%"],
      correct: 1,
      explain: "2,500 ha of mangrove restoration sequesters ~14.7M t CO₂ over 30 years. That's ~0.04% of one year's global net emissions. Every bit counts."
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
  }
};
