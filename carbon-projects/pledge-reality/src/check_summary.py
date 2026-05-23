import pandas as pd

df = pd.read_parquet('/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet')

# Check ndc_summary coverage
has_summary = df[df['year'] == 2024]['ndc_summary'].notna().sum()
total = len(df[df['year'] == 2024])
print(f'ndc_summary coverage: {has_summary}/{total} ({has_summary/total*100:.1f}%)')

# Check a few countries
for country in ['United States', 'China', 'India', 'Germany', 'Brazil']:
    row = df[(df['country'] == country) & (df['year'] == 2024)].iloc[0]
    summary = row.get('ndc_summary', '')
    print(f'\n{country}:')
    print(f'  ndc_summary: {(str(summary) or "")[:200]}')
    print(f'  cw_ghg_target: {row.get("cw_ghg_target", "N/A")}')
    print(f'  cw_target_type: {row.get("cw_target_type", "N/A")}')
    print(f'  cw_reduction_pct: {row.get("cw_reduction_pct", "N/A")}')
    print(f'  cw_target_year: {row.get("cw_target_year", "N/A")}')
    print(f'  cw_baseline_year: {row.get("cw_baseline_year", "N/A")}')
