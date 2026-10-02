import json, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
BUILD_DIR = os.path.join(REPO_ROOT, 'build')

agg = json.load(open(os.path.join(BUILD_DIR, 'agg_v2.json'), encoding='utf-8'))

GROUPS = ['CBC','COA','HISCL','Urine','A1c','RF-500']
GROUP_LABEL = {'CBC':'CBC','COA':'COA','HISCL':'Hiscl','Urine':'Urine','A1c':'A1c','RF-500':'RF-500'}
PERIODS = ['이번 년도','직전 년도','전체 누적']
BUCKETS = ['고장수리','PM','설치이전','Cal평가','기타']
BUCKET_LABEL = {'고장수리':'고장 수리','PM':'PM','설치이전':'설치·이전','Cal평가':'Cal·평가','기타':'기타'}
TEAMS = ['FS WEST','FS EAST','FS Central','FS South']
TEAM_SHORT = {'FS WEST':'WEST','FS EAST':'EAST','FS Central':'CENTRAL','FS South':'SOUTH'}

def r2(x):
    return round(x, 2) if isinstance(x, (int, float)) else x

CAL_MONTHS = agg.get('cal_months', [])
TODAY_MONTH = agg['fy_meta']['today'][:7]
PARTIAL_MONTH = TODAY_MONTH if TODAY_MONTH in CAL_MONTHS else None

def build_person_entry(name, team):
    gc = agg['person_group'].get(name, {})
    mt = agg['person_mttr'].get(name, {})
    cs = agg['person_case'].get(name, {})
    mo = agg['person_month'].get(name, {})
    sc = agg['person_score'].get(name, {})
    scg = agg['person_score_group'].get(name, {})
    cal_sg = agg.get('person_cal_score_group', {}).get(name, {})
    cal_g = agg.get('person_cal_group', {}).get(name, {})
    cal_b = agg.get('person_cal_bucket', {}).get(name, {})
    cal_mttr = agg.get('person_cal_mttr', {}).get(name, {})

    # calendar-month trend series (full raw-data history, not FY-period buckets):
    # one value per entry in CAL_MONTHS, broken down by business(group) for KPI
    # score/case-count/MTTR and by service type for case-count, matching the
    # breakdown of each metric's own cumulative (per-period) bar chart above.
    trend_score_group = {g: [r2(cal_sg.get(m, {}).get(g, 0.0)) for m in CAL_MONTHS] for g in GROUPS}
    trend_group = {g: [cal_g.get(m, {}).get(g, 0) for m in CAL_MONTHS] for g in GROUPS}
    trend_bucket = {b: [cal_b.get(m, {}).get(b, 0) for m in CAL_MONTHS] for b in BUCKETS}
    trend_mttr = {}
    for g in GROUPS:
        vals = []
        for m in CAL_MONTHS:
            d = cal_mttr.get(m, {}).get(g)
            vals.append(r2(d['sum']/d['n']) if d and d.get('n') else None)
        trend_mttr[g] = vals

    group_case = {}
    mttr = {}
    total_case = {}
    for period in PERIODS:
        gcd = gc.get(period, {})
        group_case[period] = {g: gcd.get(g, 0) for g in GROUPS}
        mtd = mt.get(period, {})
        mttr_period = {}
        for g in GROUPS:
            d = mtd.get(g)
            if d and d.get('n'):
                mttr_period[g] = {'avg': r2(d['sum']/d['n']), 'n': d['n']}
        mttr[period] = mttr_period
        total_case[period] = sum(gcd.values())

    case = {}
    for period in PERIODS:
        cd = cs.get(period, {})
        case[period] = {b: cd.get(b, 0) for b in BUCKETS}

    month = {}
    for period in PERIODS:
        md = mo.get(period, {})
        month[period] = {str(k): v for k, v in md.items()}

    score = {}
    score_group = {}
    for period in PERIODS:
        score[period] = r2(sc.get(period, 0.0))
        scgd = scg.get(period, {})
        score_group[period] = {g: r2(scgd.get(g, 0.0)) for g in GROUPS}

    return {
        'team': team,
        'group_case': group_case,
        'mttr': mttr,
        'case': case,
        'month': month,
        'total_case': total_case,
        'top_accounts': agg['person_account_top'].get(name, []),
        'score': score,
        'score_group': score_group,
        'trend_score_group': trend_score_group,
        'trend_group': trend_group,
        'trend_bucket': trend_bucket,
        'trend_mttr': trend_mttr,
    }

