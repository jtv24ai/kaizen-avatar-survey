/**
 * Kaizen Avatar Survey — Typeform-style one-question flow, expanded results.
 * Uses window.KAIZEN_SURVEY from survey-data.js.
 */
(function () {
  'use strict';

  const THRESHOLD_RATIO = 0.85;
  const scaleLabels = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

  function getData() {
    if (typeof window.KAIZEN_SURVEY !== 'object' || !window.KAIZEN_SURVEY.survey) {
      throw new Error('KAIZEN_SURVEY not loaded. Ensure survey-data.js is loaded first.');
    }
    return window.KAIZEN_SURVEY;
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderStep(container, survey, index, answers, onSelect) {
    var questions = survey.questions;
    var q = questions[index];
    var num = index + 1;
    var total = questions.length;
    var scale = survey.scale || {};
    var min = scale.min != null ? scale.min : 1;
    var max = scale.max != null ? scale.max : 5;
    var selected = answers[q.id];

    var html = '<p class="step-progress">' + num + ' of ' + total + '</p>';
    html += '<h2 class="question-title">' + escapeHtml(q.text) + '</h2>';
    html += '<div class="scale-options" role="group" aria-label="Rate from ' + min + ' to ' + max + '">';
    for (var v = min; v <= max; v++) {
      var id = q.id + '_' + v;
      var label = scaleLabels[v - 1] || '';
      var checked = selected === v ? ' checked' : '';
      html += '<label class="scale-option' + (selected === v ? ' is-selected' : '') + '">';
      html += '<input type="radio" name="' + escapeHtml(q.id) + '" value="' + v + '" id="' + escapeHtml(id) + '"' + checked + '>';
      html += '<span class="scale-value">' + v + '</span>';
      html += '<span class="scale-label">' + escapeHtml(label) + '</span>';
      html += '</label>';
    }
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('input[type="radio"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        onSelect(q.id, parseInt(radio.value, 10));
        container.querySelectorAll('.scale-option').forEach(function (el) { el.classList.remove('is-selected'); });
        radio.closest('.scale-option').classList.add('is-selected');
      });
    });
  }

  function collectResponses(survey, answers) {
    return survey.questions.map(function (q) {
      return { id: q.id, value: answers[q.id] };
    });
  }

  function scoreResponses(survey, responses) {
    var qById = {};
    survey.questions.forEach(function (q) {
      qById[q.id] = q;
    });
    var scores = {};
    survey.archetypes.forEach(function (a) {
      scores[a] = 0;
    });
    responses.forEach(function (r) {
      var q = qById[r.id];
      if (!q || !q.weights) return;
      Object.keys(q.weights).forEach(function (arch) {
        if (scores.hasOwnProperty(arch)) {
          scores[arch] += r.value * q.weights[arch];
        }
      });
    });
    return scores;
  }

  function primaryAndSecondary(scores, thresholdRatio) {
    var entries = Object.keys(scores).map(function (a) {
      return { id: a, score: scores[a] };
    });
    entries.sort(function (a, b) {
      return b.score - a.score;
    });
    var primary = entries[0];
    if (!primary || primary.score <= 0) return { primary: 'zenkai', secondary: null };
    var secondary = null;
    if (entries.length > 1 && entries[1].score >= thresholdRatio * primary.score) {
      secondary = entries[1].id;
    }
    return { primary: primary.id, secondary: secondary };
  }

  function renderResult(contentEl, data, primaryId, secondaryId, scores) {
    var meta = data.avatarMeta[primaryId];
    if (!meta) {
      contentEl.innerHTML = '<p>Unknown avatar: ' + escapeHtml(primaryId) + '</p>';
      return;
    }
    var kanji = meta.kanji || meta.name_ja;
    var imagePath = meta.image;
    var showImage = typeof imagePath === 'string' && imagePath.length > 0;
    var html = '';

    html += '<div class="result-avatar-visual">';
    if (showImage) {
      html += '<img id="avatar-result-img" src="' + escapeHtml(imagePath) + '" alt="' + escapeHtml(meta.name_ja) + '" />';
    }
    html += '<div class="avatar-kanji" id="avatar-result-kanji" style="' + (showImage ? 'display:none' : '') + '">' + escapeHtml(kanji) + '</div>';
    html += '</div>';
    html += '<p class="result-primary">' + escapeHtml(meta.name_ja) + '</p>';
    html += '<p class="result-en-parens">(' + escapeHtml(meta.name_en) + ')</p>';
    html += '<p class="result-tagline">' + escapeHtml(meta.tagline) + '</p>';

    if (meta.description) {
      html += '<div class="result-description"><p>' + escapeHtml(meta.description) + '</p></div>';
    }

    if (meta.attributes && meta.attributes.length) {
      html += '<div class="result-block result-attributes"><h3>Attributes</h3><ul>';
      meta.attributes.forEach(function (item) {
        html += '<li>' + escapeHtml(item) + '</li>';
      });
      html += '</ul></div>';
    }

    if (meta.anti_attributes && meta.anti_attributes.length) {
      html += '<div class="result-block result-anti-attributes"><h3>Anti-attributes (watch for)</h3><ul>';
      meta.anti_attributes.forEach(function (item) {
        html += '<li>' + escapeHtml(item) + '</li>';
      });
      html += '</ul></div>';
    }

    html += '<div class="landmine-block"><h3>Founder error & co-founder conflict</h3>';
    html += '<p class="strength"><strong>Strength:</strong> ' + escapeHtml(meta.conflict_strength) + '</p>';
    html += '<p><strong>Watch:</strong> ' + escapeHtml(meta.conflict_watch) + '</p></div>';
    html += '<div class="landmine-block"><h3>CASHFLOW CONFLICT</h3>';
    html += '<p class="strength"><strong>Strength:</strong> ' + escapeHtml(meta.cash_strength) + '</p>';
    html += '<p><strong>Watch:</strong> ' + escapeHtml(meta.cash_watch) + '</p></div>';

    if (secondaryId && data.avatarMeta[secondaryId]) {
      var sm = data.avatarMeta[secondaryId];
      html += '<p class="result-secondary"><strong>Secondary avatar:</strong> ' + escapeHtml(sm.name_ja) + ' (' + escapeHtml(sm.name_en) + ')</p>';
    }
    html += '<details class="result-scores"><summary>Raw scores</summary><pre>' + escapeHtml(JSON.stringify(scores, null, 2)) + '</pre></details>';
    contentEl.innerHTML = html;

    if (showImage) {
      var img = document.getElementById('avatar-result-img');
      var kanjiEl = document.getElementById('avatar-result-kanji');
      if (img && kanjiEl) {
        img.onerror = function () {
          img.style.display = 'none';
          kanjiEl.style.display = 'inline-block';
        };
      }
    }
  }

  function showResult(resultPayload) {
    document.getElementById('survey-form').hidden = true;
    document.getElementById('progress-wrap').hidden = true;
    document.getElementById('survey-header').hidden = true;
    var section = document.getElementById('result-section');
    section.hidden = false;
    renderResult(
      document.getElementById('result-content'),
      getData(),
      resultPayload.primary,
      resultPayload.secondary,
      resultPayload.scores
    );
    window.__lastResult = resultPayload;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function downloadResult() {
    var r = window.__lastResult;
    if (!r) return;
    var blob = new Blob([JSON.stringify({
      primary_avatar: r.primary,
      secondary_avatar: r.secondary,
      scores: r.scores,
      responses: r.responses,
      generated_at: new Date().toISOString()
    }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kaizen-avatar-result.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function retake() {
    document.getElementById('result-section').hidden = true;
    document.getElementById('survey-form').hidden = false;
    document.getElementById('progress-wrap').hidden = false;
    document.getElementById('survey-header').hidden = false;
    window.__lastResult = null;
    document.getElementById('step-view').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function init() {
    var data = getData();
    var survey = data.survey;
    var questions = survey.questions;
    var total = questions.length;
    var answers = {};
    var currentIndex = 0;

    var progressWrap = document.getElementById('progress-wrap');
    var progressBar = document.getElementById('progress-bar');
    var stepEl = document.getElementById('question-step');
    var nextBtn = document.getElementById('next-btn');
    var backBtn = document.getElementById('back-btn');

    function setProgress() {
      var pct = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
      progressBar.style.width = pct + '%';
    }

    function updateNextButton() {
      var q = questions[currentIndex];
      nextBtn.disabled = !q || answers[q.id] == null;
    }

    function go(delta) {
      var next = currentIndex + delta;
      if (next < 0) return;
      if (next >= total) {
        var responses = collectResponses(survey, answers);
        if (responses.length !== total) return;
        var scores = scoreResponses(survey, responses);
        var out = primaryAndSecondary(scores, THRESHOLD_RATIO);
        showResult({
          primary: out.primary,
          secondary: out.secondary,
          scores: scores,
          responses: responses
        });
        return;
      }
      currentIndex = next;
      setProgress();
      renderStep(stepEl, survey, currentIndex, answers, function (qId, value) {
        answers[qId] = value;
        updateNextButton();
      });
      backBtn.style.display = currentIndex > 0 ? 'inline-block' : 'none';
      nextBtn.textContent = currentIndex === total - 1 ? 'See my avatar' : 'Next';
      updateNextButton();
    }

    nextBtn.addEventListener('click', function () {
      var q = questions[currentIndex];
      if (!answers[q.id]) {
        return;
      }
      go(1);
    });

    backBtn.addEventListener('click', function () {
      go(-1);
    });

    document.getElementById('survey-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = questions[currentIndex];
      if (!answers[q.id]) return;
      go(1);
    });

    nextBtn.disabled = true;
    setProgress();
    renderStep(stepEl, survey, 0, answers, function (qId, value) {
      answers[qId] = value;
      updateNextButton();
    });
    backBtn.style.display = 'none';
    nextBtn.textContent = total === 1 ? 'See my avatar' : 'Next';
    updateNextButton();

    document.getElementById('download-btn').addEventListener('click', downloadResult);
    document.getElementById('retake-btn').addEventListener('click', function () {
      retake();
      currentIndex = 0;
      answers = {};
      nextBtn.disabled = true;
      setProgress();
      renderStep(stepEl, survey, 0, answers, function (qId, value) {
        answers[qId] = value;
        updateNextButton();
      });
      backBtn.style.display = 'none';
      nextBtn.textContent = total === 1 ? 'See my avatar' : 'Next';
      updateNextButton();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
