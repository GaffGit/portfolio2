(() => {
  // Shown in the boot intro and the command prompt.
  const ME = {
    name: 'Thomas Rickström',
    role: 'Information and Software Engineering student',
    handle: 'gaffgit',
    github: 'https://github.com/GaffGit',
  };

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
  };

  /* ---------- boot intro (once per session, skippable) ---------- */
  function boot() {
    if (reduceMotion || store.get('booted')) return Promise.resolve();
    store.set('booted', '1');
    const lines = [
      ['dim', `${ME.handle}-os v1.0 (tty1)`],
      ['', 'loading profile ............ <span class="ok">ok</span>'],
      ['', 'mounting ~/projects ........ <span class="ok">ok</span>'],
      ['', 'checking coffee levels ..... <span class="ok">ok</span>'],
      ['', 'starting portfolio.service . <span class="ok">ok</span>'],
      ['dim', ''],
      ['', 'welcome, guest.'],
    ];
    const el = document.createElement('div');
    el.className = 'boot';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<p class="skip-hint">press any key to skip</p>';
    document.body.append(el);

    return new Promise((resolve) => {
      let i = 0, timer;
      const finish = () => {
        clearTimeout(timer);
        ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach((e) => removeEventListener(e, finish));
        el.classList.add('done');
        setTimeout(() => el.remove(), 500);
        resolve();
      };
      const next = () => {
        if (i >= lines.length) { timer = setTimeout(finish, 380); return; }
        const [cls, html] = lines[i++];
        const p = document.createElement('p');
        p.className = cls;
        p.innerHTML = html || '&nbsp;';
        el.insertBefore(p, el.lastChild);
        timer = setTimeout(next, i === 1 ? 260 : 150);
      };
      ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach((e) => addEventListener(e, finish, { once: true, passive: true }));
      next();
    });
  }

  /* ---------- typed section commands ---------- */
  function typeCommands() {
    const cmds = $$('.cmd[data-type]');
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    cmds.forEach((c) => { c.dataset.text = c.textContent; c.textContent = ''; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting) return;
        io.unobserve(target);
        const text = target.dataset.text;
        let n = 0;
        target.classList.add('typing');
        const tick = () => {
          target.textContent = text.slice(0, ++n);
          if (n < text.length) setTimeout(tick, 28 + Math.random() * 40);
          else setTimeout(() => target.classList.remove('typing'), 600);
        };
        tick();
      });
    }, { threshold: 1 });
    cmds.forEach((c) => io.observe(c));
  }

  /* ---------- scroll-driven ASCII object ----------
     A point cloud rendered into characters. Scrolling rotates it, and each
     section boundary morphs it into the next shape. */
  function asciiObject() {
    const pre = $('#ascii'), readout = $('#ascii-readout');
    const N = 12000;
    const RAMP = '.,-~:;=!*#$@';
    const NAMES = ['torus', 'cube', 'sphere', 'octahedron'];

    // every shape stores N points as [x, y, z, nx, ny, nz]
    const fib = (fn) => {
      const out = new Float32Array(N * 6), g = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) {
        const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), a = i * g;
        fn(out, i * 6, Math.cos(a) * r, y, Math.sin(a) * r);
      }
      return out;
    };
    const set = (o, k, x, y, z, nx, ny, nz) => { o[k] = x; o[k + 1] = y; o[k + 2] = z; o[k + 3] = nx; o[k + 4] = ny; o[k + 5] = nz; };

    const torus = new Float32Array(N * 6);
    for (let i = 0, NU = 200; i < N; i++) {
      const u = ((i % NU) / NU) * Math.PI * 2, v = (Math.floor(i / NU) / (N / NU)) * Math.PI * 2;
      const R = 0.85, r = 0.38, cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
      set(torus, i * 6, (R + r * cv) * cu, r * sv, (R + r * cv) * su, cv * cu, sv, cv * su);
    }
    const cube = fib((o, k, x, y, z) => {
      const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z), m = Math.max(ax, ay, az), s = 0.72 / m;
      set(o, k, x * s, y * s, z * s, m === ax ? Math.sign(x) : 0, m === ay ? Math.sign(y) : 0, m === az ? Math.sign(z) : 0);
    });
    const sphere = fib((o, k, x, y, z) => set(o, k, x, y, z, x, y, z));
    const octa = fib((o, k, x, y, z) => {
      const s = 1.2 / (Math.abs(x) + Math.abs(y) + Math.abs(z)), c = 1 / Math.sqrt(3);
      set(o, k, x * s, y * s, z * s, Math.sign(x) * c, Math.sign(y) * c, Math.sign(z) * c);
    });
    const SHAPES = [torus, cube, sphere, octa];

    const sections = $$('main .section');
    let tops = [], cols = 0, rows = 0, cw = 6.6, lh = 11, sizePx = 200, zbuf, chars;
    const LX = 0.3, LY = 0.7, LZ = -0.65, LN = Math.hypot(LX, LY, LZ);

    const layout = () => {
      tops = sections.map((s) => s.getBoundingClientRect().top + scrollY);
      const box = pre.parentElement.getBoundingClientRect();
      const probe = document.createElement('span');
      probe.textContent = 'M'.repeat(20);
      pre.append(probe);
      cw = probe.getBoundingClientRect().width / 20 || 6.6;
      probe.remove();
      const w = Math.min(box.width, 900), h = Math.max(box.height - 40, 200);
      cols = Math.min(140, Math.floor(w / cw));
      rows = Math.min(80, Math.floor(h / lh));
      sizePx = 0.3 * Math.min(cols * cw, rows * lh);
      zbuf = new Float32Array(cols * rows);
      chars = new Array(cols * rows);
    };

    // where are we: section index plus how far into its morph
    const progress = () => {
      const y = scrollY + innerHeight * 0.5;
      let k = 0;
      while (k < tops.length - 1 && tops[k + 1] <= y) k++;
      const end = k < tops.length - 1 ? tops[k + 1] : document.documentElement.scrollHeight;
      const t = Math.min(1, Math.max(0, (y - tops[k]) / (end - tops[k] || 1)));
      const s = Math.min(1, Math.max(0, (t - 0.6) / 0.4));
      return { k, blend: k < tops.length - 1 ? s * s * (3 - 2 * s) : 0 };
    };

    const render = (time) => {
      const { k, blend } = progress();
      const a = SHAPES[k % 4], b = SHAPES[(k + 1) % 4];
      const A = reduceMotion ? 0.9 : 0.9 + scrollY * 0.0032 + time * 0.00018;
      const B = reduceMotion ? 0.35 : scrollY * 0.0019 + time * 0.0001;
      const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
      const K2 = 5, cx = cols / 2, cy = rows / 2;
      zbuf.fill(0);
      chars.fill(' ');

      for (let i = 0; i < N * 6; i += 6) {
        let x = a[i] + (b[i] - a[i]) * blend, y = a[i + 1] + (b[i + 1] - a[i + 1]) * blend, z = a[i + 2] + (b[i + 2] - a[i + 2]) * blend;
        let nx = a[i + 3] + (b[i + 3] - a[i + 3]) * blend, ny = a[i + 4] + (b[i + 4] - a[i + 4]) * blend, nz = a[i + 5] + (b[i + 5] - a[i + 5]) * blend;
        // rotate around X by A, then around Y by B
        let y1 = y * cA - z * sA, z1 = y * sA + z * cA;
        const x2 = x * cB + z1 * sB, z2 = -x * sB + z1 * cB;
        let ny1 = ny * cA - nz * sA, nz1 = ny * sA + nz * cA;
        const nx2 = nx * cB + nz1 * sB, nz2 = -nx * sB + nz1 * cB;

        const ooz = 1 / (z2 + K2);
        const px = Math.round(cx + (x2 * sizePx * K2 * ooz) / cw);
        const py = Math.round(cy - (y1 * sizePx * K2 * ooz) / lh);
        if (px < 0 || px >= cols || py < 0 || py >= rows) continue;
        const idx = py * cols + px;
        if (ooz <= zbuf[idx]) continue;
        zbuf[idx] = ooz;
        const nl = Math.hypot(nx2, ny1, nz2) || 1;
        const lum = (nx2 * LX + ny1 * LY + nz2 * LZ) / (nl * LN);
        chars[idx] = lum > 0 ? RAMP[Math.min(11, Math.floor(Math.pow(lum, 0.7) * 12))] : '.';
      }

      let out = '';
      for (let r = 0; r < rows; r++) out += chars.slice(r * cols, (r + 1) * cols).join('') + '\n';
      pre.textContent = out;

      const deg = (v) => String(Math.round(((v * 180) / Math.PI) % 360)).padStart(3, ' ');
      const shape = blend > 0.02 && blend < 0.98 ? `<b>${NAMES[k % 4]}</b> → <b>${NAMES[(k + 1) % 4]}</b>` : `<b>${NAMES[(blend >= 0.98 ? k + 1 : k) % 4]}</b>`;
      readout.innerHTML = `render: ${shape} · θ ${deg(A)}° · φ ${deg(B)}°`;
    };

    layout();
    addEventListener('resize', () => { layout(); render(performance.now()); }, { passive: true });
    addEventListener('load', layout);

    if (reduceMotion) {
      render(0);
      addEventListener('scroll', () => requestAnimationFrame(() => render(0)), { passive: true });
      return;
    }
    // ~30 fps; requestAnimationFrame already pauses in background tabs
    let last = 0;
    const loop = (t) => {
      if (t - last > 32) { last = t; render(t); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- status line, title bar path, active nav ---------- */
  function statusLine() {
    const sections = $$('main .section');
    const cwd = $('#cwd'), file = $('#sl-file'), pos = $('#sl-pos');
    const navLinks = $$('.titlebar nav a');
    let ticking = false;

    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      const pct = max > 0 ? Math.round((scrollY / max) * 100) : 0;
      pos.textContent = pct <= 0 ? 'Top' : pct >= 100 ? 'Bot' : pct + '%';
      let current = sections[0];
      for (const s of sections) if (s.getBoundingClientRect().top < innerHeight * 0.4) current = s;
      const path = current.dataset.path;
      if (cwd.textContent !== path) {
        cwd.textContent = path;
        file.textContent = path;
        navLinks.forEach((a) => (a.hash === '#' + current.id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      }
    };
    update();
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  }

  /* ---------- copy email ---------- */
  function copyEmail() {
    const btn = $('#copy-email');
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      try {
        await navigator.clipboard.writeText(email);
        btn.textContent = 'copied ✓';
      } catch {
        location.href = 'mailto:' + email;
        return;
      }
      setTimeout(() => (btn.textContent = 'copy email'), 1800);
    });
  }

  /* ---------- command prompt ---------- */
  function prompt() {
    const form = $('#prompt'), input = $('#cmd-input'), out = $('#cmd-out');
    const history = [];
    let hIdx = 0;
    const go = (id) => { $('#' + id).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); };
    const say = (html) => { out.innerHTML = html; };
    const open = (url) => window.open(url, '_blank', 'noopener');

    const commands = {
      help: () => say('commands: <span class="ok">whoami projects about experience skills now contact resume github email theme clear</span>'),
      whoami: () => { go('whoami'); say(`${ME.name} — ${ME.role}.`); },
      projects: () => { go('projects'); say(`${$$('.project').length} projects. scroll or press tab to explore.`); },
      ls: () => commands.projects(),
      about: () => { go('about'); say(''); },
      experience: () => { go('experience'); say(''); },
      skills: () => { go('skills'); say(''); },
      contact: () => { go('contact'); say('email is the fastest way to reach me.'); },
      resume: () => { open('resume.pdf'); say('opening resume.pdf ...'); },
      github: () => { open(ME.github); say('opening github ...'); },
      email: () => { $('#copy-email').click(); say('<span class="ok">email copied to clipboard.</span>'); },
      theme: () => {
        const root = document.documentElement;
        const dark = getComputedStyle(root).colorScheme.includes('dark');
        root.dataset.theme = dark ? 'light' : 'dark';
        try { localStorage.setItem('theme', root.dataset.theme); } catch {}
        say(`theme set to <span class="ok">${root.dataset.theme}</span>.`);
      },
      clear: () => say(''),
      sudo: () => say('<span class="err">guest is not in the sudoers file. This incident will be reported.</span>'),
      date: () => say(new Date().toString()),
      exit: () => say('there is no escape. try <span class="ok">contact</span> instead.'),
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = input.value.trim();
      input.value = '';
      if (!raw) return;
      history.push(raw); hIdx = history.length;
      const [name, ...args] = raw.toLowerCase().split(/\s+/);
      if (name === 'cd' && args[0]) return (commands[args[0].replace(/^~?\/?/, '')] || commands.help)();
      if (name === 'echo') return say(raw.slice(5).replace(/[<>&]/g, ''));
      (commands[name] || (() => say(`<span class="err">command not found: ${name.replace(/[<>&]/g, '')}</span>. try <span class="ok">help</span>`)))();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && hIdx > 0) { input.value = history[--hIdx]; e.preventDefault(); }
      if (e.key === 'ArrowDown') { hIdx = Math.min(hIdx + 1, history.length); input.value = history[hIdx] || ''; e.preventDefault(); }
      if (e.key === 'Tab' && input.value) {
        const match = Object.keys(commands).find((c) => c.startsWith(input.value.toLowerCase()));
        if (match) { input.value = match; e.preventDefault(); }
      }
    });

    // "/" focuses the prompt from anywhere, like many dev tools
    addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        e.preventDefault(); input.focus();
      }
    });
  }

  asciiObject();
  statusLine();
  copyEmail();
  prompt();
  boot().then(typeCommands);
})();