person_out = {}
for name, team in agg['member_team'].items():
    if team not in TEAMS:
        continue
    person_out[name] = build_person_entry(name, team)

def empty_group_case():
    return {p: {g: 0 for g in GROUPS} for p in PERIODS}

def build_team_entry(team, members):
    group_case = empty_group_case()
    mttr_sum = {p: {g: [0.0, 0] for g in GROUPS} for p in PERIODS}
    case = {p: {b: 0 for b in BUCKETS} for p in PERIODS}
    month = {p: {} for p in PERIODS}
    total_case = {p: 0 for p in PERIODS}
    score = {p: 0.0 for p in PERIODS}
    score_group = {p: {g: 0.0 for g in GROUPS} for p in PERIODS}

    for m in members:
        pe = person_out[m]
        for period in PERIODS:
            for g in GROUPS:
                group_case[period][g] += pe['group_case'][period][g]
            for g in GROUPS:
                d = pe['mttr'][period].get(g)
                if d:
                    mttr_sum[period][g][0] += d['avg'] * d['n']
                    mttr_sum[period][g][1] += d['n']
            for b in BUCKETS:
                case[period][b] += pe['case'][period][b]
            for mo, c in pe['month'][period].items():
                month[period][mo] = month[period].get(mo, 0) + c
            total_case[period] += pe['total_case'][period]
            score[period] += pe['score'][period]
            for g in GROUPS:
                score_group[period][g] += pe['score_group'][period][g]

    mttr = {p: {} for p in PERIODS}
    for period in PERIODS:
        for g in GROUPS:
            s, n = mttr_sum[period][g]
            if n:
                mttr[period][g] = {'avg': r2(s/n), 'n': n}

    for period in PERIODS:
        score[period] = r2(score[period])
        for g in GROUPS:
            score_group[period][g] = r2(score_group[period][g])

    return {
        'group_case': group_case,
        'mttr': mttr,
        'case': case,
        'month': month,
        'total_case': total_case,
        'members': members,
        'score': score,
        'score_group': score_group,
        'score_avg': {p: r2(score[p]/len(members)) if members else 0 for p in PERIODS},
    }

team_out = {}
for team in TEAMS:
    team_out[team] = build_team_entry(team, agg['team_members'][team])

def build_company_entry():
    all_members = [m for t in TEAMS for m in agg['team_members'][t]]
    return build_team_entry('__company__', all_members)

company_out = build_company_entry()
del company_out['members']

def pct(v):
    if v is None:
        return None
    return round(v*100, 1)

def avg_of(vals):
    vals = [v for v in vals if v is not None]
    return (sum(vals) / len(vals)) if vals else None

MIN_ACCOUNT_VOLUME = 3   # need at least this many 고장수리+PM visits (all-time) to be meaningful
TOP_N_HOSPITALS = 40     # cap the displayed table to the highest-volume accounts

revisit_out = {}
for team in TEAMS:
    accounts = agg.get('revisit_by_team', {}).get(team, {})
    hospitals = []
    for name, rates in accounts.items():
        cum = rates.get('cum', {}); this = rates.get('이번 년도', {}); last = rates.get('직전 년도', {})
        n_rv = cum.get('n_rv') or 0
        if n_rv < MIN_ACCOUNT_VOLUME:
            continue
        hospitals.append({
            'name': name, 'n_rv': n_rv,
            'cum_revisit': pct(cum.get('revisit')), 'cum_ftfr': pct(cum.get('ftfr')),
            'this_revisit': pct(this.get('revisit')), 'this_ftfr': pct(this.get('ftfr')),
            'last_revisit': pct(last.get('revisit')), 'last_ftfr': pct(last.get('ftfr')),
        })
    # team-level average is computed over every qualifying account, not just the
    # ones shown in the (length-capped) table below
    team_total = {
        '재방문율': avg_of(h['cum_revisit'] for h in hospitals), 'FTFR': avg_of(h['cum_ftfr'] for h in hospitals),
        '이번년도재방문율': avg_of(h['this_revisit'] for h in hospitals), '이번년도FTFR': avg_of(h['this_ftfr'] for h in hospitals),
        '직전년도재방문율': avg_of(h['last_revisit'] for h in hospitals), '직전년도FTFR': avg_of(h['last_ftfr'] for h in hospitals),
    }
    team_total = {k: (round(v, 1) if v is not None else None) for k, v in team_total.items()}
    total_qualifying = len(hospitals)
    hospitals.sort(key=lambda h: -h['n_rv'])
    hospitals = hospitals[:TOP_N_HOSPITALS]
    for h in hospitals:
        del h['n_rv']
    revisit_out[team] = {
        'reliable': True,
        'team_total': team_total,
        'hospitals': hospitals,
        'total_hospital_count': total_qualifying,
    }

