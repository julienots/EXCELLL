/* SuperEssence Sheets — module sport : exercices, modèles, générateur de programmes */
(function () {
  'use strict';
  const SE = window.SE;

  // ---------- Palette des modèles ----------
  const C = {
    black: '#111114', ink: '#1d1d22', yellow: '#FFC72C', yellowL: '#FFF4D1', yellowM: '#FFE38A', gray: '#F4F4F5', grayM: '#E4E4E7', grayD: '#3F3F46', dark: '#26262C', white: '#FFFFFF',
    green: '#DFF5E3', greenD: '#1E8E3E', red: '#FDE2E1', redD: '#C62828', blue: '#E3EEFF', blueD: '#1A5FD0'
  };
  SE.COLORS = C;

  // ---------- Bibliothèque d'exercices ----------
  const LIB = {
    'Pectoraux': ['Développé couché', 'Développé incliné haltères', 'Développé couché haltères', 'Développé décliné', 'Écarté haltères', 'Écarté poulie vis-à-vis', 'Pompes', 'Pompes déclinées', 'Dips pectoraux', 'Pec deck', 'Chest press machine'],
    'Dos': ['Soulevé de terre', 'Tractions pronation', 'Tractions supination', 'Rowing barre', 'Rowing haltère unilatéral', 'Tirage vertical', 'Tirage horizontal', 'Rowing T-bar', 'Pull-over poulie', 'Rowing machine', 'Good morning', 'Extensions lombaires', 'Face pull'],
    'Épaules': ['Développé militaire', 'Développé haltères assis', 'Élévations latérales', 'Élévations frontales', 'Oiseau haltères', 'Arnold press', 'Rowing menton', 'Push press', 'Élévations latérales poulie', 'Reverse pec deck'],
    'Bras': ['Curl barre', 'Curl haltères', 'Curl marteau', 'Curl pupitre', 'Curl incliné', 'Curl poulie', 'Extensions triceps poulie', 'Barre au front', 'Dips banc', 'Extension nuque haltère', 'Développé couché prise serrée', 'Kickback triceps'],
    'Jambes': ['Squat', 'Front squat', 'Presse à cuisses', 'Fentes marchées', 'Fentes bulgares', 'Hack squat', 'Leg extension', 'Leg curl allongé', 'Leg curl assis', 'Soulevé de terre roumain', 'Hip thrust', 'Pont fessier', 'Mollets debout', 'Mollets assis', 'Goblet squat', 'Step-up', 'Abduction machine', 'Adduction machine', 'Nordic hamstring'],
    'Abdos / Gainage': ['Planche', 'Planche latérale', 'Crunch', 'Relevés de jambes suspendu', 'Ab wheel', 'Russian twist', 'Mountain climbers', 'Dead bug', 'Pallof press', 'Hollow hold', 'Crunch poulie'],
    'Cardio / HIIT': ['Burpees', 'Jumping jacks', 'Corde à sauter', 'Rameur', 'Vélo assault', 'SkiErg', 'Sprint', 'Box jump', 'Kettlebell swing', 'Thrusters', 'Wall balls', 'Battle rope', 'High knees', 'Squat sauté', 'Tapis de course'],
    'Haltérophilie / Cross': ['Arraché', 'Épaulé-jeté', 'Power clean', 'Hang clean', 'Power snatch', 'Clean & press', 'Muscle-up', 'Toes to bar', 'Double unders', 'Handstand push-up', 'Farmer walk', 'Sled push'],
    'Course / Endurance': ['Footing', 'Endurance fondamentale', 'Fractionné court', 'Fractionné long', 'Seuil', 'Tempo run', 'Sortie longue', 'Côtes', 'Fartlek', 'Récupération active', 'Gammes / éducatifs', 'Vélo', 'Natation'],
    'Mobilité / Étirements': ['Échauffement articulaire', 'Mobilité hanches', 'Mobilité épaules', 'Étirement ischios', 'Étirement quadriceps', 'Étirement pectoraux', 'Foam roller', 'Yoga flow', 'Respiration / retour au calme']
  };
  SE.EXERCISES = LIB;
  SE.allExercises = () => Object.values(LIB).flat();

  // ---------- Constructeur de feuilles ----------
  class Builder {
    constructor(sheet) { this.sh = sheet; }
    set(r, c, v, s) {
      if (v !== undefined && v !== null && v !== '') SE.setRaw(this.sh, r, c, typeof v === 'number' ? String(v) : v);
      if (s) SE.setStyle(this.sh, r, c, s);
      return this;
    }
    row(r, c, values, s) { values.forEach((v, i) => this.set(r, c + i, v, Array.isArray(s) ? s[i] : s)); return this; }
    style(r1, c1, r2, c2, s) { for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) SE.setStyle(this.sh, r, c, s); return this; }
    merge(r1, c1, r2, c2, v, s) {
      this.sh.merges.push({ r1, c1, r2, c2 });
      if (v !== undefined) this.set(r1, c1, v);
      if (s) this.style(r1, c1, r2, c2, s);
      return this;
    }
    widths(arr) { arr.forEach((w, i) => { if (w) this.sh.colW[i] = w; }); return this; }
    h(r, px) { this.sh.rowH[r] = px; return this; }
    box(r1, c1, r2, c2, w, color) {
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const p = { bdc: color || C.black };
        if (r === r1) p.bt = w; if (r === r2) p.bb = w; if (c === c1) p.bl = w; if (c === c2) p.br = w;
        SE.setStyle(this.sh, r, c, p);
      }
      return this;
    }
    grid(r1, c1, r2, c2, color) {
      this.style(r1, c1, r2, c2, { bt: 1, bb: 1, bl: 1, br: 1, bdc: color || '#C9C9D1' });
      return this;
    }
    dv(r1, c1, r2, c2, list) { this.sh.dv.push({ r1, c1, r2, c2, list }); return this; }
    cf(rule) { this.sh.cf.push(rule); return this; }
    banner(r, c1, c2, title, sub) {
      this.merge(r, c1, r, c2, title, { bg: C.black, fc: C.yellow, b: true, fs: 20, ha: 'left', ind: 1 });
      this.h(r, 46);
      if (sub) { this.merge(r + 1, c1, r + 1, c2, sub, { bg: C.dark, fc: '#D4D4D8', fs: 11, ha: 'left', ind: 1, i: true }); this.h(r + 1, 24); }
      return this;
    }
    brandFooter(r, c1, c2) {
      this.merge(r, c1, r, c2, 'Réalisé avec SuperEssence Sheets — SuperEssence Studio', { fc: '#A1A1AA', fs: 9, ha: 'right', i: true });
      return this;
    }
  }
  SE.Builder = Builder;

  const HDR = { bg: C.grayM, b: true, ha: 'center', fs: 11, fc: C.ink };
  const today = () => { const d = new Date(); return SE.dateToSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  const q = (name) => "'" + name.replace(/'/g, "''") + "'";

  // ---------- Générateur de programmes de musculation ----------
  const MAIN = { 'Squat': 0, 'Développé couché': 1, 'Soulevé de terre': 2, 'Développé militaire': 3 };

  const SPLITS = {
    fullbody: [
      { name: 'Full body A', ex: ['Squat', 'Développé couché', 'Rowing barre', 'Fentes marchées', 'Élévations latérales', 'Planche'] },
      { name: 'Full body B', ex: ['Soulevé de terre', 'Développé militaire', 'Tractions pronation', 'Presse à cuisses', 'Curl haltères', 'Relevés de jambes suspendu'] },
      { name: 'Full body C', ex: ['Squat', 'Développé incliné haltères', 'Tirage horizontal', 'Hip thrust', 'Extensions triceps poulie', 'Dead bug'] }
    ],
    force: [
      { name: 'Squat + accessoires', ex: ['Squat', 'Développé couché', 'Soulevé de terre roumain', 'Rowing barre', 'Planche'] },
      { name: 'Développé couché + accessoires', ex: ['Développé couché', 'Front squat', 'Développé militaire', 'Tractions pronation', 'Face pull'] },
      { name: 'Soulevé de terre + accessoires', ex: ['Soulevé de terre', 'Squat', 'Développé couché prise serrée', 'Rowing haltère unilatéral', 'Ab wheel'] },
      { name: 'Développé militaire + volume', ex: ['Développé militaire', 'Squat', 'Développé incliné haltères', 'Tirage vertical', 'Curl barre'] }
    ],
    upperlower: [
      { name: 'Haut du corps (force)', ex: ['Développé couché', 'Rowing barre', 'Développé militaire', 'Tractions pronation', 'Curl barre', 'Barre au front'] },
      { name: 'Bas du corps (force)', ex: ['Squat', 'Soulevé de terre roumain', 'Presse à cuisses', 'Leg curl allongé', 'Mollets debout', 'Planche'] },
      { name: 'Haut du corps (volume)', ex: ['Développé incliné haltères', 'Tirage horizontal', 'Développé haltères assis', 'Tirage vertical', 'Curl marteau', 'Extensions triceps poulie'] },
      { name: 'Bas du corps (volume)', ex: ['Soulevé de terre', 'Fentes bulgares', 'Hip thrust', 'Leg extension', 'Mollets assis', 'Relevés de jambes suspendu'] }
    ],
    ppl: [
      { name: 'Push — Pectoraux / Épaules / Triceps', ex: ['Développé couché', 'Développé militaire', 'Développé incliné haltères', 'Élévations latérales', 'Écarté poulie vis-à-vis', 'Extensions triceps poulie'] },
      { name: 'Pull — Dos / Biceps', ex: ['Soulevé de terre', 'Tractions pronation', 'Rowing barre', 'Face pull', 'Curl barre', 'Curl marteau'] },
      { name: 'Legs — Jambes / Abdos', ex: ['Squat', 'Soulevé de terre roumain', 'Presse à cuisses', 'Leg curl assis', 'Mollets debout', 'Crunch poulie'] }
    ],
    circuit: [
      { name: 'Circuit métabolique A', ex: ['Goblet squat', 'Pompes', 'Kettlebell swing', 'Rowing haltère unilatéral', 'Mountain climbers', 'Burpees'] },
      { name: 'Circuit métabolique B', ex: ['Fentes marchées', 'Développé haltères assis', 'Thrusters', 'Tirage vertical', 'Corde à sauter', 'Planche'] },
      { name: 'Circuit métabolique C', ex: ['Squat sauté', 'Pompes déclinées', 'Rameur', 'Hip thrust', 'Battle rope', 'Russian twist'] }
    ]
  };

  const GOALS = {
    force: { label: 'Force', main: { sets: 5, reps: [5, 5, 3, 3, 3, 2, 2, 1], pct: 0.75, inc: 0.025, rpe: 8, rest: '3:00', tempo: '2-0-X-0' }, acc: { sets: 3, reps: '6-8', rpe: 8, rest: '2:00', tempo: '2-0-1-0' } },
    hypertrophie: { label: 'Hypertrophie', main: { sets: 4, reps: [10, 10, 8, 8, 8, 6, 6, 6], pct: 0.65, inc: 0.02, rpe: 8, rest: '2:00', tempo: '3-0-1-0' }, acc: { sets: 3, reps: '10-12', rpe: 9, rest: '1:30', tempo: '3-1-1-0' } },
    perte: { label: 'Perte de poids / Recomposition', main: { sets: 3, reps: [15, 15, 12, 12, 12, 12, 10, 10], pct: 0.55, inc: 0.015, rpe: 7, rest: '0:45', tempo: '2-0-1-0' }, acc: { sets: 3, reps: '15', rpe: 7, rest: '0:30', tempo: '2-0-1-0' } },
    endurance: { label: 'Endurance musculaire', main: { sets: 3, reps: [20, 20, 18, 18, 15, 15, 15, 15], pct: 0.5, inc: 0.015, rpe: 7, rest: '0:45', tempo: '1-0-1-0' }, acc: { sets: 3, reps: '15-20', rpe: 7, rest: '0:45', tempo: '1-0-1-0' } },
    debutant: { label: 'Remise en forme / Débutant', main: { sets: 3, reps: [10, 10, 10, 8, 8, 8, 8, 8], pct: 0.6, inc: 0.025, rpe: 7, rest: '1:30', tempo: '3-0-1-0' }, acc: { sets: 2, reps: '12', rpe: 7, rest: '1:00', tempo: '2-0-2-0' } }
  };
  SE.GOALS = GOALS;

  function pickSplit(goal, days) {
    if (goal === 'perte' || goal === 'endurance') return days <= 3 ? SPLITS.circuit : SPLITS.circuit.concat(SPLITS.upperlower);
    if (goal === 'force') return days <= 4 ? SPLITS.force : SPLITS.force.concat(SPLITS.ppl);
    if (goal === 'debutant') return SPLITS.fullbody;
    if (days <= 3) return days === 3 ? SPLITS.ppl : SPLITS.fullbody;
    if (days === 4) return SPLITS.upperlower;
    return SPLITS.ppl.concat(SPLITS.upperlower);
  }

  SE.generateProgram = function (o) {
    o = Object.assign({ athlete: 'Athlète', coach: '', goal: 'hypertrophie', days: 3, weeks: 6, deload: 4, start: today(), rm: [100, 80, 120, 50], bw: 75, step: 2.5, title: '' }, o);
    const G = GOALS[o.goal] || GOALS.hypertrophie;
    const wb = SE.newWorkbook(o.title || 'Programme ' + G.label + ' — ' + o.athlete);
    wb.icon = 'dumbbell';
    // --- Profil ---
    const prof = wb.sheets[0];
    prof.name = 'Profil';
    prof.tab = C.yellow;
    prof.grid = false;
    const P = new Builder(prof);
    P.widths([170, 130, 110, 110, 130, 30]);
    P.banner(0, 0, 4, 'PROFIL ATHLÈTE', 'Programme ' + G.label + ' · généré par SuperEssence Sheets');
    P.h(2, 10);
    const info = [['Athlète', o.athlete], ['Coach', o.coach || '—'], ['Objectif', G.label], ['Date de début', String(o.start)], ['Durée', o.weeks + ' semaines'], ['Séances / semaine', String(o.days)], ['Poids de corps (kg)', String(o.bw)]];
    info.forEach((x, i) => {
      P.set(3 + i, 0, x[0], { b: true, bg: C.gray, fc: C.grayD, ind: 1 });
      P.merge(3 + i, 1, 3 + i, 2, x[1], { bg: C.white, ha: 'left', ind: 1, nf: i === 3 ? 'datel' : '' });
    });
    P.grid(3, 0, 9, 2, C.grayM);
    // Bloc 1RM
    const rmRow = 11;
    P.merge(rmRow, 0, rmRow, 4, 'RECORDS & 1RM (modifiez les valeurs jaunes — tout le programme se recalcule)', { bg: C.black, fc: C.yellow, b: true, fs: 12, ind: 1 });
    P.h(rmRow, 30);
    P.row(rmRow + 1, 0, ['Mouvement', '1RM (kg)', '% poids corps', 'Charge 80%', 'DOTS (estim.)'], HDR);
    const lifts = Object.keys(MAIN);
    lifts.forEach((name, i) => {
      const r = rmRow + 2 + i;
      P.set(r, 0, name, { b: true, ind: 1 });
      P.set(r, 1, String(o.rm[i]), { bg: C.yellowM, b: true, ha: 'center', nf: 'kg' });
      P.set(r, 2, '=B' + (r + 1) + '/$B$10', { nf: 'pct', ha: 'center' });
      P.set(r, 3, '=CHARGE(B' + (r + 1) + ';80%;' + o.step + ')', { nf: 'kg', ha: 'center' });
    });
    const totR = rmRow + 6;
    P.set(totR, 0, 'Total (S+DC+SDT)', { b: true, bg: C.yellowL, ind: 1 });
    P.set(totR, 1, '=B' + (rmRow + 3) + '+B' + (rmRow + 4) + '+B' + (rmRow + 5), { b: true, bg: C.yellowL, nf: 'kg', ha: 'center' });
    P.style(totR, 2, totR, 4, { bg: C.yellowL });
    P.set(totR, 4, '=ROUND(DOTS(B' + (totR + 1) + ';$B$10;"H");1)', { b: true, bg: C.yellowL, ha: 'center' });
    P.grid(rmRow + 1, 0, totR, 4, C.grayM);
    P.cf({ r1: rmRow + 2, c1: 2, r2: rmRow + 5, c2: 2, type: 'bar', color: '#FFC72C' });
    // Repères
    const nr = totR + 2;
    P.merge(nr, 0, nr, 4, 'REPÈRES DE L\'ATHLÈTE', { bg: C.black, fc: C.yellow, b: true, fs: 12, ind: 1 });
    P.h(nr, 30);
    P.row(nr + 1, 0, ['Indicateur', 'Valeur', 'Formule', '', ''], HDR);
    P.set(nr + 2, 0, 'FC max estimée', { ind: 1 }); P.set(nr + 2, 1, '30', { bg: C.yellowM, ha: 'center' }); P.set(nr + 2, 2, '=FCMAX(B' + (nr + 3) + ')', { nf: 'bpm', ha: 'center' }); P.set(nr + 2, 3, '← âge', { fc: '#888', i: true });
    P.set(nr + 3, 0, 'IMC (taille cm)', { ind: 1 }); P.set(nr + 3, 1, '178', { bg: C.yellowM, ha: 'center' }); P.set(nr + 3, 2, '=ROUND(IMC($B$10;B' + (nr + 4) + ');1)', { ha: 'center' });
    P.set(nr + 4, 0, 'Métabolisme de base', { ind: 1 }); P.set(nr + 4, 1, 'H', { bg: C.yellowM, ha: 'center' }); P.set(nr + 4, 2, '=ROUND(MB($B$10;B' + (nr + 4) + ';B' + (nr + 3) + ';B' + (nr + 5) + '))', { nf: 'kcal', ha: 'center' });
    P.dv(nr + 4, 1, nr + 4, 1, ['H', 'F']);
    P.grid(nr + 1, 0, nr + 4, 3, C.grayM);
    P.brandFooter(nr + 6, 0, 4);
    prof.rows = Math.max(prof.rows, 60);
    // Note: B10 = poids de corps (ligne 10 = index 9)
    const rmRef = (i) => 'Profil!$B$' + (rmRow + 3 + i);

    // --- Programme ---
    const prog = SE.newSheet('Programme', 400, 12);
    wb.sheets.push(prog);
    prog.tab = C.black;
    prog.grid = false;
    const B = new Builder(prog);
    B.widths([210, 62, 62, 66, 78, 52, 62, 76, 46, 220]);
    B.banner(0, 0, 9, 'PROGRAMME ' + G.label.toUpperCase() + ' — ' + o.athlete.toUpperCase(), o.weeks + ' semaines · ' + o.days + ' séances/sem.' + (o.coach ? ' · Coach : ' + o.coach : '') + ' · Charges calculées depuis l\'onglet Profil');
    prog.freezeR = 2;
    const split = pickSplit(o.goal, o.days);
    const allEx = SE.allExercises();
    let r = 3;
    const tonnageCells = [];
    const checkRanges = [];
    for (let w = 1; w <= o.weeks; w++) {
      const deload = o.deload > 0 && w % o.deload === 0 && w !== o.weeks;
      const steps = (w - 1) - (o.deload > 0 ? Math.floor((w - 1) / o.deload) : 0);
      const pct = Math.min(0.95, G.main.pct + G.main.inc * steps) * (deload ? 0.85 : 1);
      const repsMain = G.main.reps[Math.min(G.main.reps.length - 1, Math.floor(((w - 1) / Math.max(1, o.weeks - 1)) * (G.main.reps.length - 1)))];
      B.merge(r, 0, r, 9, 'SEMAINE ' + w + (deload ? '  ·  DÉCHARGE (deload)' : '') + '  ·  intensité principale ' + Math.round(pct * 100) + '%', { bg: deload ? '#BFE3C6' : C.yellow, fc: C.black, b: true, fs: 13, ind: 1 });
      B.h(r, 32);
      r++;
      const weekStart = r;
      const weekTon = [];
      for (let d = 0; d < o.days; d++) {
        const day = split[d % split.length];
        const dateSerial = o.start + (w - 1) * 7 + Math.round((d * 7) / o.days);
        B.merge(r, 0, r, 7, 'Séance ' + (d + 1) + ' — ' + day.name, { bg: C.dark, fc: C.white, b: true, ind: 1 });
        B.merge(r, 8, r, 9, String(dateSerial), { bg: C.dark, fc: C.yellow, nf: 'dated', ha: 'right', b: true });
        B.h(r, 28);
        r++;
        B.row(r, 0, ['Exercice', 'Séries', 'Reps', '% 1RM', 'Charge', 'RPE', 'Repos', 'Tempo', 'Fait', 'Notes / consignes'], HDR);
        B.h(r, 24);
        r++;
        const first = r;
        day.ex.forEach((ex, i) => {
          const isMain = MAIN[ex] !== undefined && i < 2;
          const lvl = o.level === 'debutant' ? -1 : o.level === 'avance' ? 1 : 0;
          const sets = Math.max(2, (isMain ? G.main.sets : G.acc.sets) + lvl - (deload ? 1 : 0));
          const zebra = i % 2 ? C.gray : C.white;
          B.set(r, 0, ex, { bg: zebra, b: isMain, ind: 1 });
          B.set(r, 1, String(sets), { bg: zebra, ha: 'center' });
          if (isMain) {
            const reps = i === 0 ? repsMain : Math.max(repsMain + 2, 5);
            const p = i === 0 ? pct : pct - 0.075;
            B.set(r, 2, String(reps), { bg: zebra, ha: 'center' });
            B.set(r, 3, String(Math.round(p * 1000) / 1000), { bg: C.yellowL, ha: 'center', nf: 'pct1' });
            B.set(r, 4, '=IF(D' + (r + 1) + '="";"";CHARGE(' + rmRef(MAIN[ex]) + ';D' + (r + 1) + ';' + o.step + '))', { bg: C.yellowL, ha: 'center', nf: 'kg', b: true });
            B.set(r, 5, String(deload ? G.main.rpe - 2 : G.main.rpe), { bg: zebra, ha: 'center', nf: 'rpe' });
            B.set(r, 6, G.main.rest, { bg: zebra, ha: 'center' });
            B.set(r, 7, G.main.tempo, { bg: zebra, ha: 'center' });
          } else {
            B.set(r, 2, G.acc.reps, { bg: zebra, ha: 'center' });
            B.set(r, 3, '', { bg: zebra });
            B.set(r, 4, '', { bg: zebra, ha: 'center', nf: 'kg' });
            B.set(r, 5, String(deload ? G.acc.rpe - 2 : G.acc.rpe), { bg: zebra, ha: 'center', nf: 'rpe' });
            B.set(r, 6, G.acc.rest, { bg: zebra, ha: 'center' });
            B.set(r, 7, G.acc.tempo, { bg: zebra, ha: 'center' });
          }
          B.set(r, 8, 'FAUX', { bg: zebra, chk: true, ha: 'center' });
          B.set(r, 9, isMain && w === 1 && d === 0 && i === 0 ? 'Échauffement progressif : 40% / 60% / 80% de la charge' : '', { bg: zebra, fc: '#52525B', i: true });
          r++;
        });
        const last = r - 1;
        B.grid(first - 1, 0, last, 9, '#D4D4D8');
        B.dv(first, 0, last, 0, allEx);
        B.dv(first, 5, last, 5, ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10']);
        checkRanges.push('I' + (first + 1) + ':I' + (last + 1));
        B.merge(r, 0, r, 3, 'Tonnage de la séance', { ha: 'right', fc: C.grayD, i: true, fs: 11 });
        B.set(r, 4, '=TONNAGE(B' + (first + 1) + ':B' + (last + 1) + ';C' + (first + 1) + ':C' + (last + 1) + ';E' + (first + 1) + ':E' + (last + 1) + ')', { b: true, ha: 'center', nf: 'kg', fc: C.black });
        B.merge(r, 5, r, 7, 'Séance validée', { ha: 'right', fc: C.grayD, i: true, fs: 11 });
        B.set(r, 8, '=IF(COUNTIF(I' + (first + 1) + ':I' + (last + 1) + ';TRUE)=ROWS(I' + (first + 1) + ':I' + (last + 1) + ');"✅";COUNTIF(I' + (first + 1) + ':I' + (last + 1) + ';TRUE)&"/"&ROWS(I' + (first + 1) + ':I' + (last + 1) + '))', { ha: 'center', b: true });
        weekTon.push('E' + (r + 1));
        r += 2;
      }
      tonnageCells.push({ w, cells: weekTon, deload, pct });
      void weekStart;
    }
    B.brandFooter(r, 0, 9);
    prog.rows = r + 30;

    // --- Suivi des perfs ---
    const log = SE.newSheet('Journal', 300, 10);
    wb.sheets.push(log);
    log.tab = '#2E7D32';
    const L = new Builder(log);
    L.widths([100, 190, 80, 62, 56, 90, 90, 220]);
    L.banner(0, 0, 7, 'JOURNAL D\'ENTRAÎNEMENT', 'Notez vos séries réelles : le 1RM estimé et le tonnage se calculent automatiquement');
    log.freezeR = 3;
    L.row(2, 0, ['Date', 'Exercice', 'Charge', 'Reps', 'RPE', '1RM estimé', 'Tonnage', 'Ressenti'], HDR);
    for (let i = 0; i < 60; i++) {
      const rr = 3 + i, z = i % 2 ? C.gray : C.white;
      L.style(rr, 0, rr, 7, { bg: z });
      SE.setStyle(log, rr, 0, { nf: 'date', ha: 'center' });
      SE.setStyle(log, rr, 2, { nf: 'kg', ha: 'center' });
      SE.setStyle(log, rr, 3, { ha: 'center' });
      SE.setStyle(log, rr, 4, { ha: 'center', nf: 'rpe' });
      L.set(rr, 5, '=IF(OR(C' + (rr + 1) + '="";D' + (rr + 1) + '="");"";ROUND(IF(E' + (rr + 1) + '="";ONERM(C' + (rr + 1) + ';D' + (rr + 1) + ');E1RM(C' + (rr + 1) + ';D' + (rr + 1) + ';E' + (rr + 1) + '));1))', { nf: 'kg', ha: 'center', b: true });
      L.set(rr, 6, '=IF(C' + (rr + 1) + '="";"";C' + (rr + 1) + '*D' + (rr + 1) + ')', { nf: 'kg', ha: 'center' });
    }
    const ex0 = [['Squat', 100, 5, 8], ['Développé couché', 80, 5, 8.5], ['Soulevé de terre', 130, 3, 8], ['Squat', 102.5, 5, 8], ['Développé couché', 82.5, 5, 9]];
    ex0.forEach((e, i) => { L.set(3 + i, 0, String(o.start + i * 2)); L.set(3 + i, 1, e[0]); L.set(3 + i, 2, String(e[1])); L.set(3 + i, 3, String(e[2])); L.set(3 + i, 4, String(e[3])); });
    L.dv(3, 1, 62, 1, allEx);
    L.dv(3, 7, 62, 7, ['😀 Excellent', '🙂 Bien', '😐 Moyen', '😫 Difficile', '🤕 Douleur']);
    L.grid(2, 0, 62, 7, '#D4D4D8');
    L.cf({ r1: 3, c1: 4, r2: 62, c2: 4, type: 'gte', a: 9.5, style: { bg: C.red, fc: C.redD, b: true } });
    L.cf({ r1: 3, c1: 5, r2: 62, c2: 5, type: 'bar', color: '#FFC72C' });

    // --- Tableau de bord ---
    const dash = SE.newSheet('Tableau de bord', 60, 8);
    wb.sheets.push(dash);
    dash.tab = '#1A5FD0';
    dash.grid = false;
    const D = new Builder(dash);
    D.widths([150, 120, 120, 120, 30, 30]);
    D.banner(0, 0, 3, 'TABLEAU DE BORD', 'Synthèse automatique du programme');
    D.row(3, 0, ['Indicateur', 'Valeur', '', ''], HDR);
    D.merge(3, 1, 3, 3);
    const allChecks = checkRanges.map((x) => 'Programme!' + x);
    D.set(4, 0, 'Exercices réalisés', { b: true, ind: 1 });
    D.merge(4, 1, 4, 3, '=' + allChecks.map((x) => 'COUNTIF(' + x + ';TRUE)').join('+'), { ha: 'center', b: true, fs: 16 });
    D.set(5, 0, 'Exercices prévus', { b: true, ind: 1 });
    D.merge(5, 1, 5, 3, '=' + allChecks.map((x) => 'ROWS(' + x + ')').join('+'), { ha: 'center', fs: 14 });
    D.set(6, 0, 'Progression', { b: true, ind: 1 });
    D.merge(6, 1, 6, 3, '=IFERROR(B5/B6;0)', { ha: 'center', nf: 'pct', b: true, fs: 16, fc: C.greenD });
    D.set(7, 0, 'Meilleur 1RM estimé', { b: true, ind: 1 });
    D.merge(7, 1, 7, 3, '=MAX(Journal!F4:F63)', { ha: 'center', nf: 'kg', fs: 14 });
    D.set(8, 0, 'Tonnage journal', { b: true, ind: 1 });
    D.merge(8, 1, 8, 3, '=SUM(Journal!G4:G63)', { ha: 'center', nf: 'kg', fs: 14 });
    D.grid(3, 0, 8, 3, C.grayM);
    D.cf({ r1: 6, c1: 1, r2: 6, c2: 1, type: 'bar', color: '#2ECC71' });
    D.row(10, 0, ['Semaine', 'Intensité', 'Tonnage prévu', 'Type'], HDR);
    tonnageCells.forEach((t, i) => {
      const rr = 11 + i, z = i % 2 ? C.gray : C.white;
      D.set(rr, 0, 'S' + t.w, { bg: z, ha: 'center', b: true });
      D.set(rr, 1, String(Math.round(t.pct * 1000) / 1000), { bg: z, ha: 'center', nf: 'pct' });
      D.set(rr, 2, '=' + t.cells.map((c) => 'Programme!' + c).join('+'), { bg: z, ha: 'center', nf: 'kg' });
      D.set(rr, 3, t.deload ? 'Décharge' : 'Charge', { bg: t.deload ? C.green : z, ha: 'center' });
    });
    const lastW = 11 + tonnageCells.length - 1;
    D.grid(10, 0, lastW, 3, C.grayM);
    D.cf({ r1: 11, c1: 2, r2: lastW, c2: 2, type: 'bar', color: '#FFC72C' });
    dash.charts.push({ id: SE.uid(), type: 'bar', title: 'Tonnage prévu par semaine', r: lastW + 2, c: 0, w: 480, h: 260, labels: { r1: 11, c1: 0, r2: lastW, c2: 0 }, series: [{ r1: 11, c1: 2, r2: lastW, c2: 2, name: 'Tonnage' }] });
    dash.charts.push({ id: SE.uid(), type: 'line', title: 'Intensité (% 1RM)', r: lastW + 16, c: 0, w: 480, h: 220, labels: { r1: 11, c1: 0, r2: lastW, c2: 0 }, series: [{ r1: 11, c1: 1, r2: lastW, c2: 1, name: 'Intensité' }] });
    wb.active = 1;
    return wb;
  };

  // ---------- Modèles ----------
  function tplRunning() {
    const wb = SE.newWorkbook('Plan 10 km — 8 semaines');
    wb.icon = 'footprints';
    const sh = wb.sheets[0];
    sh.name = 'Plan 10 km';
    sh.grid = false;
    sh.tab = C.yellow;
    const B = new Builder(sh);
    B.widths([70, 120, 200, 70, 70, 90, 80, 50, 180]);
    B.banner(0, 0, 8, 'PLAN 10 KM · 8 SEMAINES', 'Allures calculées automatiquement depuis votre VMA — modifiez les cases jaunes');
    B.set(3, 0, 'VMA', { b: true, ha: 'right' }); B.set(3, 1, '15', { bg: C.yellowM, b: true, ha: 'center', nf: 'kmh' });
    B.set(3, 2, 'Objectif 10 km (temps)', { b: true, ha: 'right' }); B.set(3, 3, "'50:00", { bg: C.yellowM, b: true, ha: 'center' });
    B.set(3, 4, 'Allure cible', { b: true, ha: 'right' }); B.set(3, 5, '=ALLURE(10;D4)&" /km"', { b: true, ha: 'center', fc: C.blueD });
    B.set(3, 6, 'FC max', { b: true, ha: 'right' }); B.set(3, 7, '190', { bg: C.yellowM, ha: 'center' });
    B.h(3, 30);
    B.box(3, 0, 3, 8, 2, C.black);
    B.row(5, 0, ['Sem.', 'Type', 'Contenu', 'Dist. km', '% VMA', 'Allure', 'Durée est.', 'Fait', 'Ressenti'], HDR);
    sh.freezeR = 6;
    const plan = [
      [['Footing', 'Endurance fondamentale 40 min', 7, 0.65], ['Fractionné', '8 × 30/30 à 100% VMA', 6, 1], ['Sortie longue', '55 min tranquille', 9, 0.65]],
      [['Footing', 'EF 45 min + 4 lignes droites', 8, 0.65], ['Fractionné', '10 × 400 m (r = 1 min)', 7, 0.95], ['Sortie longue', '60 min', 10, 0.65]],
      [['Footing', 'EF 45 min', 8, 0.65], ['Seuil', '3 × 8 min à 85% (r = 2 min)', 8, 0.85], ['Sortie longue', '65 min dont 15 min allure 10 km', 11, 0.7]],
      [['Récup', 'Footing 35 min très facile', 6, 0.6], ['Fractionné', '6 × 1000 m à 90% (r = 2 min)', 9, 0.9], ['Sortie longue', '60 min', 10, 0.65]],
      [['Footing', 'EF 50 min + gammes', 9, 0.65], ['Fractionné', '12 × 300 m à 100% (r = 1 min)', 7, 1], ['Sortie longue', '70 min dont 2 × 10 min allure 10 km', 12, 0.72]],
      [['Footing', 'EF 50 min', 9, 0.65], ['Seuil', '2 × 15 min à 85% (r = 3 min)', 10, 0.85], ['Sortie longue', '75 min', 13, 0.68]],
      [['Footing', 'EF 40 min', 7, 0.65], ['Allure course', '3 × 2 km allure 10 km (r = 2 min)', 9, 0.88], ['Sortie longue', '60 min', 10, 0.65]],
      [['Footing', 'EF 30 min + 3 accélérations', 5, 0.65], ['Activation', '20 min dont 5 × 1 min allure course', 4, 0.88], ['COURSE', '🏁 10 KM — objectif !', 10, 0.88]]
    ];
    let r = 6;
    plan.forEach((wk, wi) => {
      wk.forEach((s, si) => {
        const z = wi % 2 ? C.gray : C.white;
        if (si === 0) B.merge(r, 0, r + 2, 0, 'S' + (wi + 1), { bg: wi === 7 ? C.yellow : C.dark, fc: wi === 7 ? C.black : C.yellow, b: true, ha: 'center', fs: 14 });
        B.set(r, 1, s[0], { bg: z, b: true, fc: s[0] === 'Fractionné' ? C.redD : s[0] === 'Seuil' ? '#E65100' : s[0] === 'COURSE' ? C.blueD : C.greenD });
        B.set(r, 2, s[1], { bg: z });
        B.set(r, 3, String(s[2]), { bg: z, ha: 'center', nf: 'km' });
        B.set(r, 4, String(s[3]), { bg: z, ha: 'center', nf: 'pct' });
        B.set(r, 5, '=ALLUREVMA($B$4;E' + (r + 1) + ')', { bg: z, ha: 'center', b: true });
        B.set(r, 6, '=TEMPSCOURSE(D' + (r + 1) + ';F' + (r + 1) + ')', { bg: z, ha: 'center' });
        B.set(r, 7, 'FAUX', { bg: z, chk: true });
        B.set(r, 8, '', { bg: z });
        r++;
      });
    });
    B.grid(5, 0, r - 1, 8, '#D4D4D8');
    B.dv(6, 1, r - 1, 1, ['Footing', 'Fractionné', 'Seuil', 'Sortie longue', 'Récup', 'Allure course', 'Activation', 'COURSE', 'Repos', 'Renfo']);
    B.dv(6, 8, r - 1, 8, ['😀 Facile', '🙂 Bien', '😐 Correct', '😫 Dur', '🤕 Douleur']);
    r++;
    B.merge(r, 0, r, 8, 'ZONES DE FRÉQUENCE CARDIAQUE & PRÉDICTIONS', { bg: C.black, fc: C.yellow, b: true, ind: 1 }); B.h(r, 28);
    r++;
    B.row(r, 0, ['Zone', 'Nom', 'Objectif', '% FCmax', 'FC (bpm)', '', 'Distance', 'Temps prédit', ''], HDR);
    const zones = [['Z1', 'Récupération', 'Récupérer', 0.6], ['Z2', 'Endurance', 'Base aérobie', 0.7], ['Z3', 'Tempo', 'Seuil aérobie', 0.8], ['Z4', 'Seuil', 'Seuil anaérobie', 0.88], ['Z5', 'VO2max', 'Puissance', 0.95]];
    const preds = [['5 km', 5], ['10 km', 10], ['Semi', 21.1], ['Marathon', 42.195], ['', '']];
    zones.forEach((z, i) => {
      const rr = r + 1 + i;
      B.row(rr, 0, [z[0], z[1], z[2]], [{ b: true, ha: 'center', bg: SE.mixScale(['#4FC3F7', '#66BB6A', '#FFEE58', '#FFA726', '#EF5350'], i / 4) }, { b: true }, { fc: '#555' }]);
      B.set(rr, 3, String(z[3]), { nf: 'pct', ha: 'center' });
      B.set(rr, 4, '=ROUND($H$4*D' + (rr + 1) + ')', { nf: 'bpm', ha: 'center', b: true });
      if (preds[i][0]) { B.set(rr, 6, preds[i][0], { b: true, ha: 'center' }); B.set(rr, 7, '=RIEGEL(10;$D$4;' + preds[i][1] + ')', { ha: 'center', fc: C.blueD, b: true }); }
    });
    B.grid(r, 0, r + 5, 4, '#D4D4D8');
    B.grid(r, 6, r + 4, 7, '#D4D4D8');
    B.brandFooter(r + 7, 0, 8);
    return wb;
  }

  function tplHIIT() {
    const wb = SE.newWorkbook('Circuit HIIT');
    wb.icon = 'flame';
    const sh = wb.sheets[0];
    sh.name = 'HIIT'; sh.grid = false; sh.tab = '#E53935';
    const B = new Builder(sh);
    B.widths([40, 200, 90, 90, 220, 60]);
    B.banner(0, 0, 5, 'CIRCUIT HIIT 🔥', 'Travail / repos en secondes · la durée totale se calcule automatiquement');
    B.set(3, 1, 'Nombre de tours', { b: true, ha: 'right' }); B.set(3, 2, '4', { bg: C.yellowM, b: true, ha: 'center' });
    B.set(3, 3, 'Repos entre tours', { b: true, ha: 'right' }); B.set(3, 4, '60', { bg: C.yellowM, b: true, ha: 'center', nf: 'sec' });
    B.row(5, 0, ['#', 'Exercice', 'Travail', 'Repos', 'Consigne', 'Fait'], HDR);
    const ex = [['Burpees', 40, 20, 'Poitrine au sol, saut bras tendus'], ['Squat sauté', 40, 20, 'Réception souple'], ['Mountain climbers', 40, 20, 'Hanches basses'], ['Pompes', 40, 20, 'Gainage serré'], ['Kettlebell swing', 40, 20, 'Poussée de hanches'], ['Planche', 40, 20, 'Ne pas creuser le dos'], ['Corde à sauter', 40, 20, 'Rythme régulier'], ['Fentes marchées', 40, 20, 'Genou arrière frôle le sol']];
    ex.forEach((e, i) => {
      const r = 6 + i, z = i % 2 ? C.gray : C.white;
      B.row(r, 0, [String(i + 1), e[0], String(e[1]), String(e[2]), e[3], 'FAUX'], [{ bg: C.black, fc: C.yellow, b: true, ha: 'center' }, { bg: z, b: true }, { bg: z, ha: 'center', nf: 'sec' }, { bg: z, ha: 'center', nf: 'sec' }, { bg: z, fc: '#555', i: true }, { bg: z, chk: true }]);
    });
    const last = 6 + ex.length - 1;
    B.grid(5, 0, last, 5, '#D4D4D8');
    B.dv(6, 1, last, 1, SE.allExercises());
    const t = last + 2;
    B.merge(t, 0, t, 1, 'Durée d\'un tour', { b: true, ha: 'right' }); B.set(t, 2, '=MMSS(SUM(C7:D' + (last + 1) + '))', { b: true, ha: 'center' });
    B.merge(t + 1, 0, t + 1, 1, 'Durée totale de la séance', { b: true, ha: 'right' }); B.set(t + 1, 2, '=MMSS(SUM(C7:D' + (last + 1) + ')*C4+E4*(C4-1))', { b: true, ha: 'center', bg: C.yellow, fs: 15 });
    B.merge(t + 2, 0, t + 2, 1, 'Dépense estimée (75 kg, MET 8)', { b: true, ha: 'right' }); B.set(t + 2, 2, '=ROUND(KCAL(8;75;(SUM(C7:D' + (last + 1) + ')*C4+E4*(C4-1))/60))', { b: true, ha: 'center', nf: 'kcal' });
    B.merge(t + 4, 0, t + 4, 5, '💡 Astuce : utilisez le bouton Chrono ⏱ (mode Intervalles) pour lancer ce circuit avec bips sonores.', { fc: C.grayD, i: true, wrap: true });
    B.h(t + 4, 36);
    B.brandFooter(t + 6, 0, 5);
    return wb;
  }

  function tplBody() {
    const wb = SE.newWorkbook('Suivi corporel');
    wb.icon = 'activity';
    const sh = wb.sheets[0];
    sh.name = 'Mensurations'; sh.tab = '#8E24AA'; sh.grid = false;
    const B = new Builder(sh);
    B.widths([100, 80, 80, 80, 80, 80, 70, 70, 90, 90]);
    B.banner(0, 0, 9, 'SUIVI CORPOREL', 'Poids, mensurations, IMC et masse maigre — le graphique se met à jour tout seul');
    B.set(3, 0, 'Taille (cm)', { b: true, ha: 'right' }); B.set(3, 1, '175', { bg: C.yellowM, ha: 'center', b: true });
    B.set(3, 2, 'Objectif (kg)', { b: true, ha: 'right' }); B.set(3, 3, '72', { bg: C.yellowM, ha: 'center', b: true, nf: 'kg' });
    B.row(5, 0, ['Date', 'Poids', 'Variation', 'Taille', 'Hanches', 'Bras', '% MG', 'IMC', 'Masse maigre', 'Reste à perdre'], HDR);
    sh.freezeR = 6;
    const base = today() - 7 * 9;
    const data = [[80.2, 92, 102, 36, 0.22], [79.6, 91, 101.5, 36, 0.215], [79.1, 90.5, 101, 36.2, 0.21], [78.9, 90, 100.5, 36.3, 0.208], [78.2, 89, 100, 36.4, 0.203], [77.8, 88.5, 99.5, 36.5, 0.2], [77.1, 88, 99, 36.5, 0.195], [76.8, 87, 98.5, 36.7, 0.19], [76.2, 86.5, 98, 36.8, 0.186], [75.9, 86, 97.5, 37, 0.182]];
    for (let i = 0; i < 40; i++) {
      const r = 6 + i, z = i % 2 ? C.gray : C.white, R = r + 1;
      const d = data[i];
      B.set(r, 0, d ? String(base + i * 7) : '', { bg: z, nf: 'date', ha: 'center' });
      B.set(r, 1, d ? String(d[0]) : '', { bg: z, nf: 'kg', ha: 'center', b: true });
      B.set(r, 2, i === 0 ? '' : '=IF(B' + R + '="";"";B' + R + '-B' + r + ')', { bg: z, nf: 'n1', ha: 'center' });
      B.set(r, 3, d ? String(d[1]) : '', { bg: z, nf: 'cm', ha: 'center' });
      B.set(r, 4, d ? String(d[2]) : '', { bg: z, nf: 'cm', ha: 'center' });
      B.set(r, 5, d ? String(d[3]) : '', { bg: z, nf: 'cm', ha: 'center' });
      B.set(r, 6, d ? String(d[4]) : '', { bg: z, nf: 'pct1', ha: 'center' });
      B.set(r, 7, '=IF(B' + R + '="";"";ROUND(IMC(B' + R + ';$B$4);1))', { bg: z, ha: 'center' });
      B.set(r, 8, '=IF(OR(B' + R + '="";G' + R + '="");"";ROUND(MASSEMAIGRE(B' + R + ';G' + R + ');1))', { bg: z, ha: 'center', nf: 'kg' });
      B.set(r, 9, '=IF(B' + R + '="";"";MAX(0;B' + R + '-$D$4))', { bg: z, ha: 'center', nf: 'kg' });
    }
    B.grid(5, 0, 45, 9, '#D4D4D8');
    B.cf({ r1: 6, c1: 2, r2: 45, c2: 2, type: 'lt', a: 0, style: { fc: C.greenD, b: true } });
    B.cf({ r1: 6, c1: 2, r2: 45, c2: 2, type: 'gt', a: 0, style: { fc: C.redD, b: true } });
    B.cf({ r1: 6, c1: 7, r2: 45, c2: 7, type: 'gte', a: 25, style: { bg: '#FFE0B2' } });
    sh.charts.push({ id: SE.uid(), type: 'line', title: 'Évolution du poids', r: 3, c: 11, w: 460, h: 260, labels: { r1: 6, c1: 0, r2: 15, c2: 0 }, series: [{ r1: 6, c1: 1, r2: 15, c2: 1, name: 'Poids' }] });
    sh.charts.push({ id: SE.uid(), type: 'line', title: 'Tour de taille', r: 18, c: 11, w: 460, h: 220, labels: { r1: 6, c1: 0, r2: 15, c2: 0 }, series: [{ r1: 6, c1: 3, r2: 15, c2: 3, name: 'Taille' }] });
    return wb;
  }

  function tpl1RM() {
    const wb = SE.newWorkbook('Calculateur 1RM & charges');
    wb.icon = 'calculator';
    const sh = wb.sheets[0];
    sh.name = 'Calculateur'; sh.grid = false; sh.tab = C.yellow;
    const B = new Builder(sh);
    B.widths([130, 84, 84, 84, 84, 84, 84, 30]);
    B.banner(0, 0, 6, 'CALCULATEUR 1RM', 'Entrez une performance — toutes les charges de travail sont calculées');
    B.row(3, 0, ['Charge (kg)', 'Reps', 'Arrondi', '', '', '', ''], [HDR, HDR, HDR]);
    B.set(4, 0, '100', { bg: C.yellowM, b: true, ha: 'center', fs: 16, nf: 'kg' }); B.set(4, 1, '5', { bg: C.yellowM, b: true, ha: 'center', fs: 16 }); B.set(4, 2, '2.5', { bg: C.yellowM, b: true, ha: 'center', fs: 16 });
    B.h(4, 36);
    B.row(6, 0, ['Méthode', 'Epley', 'Brzycki', 'Lombardi', 'Moyenne'], HDR);
    B.set(7, 0, '1RM estimé', { b: true, ind: 1 });
    [1, 2, 3, 4].forEach((m, i) => B.set(7, 1 + i, '=ROUND(ONERM($A$5;$B$5;' + m + ');1)', { ha: 'center', nf: 'kg', b: i === 3, bg: i === 3 ? C.yellow : C.white, fs: i === 3 ? 14 : 13 }));
    B.h(7, 32);
    B.grid(6, 0, 7, 4, '#D4D4D8');
    B.merge(9, 0, 9, 6, 'TABLE DES POURCENTAGES', { bg: C.black, fc: C.yellow, b: true, ind: 1 }); B.h(9, 28);
    B.row(10, 0, ['% 1RM', 'Charge', 'Reps typiques', 'Zone', '', '', ''], HDR);
    const zones = [[1, '1', 'Force max'], [0.95, '2', 'Force max'], [0.9, '3-4', 'Force'], [0.85, '5-6', 'Force'], [0.8, '7-8', 'Force / Hypertrophie'], [0.75, '9-10', 'Hypertrophie'], [0.7, '11-12', 'Hypertrophie'], [0.65, '13-15', 'Endurance de force'], [0.6, '16-20', 'Endurance'], [0.5, '20+', 'Échauffement / technique']];
    zones.forEach((z, i) => {
      const r = 11 + i, bg = SE.mixScale(['#FFCDD2', '#FFF59D', '#C8E6C9'], i / 9);
      B.row(r, 0, [String(z[0]), '=CHARGE($E$8;A' + (r + 1) + ';$C$5)', z[1], z[2]], [{ nf: 'pct', ha: 'center', b: true, bg }, { nf: 'kg', ha: 'center', b: true }, { ha: 'center' }, { fc: '#555' }]);
    });
    B.grid(10, 0, 20, 3, '#D4D4D8');
    B.merge(22, 0, 22, 6, 'CHARGES SELON REPS × RPE', { bg: C.black, fc: C.yellow, b: true, ind: 1 }); B.h(22, 28);
    const rpes = [10, 9.5, 9, 8.5, 8, 7.5];
    B.row(23, 0, ['Reps \\ RPE'].concat(rpes.map(String)), HDR.constructor === Object ? rpes.map(() => HDR).concat([HDR]) : HDR);
    for (let k = 0; k < 7; k++) SE.setStyle(sh, 23, k, HDR);
    for (let reps = 1; reps <= 10; reps++) {
      const r = 23 + reps;
      B.set(r, 0, String(reps), { b: true, ha: 'center', bg: C.gray });
      rpes.forEach((rp, i) => B.set(r, 1 + i, '=CHARGERPE($E$8;$A' + (r + 1) + ';' + SE.colName(1 + i) + '$24;$C$5)', { ha: 'center', nf: 'kg' }));
    }
    B.grid(23, 0, 33, 6, '#D4D4D8');
    B.cf({ r1: 24, c1: 1, r2: 33, c2: 6, type: 'scale', colors: ['#E8F5E9', '#FFF59D', '#FFAB91'] });
    B.brandFooter(35, 0, 6);
    return wb;
  }

  function tplClient() {
    const wb = SE.newWorkbook('Fiche bilan client');
    wb.icon = 'user';
    const sh = wb.sheets[0];
    sh.name = 'Bilan'; sh.grid = false; sh.tab = C.yellow;
    const B = new Builder(sh);
    B.widths([180, 150, 30, 180, 150]);
    B.banner(0, 0, 4, 'FICHE BILAN CLIENT', 'Premier rendez-vous · objectifs · calcul des besoins énergétiques');
    const sec = (r, c, title) => { B.merge(r, c, r, c + 1, title, { bg: C.black, fc: C.yellow, b: true, ind: 1 }); B.h(r, 28); };
    const field = (r, c, label, val, s) => { B.set(r, c, label, { bg: C.gray, b: true, ind: 1, fc: C.grayD }); B.set(r, c + 1, val, Object.assign({ bg: C.yellowL, ha: 'center' }, s || {})); };
    sec(3, 0, 'IDENTITÉ');
    field(4, 0, 'Nom', 'Camille Martin'); field(5, 0, 'Sexe (H/F)', 'F'); field(6, 0, 'Âge', '32'); field(7, 0, 'Taille (cm)', '168'); field(8, 0, 'Poids (kg)', '64', { nf: 'kg' }); field(9, 0, 'Date du bilan', String(today()), { nf: 'date' }); field(10, 0, 'Téléphone', ''); field(11, 0, 'E-mail', '');
    B.dv(5, 1, 5, 1, ['H', 'F']);
    B.grid(4, 0, 11, 1, C.grayM);
    sec(3, 3, 'OBJECTIFS & CONTEXTE');
    field(4, 3, 'Objectif principal', 'Perte de poids'); field(5, 3, 'Échéance', '3 mois'); field(6, 3, 'Niveau', 'Intermédiaire'); field(7, 3, 'Séances / semaine', '3'); field(8, 3, 'Matériel', 'Salle complète'); field(9, 3, 'Activité quotidienne', 'Modérée'); field(10, 3, 'Blessures / douleurs', 'Aucune'); field(11, 3, 'Sommeil (h)', '7');
    B.dv(4, 4, 4, 4, ['Perte de poids', 'Prise de masse', 'Force', 'Remise en forme', 'Performance', 'Santé / bien-être', 'Préparation course']);
    B.dv(6, 4, 6, 4, ['Débutant', 'Intermédiaire', 'Avancé', 'Athlète']);
    B.dv(9, 4, 9, 4, ['Sédentaire', 'Légère', 'Modérée', 'Active', 'Très active']);
    B.grid(4, 3, 11, 4, C.grayM);
    sec(13, 0, 'BESOINS ÉNERGÉTIQUES');
    const res = (r, label, f, s) => { B.set(r, 0, label, { bg: C.gray, b: true, ind: 1, fc: C.grayD }); B.set(r, 1, f, Object.assign({ ha: 'center', b: true }, s || {})); };
    res(14, 'IMC', '=ROUND(IMC(B9;B8);1)');
    res(15, 'Métabolisme de base', '=ROUND(MB(B9;B8;B7;B6))', { nf: 'kcal' });
    res(16, 'Coef. d\'activité', '=CHOOSE(MATCH(E10;{"Sédentaire";"Légère";"Modérée";"Active";"Très active"};0);1.2;1.375;1.55;1.725;1.9)', { nf: 'n2' });
    res(17, 'Dépense totale (DET)', '=ROUND(DET(B16;B17))', { nf: 'kcal' });
    res(18, 'Apport conseillé', '=ROUND(B18*IF(E5="Perte de poids";0.8;IF(E5="Prise de masse";1.1;1)))', { nf: 'kcal', bg: C.yellow, fs: 15 });
    res(19, 'Hydratation', '=HYDRATATION(B9;60)&" ml / jour"');
    B.grid(14, 0, 19, 1, C.grayM);
    sec(13, 3, 'RÉPARTITION DES MACROS');
    B.row(14, 3, ['Macro', 'Grammes / jour'], HDR);
    B.set(15, 3, 'Protéines (30%)', { b: true, ind: 1, fc: C.redD }); B.set(15, 4, '=MACROS($B$19;"P";30%)&" g"', { ha: 'center', b: true });
    B.set(16, 3, 'Glucides (45%)', { b: true, ind: 1, fc: '#E65100' }); B.set(16, 4, '=MACROS($B$19;"G";45%)&" g"', { ha: 'center', b: true });
    B.set(17, 3, 'Lipides (25%)', { b: true, ind: 1, fc: C.blueD }); B.set(17, 4, '=MACROS($B$19;"L";25%)&" g"', { ha: 'center', b: true });
    B.set(18, 3, 'Protéines / kg', { b: true, ind: 1 }); B.set(18, 4, '=ROUND(MACROS($B$19;"P";30%)/B9;1)&" g/kg"', { ha: 'center' });
    B.grid(14, 3, 18, 4, C.grayM);
    B.merge(21, 0, 21, 4, 'TESTS PHYSIQUES', { bg: C.black, fc: C.yellow, b: true, ind: 1 });
    B.row(22, 0, ['Test', 'Résultat', '', 'Référence', 'Commentaire'], HDR);
    const tests = [['Pompes max', '18', 'Bon > 20'], ['Gainage (s)', '75', 'Bon > 90 s'], ['Squat 1 min', '38', 'Bon > 40'], ['Cooper (m)', '2200', 'Bon > 2400 m'], ['Souplesse (cm)', '+4', 'Bon > +5']];
    tests.forEach((t, i) => { const r = 23 + i; B.row(r, 0, [t[0], t[1], '', t[2], ''], [{ b: true, ind: 1 }, { ha: 'center', bg: C.yellowL }, {}, { fc: '#666', i: true }, {}]); });
    B.grid(22, 0, 27, 4, C.grayM);
    B.merge(29, 0, 29, 4, 'NOTES DU COACH', { bg: C.black, fc: C.yellow, b: true, ind: 1 });
    B.merge(30, 0, 33, 4, 'Motivation élevée. Commencer par 3 séances full body, focus technique sur le squat. Revoir le bilan dans 4 semaines.', { wrap: true, va: 'top', bg: C.gray, fc: C.grayD });
    B.brandFooter(35, 0, 4);
    return wb;
  }

  function tplCoach() {
    const wb = SE.newWorkbook('Gestion clients & facturation');
    wb.icon = 'users';
    const sh = wb.sheets[0];
    sh.name = 'Clients'; sh.tab = C.yellow; sh.grid = false;
    const B = new Builder(sh);
    B.widths([160, 130, 120, 90, 90, 100, 110, 120]);
    B.banner(0, 0, 7, 'GESTION CLIENTS', 'Suivi des abonnements, séances et paiements');
    B.row(3, 0, ['Client', 'Formule', 'Début', 'Séances/mois', 'Tarif séance', 'Montant mois', 'Paiement', 'Prochain bilan'], HDR);
    sh.freezeR = 4;
    const cl = [['Camille M.', 'Coaching premium', 3, 45, 'Payé'], ['Lucas D.', 'Programme en ligne', 0, 0, 'Payé'], ['Sarah B.', 'Duo', 8, 30, 'En attente'], ['Thomas R.', 'Coaching premium', 12, 40, 'Payé'], ['Inès K.', 'Préparation course', 4, 45, 'En retard'], ['Hugo P.', 'Programme en ligne', 0, 0, 'En attente']];
    const forfait = { 'Programme en ligne': 49 };
    cl.forEach((c, i) => {
      const r = 4 + i, R = r + 1, z = i % 2 ? C.gray : C.white;
      B.row(r, 0, [c[0], c[1], String(today() - 30 * (i + 1)), String(c[2]), String(c[3]), '=IF(B' + R + '="Programme en ligne";49;D' + R + '*E' + R + ')', c[4], '=EDATE(C' + R + ';' + (i % 3 + 1) + ')'],
        [{ bg: z, b: true }, { bg: z }, { bg: z, nf: 'date', ha: 'center' }, { bg: z, ha: 'center' }, { bg: z, nf: 'eur', ha: 'center' }, { bg: z, nf: 'eur', ha: 'center', b: true }, { bg: z, ha: 'center' }, { bg: z, nf: 'date', ha: 'center' }]);
    });
    void forfait;
    const last = 4 + 19;
    for (let r = 4 + cl.length; r <= last; r++) { const z = (r - 4) % 2 ? C.gray : C.white; B.style(r, 0, r, 7, { bg: z }); B.set(r, 5, '=IF(A' + (r + 1) + '="";"";IF(B' + (r + 1) + '="Programme en ligne";49;D' + (r + 1) + '*E' + (r + 1) + '))', { nf: 'eur', ha: 'center', b: true }); SE.setStyle(sh, r, 2, { nf: 'date', ha: 'center' }); SE.setStyle(sh, r, 4, { nf: 'eur', ha: 'center' }); }
    B.grid(3, 0, last, 7, '#D4D4D8');
    B.dv(4, 1, last, 1, ['Coaching premium', 'Programme en ligne', 'Duo', 'Préparation course', 'Séance découverte', 'Small group']);
    B.dv(4, 6, last, 6, ['Payé', 'En attente', 'En retard', 'Offert']);
    B.cf({ r1: 4, c1: 6, r2: last, c2: 6, type: 'eq', a: 'Payé', style: { bg: C.green, fc: C.greenD, b: true } });
    B.cf({ r1: 4, c1: 6, r2: last, c2: 6, type: 'eq', a: 'En attente', style: { bg: '#FFF3CD', fc: '#8A6D00', b: true } });
    B.cf({ r1: 4, c1: 6, r2: last, c2: 6, type: 'eq', a: 'En retard', style: { bg: C.red, fc: C.redD, b: true } });
    const t = last + 2;
    B.merge(t, 0, t, 3, 'CHIFFRE D\'AFFAIRES DU MOIS', { bg: C.black, fc: C.yellow, b: true, ind: 1 }); B.h(t, 28);
    const kpi = [['CA total', '=SUM(F5:F' + (last + 1) + ')'], ['Encaissé', '=SUMIF(G5:G' + (last + 1) + ';"Payé";F5:F' + (last + 1) + ')'], ['En attente', '=SUMIF(G5:G' + (last + 1) + ';"En attente";F5:F' + (last + 1) + ')+SUMIF(G5:G' + (last + 1) + ';"En retard";F5:F' + (last + 1) + ')'], ['Clients actifs', '=COUNTA(A5:A' + (last + 1) + ')'], ['Séances à donner', '=SUM(D5:D' + (last + 1) + ')']];
    kpi.forEach((k, i) => { B.merge(t + 1 + i, 0, t + 1 + i, 1, k[0], { b: true, ind: 1, bg: C.gray }); B.merge(t + 1 + i, 2, t + 1 + i, 3, k[1], { ha: 'center', b: true, fs: 14, nf: i < 3 ? 'eur' : '' }); });
    B.grid(t + 1, 0, t + 5, 3, C.grayM);
    sh.charts.push({ id: SE.uid(), type: 'pie', title: 'Répartition du CA', r: t, c: 5, w: 360, h: 240, labels: { r1: 4, c1: 0, r2: 9, c2: 0 }, series: [{ r1: 4, c1: 5, r2: 9, c2: 5, name: 'CA' }] });
    // Agenda
    const ag = SE.newSheet('Agenda', 40, 8);
    wb.sheets.push(ag);
    ag.tab = C.black; ag.grid = false;
    const A = new Builder(ag);
    A.widths([70, 120, 120, 120, 120, 120, 120, 120]);
    A.banner(0, 0, 7, 'AGENDA DE LA SEMAINE', 'Planifiez vos séances — les créneaux remplis se colorent automatiquement');
    A.row(3, 0, ['Heure', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'], { bg: C.black, fc: C.yellow, b: true, ha: 'center' });
    ag.freezeR = 4; ag.freezeC = 1;
    for (let h = 7; h <= 21; h++) {
      const r = 4 + h - 7;
      A.set(r, 0, (h < 10 ? '0' : '') + h + ':00', { b: true, ha: 'center', bg: C.gray });
      A.h(r, 34);
    }
    A.set(4, 1, 'Camille M.'); A.set(5, 3, 'Thomas R.'); A.set(11, 2, 'Sarah B. (duo)'); A.set(13, 4, 'Inès K.'); A.set(6, 6, 'Small group');
    A.grid(3, 0, 18, 7, '#D4D4D8');
    A.style(4, 1, 18, 7, { ha: 'center', wrap: true, fs: 11 });
    A.cf({ r1: 4, c1: 1, r2: 18, c2: 7, type: 'notempty', style: { bg: C.yellowM, b: true } });
    A.dv(4, 1, 18, 7, cl.map((c) => c[0]).concat(['Small group', 'Bloqué', 'Admin']));
    return wb;
  }

  function tplNutrition() {
    const wb = SE.newWorkbook('Plan nutrition');
    wb.icon = 'flame';
    const sh = wb.sheets[0];
    sh.name = 'Journée type'; sh.tab = '#43A047'; sh.grid = false;
    const B = new Builder(sh);
    B.widths([120, 210, 70, 70, 70, 70, 70]);
    B.banner(0, 0, 6, 'PLAN NUTRITION — JOURNÉE TYPE', 'Quantités en grammes · totaux et écarts calculés automatiquement');
    B.row(3, 0, ['Repas', 'Aliment', 'Quantité', 'Kcal', 'Prot.', 'Gluc.', 'Lip.'], HDR);
    const meals = [
      ['Petit-déj', 'Flocons d\'avoine', 80, 300, 10, 52, 6], ['', 'Skyr nature', 150, 95, 16, 6, 0.3], ['', 'Banane', 120, 108, 1.3, 25, 0.4],
      ['Déjeuner', 'Riz basmati (cuit)', 200, 260, 5, 56, 0.6], ['', 'Blanc de poulet', 150, 165, 34, 0, 3], ['', 'Légumes verts', 200, 60, 4, 8, 0.5], ['', 'Huile d\'olive', 10, 90, 0, 0, 10],
      ['Collation', 'Whey', 30, 120, 24, 3, 1.5], ['', 'Amandes', 25, 145, 5, 2, 12.5],
      ['Dîner', 'Patate douce', 250, 215, 4, 50, 0.3], ['', 'Saumon', 150, 300, 30, 0, 20], ['', 'Salade composée', 150, 40, 2, 6, 0.5]
    ];
    meals.forEach((m, i) => {
      const r = 4 + i;
      const isFirst = !!m[0];
      const z = ['Petit-déj', 'Collation'].includes(meals.slice(0, i + 1).filter((x) => x[0]).pop()[0]) ? C.white : C.gray;
      B.row(r, 0, [m[0], m[1], String(m[2]), String(m[3]), String(m[4]), String(m[5]), String(m[6])], [{ bg: isFirst ? C.dark : z, fc: isFirst ? C.yellow : C.ink, b: true }, { bg: z }, { bg: z, ha: 'center', nf: 'n0' }, { bg: z, ha: 'center', nf: 'n0' }, { bg: z, ha: 'center', nf: 'n1' }, { bg: z, ha: 'center', nf: 'n1' }, { bg: z, ha: 'center', nf: 'n1' }]);
    });
    const last = 4 + meals.length - 1, L = last + 1;
    B.grid(3, 0, last, 6, '#D4D4D8');
    const t = last + 1;
    B.merge(t, 0, t, 2, 'TOTAL', { bg: C.black, fc: C.yellow, b: true, ha: 'right' });
    ['D', 'E', 'F', 'G'].forEach((col, i) => B.set(t, 3 + i, '=SUM(' + col + '5:' + col + L + ')', { bg: C.black, fc: C.yellow, b: true, ha: 'center', nf: 'n0' }));
    B.merge(t + 1, 0, t + 1, 2, 'Objectif', { b: true, ha: 'right', bg: C.gray });
    ['2100', '150', '230', '65'].forEach((v, i) => B.set(t + 1, 3 + i, v, { bg: C.yellowM, ha: 'center', b: true }));
    B.merge(t + 2, 0, t + 2, 2, 'Atteint', { b: true, ha: 'right', bg: C.gray });
    ['D', 'E', 'F', 'G'].forEach((col, i) => B.set(t + 2, 3 + i, '=' + col + (t + 1) + '/' + col + (t + 2), { ha: 'center', nf: 'pct', b: true }));
    B.cf({ r1: t + 2, c1: 3, r2: t + 2, c2: 6, type: 'between', a: 0.9, b: 1.1, style: { bg: C.green, fc: C.greenD } });
    B.cf({ r1: t + 2, c1: 3, r2: t + 2, c2: 6, type: 'gt', a: 1.1, style: { bg: C.red, fc: C.redD } });
    B.grid(t, 0, t + 2, 6, '#D4D4D8');
    sh.charts.push({ id: SE.uid(), type: 'pie', title: 'Répartition des macros (g)', r: t + 4, c: 0, w: 380, h: 240, labels: { r1: 3, c1: 4, r2: 3, c2: 6 }, series: [{ r1: t, c1: 4, r2: t, c2: 6, name: 'Macros' }] });
    return wb;
  }

  function tplBudget() {
    const wb = SE.newWorkbook('Budget mensuel');
    wb.icon = 'calculator';
    const sh = wb.sheets[0];
    sh.name = 'Budget'; sh.grid = false; sh.tab = '#1A5FD0';
    const B = new Builder(sh);
    B.widths([180, 110, 110, 110, 30]);
    B.banner(0, 0, 3, 'BUDGET MENSUEL', 'Modèle généraliste — fonctionne comme un tableur classique');
    B.row(3, 0, ['Poste', 'Prévu', 'Réel', 'Écart'], HDR);
    const items = [['REVENUS', null], ['Salaire', 2400, 2400], ['Coaching', 800, 950], ['Autres', 100, 40], ['DÉPENSES', null], ['Loyer', 850, 850], ['Courses', 350, 392], ['Transport', 120, 98], ['Abonnement salle', 40, 40], ['Compléments', 60, 75], ['Loisirs', 150, 210], ['Épargne', 400, 400]];
    let r = 4; const rev = [], dep = [];
    items.forEach((it) => {
      if (it[1] === null) { B.merge(r, 0, r, 3, it[0], { bg: C.dark, fc: C.yellow, b: true, ind: 1 }); r++; return; }
      const R = r + 1;
      B.row(r, 0, [it[0], String(it[1]), String(it[2]), '=C' + R + '-B' + R], [{ ind: 1 }, { nf: 'eur', ha: 'right' }, { nf: 'eur', ha: 'right' }, { nf: 'eur', ha: 'right', b: true }]);
      (rev.length < 3 && dep.length === 0 ? rev : dep).push(R);
      r++;
    });
    B.grid(3, 0, r - 1, 3, '#D4D4D8');
    B.cf({ r1: 5, c1: 3, r2: 7, c2: 3, type: 'lt', a: 0, style: { fc: C.redD } });
    B.cf({ r1: 9, c1: 3, r2: r - 1, c2: 3, type: 'gt', a: 0, style: { fc: C.redD } });
    B.cf({ r1: 9, c1: 3, r2: r - 1, c2: 3, type: 'lte', a: 0, style: { fc: C.greenD } });
    r++;
    const sumOf = (col, rows) => '=' + rows.map((x) => col + x).join('+');
    B.row(r, 0, ['Total revenus', sumOf('B', rev), sumOf('C', rev), ''], [{ b: true, bg: C.gray }, { b: true, nf: 'eur', bg: C.gray }, { b: true, nf: 'eur', bg: C.gray }, { bg: C.gray }]);
    B.row(r + 1, 0, ['Total dépenses', sumOf('B', dep), sumOf('C', dep), ''], [{ b: true, bg: C.gray }, { b: true, nf: 'eur', bg: C.gray }, { b: true, nf: 'eur', bg: C.gray }, { bg: C.gray }]);
    B.row(r + 2, 0, ['Solde', '=B' + (r + 1) + '-B' + (r + 2), '=C' + (r + 1) + '-C' + (r + 2), ''], [{ b: true, bg: C.yellow }, { b: true, nf: 'eur', bg: C.yellow }, { b: true, nf: 'eur', bg: C.yellow, fs: 15 }, { bg: C.yellow }]);
    sh.charts.push({ id: SE.uid(), type: 'bar', title: 'Dépenses prévues vs réelles', r: 3, c: 5, w: 460, h: 260, labels: { r1: 9, c1: 0, r2: r - 2, c2: 0 }, series: [{ r1: 9, c1: 1, r2: r - 2, c2: 1, name: 'Prévu' }, { r1: 9, c1: 2, r2: r - 2, c2: 2, name: 'Réel' }] });
    return wb;
  }

  function tplWeekly() {
    const wb = SE.newWorkbook('Semaine type — planning sportif');
    wb.icon = 'calendar-days';
    const sh = wb.sheets[0];
    sh.name = 'Semaine'; sh.grid = false; sh.tab = C.yellow;
    const B = new Builder(sh);
    B.widths([110, 140, 140, 140, 140, 140, 140, 140]);
    B.banner(0, 0, 7, 'MA SEMAINE D\'ENTRAÎNEMENT', 'Programme visuel à partager — exportez-le en image pour vos clients');
    const days = ['', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];
    B.row(3, 0, days, { bg: C.black, fc: C.yellow, b: true, ha: 'center', fs: 12 });
    B.h(3, 32);
    const rows = [['Séance', 'Push', 'Course EF', 'Pull', 'Repos', 'Legs', 'Sortie longue', 'Repos'], ['Durée', '60 min', '45 min', '60 min', '—', '70 min', '75 min', '—'], ['Intensité', 'RPE 8', 'Z2', 'RPE 8', '—', 'RPE 8', 'Z2', '—'], ['Focus', 'Pecs / épaules', 'Endurance', 'Dos / biceps', 'Mobilité 15 min', 'Jambes / abdos', 'Aérobie', 'Récupération'], ['Fait', 'FAUX', 'FAUX', 'FAUX', 'FAUX', 'FAUX', 'FAUX', 'FAUX']];
    rows.forEach((rw, i) => {
      const r = 4 + i;
      B.row(r, 0, rw, rw.map((v, j) => (j === 0 ? { bg: C.dark, fc: C.white, b: true, ind: 1 } : Object.assign({ ha: 'center', wrap: true, bg: j % 2 ? C.white : C.gray }, i === 0 ? { b: true, fs: 14 } : {}, i === 4 ? { chk: true } : {}))));
      B.h(r, i === 0 ? 40 : 30);
    });
    B.grid(3, 0, 8, 7, '#D4D4D8');
    B.cf({ r1: 4, c1: 1, r2: 4, c2: 7, type: 'eq', a: 'Repos', style: { bg: C.green, fc: C.greenD } });
    B.dv(4, 1, 4, 7, ['Push', 'Pull', 'Legs', 'Full body', 'Haut du corps', 'Bas du corps', 'Course EF', 'Fractionné', 'Sortie longue', 'HIIT', 'Mobilité', 'Repos']);
    B.brandFooter(10, 0, 7);
    return wb;
  }

  function tplBlankSport() {
    const wb = SE.newWorkbook('Programme vierge');
    wb.icon = 'clipboard-list';
    const sh = wb.sheets[0];
    sh.name = 'Programme'; sh.grid = false; sh.tab = C.yellow;
    const B = new Builder(sh);
    B.widths([210, 62, 62, 78, 52, 62, 76, 46, 220]);
    B.banner(0, 0, 8, 'MON PROGRAMME', 'Tapez le nom de l\'athlète ici · utilisez Sport → Exercices pour remplir rapidement');
    sh.freezeR = 2;
    let r = 3;
    for (let d = 1; d <= 3; d++) {
      B.merge(r, 0, r, 8, 'SÉANCE ' + d, { bg: C.yellow, b: true, ind: 1, fs: 13 }); B.h(r, 30); r++;
      B.row(r, 0, ['Exercice', 'Séries', 'Reps', 'Charge', 'RPE', 'Repos', 'Tempo', 'Fait', 'Notes'], HDR); r++;
      const f = r;
      for (let i = 0; i < 6; i++, r++) { const z = i % 2 ? C.gray : C.white; B.style(r, 0, r, 8, { bg: z }); SE.setStyle(sh, r, 3, { nf: 'kg', ha: 'center' }); SE.setStyle(sh, r, 1, { ha: 'center' }); SE.setStyle(sh, r, 2, { ha: 'center' }); SE.setStyle(sh, r, 4, { ha: 'center', nf: 'rpe' }); SE.setStyle(sh, r, 5, { ha: 'center' }); SE.setStyle(sh, r, 6, { ha: 'center' }); B.set(r, 7, 'FAUX', { chk: true }); }
      B.grid(f - 1, 0, r - 1, 8, '#D4D4D8');
      B.dv(f, 0, r - 1, 0, SE.allExercises());
      B.merge(r, 0, r, 2, 'Tonnage', { ha: 'right', i: true, fc: C.grayD });
      B.set(r, 3, '=TONNAGE(B' + (f + 1) + ':B' + r + ';C' + (f + 1) + ':C' + r + ';D' + (f + 1) + ':D' + r + ')', { nf: 'kg', b: true, ha: 'center' });
      r += 2;
    }
    B.brandFooter(r, 0, 8);
    return wb;
  }

  SE.TEMPLATES = [
    { id: 'gen', name: 'Générateur de programme', desc: 'Assistant : objectif, niveau, fréquence, 1RM → programme complet', icon: 'wand-sparkles', color: '#FFC72C', wizard: true },
    { id: 'force', name: 'Force 3 jours', desc: 'Squat / DC / SDT · 8 semaines · % 1RM automatiques', icon: 'dumbbell', color: '#111114', make: () => SE.generateProgram({ goal: 'force', days: 3, weeks: 8, athlete: 'Athlète', title: 'Programme Force — 8 semaines' }) },
    { id: 'hyper', name: 'Hypertrophie PPL', desc: 'Push / Pull / Legs · 6 semaines · décharge', icon: 'trophy', color: '#E53935', make: () => SE.generateProgram({ goal: 'hypertrophie', days: 3, weeks: 6, athlete: 'Athlète', title: 'Hypertrophie PPL — 6 semaines' }) },
    { id: 'ul', name: 'Upper / Lower 4 jours', desc: 'Haut / Bas · 8 semaines · force + volume', icon: 'columns-3', color: '#1A5FD0', make: () => SE.generateProgram({ goal: 'hypertrophie', days: 4, weeks: 8, athlete: 'Athlète', title: 'Upper / Lower — 8 semaines' }) },
    { id: 'deb', name: 'Full body débutant', desc: '3 séances · 4 semaines · technique', icon: 'sparkles', color: '#43A047', make: () => SE.generateProgram({ goal: 'debutant', days: 3, weeks: 4, athlete: 'Athlète', title: 'Full body débutant — 4 semaines' }) },
    { id: 'perte', name: 'Perte de poids', desc: 'Circuits métaboliques · 6 semaines', icon: 'flame', color: '#FB8C00', make: () => SE.generateProgram({ goal: 'perte', days: 3, weeks: 6, athlete: 'Athlète', title: 'Perte de poids — circuits' }) },
    { id: 'run', name: 'Plan 10 km', desc: '8 semaines · allures VMA · zones FC', icon: 'footprints', color: '#00ACC1', make: tplRunning },
    { id: 'hiit', name: 'Circuit HIIT', desc: 'Travail / repos · durée totale · kcal', icon: 'zap', color: '#E53935', make: tplHIIT },
    { id: 'week', name: 'Semaine type', desc: 'Planning visuel à partager en image', icon: 'calendar-days', color: '#8E24AA', make: tplWeekly },
    { id: 'body', name: 'Suivi corporel', desc: 'Poids · mensurations · IMC · graphiques', icon: 'activity', color: '#8E24AA', make: tplBody },
    { id: '1rm', name: 'Calculateur 1RM', desc: 'Table des % et charges RPE', icon: 'calculator', color: '#111114', make: tpl1RM },
    { id: 'client', name: 'Fiche bilan client', desc: 'Anamnèse · MB / DET · macros · tests', icon: 'user', color: '#FFC72C', make: tplClient },
    { id: 'nutri', name: 'Plan nutrition', desc: 'Repas · macros · objectifs', icon: 'heart-pulse', color: '#43A047', make: tplNutrition },
    { id: 'coach', name: 'Clients & facturation', desc: 'Abonnements · paiements · agenda', icon: 'users', color: '#1A5FD0', make: tplCoach },
    { id: 'blank-sport', name: 'Programme vierge', desc: '3 séances prêtes à remplir', icon: 'clipboard-list', color: '#3F3F46', make: tplBlankSport },
    { id: 'budget', name: 'Budget mensuel', desc: 'Modèle généraliste (hors sport)', icon: 'calculator', color: '#607D8B', make: tplBudget },
    { id: 'blank', name: 'Classeur vide', desc: 'Tableur classique', icon: 'file-spreadsheet', color: '#9E9E9E', make: () => SE.newWorkbook('Nouveau classeur') }
  ];

  // ---------- Styles de tableau ----------
  SE.TABLE_STYLES = [
    { name: 'SuperEssence', head: { bg: '#111114', fc: '#FFC72C' }, band: ['#FFFFFF', '#FFF4D1'], line: '#E4E4E7' },
    { name: 'Jaune', head: { bg: '#FFC72C', fc: '#111114' }, band: ['#FFFFFF', '#FFF8E1'], line: '#F0D98A' },
    { name: 'Graphite', head: { bg: '#3F3F46', fc: '#FFFFFF' }, band: ['#FFFFFF', '#F4F4F5'], line: '#D4D4D8' },
    { name: 'Océan', head: { bg: '#1A5FD0', fc: '#FFFFFF' }, band: ['#FFFFFF', '#E3EEFF'], line: '#C5D7F5' },
    { name: 'Forêt', head: { bg: '#2E7D32', fc: '#FFFFFF' }, band: ['#FFFFFF', '#E8F5E9'], line: '#C8E6C9' },
    { name: 'Rouge', head: { bg: '#C62828', fc: '#FFFFFF' }, band: ['#FFFFFF', '#FDECEA'], line: '#F5C6C3' },
    { name: 'Violet', head: { bg: '#6A1B9A', fc: '#FFFFFF' }, band: ['#FFFFFF', '#F3E5F5'], line: '#E1BEE7' },
    { name: 'Orange', head: { bg: '#EF6C00', fc: '#FFFFFF' }, band: ['#FFFFFF', '#FFF3E0'], line: '#FFE0B2' }
  ];
  SE.applyTableStyle = function (sh, sel, st) {
    for (let r = sel.r1; r <= sel.r2; r++) for (let c = sel.c1; c <= sel.c2; c++) {
      const head = r === sel.r1;
      SE.setStyle(sh, r, c, Object.assign({ bt: 1, bb: 1, bl: 1, br: 1, bdc: st.line }, head ? { bg: st.head.bg, fc: st.head.fc, b: true, ha: 'center' } : { bg: st.band[(r - sel.r1 + 1) % 2], fc: null }));
    }
  };

  // ---------- Chrono / minuteur ----------
  let audioCtx = null;
  SE.beep = function (freq, dur, n) {
    if (!SE.settings.beep) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audioCtx.currentTime;
      for (let i = 0; i < (n || 1); i++) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = freq || 880; o.type = 'square';
        g.gain.setValueAtTime(0.0001, t0 + i * 0.25);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.25 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.25 + (dur || 0.15));
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t0 + i * 0.25); o.stop(t0 + i * 0.25 + (dur || 0.15) + 0.05);
      }
    } catch (e) { /* audio indisponible */ }
    if (SE.settings.haptics && navigator.vibrate) navigator.vibrate(n > 1 ? [200, 100, 200] : 120);
  };
})();
