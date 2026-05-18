import pandas as pd

path = '/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet'
df = pd.read_parquet(path)

print('=== GAP-RELATED COLUMNS IN ENRICHED ===')
gap_cols = [c for c in df.columns if 'gap' in c.lower() or 'target' in c.lower() or 'momentum' in c.lower() or 'divergence' in c.lower()]
for col in gap_cols:
    if df[col].dtype == 'object':
        n = (df[col] != '').sum()
    else:
        n = (df[col] > 0).sum() if df[col].dtype in ['float64', 'int64'] else df[col].notna().sum()
    pct = n / len(df) * 100
    print(f'  {col:45s} {n:5d}/{len(df)} ({pct:5.1f}%)')

print('\n=== TOP 15 EMITTERS 2024 ===')
df_2024 = df[df['year'] == 2024].sort_values('fossil_co2_mtCO2', ascending=False)
for _, row in df_2024.head(15).iterrows():
    country = row['country']
    co2 = row['fossil_co2_mtCO2']
    target_yr = int(row['cw_target_year']) if row['cw_target_year'] > 0 else '?'
    reduction = row['cw_reduction_pct']
    implied = row['implied_target_mtco2e']
    gap = row['reality_gap_mtco2e']
    momentum = row['momentum_cagr_10yr_pct']
    req_cagr = row['target_cagr_required_pct']
    divergence = row['momentum_vs_target_divergence_pct']
    on_track = row['on_track']
    
    parts = []
    if target_yr != '?': parts.append('target=' + str(target_yr))
    if reduction > 0: parts.append('reduction=' + str(reduction) + '%')
    if implied > 0: parts.append('implied=' + str(round(implied)))
    if gap != 0: parts.append('gap=' + str(round(gap)))
    if momentum != 0: parts.append('momentum=' + str(round(momentum, 2)) + '%')
    if req_cagr != 0: parts.append('req_cagr=' + str(round(req_cagr, 2)) + '%')
    if divergence != 0: parts.append('divergence=' + str(round(divergence, 2)) + '%')
    parts.append('on_track=' + str(on_track))
    
    print('  ' + country.ljust(30) + ' CO2=' + str(round(co2, 1)).rjust(8) + '  ' + ', '.join(parts))

print('\n=== ON TRACK DISTRIBUTION (2024) ===')
df_2024 = df[df['year'] == 2024]
print('  true:', (df_2024['on_track'] == 'true').sum())
print('  false:', (df_2024['on_track'] == 'false').sum())
print('  empty:', (df_2024['on_track'] == '').sum())