# ---------- monthly revisit/FTFR trend (calendar-month, full raw-data history) ----------
monthly = agg.get('revisit_monthly_by_team', {})
all_months = sorted({mk for t in TEAMS for mk in monthly.get(t, {})})
today_month = agg['fy_meta']['today'][:7]  # 'YYYY-MM' — current (likely partial) month

def rate_pair(cell):
    rv = round(cell['ad'] / cell['n_rv'] * 100, 1) if cell.get('n_rv') else None
    ft = round((cell['n_ftfr'] - cell['ae']) / cell['n_ftfr'] * 100, 1) if cell.get('n_ftfr') else None
    return rv, ft

teams_trend = {}
company_cells = {mk: {'n_rv':0,'ad':0,'n_ftfr':0,'ae':0} for mk in all_months}
for team in TEAMS:
    tm = monthly.get(team, {})
    revisit_arr, ftfr_arr, n_rv_arr, n_ftfr_arr = [], [], [], []
    for mk in all_months:
        cell = tm.get(mk, {'n_rv':0,'ad':0,'n_ftfr':0,'ae':0})
        rv, ft = rate_pair(cell)
        revisit_arr.append(rv); ftfr_arr.append(ft)
        n_rv_arr.append(cell.get('n_rv', 0)); n_ftfr_arr.append(cell.get('n_ftfr', 0))
        cc = company_cells[mk]
        cc['n_rv'] += cell.get('n_rv', 0); cc['ad'] += cell.get('ad', 0)
        cc['n_ftfr'] += cell.get('n_ftfr', 0); cc['ae'] += cell.get('ae', 0)
    teams_trend[team] = {'revisit': revisit_arr, 'ftfr': ftfr_arr, 'n_rv': n_rv_arr, 'n_ftfr': n_ftfr_arr}

company_revisit, company_ftfr, company_n_rv, company_n_ftfr = [], [], [], []
for mk in all_months:
    rv, ft = rate_pair(company_cells[mk])
    company_revisit.append(rv); company_ftfr.append(ft)
    company_n_rv.append(company_cells[mk]['n_rv']); company_n_ftfr.append(company_cells[mk]['n_ftfr'])

revisit_trend = {
    'months': all_months,
    'partial_month': today_month if today_month in all_months else None,
    'company': {'revisit': company_revisit, 'ftfr': company_ftfr, 'n_rv': company_n_rv, 'n_ftfr': company_n_ftfr},
    'teams': teams_trend,
}

final = {
    'teams': TEAMS,
    'team_short': TEAM_SHORT,
    'groups': GROUPS,
    'group_label': GROUP_LABEL,
    'periods': PERIODS,
    'period_label': agg['fy_meta']['labels'],
    'fy_meta': agg['fy_meta'],
    'buckets': BUCKETS,
    'bucket_label': BUCKET_LABEL,
    'benchmarks': {'mttr_target': 120, 'revisit_target': 15.0, 'ftfr_target': 90.0},
    'person': person_out,
    'team': team_out,
    'company': company_out,
    'revisit': revisit_out,
    'revisit_trend': revisit_trend,
    'trend_months': CAL_MONTHS,
    'trend_partial_month': PARTIAL_MONTH,
    'revisit_snapshot_date': agg['fy_meta']['today'][:10],
    'data_snapshot_date': agg['fy_meta']['today'][:10],
}

OUT_PATH = os.path.join(BUILD_DIR, 'dashboard_data_v2.json')
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(final, f, ensure_ascii=False, separators=(',', ':'))

print('final size:', os.path.getsize(OUT_PATH))
print('persons:', len(person_out))
print('company total_case:', company_out['total_case'])
print('period_label:', final['period_label'])
