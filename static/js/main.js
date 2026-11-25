/* Active-to-Predictive Visual Recovery — page interactions (no dependencies) */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- nav background on scroll ---------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el) => io.observe(el));

  /* ---------- lazy autoplay videos: load + play when visible, pause when not ---------- */
  const vio = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      if (v.dataset.src && !v.src) { v.src = v.dataset.src; v.load(); }
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    } else if (!v.paused) v.pause();
  }), { threshold: 0.35 });
  $$('video.lazy').forEach((v) => vio.observe(v));

  /* ---------- lightbox for figures ---------- */
  const lb = $('#lightbox'), lbImg = $('img', lb);
  $$('.zoomable img').forEach((img) => img.addEventListener('click', () => {
    lbImg.src = img.src; lbImg.alt = img.alt; lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false');
  }));
  const closeLb = () => { lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); };
  lb.addEventListener('click', closeLb);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLb(); });

  /* ---------- BibTeX copy ---------- */
  $('#copy-bib').addEventListener('click', () => {
    const t = $('#bib-text').innerText, b = $('#copy-bib');
    const done = () => { b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, done); else done();
  });

  /* ---------- count-up for hero stats ---------- */
  const cio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target, to = parseFloat(el.dataset.count), t0 = performance.now(), dur = 1300;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), ez = 1 - Math.pow(1 - k, 3);
      el.textContent = (to * ez).toFixed(1); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: 0.6 });
  $$('[data-count]').forEach((el) => cio.observe(el));

  /* ================= real-world results (paper Table 4) ================= */
  const V = 'static/videos/';
  const TASKS = [
    { id: 'pick', name: 'Picking Cube', instr: 'pick up the white cube', clean: 77.8,
      conds: [
        { id: 'pick_full', name: 'Target fully hidden', corr: 0.0, ours: 66.7, base: true },
        { id: 'pick_partial', name: 'Target partially hidden', corr: 33.3, ours: 66.7, base: false },
        { id: 'pick_visible', name: 'Target visible', corr: 75.0, ours: 75.0, base: false },
      ] },
    { id: 'pnp', name: 'Pick & Place', instr: 'pick up the black cube and place it on the white plate', clean: 77.8,
      conds: [
        { id: 'pnp_object', name: 'Cube hidden', corr: 8.3, ours: 58.3, base: true },
        { id: 'pnp_goal', name: 'Plate hidden', corr: 0.0, ours: 33.3, base: true },
        { id: 'pnp_both', name: 'Cube & plate hidden', corr: 0.0, ours: 41.7, base: true },
      ] },
    { id: 'push', name: 'Pushing Cube', instr: 'push the blue cube to the black marker', clean: 72.2,
      conds: [
        { id: 'push_object', name: 'Cube hidden', corr: 8.3, ours: 83.3, base: true },
        { id: 'push_goal', name: 'Marker hidden', corr: 8.3, ours: 58.3, base: false },
        { id: 'push_both', name: 'Cube & marker hidden', corr: 0.0, ours: 33.3, base: true },
      ] },
  ];
  const OVERALL = { pick: [36.1, 69.4], pnp: [2.8, 44.4], push: [5.6, 58.3] };
  const tabs = $('#task-tabs'), pills = $('#cond-pills'), cmp = $('#compare');
  const vBase = $('#vid-base'), vOurs = $('#vid-ours'), vView = $('#vid-view'), info = $('#cond-info');
  let curTask = TASKS[2], curCond = curTask.conds[2];

  function setVideo(v, src, poster) {
    if (v.dataset.cur === src) return;
    v.dataset.cur = src; v.poster = poster || ''; v.src = src; v.load();
    if (realVisible) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
  }
  function render() {
    tabs.innerHTML = ''; pills.innerHTML = '';
    TASKS.forEach((t) => {
      const b = document.createElement('button'); b.className = 'tab' + (t === curTask ? ' active' : '');
      b.textContent = t.name; b.setAttribute('role', 'tab');
      b.onclick = () => { curTask = t; curCond = t.conds.find((c) => c.base) || t.conds[0]; render(); };
      tabs.appendChild(b);
    });
    curTask.conds.forEach((c) => {
      const b = document.createElement('button'); b.className = 'pill' + (c === curCond ? ' active' : '');
      b.textContent = c.name; b.onclick = () => { curCond = c; render(); };
      pills.appendChild(b);
    });
    const c = curCond;
    cmp.classList.toggle('single', !c.base);
    if (c.base) setVideo(vBase, V + c.id + '_gr00t.mp4', V + c.id + '_gr00t.jpg');
    else { vBase.pause(); }
    setVideo(vOurs, V + c.id + '_ours.mp4', V + c.id + '_ours.jpg');
    setVideo(vView, V + c.id + '_view.mp4', '');
    info.innerHTML = `Instruction <span class="instr">"${curTask.instr}"</span><br>` +
      `Condition success over 12 trials: <span class="rate">Direct GR00T <b>${c.corr.toFixed(1)}%</b></span> &rarr; ` +
      `<span class="rate">Ours <b>${c.ours.toFixed(1)}%</b></span>` +
      (c.base ? '' : '<br><span style="color:var(--ink3);font-size:13.5px">Showing our rollout for this condition.</span>');
  }
  let realVisible = false;
  new IntersectionObserver((es) => es.forEach((e) => {
    realVisible = e.isIntersecting;
    [vBase, vOurs, vView].forEach((v) => {
      if (!v.src) return;
      if (realVisible && !(v === vBase && !curCond.base)) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause();
    });
  }), { threshold: 0.15 }).observe($('#real'));
  render();

  /* ================= bar charts ================= */
  const tip = document.createElement('div'); tip.className = 'tooltip'; document.body.appendChild(tip);
  const showTip = (e, html) => { tip.innerHTML = html; tip.style.opacity = 1; moveTip(e); };
  const moveTip = (e) => { tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; };
  const hideTip = () => { tip.style.opacity = 0; };

  function barChart(el, groups) {
    const wrap = document.createElement('div'); wrap.className = 'groups';
    groups.forEach((g) => {
      if (g.sep) { const s = document.createElement('div'); s.className = 'sep'; wrap.appendChild(s); return; }
      const row = document.createElement('div'); row.className = 'group';
      row.innerHTML = `<div class="group-label ${g.task ? 'task' : ''}">${g.label}${g.sub ? `<small>${g.sub}</small>` : ''}</div>`;
      const bars = document.createElement('div'); bars.className = 'bars';
      [0, 25, 50, 75, 100].forEach((x) => { const gl = document.createElement('div'); gl.className = 'gridline'; gl.style.left = x + '%'; bars.appendChild(gl); });
      [['base', g.corr, 'Direct GR00T (occluded)'], ['ours', g.ours, 'Ours + frozen GR00T']].forEach(([k, v, name]) => {
        const r = document.createElement('div'); r.className = 'bar-row ' + k;
        r.innerHTML = `<div class="bar ${k}" data-w="${v}"></div><span class="bar-val" data-l="${v}">${v.toFixed(1)}%</span>`;
        r.addEventListener('mouseenter', (e) => showTip(e, `<div class="tt-k">${g.label}${g.sub ? ' · ' + g.sub : ''}</div>${name}: <b>${v.toFixed(1)}%</b>` +
          (g.clean != null ? `<div class="tt-k">clean-camera reference ${g.clean.toFixed(1)}%</div>` : '')));
        r.addEventListener('mousemove', moveTip); r.addEventListener('mouseleave', hideTip);
        bars.appendChild(r);
      });
      if (g.clean != null) { const m = document.createElement('div'); m.className = 'clean-mark'; m.style.left = g.clean + '%'; m.title = 'clean ' + g.clean + '%'; bars.appendChild(m); }
      row.appendChild(bars); wrap.appendChild(row);
    });
    const ax = document.createElement('div'); ax.className = 'axis';
    ax.innerHTML = '<div></div><div class="ticks-x">' + [0, 25, 50, 75, 100].map((x) => `<span style="left:${x}%">${x}%</span>`).join('') + '</div>';
    el.appendChild(wrap); el.appendChild(ax);
    new IntersectionObserver((es, o) => es.forEach((e) => {
      if (!e.isIntersecting) return; o.disconnect();
      $$('.bar', el).forEach((b) => (b.style.width = b.dataset.w + '%'));
      $$('.bar-val', el).forEach((s) => (s.style.left = s.dataset.l + '%'));
    }), { threshold: 0.25 }).observe(el);
  }
  function table(el, head, rows) {
    el.innerHTML = '<table class="rtable"><thead><tr>' + head.map((h) => `<th>${h}</th>`).join('') + '</tr></thead><tbody>' +
      rows.map((r) => '<tr>' + r.map((x) => `<td>${x}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
  }

  const realGroups = [];
  TASKS.forEach((t, i) => {
    if (i) realGroups.push({ sep: true });
    t.conds.forEach((c) => realGroups.push({ label: c.name, sub: t.name, corr: c.corr, ours: c.ours }));
    realGroups.push({ label: 'Overall', sub: t.name, task: true, corr: OVERALL[t.id][0], ours: OVERALL[t.id][1], clean: t.clean });
  });
  barChart($('#chart-real'), realGroups);
  table($('#table-real'), ['Task', 'Condition', 'Clean', 'Direct GR00T', 'Ours'],
    TASKS.flatMap((t) => [...t.conds.map((c) => [t.name, c.name, '', c.corr.toFixed(1), c.ours.toFixed(1)]),
      [t.name, '<b>Overall</b>', t.clean.toFixed(1), OVERALL[t.id][0].toFixed(1), '<b>' + OVERALL[t.id][1].toFixed(1) + '</b>']]));

  const SIM = [
    { label: 'Can-to-Plate', corr: 20, ours: 48, clean: 90 },
    { label: 'Clutter Pick', corr: 34, ours: 42, clean: 70 },
    { label: 'Block Push', corr: 30, ours: 72, clean: 100 },
    { label: 'Bottle-to-Box', corr: 2, ours: 10, clean: 50 },
    { sep: true },
    { label: 'Average', task: true, corr: 21.5, ours: 43.0, clean: 77.5 },
  ];
  barChart($('#chart-sim'), SIM);
  table($('#table-sim'), ['Task', 'Clean', 'Direct GR00T', 'Ours'],
    SIM.filter((s) => !s.sep).map((s) => [s.label, s.clean.toFixed(1), s.corr.toFixed(1), s.ours.toFixed(1)]));
})();
