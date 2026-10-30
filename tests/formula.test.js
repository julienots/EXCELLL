/* Tests du moteur de formules et des modèles — node tests/formula.test.js */
'use strict';
const path = require('path');
global.window = global;
global.localStorage = { getItem() { return null; }, setItem() {} };
['formula', 'model', 'sport'].forEach((f) => require(path.join(__dirname, '..', 'www', 'js', f + '.js')));
const SE = global.SE;

let fails = 0, n = 0;
function eq(name, got, want) {
  n++;
  const ok = typeof want === 'number' ? Math.abs(got - want) < 1e-6 : got === want;
  if (!ok) { fails++; console.error('✗', name, '→', got, '≠', want); }
}

const wb = SE.newWorkbook('t');
const sh = wb.sheets[0];
const set = (a, v) => { const p = SE.parseAddr(a); SE.setRaw(sh, p.r, p.c, v); };
const calc = new SE.Calc(wb);
const val = (a) => { calc.invalidate(); const p = SE.parseAddr(a); const v = calc.value(0, p.r, p.c); return SE.isErr(v) ? v.err : v; };

set('A1', '100'); set('A2', '5'); set('A3', '2,5'); set('A4', 'Squat'); set('A5', '80%');
set('B1', '=A1+A2*2'); eq('priorité', val('B1'), 110);
set('B1', '=(A1+A2)*2'); eq('parenthèses', val('B1'), 210);
set('B1', '=-2^2'); eq('moins unaire', val('B1'), 4);
set('B1', '=SOMME(A1:A3)'); eq('SOMME fr', val('B1'), 107.5);
set('B1', '=SUM(A1,A2)'); eq('SUM en', val('B1'), 105);
set('B1', '=MOYENNE(A1;A2)'); eq('MOYENNE', val('B1'), 52.5);
set('B1', '=SI(A1>50;"lourd";"léger")'); eq('SI', val('B1'), 'lourd');
set('B1', '=NB.SI(A1:A5;">4")'); eq('NB.SI', val('B1'), 2);
set('B1', '=RECHERCHEV("Squat";A4:A5;1;FAUX)'); eq('RECHERCHEV', val('B1'), 'Squat');
set('B1', '=A4&" "&A1'); eq('concat', val('B1'), 'Squat 100');
set('B1', '=1/0'); eq('div0', val('B1'), '#DIV/0!');
set('B1', '=SIERREUR(1/0;0)'); eq('SIERREUR', val('B1'), 0);
set('B1', '=B1'); eq('cycle', val('B1'), '#CYCLE!');
set('B1', '=INCONNUE(1)'); eq('nom inconnu', val('B1'), '#NAME?');
set('B1', '=ONERM(A1;A2)'); eq('ONERM Epley', val('B1'), 116.666666667);
set('B1', '=CHARGE(120;A5)'); eq('CHARGE %', val('B1'), 95);
set('B1', '=CHARGE(120;80;5)'); eq('CHARGE pas 5', val('B1'), 95);
set('B1', '=ALLURE(10;"50:00")'); eq('ALLURE', val('B1'), '5:00');
set('B1', '=VITESSE(10;"50:00")'); eq('VITESSE', val('B1'), 12);
set('B1', '=ALLUREVMA(15;80%)'); eq('ALLUREVMA', val('B1'), '5:00');
set('B1', '=TEMPSCOURSE(21.1;"5:00")'); eq('TEMPSCOURSE', val('B1'), '1:45:30');
set('B1', '=ROUND(IMC(75;180);1)'); eq('IMC', val('B1'), 23.1);
set('B1', '=FCMAX(30)'); eq('FCMAX', val('B1'), 190);
set('B1', '=TONNAGE({3;3};{10;8};{100;50})'); eq('TONNAGE', val('B1'), 4200);
set('B1', '=RPEPCT(1;10)'); eq('RPE 1@10', val('B1'), 1);
set('B1', '=MMSS(SECONDES("1:30")+30)'); eq('durées', val('B1'), '2:00');
set('B1', '=DATE(2026;1;31)'); eq('DATE', val('B1'), 46053);
set('B1', '=TEXTE(0.756;"0.0%")'); eq('TEXTE %', val('B1'), '75,6%');

eq('décalage formule', SE.shiftFormula('=A1+$B$2+B$3+"A1"', 1, 1), '=B2+$B$2+C$3+"A1"');

// insertion de ligne : les références suivent
const wb2 = SE.newWorkbook('s');
const s2 = wb2.sheets[0];
SE.setRaw(s2, 0, 0, '1'); SE.setRaw(s2, 1, 0, '2'); SE.setRaw(s2, 2, 0, '=SUM(A1:A2)');
SE.structural(wb2, 0, 'r', 1, 1);
eq('insertion ligne', s2.cells['3,0'].v, '=SUM(A1:A3)');
SE.structural(wb2, 0, 'r', 0, -1);
eq('suppression ligne', s2.cells['2,0'].v, '=SUM(A1:A2)');

// tous les modèles se calculent sans erreur
for (const t of SE.TEMPLATES) {
  if (!t.make) continue;
  const w = t.make();
  const c = new SE.Calc(w);
  w.sheets.forEach((s, si) => {
    for (const k in s.cells) {
      const [r, cc] = k.split(',').map(Number);
      const v = c.value(si, r, cc);
      n++;
      if (SE.isErr(v)) { fails++; console.error('✗ modèle', t.id, s.name + '!' + SE.addr(r, cc), s.cells[k].v, v.err); }
    }
  });
}
for (const goal of Object.keys(SE.GOALS)) for (const days of [2, 3, 4, 5, 6]) {
  const w = SE.generateProgram({ goal, days, weeks: 5, level: 'avance' });
  const c = new SE.Calc(w);
  w.sheets.forEach((s, si) => { for (const k in s.cells) { const [r, cc] = k.split(',').map(Number); n++; const v = c.value(si, r, cc); if (SE.isErr(v)) { fails++; console.error('✗ générateur', goal, days, s.name, SE.addr(r, cc), v.err); } } });
}

console.log(fails ? `${fails} échec(s) sur ${n} vérifications` : `✓ ${n} vérifications OK`);
process.exit(fails ? 1 : 0);
