(function () {
  "use strict";
  const D = window.DH_DATA;
  const G = window.DH_GUIDE;
  const STORE_KEY = "dh-builder-v1";

  const TRAITS = [
    { id: "agility", name: "敏捷", verbs: "衝刺・跳躍・機動" },
    { id: "strength", name: "力量", verbs: "舉起・猛擊・擒抱" },
    { id: "finesse", name: "靈巧", verbs: "控制・隱匿・巧手" },
    { id: "instinct", name: "本能", verbs: "察覺・感知・導航" },
    { id: "presence", name: "風度", verbs: "魅力・表演・欺騙" },
    { id: "knowledge", name: "知識", verbs: "回憶・分析・理解" }
  ];
  const POOL = { "2": 1, "1": 2, "0": 2, "-1": 1 };
  const VALUES = [2, 1, 0, -1];
  const APPEAR_ROWS = [
    { id: "clothes", name: "衣著" },
    { id: "eyes", name: "眼睛" },
    { id: "skin", name: "膚色" },
    { id: "body", name: "體型" },
    { id: "attitude", name: "態度" }
  ];

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => (n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "+0");
  const parseNum = (s) => parseInt(String(s).replace("−", "-").replace("+", ""), 10);
  const byId = (arr, id) => arr.find((x) => x.id === id);
  const cls = () => byId(D.classes, S.classId);
  const sub = () => cls() && byId(cls().subclasses, S.subclassId);
  const anc = (id) => byId(D.ancestries, id || S.ancestryId);
  const com = () => byId(D.communities, S.communityId);
  const domName = (d) => D.domainNames[d];
  const domTag = (d) => `<span class="dom dom-${d}">${esc(domName(d))}</span>`;
  const featName = (html) => { const m = /<em>(.*?)：?<\/em>/.exec(html); return m ? m[1].replace(/：$/, "") : ""; };
  const stripTags = (h) => String(h).replace(/<li>/g, "\n・").replace(/<\/p>\s*<p>/g, "\n").replace(/<[^>]+>/g, "").replace(/\n{2,}/g, "\n").trim();
  const allPrimary = () => [...D.equipment.primaryPhysical.map((w) => ({ ...w, magic: false })), ...D.equipment.primaryMagic.map((w) => ({ ...w, magic: true }))];
  const findWeapon = (list, name) => list.find((w) => w["名稱"] === name);
  const traitByName = (n) => TRAITS.find((t) => t.name === n);

  function blankState() {
    return {
      mode: null, quiz: [], step: 0,
      classId: null, subclassId: null,
      ancestryId: null, mixA: null, mixB: null, mixName: "",
      communityId: null,
      traits: { agility: null, strength: null, finesse: null, instinct: null, presence: null, knowledge: null },
      equipMode: "suggested", primary: null, secondary: null, armor: null,
      potion: null, classItem: null, spellbook: "",
      background: ["", "", ""], backgroundExtra: "",
      experiences: ["", ""],
      cards: [],
      appearance: { clothes: [], eyes: [], skin: [], body: [], attitude: [] }, appearanceExtra: "",
      name: "", pronouns: "",
      connections: ""
    };
  }
  let S = load() || blankState();

  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      return Object.assign(blankState(), JSON.parse(raw));
    } catch (e) { return null; }
  }

  // ---------- equipment & stats ----------
  function equipment() {
    const c = cls();
    if (!c) return {};
    if (S.equipMode === "suggested") {
      const sug = c.suggestedEquip;
      const p = sug.find((e) => e.kind === "primary");
      const s = sug.find((e) => e.kind === "secondary");
      const a = sug.find((e) => e.kind === "armor");
      return {
        primary: p && findWeapon(allPrimary(), p.name),
        secondary: s && findWeapon(D.equipment.secondary, s.name),
        armor: a && findWeapon(D.equipment.armor, a.name)
      };
    }
    const primary = findWeapon(allPrimary(), S.primary);
    return {
      primary,
      secondary: primary && primary["負荷"] === "單手" ? findWeapon(D.equipment.secondary, S.secondary) : null,
      armor: findWeapon(D.equipment.armor, S.armor)
    };
  }

  function featureMods() {
    // character features that change starting numbers
    const feats = [...ancestryFeatures(), ...(sub() ? sub().features : [])];
    const names = feats.map(featName);
    const m = { hp: 0, stress: 0, evasion: 0, threshold: 0, cards: 0 };
    if (names.includes("耐力")) m.hp += 1;
    if (names.includes("高耐力")) m.stress += 1;
    if (names.includes("靈活")) m.evasion += 1;
    if (names.includes("龜甲")) m.threshold += 1; // 熟練值 1
    if (S.subclassId === "guardian-vengeance") m.stress += 1;
    if (S.subclassId === "wizard-school-of-war") m.hp += 1;
    if (S.subclassId === "wizard-school-of-knowledge") m.cards += 1;
    return m;
  }

  function ancestryFeatures() {
    if (!S.ancestryId) return [];
    if (S.ancestryId === "mixed-ancestry") {
      const a = anc(S.mixA), b = anc(S.mixB);
      return [a && a.features[0], b && b.features[1]].filter(Boolean);
    }
    return anc().features;
  }

  function stats() {
    const c = cls();
    if (!c) return null;
    const m = featureMods();
    const eq = equipment();
    let evasion = c.evasion + m.evasion;
    let armorScore = 0, minor = null, major = null;
    const modFrom = (txt, key) => {
      const r = new RegExp(key + "\\s*([+\\-−])\\s*(\\d+)").exec(txt || "");
      return r ? (r[1] === "+" ? 1 : -1) * parseInt(r[2], 10) : 0;
    };
    const notes = [];
    if (eq.armor) {
      armorScore = parseInt(eq.armor["護甲值"], 10);
      const [a, b] = eq.armor["閾值"].split("/").map((n) => parseInt(n, 10));
      minor = a + 1 + m.threshold; major = b + 1 + m.threshold;
      evasion += modFrom(eq.armor["特性"], "閃避值");
      if (/敏捷\s*[-−]1/.test(eq.armor["特性"])) notes.push("全板甲：敏捷 −1");
    }
    if (eq.secondary) {
      armorScore += modFrom(eq.secondary["特性"], "護甲值");
      evasion += modFrom(eq.secondary["特性"], "閃避值");
    }
    return {
      level: 1, evasion, armor: armorScore, hp: c.hp + m.hp, stress: 6 + m.stress, hope: 2, proficiency: 1,
      minor, major, cardsNeeded: 2 + m.cards, notes
    };
  }

  function traitsComplete() { return TRAITS.every((t) => S.traits[t.id] !== null); }
  function poolLeft() {
    const left = { ...POOL };
    TRAITS.forEach((t) => { const v = S.traits[t.id]; if (v !== null) left[String(v)]--; });
    return left;
  }

  // ---------- steps ----------
  const STEPS = [];
  function step(def) { STEPS.push(def); }

  step({
    id: "intro", label: null, noPager: true,
    render() {
      const hasProgress = S.classId;
      return `<section class="intro">
        <div class="dice-pair" aria-hidden="true"><div class="die hope-die">希</div><div class="die fear-die">懼</div></div>
        <h1 class="q-title">你將成為誰？</h1>
        <p class="q-hint">回答一連串問題，一步一步建立你的《匕首心》1 級角色。每一步都附上規則說明，完成後會得到一張可以列印、複製的角色卡。</p>
        <div class="paths">
          <button class="choice" type="button" data-action="start" data-mode="quiz">
            <span class="c-name">先做心理測驗</span><span class="c-sub">回答 5 個問題，看看哪個職業最像你。適合第一次玩的人。</span>
          </button>
          <button class="choice" type="button" data-action="start" data-mode="direct">
            <span class="c-name">直接選職業</span><span class="c-sub">已經知道想玩什麼了，跳過測驗。</span>
          </button>
        </div>
        ${hasProgress ? `<p class="resume">上次的角色還在。<button class="btn small" type="button" data-action="resume">繼續編輯</button> <button class="btn small ghost" type="button" data-action="reset">清除並重新開始</button></p>` : ""}
      </section>`;
    }
  });

  G.quiz.forEach((q, qi) => {
    step({
      id: "quiz" + qi, label: null, quiz: true, autoNext: true,
      valid: () => S.quiz[qi] != null,
      render() {
        return head(`心理測驗 ${qi + 1} / ${G.quiz.length}`, q.q, "") +
          `<div class="choices list quiz-q">${q.options.map((o, oi) =>
            `<button class="choice" type="button" aria-pressed="${S.quiz[qi] === oi}" data-action="quiz" data-q="${qi}" data-o="${oi}"><span class="c-name">${esc(o.t)}</span></button>`).join("")}</div>`;
      }
    });
  });

  function quizRanking() {
    const score = {};
    D.classes.forEach((c) => (score[c.id] = 0));
    G.quiz.forEach((q, qi) => {
      const o = q.options[S.quiz[qi]];
      if (o) Object.entries(o.s).forEach(([k, v]) => (score[k] += v));
    });
    return D.classes.map((c) => ({ c, s: score[c.id] })).sort((a, b) => b.s - a.s);
  }

  step({
    id: "class", label: "職業",
    valid: () => !!S.classId,
    summary: () => cls() && cls().name,
    render() {
      let ranking = "";
      let top = [];
      if (S.mode === "quiz" && S.quiz.filter((x) => x != null).length === G.quiz.length) {
        const r = quizRanking();
        const max = r[0].s || 1;
        top = r.slice(0, 2).map((x) => x.c.id);
        ranking = `<div class="ranking" aria-label="測驗結果">${r.slice(0, 4).map((x) =>
          `<div class="rank"><span>${esc(x.c.name)}</span><span class="rank-bar"><i style="width:${Math.round((x.s / max) * 100)}%"></i></span><span>${x.s}</span></div>`).join("")}</div>`;
      }
      const title = top.length ? `你最像「${cls() && top.includes(S.classId) ? cls().name : byId(D.classes, top[0]).name}」` : "你走的是哪一條路？";
      const hint = top.length
        ? "這是測驗的推薦，不是規定。看看下面的說明，選你最想玩的職業。"
        : "<strong>職業</strong>決定你的兩個領域、起始閃避值與生命點，以及獨特的希望特性與職業特性。";
      return head("步驟 1・職業", title, hint) + ranking +
        `<div class="choices">${D.classes.map((c) => `
          <button class="choice" type="button" aria-pressed="${S.classId === c.id}" data-action="pick" data-key="classId" data-val="${c.id}">
            <span class="c-name">${esc(c.name)}${top.includes(c.id) ? '<span class="badge">推薦</span>' : ""}</span>
            <span class="c-sub">${esc(c.short)}</span>
            <span class="c-meta">${c.domains.map(domTag).join("")}</span>
          </button>`).join("")}</div>` + (cls() ? classDetail(cls()) : "");
    }
  });

  function classDetail(c) {
    return `<div class="detail feat">
      <h3>${esc(c.name)}</h3>
      <p>${esc(c.desc)}</p>
      <div class="stats"><span>領域 ${c.domains.map(domTag).join("")}</span><span>閃避值 <b>${c.evasion}</b></span><span>生命點 <b>${c.hp}</b></span></div>
      <h4>希望特性</h4>${c.hope.join("")}
      <h4>職業特性</h4>${c.features.join("")}
    </div>`;
  }

  step({
    id: "subclass", label: "子職業",
    valid: () => !!S.subclassId,
    summary: () => sub() && sub().name,
    render() {
      const c = cls();
      return head("步驟 1・子職業", `身為${c.name}，你專精什麼？`, "<strong>子職業</strong>代表你在職業中的專長方向。它可能決定你的<strong>施法屬性</strong>，並給你一組基礎特性。") +
        `<div class="choices wide">${c.subclasses.map((s) => `
          <button class="choice" type="button" aria-pressed="${S.subclassId === s.id}" data-action="pick" data-key="subclassId" data-val="${s.id}">
            <span class="c-name">${esc(s.name)}</span>
            <span class="c-sub">${esc(s.desc)}</span>
            <span class="c-meta">${s.spellTrait ? "施法屬性：" + esc(s.spellTrait) : "無施法屬性"}</span>
          </button>`).join("")}</div>` +
        (sub() ? `<div class="detail feat"><h3>${esc(sub().name)}・基礎特性</h3>${sub().features.join("")}</div>` : "");
    }
  });

  step({
    id: "ancestry", label: "種族",
    valid: () => S.ancestryId && (S.ancestryId !== "mixed-ancestry" || (S.mixA && S.mixB && S.mixA !== S.mixB)),
    summary: () => ancestryLabel(),
    render() {
      const list = D.ancestries;
      let detail = "";
      if (S.ancestryId === "mixed-ancestry") {
        const opts = (sel) => `<option value="">請選擇</option>` + list.filter((a) => a.id !== "mixed-ancestry").map((a) => `<option value="${a.id}" ${sel === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("");
        const a = anc(S.mixA), b = anc(S.mixB);
        detail = `<div class="detail feat">
          <h3>混血種族</h3><p>${esc(anc("mixed-ancestry").desc)}</p>
          <p>從一個種族取得<strong>第一項</strong>特性，從另一個種族取得<strong>第二項</strong>特性。</p>
          <label class="field"><span>第一項特性來自</span><select data-bind="mixA">${opts(S.mixA)}</select></label>
          ${a ? a.features[0] : ""}
          <label class="field"><span>第二項特性來自</span><select data-bind="mixB">${opts(S.mixB)}</select></label>
          ${b ? b.features[1] : ""}
          <label class="field"><span>你怎麼稱呼自己的種族？（選填）</span><input type="text" data-bind="mixName" value="${esc(S.mixName)}" placeholder="${a && b ? esc(a.name + "-" + b.name) : "例如：哥布林-獸人"}"></label>
        </div>`;
      } else if (anc()) {
        const a = anc();
        detail = `<div class="detail feat"><h3>${esc(a.name)}</h3><p>${esc(a.desc)}</p><h4>種族特性</h4>${a.features.join("")}</div>`;
      }
      return head("步驟 2・血統", "你的血脈從何而來？", "<strong>種族</strong>代表你的血統與外貌，並給你兩項種族特性。外表細節仍由你決定。") +
        `<div class="choices">${list.map((a) => `
          <button class="choice" type="button" aria-pressed="${S.ancestryId === a.id}" data-action="pick" data-key="ancestryId" data-val="${a.id}">
            <span class="c-name">${esc(a.name)}</span>
            <span class="c-sub">${a.id === "mixed-ancestry" ? "混合兩個種族的特性" : esc(a.features.map(featName).join("、"))}</span>
          </button>`).join("")}</div>` + detail;
    }
  });

  function ancestryLabel() {
    if (!S.ancestryId) return null;
    if (S.ancestryId === "mixed-ancestry") {
      const a = anc(S.mixA), b = anc(S.mixB);
      return S.mixName || (a && b ? a.name + "-" + b.name : "混血種族");
    }
    return anc().name;
  }

  step({
    id: "community", label: "社群",
    valid: () => !!S.communityId,
    summary: () => com() && com().name,
    render() {
      return head("步驟 2・血統", "你在哪裡長大？", "<strong>社群</strong>是對你成長影響最深的文化或環境，給你一項社群特性。") +
        `<div class="choices">${D.communities.map((c) => `
          <button class="choice" type="button" aria-pressed="${S.communityId === c.id}" data-action="pick" data-key="communityId" data-val="${c.id}">
            <span class="c-name">${esc(c.name)}</span>
            <span class="c-sub">${esc(c.short)}</span>
          </button>`).join("")}</div>` +
        (com() ? `<div class="detail feat"><h3>${esc(com().name)}</h3><p>${esc(com().traits)}</p><h4>社群特性</h4>${com().features.join("")}</div>` : "");
    }
  });

  step({
    id: "traits", label: "屬性",
    valid: traitsComplete,
    summary: () => traitsComplete() ? TRAITS.map((t) => t.name[0] + fmt(S.traits[t.id])).join(" ") : null,
    render() {
      const left = poolLeft();
      const spell = sub() && sub().spellTrait;
      const chips = [];
      VALUES.forEach((v) => { for (let i = 0; i < POOL[String(v)]; i++) chips.push(`<span class="chip-n ${i >= left[String(v)] ? "used" : ""}">${fmt(v)}</span>`); });
      return head("步驟 3・屬性", "你最擅長的是什麼？", `把 <strong>+2、+1、+1、+0、+0、−1</strong> 分配到六項屬性上。擲骰時會加上對應屬性的調整值。${spell ? `你的施法屬性是<strong>${esc(spell)}</strong>，建議給 +1 或 +2。` : ""}`) +
        `<div class="pool"><span>剩下：</span>${chips.join("")}
          <button class="btn small" type="button" data-action="suggest-traits">套用${esc(cls().name)}建議分配</button>
          <button class="btn small ghost" type="button" data-action="clear-traits">清除</button></div>
        <div class="traits">${TRAITS.map((t) => {
          const cur = S.traits[t.id];
          return `<div class="trait" role="group" aria-label="${t.name}">
            <div class="trait-name">${t.name}${spell === t.name ? "<small>施法屬性</small>" : ""}</div>
            <div class="trait-verbs">${t.verbs}</div>
            <div class="vals">${VALUES.map((v) => {
              const on = cur === v;
              const dis = !on && left[String(v)] <= 0;
              return `<button type="button" class="val" aria-pressed="${on}" ${dis ? "disabled" : ""} data-action="trait" data-t="${t.id}" data-v="${v}" aria-label="${t.name} ${fmt(v)}">${fmt(v)}</button>`;
            }).join("")}</div></div>`;
        }).join("")}</div>`;
    }
  });

  step({
    id: "equipment", label: "裝備",
    valid: () => { const e = equipment(); return !!(e.primary && e.armor); },
    summary: () => { const e = equipment(); return e.primary ? [e.primary, e.secondary, e.armor].filter(Boolean).map((x) => x["名稱"]).join("、") : null; },
    render() {
      const c = cls();
      const eq = equipment();
      const st = stats();
      let body;
      if (S.equipMode === "suggested") {
        body = `<div class="detail">
          <h3>${esc(c.name)}的建議裝備</h3>
          ${[eq.primary && weaponLine("主武器", eq.primary), eq.secondary && weaponLine("副武器", eq.secondary), eq.armor && armorLine(eq.armor)].filter(Boolean).join("")}
        </div>`;
      } else {
        const spell = sub() && sub().spellTrait;
        const prim = allPrimary().filter((w) => !w.magic || spell);
        const primary = findWeapon(allPrimary(), S.primary);
        body = `<div class="group"><h3>主武器</h3><p>${spell ? "你有施法屬性，可以使用魔法武器。" : "你沒有施法屬性，只能使用物理武器。"}雙手武器不能再搭配副武器。</p>
            <div class="choices wide">${prim.map((w) => weaponChoice(w, "primary")).join("")}</div></div>
          ${primary && primary["負荷"] === "單手" ? `<div class="group"><h3>副武器（選填）</h3><p>單手主武器可以搭配一把副武器。</p>
            <div class="choices wide">${D.equipment.secondary.map((w) => weaponChoice(w, "secondary")).join("")}</div></div>` : ""}
          <div class="group"><h3>護甲</h3><p>閾值會加上你的等級（1）。</p>
            <div class="choices wide">${D.equipment.armor.map((a) => `
              <button class="choice" type="button" aria-pressed="${S.armor === a["名稱"]}" data-action="pick" data-key="armor" data-val="${esc(a["名稱"])}">
                <span class="c-name">${esc(a["名稱"])}</span>
                <span class="c-sub">閾值 ${esc(a["閾值"])}・護甲值 ${esc(a["護甲值"])}</span>
                <span class="c-meta">${esc(a["特性"])}</span></button>`).join("")}</div></div>`;
      }
      return head("步驟 5・裝備", "你帶著什麼上路？", "選擇位階 1 的武器與護甲：<strong>一把雙手主武器</strong>，或<strong>一把單手主武器加一把副武器</strong>。熟練值起始為 1，代表傷害擲 1 顆骰。") +
        `<div class="seg" role="group" aria-label="裝備方式">
          <button type="button" aria-pressed="${S.equipMode === "suggested"}" data-action="equip-mode" data-val="suggested">使用建議裝備</button>
          <button type="button" aria-pressed="${S.equipMode === "custom"}" data-action="equip-mode" data-val="custom">自己挑選</button>
        </div>` + body +
        (st && st.minor ? `<p class="q-hint" style="margin-top:20px">目前：閃避值 <strong>${st.evasion}</strong>・護甲值 <strong>${st.armor}</strong>・傷害閾值 <strong>${st.minor} / ${st.major}</strong>${st.notes.length ? "・" + esc(st.notes.join("、")) : ""}</p>` : "");
    }
  });

  function weaponChoice(w, key) {
    return `<button class="choice" type="button" aria-pressed="${S[key] === w["名稱"]}" data-action="pick" data-key="${key}" data-val="${esc(w["名稱"])}">
      <span class="c-name">${esc(w["名稱"])}</span>
      <span class="c-sub">${esc(w["屬性"])}・${esc(w["射程"])}・${esc(dmg(w))}・${esc(w["負荷"])}</span>
      ${w["特性"] && w["特性"] !== "—" ? `<span class="c-meta">${esc(w["特性"])}</span>` : ""}</button>`;
  }
  function dmg(w) { return "1" + w["傷害"].replace(/\s*物$/, " 物理").replace(/\s*魔$/, " 魔法"); }
  function weaponLine(kind, w) {
    return `<p><strong>${kind}：${esc(w["名稱"])}</strong>　${esc(w["屬性"])}・${esc(w["射程"])}・${esc(dmg(w))}・${esc(w["負荷"])}${w["特性"] && w["特性"] !== "—" ? `<br><span style="color:var(--muted)">${esc(w["特性"])}</span>` : ""}</p>`;
  }
  function armorLine(a) {
    return `<p><strong>護甲：${esc(a["名稱"])}</strong>　閾值 ${esc(a["閾值"])}・護甲值 ${esc(a["護甲值"])}${a["特性"] && a["特性"] !== "—" ? `<br><span style="color:var(--muted)">${esc(a["特性"])}</span>` : ""}</p>`;
  }

  step({
    id: "inventory", label: "行囊",
    valid: () => S.potion != null && S.classItem != null,
    summary: () => S.classItem != null ? G.classes[S.classId].classItems[S.classItem] : null,
    render() {
      const g = G.classes[S.classId];
      return head("步驟 5・裝備", "行囊裡還有什麼？", `每個人都帶著：<strong>${esc(G.baseInventory)}</strong>。另外選一瓶藥劑和一件職業物品。`) +
        `<div class="group"><h3>選一瓶藥劑</h3><div class="choices wide">${G.potions.map((p, i) => `
          <button class="choice" type="button" aria-pressed="${S.potion === i}" data-action="pick-num" data-key="potion" data-val="${i}"><span class="c-name" style="font-size:18px">${esc(p)}</span></button>`).join("")}</div></div>
        <div class="group"><h3>選一件職業物品</h3><div class="choices wide">${g.classItems.map((p, i) => `
          <button class="choice" type="button" aria-pressed="${S.classItem === i}" data-action="pick-num" data-key="classItem" data-val="${i}"><span class="c-name" style="font-size:18px">${esc(p)}</span></button>`).join("")}</div></div>
        ${g.spellbook ? `<label class="field"><span>你的法術記錄在什麼東西上？（選填）</span><input type="text" data-bind="spellbook" value="${esc(S.spellbook)}" placeholder="${esc(g.spellbook)}"></label>` : ""}`;
    }
  });

  step({
    id: "background", label: "背景",
    valid: () => true,
    summary: () => S.background.some((x) => x.trim()) ? "已填寫" : null,
    render() {
      const qs = cls().backgroundQ;
      return head("步驟 6・背景", "說說你的過去", "回答下面任意幾題，也可以全部跳過，讓角色的過去在遊戲中慢慢浮現。背景沒有規則效果，但會影響主持人為你準備的故事。") +
        qs.map((q, i) => `<label class="field"><span>${esc(q)}</span><textarea data-bind="background.${i}" placeholder="寫幾句就好">${esc(S.background[i])}</textarea></label>`).join("") +
        `<label class="field"><span>其他想補充的設定（選填）</span><textarea data-bind="backgroundExtra">${esc(S.backgroundExtra)}</textarea></label>`;
    }
  });

  step({
    id: "experiences", label: "經歷",
    valid: () => S.experiences.every((x) => x.trim()),
    summary: () => S.experiences.every((x) => x.trim()) ? S.experiences.join("、") : null,
    render() {
      const clank = ancestryFeatures().some((f) => featName(f) === "定製設計");
      const ex = D.experienceExamples;
      return head("步驟 7・經歷", "你有哪些經歷？", `<strong>經歷</strong>是概括你技能、個性或才能的一個詞或短語，各 <strong>+2</strong>。擲骰時花 1 點希望，就能把相關經歷的加值加上去。${clank ? "你是械靈：選一項最符合你被製造目的的經歷，它再額外 +1。" : ""}`) +
        [0, 1].map((i) => `<label class="field"><span>經歷 ${i + 1}（+2）</span><input type="text" data-bind="experiences.${i}" value="${esc(S.experiences[i])}" placeholder="例如：${i ? "我罩你" : "皇室御廚"}"></label>`).join("") +
        `<div class="group"><h3>需要靈感？點一下就會填入空著的欄位</h3>${Object.entries(ex).map(([cat, list]) =>
          `<p class="ex-cat">${esc(cat)}</p><div class="chips">${list.map((w) => `<button type="button" class="chip" aria-pressed="${S.experiences.includes(w)}" data-action="exp" data-val="${esc(w)}">${esc(w)}</button>`).join("")}</div>`).join("")}</div>`;
    }
  });

  step({
    id: "cards", label: "領域卡",
    valid: () => S.cards.length === stats().cardsNeeded,
    summary: () => S.cards.length ? S.cards.map((id) => byId(D.cards, id).name).join("、") : null,
    render() {
      const c = cls();
      const need = stats().cardsNeeded;
      const cards = D.cards.filter((x) => c.domains.includes(x.domain));
      return head("步驟 8・領域卡", "你掌握了哪些能力？", `從${c.domains.map(domTag).join("和")}兩個領域的 1 級卡中，選擇 <strong>${need} 張</strong>。${need > 2 ? "（知識學派額外 +1 張）" : ""}已選 ${S.cards.length} / ${need}。`) +
        `<div class="choices wide">${cards.map((x) => {
          const on = S.cards.includes(x.id);
          return `<button class="choice dcard" type="button" aria-pressed="${on}" ${!on && S.cards.length >= need ? "disabled" : ""} data-action="card" data-val="${x.id}">
            <span class="c-meta" style="margin:0 0 6px">${domTag(x.domain)} ${esc(x.type)}・回想費用 ${x.recall}</span>
            <span class="c-name">${esc(x.name)}</span>
            <span class="dcard-text feat">${x.text}</span></button>`;
        }).join("")}</div>`;
    }
  });

  step({
    id: "appearance", label: "外觀",
    valid: () => true,
    summary: () => { const n = APPEAR_ROWS.reduce((a, r) => a + S.appearance[r.id].length, 0); return n ? `已選 ${n} 項` : null; },
    render() {
      const g = G.classes[S.classId];
      const opts = { clothes: g.clothes, attitude: g.attitude, eyes: G.appearanceCommon.eyes, skin: G.appearanceCommon.skin, body: G.appearanceCommon.body };
      return head("角色形象", "別人第一眼看見的你", "每一行選一個或多個，也可以在最下面自己描述。這些選項來自角色卡的角色指南。") +
        APPEAR_ROWS.map((r) => `<div class="group"><h3>${r.name}</h3><div class="chips">${opts[r.id].map((o) =>
          `<button type="button" class="chip" aria-pressed="${S.appearance[r.id].includes(o)}" data-action="appear" data-row="${r.id}" data-val="${esc(o)}">${esc(o)}</button>`).join("")}</div></div>`).join("") +
        `<label class="field"><span>其他描述（選填）</span><textarea data-bind="appearanceExtra" placeholder="髮型、傷疤、口頭禪……">${esc(S.appearanceExtra)}</textarea></label>`;
    }
  });

  step({
    id: "name", label: "姓名",
    valid: () => !!S.name.trim(),
    summary: () => S.name.trim() ? S.name + (S.pronouns ? `（${S.pronouns}）` : "") : null,
    render() {
      return head("最後一個問題", "你叫什麼名字？", "名字之外，也可以寫下別人該怎麼稱呼你。") +
        `<label class="field"><span>姓名</span><input type="text" data-bind="name" value="${esc(S.name)}" autocomplete="off"></label>
         <label class="field"><span>代稱（選填）</span><input type="text" data-bind="pronouns" value="${esc(S.pronouns)}" placeholder="例如：他、她、祂"></label>`;
    }
  });

  step({
    id: "connections", label: "隊伍連結",
    valid: () => true,
    summary: () => S.connections.trim() ? "已填寫" : null,
    render() {
      return head("步驟 9・隊伍連結", "你和夥伴之間有什麼故事？", "上桌時，向其他玩家介紹你的角色，再從下面挑一題問他們（也可以自己出題）。先把想問的、或討論後的結果記在這裡。") +
        `<div class="detail"><h4>${esc(cls().name)}的連結問題</h4><ul>${cls().connectionQ.map((q) => `<li>${esc(q)}</li>`).join("")}</ul></div>
         <label class="field" style="margin-top:20px"><span>連結筆記（選填）</span><textarea data-bind="connections" placeholder="例如：阿蓮是我第一次見面就救了我一命的人">${esc(S.connections)}</textarea></label>`;
    }
  });

  step({
    id: "sheet", label: null, noPager: false, isLast: true,
    render() { return sheetHTML(); }
  });

  function head(kicker, title, hint) {
    return `<p class="q-kicker">${esc(kicker)}</p><h1 class="q-title">${esc(title)}</h1>${hint ? `<p class="q-hint">${hint}</p>` : ""}`;
  }

  // ---------- sheet ----------
  function sheetHTML() {
    const c = cls(), s = sub(), st = stats(), eq = equipment();
    const g = G.classes[S.classId];
    const app = APPEAR_ROWS.filter((r) => S.appearance[r.id].length).map((r) => `<li>${r.name}：${esc(S.appearance[r.id].join("、"))}</li>`).join("");
    const bg = c.backgroundQ.map((q, i) => S.background[i].trim() ? `<dt>${esc(q)}</dt><dd>${esc(S.background[i])}</dd>` : "").join("");
    const wrow = (k, w) => w ? `<tr><td>${k}</td><td><b>${esc(w["名稱"])}</b></td><td>${esc(w["屬性"])}</td><td>${esc(w["射程"])}</td><td>${esc(dmg(w))}</td><td>${esc(w["負荷"])}</td><td>${esc(w["特性"])}</td></tr>` : "";
    return `<p class="q-kicker">完成</p><h1 class="q-title">這就是你的角色</h1>
      <div class="row sheet-actions">
        <button class="btn hope" type="button" data-action="copy">複製文字版</button>
        <button class="btn" type="button" data-action="print">列印 / 存成 PDF</button>
        <button class="btn" type="button" data-action="download">下載 JSON</button>
        <button class="btn ghost" type="button" data-action="reset">建立新角色</button>
      </div>
      <p class="toast" id="toast" role="status"></p>
      <article class="sheet" id="sheet">
        <h2>${esc(S.name)}</h2>
        <p class="who">${S.pronouns ? esc(S.pronouns) + "・" : ""}1 級 ${esc(ancestryLabel())}・${esc(com().name)}・${esc(c.name)}（${esc(s.name)}）${s.spellTrait ? "・施法屬性 " + esc(s.spellTrait) : ""}</p>

        <div class="sheet-stats">
          <div class="stat"><b>${st.evasion}</b><span>閃避值</span></div>
          <div class="stat"><b>${st.armor}</b><span>護甲槽</span></div>
          <div class="stat"><b>${st.hp}</b><span>生命點</span></div>
          <div class="stat"><b>${st.stress}</b><span>壓力槽</span></div>
          <div class="stat"><b>${st.hope}</b><span>希望</span></div>
          <div class="stat"><b>${st.proficiency}</b><span>熟練值</span></div>
        </div>
        <div class="thresholds">
          <div><b>1–${st.minor - 1}</b>輕度傷害<br>標記 1 生命</div>
          <div><b>${st.minor}–${st.major - 1}</b>重度傷害<br>標記 2 生命</div>
          <div><b>${st.major}+</b>嚴重傷害<br>標記 3 生命</div>
        </div>
        ${st.notes.length ? `<p class="note">${esc(st.notes.join("、"))}</p>` : ""}

        <h3>屬性</h3>
        <div class="sheet-traits">${TRAITS.map((t) => `<div><b>${fmt(S.traits[t.id])}</b>${t.name}<small>${t.verbs}</small></div>`).join("")}</div>

        <h3>裝備</h3>
        <table><thead><tr><th></th><th>名稱</th><th>屬性</th><th>射程</th><th>傷害</th><th>負荷</th><th>特性</th></tr></thead>
          <tbody>${wrow("主武器", eq.primary)}${wrow("副武器", eq.secondary)}</tbody></table>
        ${eq.armor ? `<p style="margin-top:8px"><b>${esc(eq.armor["名稱"])}</b>　基礎閾值 ${esc(eq.armor["閾值"])}・護甲值 ${esc(eq.armor["護甲值"])}・${esc(eq.armor["特性"])}</p>` : ""}

        <div class="cols">
          <div>
            <h3>經歷</h3>
            <ul>${S.experiences.map((x) => `<li>${esc(x)} +2</li>`).join("")}</ul>
          </div>
          <div>
            <h3>背包</h3>
            <ul><li>${esc(G.baseInventory)}</li><li>${esc(G.potions[S.potion])}</li><li>${esc(g.classItems[S.classItem])}</li>${S.spellbook ? `<li>法術記錄於：${esc(S.spellbook)}</li>` : ""}</ul>
          </div>
        </div>

        <h3>職業特性</h3>
        <div class="feat">${c.hope.join("")}${c.features.join("")}</div>
        <h3>子職業：${esc(s.name)}（基礎）</h3>
        <div class="feat">${s.features.join("")}</div>
        <h3>種族與社群特性</h3>
        <div class="feat">${ancestryFeatures().join("")}${com().features.join("")}</div>

        <h3>領域卡</h3>
        ${S.cards.map((id) => { const x = byId(D.cards, id); return `<div class="card-block feat"><div class="t">${esc(x.name)}</div><div class="m">${esc(domName(x.domain))}・${esc(x.type)}・1 級・回想費用 ${x.recall}</div>${x.text}</div>`; }).join("")}

        ${app || S.appearanceExtra ? `<h3>外觀</h3><ul>${app}</ul>${S.appearanceExtra ? `<p>${esc(S.appearanceExtra)}</p>` : ""}` : ""}
        ${bg || S.backgroundExtra ? `<h3>背景</h3><dl class="qa">${bg}</dl>${S.backgroundExtra ? `<p>${esc(S.backgroundExtra)}</p>` : ""}` : ""}
        ${S.connections.trim() ? `<h3>隊伍連結</h3><p>${esc(S.connections)}</p>` : ""}
        ${c.id === "druid" || c.id === "ranger" ? `<p class="note" style="margin-top:20px">${c.id === "druid" ? "德魯伊的野獸形態選項請參考 SRD 或角色卡附頁。" : s.id === "ranger-beastbound" ? "記得和主持人一起建立你的動物夥伴（見角色卡附頁）。" : ""}</p>` : ""}
      </article>`;
  }

  function sheetText() {
    const c = cls(), s = sub(), st = stats(), eq = equipment(), g = G.classes[S.classId];
    const L = [];
    L.push(`【${S.name}】${S.pronouns ? "（" + S.pronouns + "）" : ""}`);
    L.push(`1 級 ${ancestryLabel()}・${com().name}・${c.name}／${s.name}${s.spellTrait ? "（施法屬性：" + s.spellTrait + "）" : ""}`);
    L.push(`閃避值 ${st.evasion}｜護甲槽 ${st.armor}｜生命點 ${st.hp}｜壓力槽 ${st.stress}｜希望 ${st.hope}｜熟練值 ${st.proficiency}`);
    L.push(`傷害閾值：輕度 1–${st.minor - 1}（標記 1）／重度 ${st.minor}–${st.major - 1}（標記 2）／嚴重 ${st.major}+（標記 3）`);
    L.push("屬性：" + TRAITS.map((t) => t.name + fmt(S.traits[t.id])).join(" "));
    L.push("");
    const w = (k, x) => x && L.push(`${k}：${x["名稱"]}（${x["屬性"]}・${x["射程"]}・${dmg(x)}・${x["負荷"]}）${x["特性"] !== "—" ? x["特性"] : ""}`);
    w("主武器", eq.primary); w("副武器", eq.secondary);
    if (eq.armor) L.push(`護甲：${eq.armor["名稱"]}（閾值 ${eq.armor["閾值"]}・護甲值 ${eq.armor["護甲值"]}）${eq.armor["特性"] !== "—" ? eq.armor["特性"] : ""}`);
    L.push("經歷：" + S.experiences.map((x) => x + " +2").join("、"));
    L.push("背包：" + [G.baseInventory, G.potions[S.potion], g.classItems[S.classItem]].join("；"));
    L.push("");
    L.push("— 職業特性 —");
    [...c.hope, ...c.features].forEach((f) => L.push(stripTags(f)));
    L.push(`— 子職業：${s.name} —`);
    s.features.forEach((f) => L.push(stripTags(f)));
    L.push("— 種族與社群 —");
    [...ancestryFeatures(), ...com().features].forEach((f) => L.push(stripTags(f)));
    L.push("— 領域卡 —");
    S.cards.forEach((id) => { const x = byId(D.cards, id); L.push(`${x.name}（${domName(x.domain)}・${x.type}・回想 ${x.recall}）`); L.push(stripTags(x.text)); });
    const app = APPEAR_ROWS.filter((r) => S.appearance[r.id].length).map((r) => r.name + "：" + S.appearance[r.id].join("、"));
    if (app.length || S.appearanceExtra) { L.push("— 外觀 —"); app.forEach((x) => L.push(x)); if (S.appearanceExtra) L.push(S.appearanceExtra); }
    const bg = c.backgroundQ.map((q, i) => S.background[i].trim() ? `Q：${q}\nA：${S.background[i]}` : "").filter(Boolean);
    if (bg.length || S.backgroundExtra) { L.push("— 背景 —"); bg.forEach((x) => L.push(x)); if (S.backgroundExtra) L.push(S.backgroundExtra); }
    if (S.connections.trim()) { L.push("— 隊伍連結 —"); L.push(S.connections); }
    return L.join("\n");
  }

  // ---------- flow ----------
  function activeSteps() { return STEPS.filter((s) => !s.quiz || S.mode === "quiz"); }
  function currentStep() { const a = activeSteps(); return a[Math.min(S.step, a.length - 1)]; }
  function canReach(idx) {
    const a = activeSteps();
    for (let i = 1; i < idx; i++) if (a[i].valid && !a[i].valid()) return false;
    return true;
  }

  function render(focus) {
    const a = activeSteps();
    if (S.step >= a.length) S.step = a.length - 1;
    if (!canReach(S.step)) { while (S.step > 0 && !canReach(S.step)) S.step--; }
    const st = currentStep();
    const stage = $("#stage");
    stage.innerHTML = st.render();
    // progress
    const realSteps = a.filter((x) => x.id !== "intro");
    const pos = Math.max(0, realSteps.indexOf(st) + 1);
    $("#trackFill").style.width = (st.id === "intro" ? 0 : (pos / realSteps.length) * 100) + "%";
    $("#stepCount").textContent = st.id === "intro" ? "" : `${pos} / ${realSteps.length}`;
    // pager
    const pager = $("#pager");
    pager.classList.toggle("hidden", !!st.noPager);
    const ok = !st.valid || st.valid();
    $("#nextBtn").disabled = !ok || st.isLast;
    $("#nextBtn").style.visibility = st.isLast ? "hidden" : "visible";
    $("#nextBtn").textContent = a[S.step + 1] && a[S.step + 1].isLast ? "完成角色" : "下一步";
    $("#pagerHint").textContent = ok ? "" : hintFor(st);
    renderSummary();
    save();
    if (focus) { window.scrollTo({ top: 0 }); stage.focus({ preventScroll: true }); }
  }

  function hintFor(st) {
    return ({
      class: "選一個職業", subclass: "選一個子職業", ancestry: S.ancestryId === "mixed-ancestry" ? "選兩個不同的種族" : "選一個種族",
      community: "選一個社群", traits: "六項屬性都要分配", equipment: "選主武器與護甲", inventory: "選藥劑與職業物品",
      experiences: "填寫兩項經歷", cards: `選 ${stats() ? stats().cardsNeeded : 2} 張領域卡`, name: "替角色取個名字"
    })[st.id] || "";
  }

  function renderSummary() {
    const a = activeSteps();
    const st = stats();
    const cur = currentStep();
    const items = a.map((s, i) => s.label ? { s, i } : null).filter(Boolean);
    $("#summary").innerHTML = `<h2>${esc(S.name.trim() || "我的角色")}</h2>
      <ul class="sum-list">${items.map(({ s, i }) => {
        const v = s.summary ? s.summary() : null;
        const reach = canReach(i);
        return `<li class="${cur === s ? "current" : ""}"><button type="button" data-action="goto" data-i="${i}" ${reach ? "" : "disabled"}>
          <span class="k">${s.label}</span><span class="v ${v ? "" : "empty"}">${esc(v || "—")}</span></button></li>`;
      }).join("")}</ul>
      ${st ? `<div class="mini-stats">
        <div><b>${st.evasion}</b><span>閃避值</span></div>
        <div><b>${st.hp}</b><span>生命點</span></div>
        <div><b>${st.stress}</b><span>壓力槽</span></div>
        <div><b>${st.armor || "—"}</b><span>護甲槽</span></div>
        <div><b>${st.minor ? st.minor + "/" + st.major : "—"}</b><span>閾值</span></div>
        <div><b>${st.hope}</b><span>希望</span></div></div>` : ""}`;
  }

  function go(delta) {
    const a = activeSteps();
    const st = currentStep();
    if (delta > 0 && st.valid && !st.valid()) return;
    S.step = Math.max(0, Math.min(a.length - 1, S.step + delta));
    render(true);
  }

  function toast(msg) { const t = $("#toast"); if (t) t.textContent = msg; }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b || b.disabled) return;
    const act = b.dataset.action;
    const val = b.dataset.val;
    switch (act) {
      case "home": S.step = 0; render(true); break;
      case "start":
        S.mode = b.dataset.mode; S.step = 1; render(true); break;
      case "resume": {
        const a = activeSteps();
        let i = 1; while (i < a.length - 1 && (!a[i].valid || a[i].valid())) i++;
        S.step = i; render(true); break;
      }
      case "reset": S = blankState(); render(true); break;
      case "prev": go(-1); break;
      case "next": go(1); break;
      case "goto": S.step = +b.dataset.i; closeSummary(); render(true); break;
      case "quiz":
        S.quiz[+b.dataset.q] = +b.dataset.o;
        render();
        setTimeout(() => go(1), 220);
        break;
      case "pick": {
        const key = b.dataset.key;
        if (key === "classId" && S.classId !== val) {
          Object.assign(S, { subclassId: null, cards: [], classItem: null, primary: null, secondary: null, armor: null, background: ["", "", ""] });
          S.appearance.clothes = []; S.appearance.attitude = [];
        }
        if (key === "subclassId" && S.subclassId !== val) S.cards = [];
        if (key === "primary") { const w = findWeapon(allPrimary(), val); if (w && w["負荷"] === "雙手") S.secondary = null; }
        if (key === "secondary" && S.secondary === val) { S.secondary = null; render(); break; }
        S[key] = val;
        render();
        break;
      }
      case "pick-num": S[b.dataset.key] = +val; render(); break;
      case "trait": {
        const t = b.dataset.t, v = +b.dataset.v;
        S.traits[t] = S.traits[t] === v ? null : v;
        render(); break;
      }
      case "suggest-traits":
        cls().suggestedTraits.forEach((v, i) => (S.traits[TRAITS[i].id] = parseNum(v)));
        render(); break;
      case "clear-traits": TRAITS.forEach((t) => (S.traits[t.id] = null)); render(); break;
      case "equip-mode": {
        if (val === "custom" && S.equipMode !== "custom" && !S.primary) {
          const eq = equipment();
          S.primary = eq.primary ? eq.primary["名稱"] : null;
          S.secondary = eq.secondary ? eq.secondary["名稱"] : null;
          S.armor = eq.armor ? eq.armor["名稱"] : null;
        }
        S.equipMode = val; render(); break;
      }
      case "exp": {
        const i = S.experiences.indexOf(val);
        if (i >= 0) S.experiences[i] = "";
        else { const j = S.experiences.findIndex((x) => !x.trim()); if (j >= 0) S.experiences[j] = val; }
        render(); break;
      }
      case "card": {
        const i = S.cards.indexOf(val);
        if (i >= 0) S.cards.splice(i, 1); else if (S.cards.length < stats().cardsNeeded) S.cards.push(val);
        render(); break;
      }
      case "appear": {
        const arr = S.appearance[b.dataset.row];
        const i = arr.indexOf(val);
        if (i >= 0) arr.splice(i, 1); else arr.push(val);
        render(); break;
      }
      case "copy": {
        const text = sheetText();
        try {
          navigator.clipboard.writeText(text).then(() => toast("已複製到剪貼簿。"), () => fallbackCopy(text));
        } catch (err) { fallbackCopy(text); }
        break;
      }
      case "print":
        try { window.print(); } catch (err) { toast("這個頁面無法列印，請用瀏覽器選單列印。"); }
        break;
      case "download": {
        try {
          const blob = new Blob([JSON.stringify({ version: 1, character: S }, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = (S.name.trim() || "character") + ".json";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) { toast("無法下載檔案。"); }
        break;
      }
      case "toggle-summary": {
        const s = $("#summary"); const open = !s.classList.contains("open");
        s.classList.toggle("open", open); b.setAttribute("aria-expanded", open);
        break;
      }
    }
  });

  function closeSummary() { $("#summary").classList.remove("open"); $(".summary-toggle").setAttribute("aria-expanded", "false"); }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? "已複製到剪貼簿。" : "無法自動複製，請手動選取角色卡文字。");
  }

  // text inputs: update state without re-rendering (keeps focus)
  function setPath(path, value) {
    const parts = path.split(".");
    let o = S;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }
  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-bind]");
    if (!el || el.tagName === "SELECT") return;
    setPath(el.dataset.bind, el.value);
    const st = currentStep();
    const ok = !st.valid || st.valid();
    $("#nextBtn").disabled = !ok;
    $("#pagerHint").textContent = ok ? "" : hintFor(st);
    renderSummary();
    save();
  });
  document.addEventListener("change", (e) => {
    const el = e.target.closest("select[data-bind]");
    if (!el) return;
    setPath(el.dataset.bind, el.value || null);
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input[type=text]")) { e.preventDefault(); go(1); }
  });

  render();
})();
