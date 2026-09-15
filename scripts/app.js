window.initDashboard = function(DATA){
"use strict";
var TEAM_COLOR = { 'FS WEST':'var(--s1)', 'FS EAST':'var(--s2)', 'FS Central':'var(--s3)', 'FS South':'var(--s4)' };
var GROUP_COLOR = { 'CBC':'var(--s1)', 'COA':'var(--s2)', 'HISCL':'var(--s3)', 'Urine':'var(--s4)', 'A1c':'var(--s5)', 'RF-500':'var(--s6)' };
var BUCKET_COLOR = { '고장수리':'var(--s1)', 'PM':'var(--s3)', '설치이전':'var(--s4)', 'Cal평가':'var(--s5)', '기타':'var(--text-muted)' };
var MONTH_LABEL = {1:'1월',2:'2월',3:'3월',4:'4월',5:'5월',6:'6월',7:'7월',8:'8월',9:'9월',10:'10월',11:'11월',12:'12월'};

var state = { tab:'overview', period:'이번 년도', team:'FS WEST', person:null, personSearch:'', sortKey:'total', sortDir:'desc', hospSortKey:'this_revisit', hospSortDir:'desc', lbSortKey:'score', lbSortDir:'desc' };

// pick a default person
(function(){
  var firstTeamMembers = DATA.team[state.team].members;
  state.person = firstTeamMembers[0];
})();

function resolveVar(v){
  if (typeof v !== 'string' || v.indexOf('var(') !== 0) return v;
  var name = v.slice(4, -1);
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function fmt(n){
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('ko-KR');
}
function fmt1(n){
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('ko-KR', {maximumFractionDigits:1, minimumFractionDigits:1});
}
function pctStr(n){ return (n===null||n===undefined||isNaN(n)) ? '—' : n.toFixed(1)+'%'; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function deltaBadge(cur, prev, higherIsBetter){
  if (cur === null || prev === null || prev === undefined || cur === undefined || prev === 0) return '<span class="pill neutral">신규</span>';
  var d = ((cur - prev) / Math.abs(prev)) * 100;
  var up = d > 0.5, down = d < -0.5;
  var good = higherIsBetter ? up : down;
  var cls = (up || down) ? (good ? 'delta-down' : 'delta-up') : 'delta-flat';
  // delta-down class = green (favorable), delta-up = red (unfavorable) per our CSS convention
  var arrow = up ? '▲' : (down ? '▼' : '·');
  return '<span class="stat-delta '+cls+'">'+arrow+' '+Math.abs(d).toFixed(1)+'% <span style="color:var(--text-muted);font-weight:500;">YoY</span></span>';
}

function targetPill(value, target, mode){
  // mode: 'lower-better' (mttr, revisit) or 'higher-better' (ftfr)
  if (value === null || value === undefined) return '<span class="pill neutral">데이터없음</span>';
  var ok = mode === 'higher-better' ? value >= target : value <= target;
  var close = mode === 'higher-better' ? value >= target*0.92 : value <= target*1.15;
  var cls = ok ? 'good' : (close ? 'warn' : 'bad');
  var label = ok ? '목표 달성' : (close ? '목표 근접' : '목표 미달');
  return '<span class="pill '+cls+'">'+label+'</span>';
}

/* ---------------- SVG chart helpers ---------------- */
var NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs){
  var e = document.createElementNS(NS, tag);
  for (var k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function showTip(evt, html){
  var tip = document.getElementById('tooltip');
  tip.innerHTML = html;
  tip.style.opacity = 1;
  var x = evt.clientX + 14, y = evt.clientY + 14;
  var tw = 240, th = 80;
  if (x + tw > window.innerWidth) x = evt.clientX - tw - 14;
  if (y + th > window.innerHeight) y = evt.clientY - th - 14;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
function hideTip(){ document.getElementById('tooltip').style.opacity = 0; }

// single-series categorical bar chart
function barChart(container, cats, values, colors, opts){
  opts = opts || {};
  container.innerHTML = '';
  var W = container.clientWidth || 600, H = opts.height || 220;
  var padL = 40, padR = 14, padT = 16, padB = 30;
  if (W < padL + padR + 80) W = 600;
  var innerW = W - padL - padR, innerH = H - padT - padB;
  var maxV = Math.max(1, opts.maxValue || Math.max.apply(null, values.concat([opts.targetLine||0])) * 1.18);
  var svg = svgEl('svg', {class:'chart', viewBox:'0 0 '+W+' '+H, height:H});
  // gridlines
  var ticks = 4;
  for (var i=0;i<=ticks;i++){
    var gy = padT + innerH - (innerH*i/ticks);
    svg.appendChild(svgEl('line', {class:'grid-line', x1:padL, x2:W-padR, y1:gy, y2:gy}));
    var t = svgEl('text', {x:padL-8, y:gy+3, 'text-anchor':'end', 'font-size':'10'});
    t.textContent = fmt(Math.round(maxV*i/ticks));
    svg.appendChild(t);
  }
  var n = cats.length;
  var slot = innerW/n;
  var bw = Math.max(6, Math.min(46, slot*0.52));
  values.forEach(function(v, idx){
    var cx = padL + slot*idx + slot/2;
    var bh = innerH * (v/maxV);
    var x = cx - bw/2, y = padT + innerH - bh;
    var color = resolveVar(colors[idx % colors.length]);
    var rect = svgEl('rect', {x:x, y:y, width:bw, height:Math.max(bh,1.5), rx:4, fill:color});
    rect.style.cursor='pointer';
    rect.addEventListener('mousemove', function(e){ showTip(e, '<b>'+esc(cats[idx])+'</b>'+fmt(v)+(opts.unit||'')); });
    rect.addEventListener('mouseleave', hideTip);
    svg.appendChild(rect);
    if (opts.showValues !== false){
      var vl = svgEl('text', {class:'value-label', x:cx, y:y-6, 'text-anchor':'middle'});
      vl.textContent = fmt(v);
      svg.appendChild(vl);
    }
    var lbl = svgEl('text', {class:'bar-label axis-label', x:cx, y:H-10, 'text-anchor':'middle'});
    lbl.textContent = opts.catLabels ? opts.catLabels[idx] : cats[idx];
    svg.appendChild(lbl);
  });
  if (opts.targetLine){
    var ty = padT + innerH - innerH*(opts.targetLine/maxV);
    svg.appendChild(svgEl('line', {class:'target-line', x1:padL, x2:W-padR, y1:ty, y2:ty}));
    var tt = svgEl('text', {x:W-padR, y:ty-4, 'text-anchor':'end', 'font-size':'10', fill:resolveVar('var(--text-muted)')});
    tt.textContent = '목표 '+opts.targetLine+(opts.unit||'');
    svg.appendChild(tt);
  }
  container.appendChild(svg);
}

// grouped bar chart: 2 series
function groupedBarChart(container, cats, seriesArr, opts){
  opts = opts || {};
  container.innerHTML = '';
  var W = container.clientWidth || 600, H = opts.height || 230;
  var padL = 40, padR = 14, padT = 16, padB = 30;
  if (W < padL + padR + 80) W = 600;
  var innerW = W - padL - padR, innerH = H - padT - padB;
  var allVals = [];
  seriesArr.forEach(function(s){ allVals = allVals.concat(s.values); });
  var maxV = Math.max(1, Math.max.apply(null, allVals) * 1.2);
  var svg = svgEl('svg', {class:'chart', viewBox:'0 0 '+W+' '+H, height:H});
  var ticks = 4;
  for (var i=0;i<=ticks;i++){
    var gy = padT + innerH - (innerH*i/ticks);
    svg.appendChild(svgEl('line', {class:'grid-line', x1:padL, x2:W-padR, y1:gy, y2:gy}));
    var t = svgEl('text', {x:padL-8, y:gy+3, 'text-anchor':'end', 'font-size':'10'});
    t.textContent = fmt(Math.round(maxV*i/ticks));
    svg.appendChild(t);
  }
  var n = cats.length, ns = seriesArr.length;
  var slot = innerW/n;
  var groupW = Math.min(64, slot*0.7);
  var bw = Math.max(4, groupW/ns - 3);
  cats.forEach(function(cat, ci){
    var gx = padL + slot*ci + slot/2 - groupW/2;
    seriesArr.forEach(function(s, si){
      var v = s.values[ci];
      var bh = innerH * (v/maxV);
      var x = gx + si*(bw+3), y = padT + innerH - bh;
      var rect = svgEl('rect', {x:x, y:y, width:bw, height:Math.max(bh,1.5), rx:3, fill:resolveVar(s.color)});
      rect.style.cursor='pointer';
      rect.addEventListener('mousemove', function(e){ showTip(e, '<b>'+esc(cat)+'</b>'+esc(s.name)+': '+fmt(v)+(opts.unit||'')); });
      rect.addEventListener('mouseleave', hideTip);
      svg.appendChild(rect);
    });
    var lbl = svgEl('text', {class:'bar-label axis-label', x:padL+slot*ci+slot/2, y:H-10, 'text-anchor':'middle'});
    lbl.textContent = cat;
    svg.appendChild(lbl);
  });
  container.appendChild(svg);
  renderLegend(container, seriesArr.map(function(s){return {label:s.name, color:s.color};}));
}

// line chart: multi-series over month index, with dots + hover crosshair
function lineChart(container, months, seriesArr, opts){
  opts = opts || {};
  container.innerHTML = '';
  var W = container.clientWidth || 600, H = opts.height || 230;
  var padL = 40, padR = 16, padT = 16, padB = 26;
  if (W < padL + padR + 80) W = 600;
  var innerW = W - padL - padR, innerH = H - padT - padB;
  var allVals = [0];
  seriesArr.forEach(function(s){ months.forEach(function(m){ if (s.values[m] !== undefined) allVals.push(s.values[m]); }); });
  var maxV = Math.max(1, Math.max.apply(null, allVals) * 1.18);
  var svg = svgEl('svg', {class:'chart', viewBox:'0 0 '+W+' '+H, height:H});
  var ticks = 4;
  for (var i=0;i<=ticks;i++){
    var gy = padT + innerH - (innerH*i/ticks);
    svg.appendChild(svgEl('line', {class:'grid-line', x1:padL, x2:W-padR, y1:gy, y2:gy}));
    var t = svgEl('text', {x:padL-8, y:gy+3, 'text-anchor':'end', 'font-size':'10'});
    t.textContent = fmt(Math.round(maxV*i/ticks));
    svg.appendChild(t);
  }
  var n = months.length;
  var xFor = function(idx){ return n <= 1 ? padL+innerW/2 : padL + innerW*idx/(n-1); };
  months.forEach(function(m, idx){
    var lbl = svgEl('text', {class:'axis-label', x:xFor(idx), y:H-8, 'text-anchor':'middle', 'font-size':'10'});
    lbl.textContent = MONTH_LABEL[m];
    svg.appendChild(lbl);
  });
  seriesArr.forEach(function(s){
    var pts = [];
    months.forEach(function(m, idx){
      var v = s.values[m];
      if (v === undefined || v === null) return;
      pts.push([xFor(idx), padT + innerH - innerH*(v/maxV), v, idx]);
    });
    if (pts.length === 0) return;
    var d = pts.map(function(p,i){ return (i===0?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1); }).join(' ');
    svg.appendChild(svgEl('path', {d:d, fill:'none', stroke:resolveVar(s.color), 'stroke-width':2, 'stroke-linecap':'round', 'stroke-linejoin':'round'}));
    pts.forEach(function(p){
      var c = svgEl('circle', {cx:p[0], cy:p[1], r:3.4, fill:resolveVar('var(--surface)'), stroke:resolveVar(s.color), 'stroke-width':2});
      c.style.cursor = 'pointer';
      c.addEventListener('mousemove', function(e){ showTip(e, '<b>'+MONTH_LABEL[months[p[3]]]+'</b>'+esc(s.name)+': '+fmt(p[2])+(opts.unit||'')); });
      c.addEventListener('mouseleave', hideTip);
      svg.appendChild(c);
    });
  });
  container.appendChild(svg);
  renderLegend(container, seriesArr.map(function(s){return {label:s.name, color:s.color, line:true};}));
}

function renderLegend(container, items){
  var leg = document.createElement('div');
  leg.className = 'legend';
  items.forEach(function(it){
    var el = document.createElement('span');
    el.className = 'item';
    el.innerHTML = '<span class="'+(it.line?'line-swatch':'swatch')+'" style="background:'+resolveVar(it.color)+'"></span>'+esc(it.label);
    leg.appendChild(el);
  });
  container.appendChild(leg);
}

/* ---------------- data helpers ---------------- */
function groupCaseArr(entry, period){
  return DATA.groups.map(function(g){ return (entry.group_case[period]||{})[g] || 0; });
}
function bucketCaseArr(entry, period){
  return DATA.buckets.map(function(b){ return (entry.case[period]||{})[b] || 0; });
}
function mttrRepairAvg(entry, period){
  var m = entry.mttr[period] || {};
  var sum=0, n=0;
  DATA.groups.forEach(function(g){ if (m[g]){ sum += m[g].avg*m[g].n; n += m[g].n; } });
  return n ? sum/n : null;
}
// Sysmex Korea fiscal year runs Apr->Mar, so trend charts order months
// fiscal-chronologically (Apr first, Mar last) rather than calendar-numeric.
function fiscalOrder(m){ return m >= 4 ? m - 4 : m + 8; }
function monthsUnion(entryA, entryB){
  var set = {};
  Object.keys(entryA||{}).forEach(function(k){ set[k]=1; });
  Object.keys(entryB||{}).forEach(function(k){ set[k]=1; });
  return Object.keys(set).map(Number).sort(function(a,b){return fiscalOrder(a)-fiscalOrder(b);});
}
function teamRevisit(team, period){
  var r = DATA.revisit[team];
  var key = period === '이번 년도' ? ['this_revisit','this_ftfr'] : period === '직전 년도' ? ['last_revisit','last_ftfr'] : ['cum_revisit','cum_ftfr'];
  var tt = r.team_total;
  var map = { this_revisit:'이번년도재방문율', this_ftfr:'이번년도FTFR', last_revisit:'직전년도재방문율', last_ftfr:'직전년도FTFR', cum_revisit:'재방문율', cum_ftfr:'FTFR' };
  return { revisit: tt[map[key[0]]], ftfr: tt[map[key[1]]], reliable: r.reliable };
}

/* ================= RENDER: OVERVIEW ================= */
function renderOverview(){
  var el = document.getElementById('panel-overview');
  var period = state.period;
  var company = DATA.company;
  var totalCase = company.total_case[period];
  var totalCasePrevYoY = period === '이번 년도' ? company.total_case['직전 년도'] : null;
  var mttr = mttrRepairAvg(company, period);
  var mttrPrevYoY = period === '이번 년도' ? mttrRepairAvg(company, '직전 년도') : null;

  var reliableTeams = DATA.teams.filter(function(t){ return DATA.revisit[t].reliable; });
  var rvVals = reliableTeams.map(function(t){ return teamRevisit(t, period).revisit; }).filter(function(v){return v!==null&&v!==undefined;});
  var ftfrVals = reliableTeams.map(function(t){ return teamRevisit(t, period).ftfr; }).filter(function(v){return v!==null&&v!==undefined;});
  var avgRevisit = rvVals.length ? rvVals.reduce(function(a,b){return a+b;},0)/rvVals.length : null;
  var avgFtfr = ftfrVals.length ? ftfrVals.reduce(function(a,b){return a+b;},0)/ftfrVals.length : null;

  var html = '';
  html += '<div class="caveat"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>'+
    '<div><b>데이터 안내.</b> 원본 서비스 요청 원시 데이터(담당자·작업시간·거래처 등 4만여 건, 기준일 '+DATA.data_snapshot_date+')를 직접 재집계했습니다. '+
    '기간은 Sysmex Korea 회계연도(FY, 매년 4월 시작~익년 3월 종료) 기준이며, 처리 건수·MTTR은 전 인원 동일 기준으로 계산됩니다. '+
    '<b>고장수리 작업시간이 500분을 초과하는 건은 입력 오류로 간주하여 MTTR 통계에서 제외</b>했습니다. '+
    '재방문율/FTFR('+DATA.revisit_snapshot_date+' 기준)은 원본 시트 수식(동일 거래처/장비가 14일 이내 고장수리·PM으로 재방문한 경우)을 그대로 재현해 원시 데이터에서 직접 계산했으며, 4개 팀 모두 동일한 방식으로 계산되어 <b>FS EAST 팀도 다른 팀과 동일하게</b> 정상 표시됩니다. '+
    '<b>KPI 종합 점수</b>는 업무 종류별 가중치를 적용해 <b>담당자로 등록된 업무</b>만 합산한 값이며, 필수 참석자로만 등록된 지원 업무는 원본 가중식을 재현할 수 없어 점수에 포함하지 않았습니다(참고용 지표). '+
    '<b>김민결</b>은 요청에 따라 이 대시보드에서 제외되었습니다(인원 '+Object.keys(DATA.person).length+'명 기준).</div></div>';

  html += '<div class="block grid grid-4">'+
    statTile('총 처리 건수', fmt(totalCase), '건', deltaBadge(totalCase, totalCasePrevYoY, false), DATA.period_label[period])+
    statTile('평균 MTTR (고장수리)', fmt1(mttr), '분', deltaBadge(mttr, mttrPrevYoY, true)+' '+targetPill(mttr, DATA.benchmarks.mttr_target, 'lower-better'), '목표 '+DATA.benchmarks.mttr_target+'분 이내 · 500분 초과 건 제외')+
    statTile('평균 재방문율', pctStr(avgRevisit), '', targetPill(avgRevisit, DATA.benchmarks.revisit_target, 'lower-better'), 'WEST·CENTRAL·SOUTH 평균 (목표 '+DATA.benchmarks.revisit_target+'% 이하)')+
    statTile('평균 FTFR', pctStr(avgFtfr), '', targetPill(avgFtfr, DATA.benchmarks.ftfr_target, 'higher-better'), 'WEST·CENTRAL·SOUTH 평균 (목표 '+DATA.benchmarks.ftfr_target+'% 이상)')+
    '</div>';

  html += '<div class="block"><div class="block-head"><h2>전 직원 KPI 종합 점수</h2><span class="hint">업무 종류별 가중치 적용 · 담당자 기준 · 열 제목 클릭 시 정렬 · 행 클릭 시 개인별 상세로 이동 · '+period+'</span></div>'+
    '<div class="card table-scroll" style="padding:6px;"><table class="data-table" id="lbTable"></table></div></div>';

  html += '<div class="block grid grid-2">'+
    chartCard('team-cmp-chart', '팀별 처리 건수', '선택 기간 · '+period)+
    chartCard('svc-type-chart', '서비스 유형별 처리 건수', '전사 · '+period)+
    '</div>';

  html += '<div class="block grid grid-2">'+
    chartCard('group-cmp-chart', '비즈니스(장비 그룹)별 처리 건수', '전사 · '+period)+
    chartCard('trend-chart', '월별 처리 건수 추이', '이번 년도 vs 직전 년도 · 전사')+
    '</div>';

  html += '<div class="block"><div class="block-head"><h2>팀별 재방문율 / FTFR 개요</h2><span class="hint">고장수리+점검 기준, "'+period+'" 스냅샷</span></div>'+
    '<div class="grid grid-4" id="teamRevisitCards"></div></div>';

  el.innerHTML = html;

  renderLeaderboardTable(period);

  barChart(document.getElementById('team-cmp-chart'), DATA.teams.map(function(t){return DATA.team_short[t];}), DATA.teams.map(function(t){return DATA.team[t].total_case[period];}), DATA.teams.map(function(t){return TEAM_COLOR[t];}), {unit:'건'});
  barChart(document.getElementById('svc-type-chart'), DATA.buckets.map(function(b){return DATA.bucket_label[b];}), bucketCaseArr(company, period), DATA.buckets.map(function(b){return BUCKET_COLOR[b];}), {unit:'건'});
  barChart(document.getElementById('group-cmp-chart'), DATA.groups.map(function(g){return DATA.group_label[g];}), groupCaseArr(company, period), DATA.groups.map(function(g){return GROUP_COLOR[g];}), {unit:'건'});

  var months = monthsUnion(company.month['이번 년도'], company.month['직전 년도']);
  lineChart(document.getElementById('trend-chart'), months, [
    {name:'이번 년도', color:'var(--accent)', values: mapMonthVals(company.month['이번 년도'])},
    {name:'직전 년도', color:'var(--text-muted)', values: mapMonthVals(company.month['직전 년도'])},
  ], {unit:'건'});

  var cardsEl = document.getElementById('teamRevisitCards');
  DATA.teams.forEach(function(t){
    var rv = teamRevisit(t, period);
    var reliable = DATA.revisit[t].reliable;
    var card = document.createElement('div');
    card.className = 'card stat';
    card.innerHTML = '<div class="stat-label"><span style="color:'+resolveVar(TEAM_COLOR[t])+'">'+t+'</span>'+(reliable?'':'<span class="pill warn">확인필요</span>')+'</div>'+
      '<div class="stat-value" style="font-size:19px;">'+pctStr(rv.revisit)+' <span class="unit">재방문율</span></div>'+
      '<div class="stat-sub">FTFR '+pctStr(rv.ftfr)+' '+(reliable?targetPill(rv.ftfr, DATA.benchmarks.ftfr_target,'higher-better'):'')+'</div>';
    cardsEl.appendChild(card);
  });
}
function mapMonthVals(obj){
  var out = {};
  Object.keys(obj||{}).forEach(function(k){ out[Number(k)] = obj[k]; });
  return out;
}
function statTile(label, value, unit, deltaHtml, sub){
  return '<div class="card stat"><div class="stat-label">'+label+'</div>'+
    '<div class="stat-value">'+value+(unit?'<span class="unit">'+unit+'</span>':'')+'</div>'+
    (deltaHtml?'<div>'+deltaHtml+'</div>':'')+
    (sub?'<div class="stat-sub">'+sub+'</div>':'')+
    '</div>';
}
function chartCard(id, title, hint){
  return '<div class="card chart-card"><div class="block-head"><h2>'+title+'</h2><span class="hint">'+hint+'</span></div><div id="'+id+'"></div></div>';
}

/* ---- company-wide KPI score leaderboard (all employees at a glance) ---- */
function renderLeaderboardTable(period){
  var allMembers = DATA.teams.reduce(function(acc,t){ return acc.concat(DATA.team[t].members.map(function(m){return {name:m, team:t};})); }, []);
  var rows = allMembers.map(function(x){
    var pe = DATA.person[x.name];
    return {
      name: x.name, team: x.team,
      score: pe.score[period] || 0,
      scorePrev: period==='이번 년도' ? (pe.score['직전 년도']||0) : null,
      total: pe.total_case[period] || 0,
    };
  });
  var maxScore = Math.max(1, Math.max.apply(null, rows.map(function(r){return r.score;})));
  var key = state.lbSortKey, dir = state.lbSortDir;
  rows.sort(function(a,b){
    var av = a[key], bv = b[key];
    if (typeof av === 'string' || typeof bv === 'string'){
      var cmp = String(av).localeCompare(String(bv), 'ko');
      return dir==='desc' ? -cmp : cmp;
    }
    if (av===null||av===undefined) av = -Infinity; if (bv===null||bv===undefined) bv = -Infinity;
    return dir==='desc' ? bv-av : av-bv;
  });
  var cols = [
    {k:'rank', label:'#'},
    {k:'name', label:'이름'},
    {k:'team', label:'팀'},
    {k:'score', label:'KPI 종합 점수', num:true},
    {k:'total', label:'총 처리건수', num:true},
  ];
  var thead = '<thead><tr>'+cols.map(function(c){
    if (c.k==='rank') return '<th>#</th>';
    var arrow = state.lbSortKey===c.k ? '<span class="arrow">'+(state.lbSortDir==='desc'?'▼':'▲')+'</span>' : '';
    return '<th class="'+(c.num?'num':'')+'" data-key="'+c.k+'">'+c.label+arrow+'</th>';
  }).join('')+'</tr></thead>';
  var tbody = '<tbody>'+rows.map(function(r, i){
    var rankCls = i===0?'top1':(i===1?'top2':(i===2?'top3':''));
    var pct = Math.max(2, Math.round(r.score/maxScore*100));
    var color = resolveVar(TEAM_COLOR[r.team]);
    var isSelf = r.name === state.person;
    return '<tr class="'+(isSelf?'self-row':'')+'" data-person="'+esc(r.name)+'">'+
      '<td><span class="rank-badge '+rankCls+'">'+(i+1)+'</span></td>'+
      '<td>'+esc(r.name)+'</td>'+
      '<td><span style="color:'+color+';font-weight:600;font-size:11.5px;">'+DATA.team_short[r.team]+'</span></td>'+
      '<td class="num"><div class="score-cell"><div class="score-bar-track"><div class="score-bar-fill" style="width:'+pct+'%;background:'+color+';"></div></div><span class="score-num">'+fmt1(r.score)+'</span></div></td>'+
      '<td class="num">'+fmt(r.total)+'</td>'+
      '</tr>';
  }).join('')+'</tbody>';
  var table = document.getElementById('lbTable');
  table.innerHTML = thead+tbody;
  table.querySelectorAll('th[data-key]').forEach(function(th){
    th.addEventListener('click', function(){
      var k = th.getAttribute('data-key');
      if (state.lbSortKey === k) state.lbSortDir = state.lbSortDir==='desc'?'asc':'desc';
      else { state.lbSortKey = k; state.lbSortDir = 'desc'; }
      renderLeaderboardTable(period);
    });
  });
  table.querySelectorAll('tbody tr').forEach(function(tr){
    tr.addEventListener('click', function(){
      state.person = tr.getAttribute('data-person');
      state.tab = 'person';
      switchTab('person');
    });
  });
}

/* ================= RENDER: TEAM ================= */
function renderTeam(){
  var el = document.getElementById('panel-team');
  var period = state.period;
  var team = state.team;
  var teamData = DATA.team[team];

  var html = '<div class="controls" style="margin-bottom:18px;">'+
    '<div class="control-group"><span class="control-label">팀</span><div class="segmented" id="teamSeg"></div></div></div>';

  html += '<div class="block grid grid-2">'+
    chartCard('team-score-total-chart', '팀별 KPI 종합 점수', period+' · 팀원 점수 합계')+
    chartCard('team-score-avg-chart', '팀별 평균 KPI 점수', period+' · 팀원 1인당 평균')+
    '</div>';

  var mttr = mttrRepairAvg(teamData, period);
  var rv = teamRevisit(team, period);
  var reliable = DATA.revisit[team].reliable;

  html += '<div class="block grid grid-4">'+
    statTile('총 처리 건수', fmt(teamData.total_case[period]), '건', null, team+' · '+period)+
    statTile('평균 MTTR (고장수리)', fmt1(mttr), '분', targetPill(mttr, DATA.benchmarks.mttr_target,'lower-better'), '목표 '+DATA.benchmarks.mttr_target+'분 이내')+
    statTile('재방문율', pctStr(rv.revisit), '', reliable?targetPill(rv.revisit, DATA.benchmarks.revisit_target,'lower-better'):'<span class="pill warn">확인필요</span>', reliable?('목표 '+DATA.benchmarks.revisit_target+'% 이하'):'원본 시트 수식 오류 — 참고용')+
    statTile('FTFR', pctStr(rv.ftfr), '', reliable?targetPill(rv.ftfr, DATA.benchmarks.ftfr_target,'higher-better'):'', reliable?('목표 '+DATA.benchmarks.ftfr_target+'% 이상'):'&nbsp;')+
    '</div>';

  html += '<div class="block grid grid-2">'+
    chartCard('team-group-chart', '비즈니스(장비 그룹)별 처리 건수', period)+
    chartCard('team-svc-chart', '서비스 유형별 처리 건수', period)+
    '</div>';

  html += '<div class="block">'+chartCard('team-trend-chart','월별 처리 건수 추이','이번 년도 vs 직전 년도')+'</div>';

  html += '<div class="block"><div class="block-head"><h2>팀원별 순위</h2><span class="hint">열 제목 클릭 시 정렬 · 행 클릭 시 개인별 상세로 이동</span></div>'+
    '<div class="card table-scroll" style="padding:6px;"><table class="data-table" id="rankTable"></table></div></div>';

  var hospTotal = DATA.revisit[team].total_hospital_count || DATA.revisit[team].hospitals.length;
  html += '<div class="block"><div class="block-head"><h2>담당 병원별 재방문율 / FTFR</h2><span class="hint">고장수리+점검 기준(방문 3건 이상) · '+team+' 서비스 건수 상위 '+DATA.revisit[team].hospitals.length+'개 병원 (전체 '+hospTotal+'개 중)</span></div>'+
    '<div class="card table-scroll" style="padding:6px;"><table class="data-table" id="hospTable"></table></div></div>';

  el.innerHTML = html;

  var seg = document.getElementById('teamSeg');
  DATA.teams.forEach(function(t){
    var b = document.createElement('button');
    b.textContent = DATA.team_short[t];
    b.className = t === team ? 'active' : '';
    b.style.color = t===team ? resolveVar(TEAM_COLOR[t]) : '';
    b.addEventListener('click', function(){ state.team = t; state.sortKey='total'; state.sortDir='desc'; renderTeam(); });
    seg.appendChild(b);
  });

  var teamLabels = DATA.teams.map(function(t){return DATA.team_short[t];});
  var teamColors = DATA.teams.map(function(t){return TEAM_COLOR[t];});
  var teamScoreTotal = DATA.teams.map(function(t){return DATA.team[t].score[period] || 0;});
  var teamScoreAvg = DATA.teams.map(function(t){return DATA.team[t].score_avg[period] || 0;});
  barChart(document.getElementById('team-score-total-chart'), teamLabels, teamScoreTotal, teamColors, {unit:'점'});
  barChart(document.getElementById('team-score-avg-chart'), teamLabels, teamScoreAvg, teamColors, {unit:'점'});

  barChart(document.getElementById('team-group-chart'), DATA.groups.map(function(g){return DATA.group_label[g];}), groupCaseArr(teamData, period), DATA.groups.map(function(g){return GROUP_COLOR[g];}), {unit:'건'});
  barChart(document.getElementById('team-svc-chart'), DATA.buckets.map(function(b){return DATA.bucket_label[b];}), bucketCaseArr(teamData, period), DATA.buckets.map(function(b){return BUCKET_COLOR[b];}), {unit:'건'});
  var months = monthsUnion(teamData.month['이번 년도'], teamData.month['직전 년도']);
  lineChart(document.getElementById('team-trend-chart'), months, [
    {name:'이번 년도', color:'var(--accent)', values: mapMonthVals(teamData.month['이번 년도'])},
    {name:'직전 년도', color:'var(--text-muted)', values: mapMonthVals(teamData.month['직전 년도'])},
  ], {unit:'건'});

  renderRankTable(team, period);
  renderHospTable(team);
}

function renderRankTable(team, period){
  var members = DATA.team[team].members;
  var rows = members.map(function(m){
    var pe = DATA.person[m];
    return { name:m, total: pe.total_case[period], mttr: mttrRepairAvg(pe, period), repair: (pe.case[period]||{})['고장수리']||0, pm:(pe.case[period]||{})['PM']||0, score: pe.score[period]||0 };
  });
  var key = state.sortKey, dir = state.sortDir;
  rows.sort(function(a,b){
    var av = a[key], bv = b[key];
    if (av===null) av = -Infinity; if (bv===null) bv = -Infinity;
    return dir==='desc' ? bv-av : av-bv;
  });
  var cols = [
    {k:'rank', label:'#', num:false},
    {k:'name', label:'이름', num:false},
    {k:'score', label:'KPI 점수', num:true},
    {k:'total', label:'총 처리건수', num:true},
    {k:'repair', label:'고장수리', num:true},
    {k:'pm', label:'PM', num:true},
    {k:'mttr', label:'MTTR(분)', num:true},
  ];
  var thead = '<thead><tr>'+cols.map(function(c){
    if (c.k==='rank') return '<th>#</th>';
    var arrow = state.sortKey===c.k ? '<span class="arrow">'+(state.sortDir==='desc'?'▼':'▲')+'</span>' : '';
    return '<th class="'+(c.num?'num':'')+'" data-key="'+c.k+'">'+c.label+arrow+'</th>';
  }).join('')+'</tr></thead>';
  var tbody = '<tbody>'+rows.map(function(r, i){
    var isSelf = r.name === state.person;
    return '<tr class="'+(isSelf?'self-row':'')+'" data-person="'+esc(r.name)+'">'+
      '<td><span class="rank-badge">'+(i+1)+'</span></td>'+
      '<td>'+esc(r.name)+'</td>'+
      '<td class="num">'+fmt1(r.score)+'</td>'+
      '<td class="num">'+fmt(r.total)+'</td>'+
      '<td class="num">'+fmt(r.repair)+'</td>'+
      '<td class="num">'+fmt(r.pm)+'</td>'+
      '<td class="num">'+(r.mttr===null?'—':fmt1(r.mttr))+'</td>'+
      '</tr>';
  }).join('')+'</tbody>';
  var table = document.getElementById('rankTable');
  table.innerHTML = thead+tbody;
  table.querySelectorAll('th[data-key]').forEach(function(th){
    th.addEventListener('click', function(){
      var k = th.getAttribute('data-key');
      if (state.sortKey === k) state.sortDir = state.sortDir==='desc'?'asc':'desc';
      else { state.sortKey = k; state.sortDir = 'desc'; }
      renderRankTable(team, period);
    });
  });
  table.querySelectorAll('tbody tr').forEach(function(tr){
    tr.addEventListener('click', function(){
      state.person = tr.getAttribute('data-person');
      state.tab = 'person';
      switchTab('person');
    });
  });
}

function renderHospTable(team){
  var hospitals = DATA.revisit[team].hospitals.slice();
  var key = state.hospSortKey, dir = state.hospSortDir;
  hospitals.sort(function(a,b){
    var av = a[key], bv = b[key];
    if (av===null||av===undefined) av = -Infinity; if (bv===null||bv===undefined) bv = -Infinity;
    return dir==='desc' ? bv-av : av-bv;
  });
  var cols = [
    {k:'name', label:'병원명'},
    {k:'this_revisit', label:'이번년도 재방문율', num:true, pct:true},
    {k:'this_ftfr', label:'이번년도 FTFR', num:true, pct:true},
    {k:'last_revisit', label:'직전년도 재방문율', num:true, pct:true},
    {k:'last_ftfr', label:'직전년도 FTFR', num:true, pct:true},
    {k:'cum_revisit', label:'누적 재방문율', num:true, pct:true},
  ];
  if (!hospitals.length){
    document.getElementById('hospTable').innerHTML = '<tbody><tr><td class="empty-note">이 팀에 대한 병원별 재방문율 데이터가 원본 시트에 존재하지 않습니다.</td></tr></tbody>';
    return;
  }
  var thead = '<thead><tr>'+cols.map(function(c){
    var arrow = state.hospSortKey===c.k ? '<span class="arrow">'+(state.hospSortDir==='desc'?'▼':'▲')+'</span>' : '';
    return '<th class="'+(c.num?'num':'')+'" data-key="'+c.k+'">'+c.label+arrow+'</th>';
  }).join('')+'</tr></thead>';
  var tbody = '<tbody>'+hospitals.map(function(h){
    return '<tr>'+cols.map(function(c){
      var v = h[c.k];
      return '<td class="'+(c.num?'num':'')+'">'+(c.pct ? pctStr(v) : esc(v))+'</td>';
    }).join('')+'</tr>';
  }).join('')+'</tbody>';
  var table = document.getElementById('hospTable');
  table.innerHTML = thead+tbody;
  table.querySelectorAll('th[data-key]').forEach(function(th){
    th.addEventListener('click', function(){
      var k = th.getAttribute('data-key');
      if (state.hospSortKey === k) state.hospSortDir = state.hospSortDir==='desc'?'asc':'desc';
      else { state.hospSortKey = k; state.hospSortDir = 'desc'; }
      renderHospTable(team);
    });
  });
}

/* ================= RENDER: PERSON ================= */
function renderPerson(){
  var el = document.getElementById('panel-person');
  var period = state.period;

  var html = '<div class="person-shell">';
  html += '<div class="person-list" id="personList"></div>';
  html += '<div style="flex:1; min-width:0;" id="personDetail"></div>';
  html += '</div>';
  el.innerHTML = html;

  var listEl = document.getElementById('personList');
  var searchHtml = '<input class="search" style="width:100%;margin-bottom:10px;" placeholder="이름 검색..." id="personSearchInput" value="'+esc(state.personSearch)+'">';
  listEl.insertAdjacentHTML('beforeend', searchHtml);
  DATA.teams.forEach(function(t){
    var members = DATA.team[t].members.filter(function(m){ return m.indexOf(state.personSearch) !== -1; });
    if (!members.length) return;
    var g = document.createElement('div');
    g.innerHTML = '<div class="team-group-label" style="color:'+resolveVar(TEAM_COLOR[t])+'">'+DATA.team_short[t]+'</div>';
    members.forEach(function(m){
      var item = document.createElement('div');
      item.className = 'person-item' + (m===state.person?' active':'');
      item.innerHTML = '<span class="person-main">'+esc(m)+'</span><span class="mini">'+fmt(DATA.person[m].total_case[period])+'건</span>';
      item.addEventListener('click', function(){ state.person = m; renderPerson(); });
      g.appendChild(item);
    });
    listEl.appendChild(g);
  });
  document.getElementById('personSearchInput').addEventListener('input', function(e){
    state.personSearch = e.target.value;
    renderPerson();
  });

  if (!state.person || !DATA.person[state.person]){
    document.getElementById('personDetail').innerHTML = '<div class="empty-note">왼쪽에서 팀원을 선택하세요.</div>';
    return;
  }
  var pe = DATA.person[state.person];
  var team = pe.team;
  var detail = document.getElementById('personDetail');

  var total = pe.total_case[period];
  var totalPrevYoY = period==='이번 년도' ? pe.total_case['직전 년도'] : null;
  var mttr = mttrRepairAvg(pe, period);
  var mttrPrevYoY = period==='이번 년도' ? mttrRepairAvg(pe, '직전 년도') : null;
  var score = pe.score[period] || 0;
  var scorePrevYoY = period==='이번 년도' ? (pe.score['직전 년도']||0) : null;
  var rv = teamRevisit(team, period);
  var reliable = DATA.revisit[team].reliable;

  var html2 = '<div class="person-header">'+
    '<div><h2>'+esc(state.person)+'</h2><span class="team-tag" style="background:'+resolveVar('var(--accent-soft)')+';color:'+resolveVar(TEAM_COLOR[team])+'">'+team+'</span></div>'+
    '</div>';

  html2 += '<div class="block grid grid-5">'+
    statTile('KPI 종합 점수', fmt1(score), '점', deltaBadge(score, scorePrevYoY, true), '업무 가중치 적용 · 담당자 기준 · '+period)+
    statTile('총 처리 건수', fmt(total), '건', deltaBadge(total, totalPrevYoY, false), period)+
    statTile('평균 MTTR (고장수리)', fmt1(mttr), '분', deltaBadge(mttr, mttrPrevYoY, true)+' '+targetPill(mttr, DATA.benchmarks.mttr_target,'lower-better'), '목표 '+DATA.benchmarks.mttr_target+'분 이내')+
    statTile('소속팀 재방문율', pctStr(rv.revisit), '', reliable?targetPill(rv.revisit, DATA.benchmarks.revisit_target,'lower-better'):'<span class="pill warn">확인필요</span>', '팀 평균 참고치 (개인별 데이터 아님)')+
    statTile('소속팀 FTFR', pctStr(rv.ftfr), '', reliable?targetPill(rv.ftfr, DATA.benchmarks.ftfr_target,'higher-better'):'', '팀 평균 참고치 (개인별 데이터 아님)')+
    '</div>';

  html2 += '<div class="block grid grid-2">'+
    chartCard('p-score-chart', '비즈니스(장비 그룹)별 KPI 점수', '가중치 적용 · '+period)+
    chartCard('p-group-chart', '비즈니스(장비 그룹)별 처리 건수', period)+
    '</div>';
  html2 += '<div class="block grid grid-2">'+
    chartCard('p-svc-chart', '서비스 유형별 처리 건수', period)+
    chartCard('p-mttr-chart', 'MTTR by 장비 그룹 (고장수리)', period+' · 목표 '+DATA.benchmarks.mttr_target+'분')+
    '</div>';
  html2 += '<div class="block">'+chartCard('p-trend-chart', '월별 처리 건수 추이', '이번 년도 vs 직전 년도')+'</div>';

  html2 += '<div class="block"><div class="block-head"><h2>자주 방문한 병원 (Top 6)</h2><span class="hint">고장수리·PM 건수 기준 · 누적</span></div>'+
    '<div class="card table-scroll" style="padding:6px;"><table class="data-table"><thead><tr><th>병원명</th><th class="num">방문 건수</th></tr></thead><tbody>'+
    pe.top_accounts.map(function(a,i){ return '<tr><td><span class="rank-badge" style="margin-right:8px;">'+(i+1)+'</span>'+esc(a[0])+'</td><td class="num">'+fmt(a[1])+'</td></tr>'; }).join('')+
    '</tbody></table></div></div>';

  detail.innerHTML = html2;

  var scoreByGroup = pe.score_group[period] || {};
  var scoreVals = DATA.groups.map(function(g){ return scoreByGroup[g] || 0; });
  barChart(document.getElementById('p-score-chart'), DATA.groups.map(function(g){return DATA.group_label[g];}), scoreVals, DATA.groups.map(function(g){return GROUP_COLOR[g];}), {unit:'점'});
  barChart(document.getElementById('p-group-chart'), DATA.groups.map(function(g){return DATA.group_label[g];}), groupCaseArr(pe, period), DATA.groups.map(function(g){return GROUP_COLOR[g];}), {unit:'건'});
  barChart(document.getElementById('p-svc-chart'), DATA.buckets.map(function(b){return DATA.bucket_label[b];}), bucketCaseArr(pe, period), DATA.buckets.map(function(b){return BUCKET_COLOR[b];}), {unit:'건'});

  var mttrByGroup = pe.mttr[period] || {};
  var mttrVals = DATA.groups.map(function(g){ return mttrByGroup[g] ? mttrByGroup[g].avg : 0; });
  barChart(document.getElementById('p-mttr-chart'), DATA.groups.map(function(g){return DATA.group_label[g];}), mttrVals, DATA.groups.map(function(g){return GROUP_COLOR[g];}), {unit:'분', targetLine: DATA.benchmarks.mttr_target});

  var months = monthsUnion(pe.month['이번 년도'], pe.month['직전 년도']);
  lineChart(document.getElementById('p-trend-chart'), months, [
    {name:'이번 년도', color:'var(--accent)', values: mapMonthVals(pe.month['이번 년도'])},
    {name:'직전 년도', color:'var(--text-muted)', values: mapMonthVals(pe.month['직전 년도'])},
  ], {unit:'건'});
}

/* ================= APP SHELL ================= */
function render(){
  if (state.tab === 'overview') renderOverview();
  else if (state.tab === 'team') renderTeam();
  else if (state.tab === 'person') renderPerson();
}

function switchTab(tab){
  state.tab = tab;
  document.querySelectorAll('#tabs button').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-tab')===tab); });
  document.querySelectorAll('section.panel').forEach(function(p){ p.classList.remove('active'); });
  document.getElementById('panel-'+tab).classList.add('active');
  render();
}

function initControls(){
  document.querySelectorAll('#tabs button').forEach(function(b){
    b.addEventListener('click', function(){ switchTab(b.getAttribute('data-tab')); });
  });
  var seg = document.getElementById('periodSeg');
  DATA.periods.forEach(function(p){
    var b = document.createElement('button');
    b.textContent = p;
    b.title = DATA.period_label[p];
    b.className = p===state.period ? 'active':'';
    b.addEventListener('click', function(){
      state.period = p;
      seg.querySelectorAll('button').forEach(function(bb){ bb.classList.toggle('active', bb===b); });
      render();
    });
    seg.appendChild(b);
  });
  var periodHint = document.createElement('span');
  periodHint.className = 'hint';
  periodHint.id = 'periodHint';
  document.getElementById('globalControls').appendChild(periodHint);
  function updatePeriodHint(){ periodHint.textContent = DATA.period_label[state.period]; }
  seg.addEventListener('click', updatePeriodHint);
  updatePeriodHint();

  var metaLine = document.getElementById('metaLine');
  metaLine.textContent = '데이터 기준일 '+DATA.data_snapshot_date+' · Sysmex Korea 회계연도(FY, 4월~익년 3월) 기준 · 팀 4개 · 인원 '+Object.keys(DATA.person).length+'명 · 서비스 기록 약 40,000건';

  var themeBtn = document.getElementById('themeToggle');
  var themeLabel = document.getElementById('themeLabel');
  function applyTheme(mode){
    if (mode === 'system'){ document.documentElement.removeAttribute('data-theme'); themeLabel.textContent='시스템'; }
    else { document.documentElement.setAttribute('data-theme', mode); themeLabel.textContent = mode==='dark'?'다크':'라이트'; }
    try{ localStorage.setItem('fsg-kpi-theme', mode); }catch(e){}
  }
  var saved = 'system';
  try{ saved = localStorage.getItem('fsg-kpi-theme') || 'system'; }catch(e){}
  applyTheme(saved);
  themeBtn.addEventListener('click', function(){
    var cur = document.documentElement.getAttribute('data-theme') || 'system';
    var next = cur === 'system' ? 'dark' : (cur === 'dark' ? 'light' : 'system');
    applyTheme(next);
    render();
  });
}

initControls();
render();
window.addEventListener('resize', function(){ render(); });
};
