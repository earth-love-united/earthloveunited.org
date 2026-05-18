import pandas as pd
df = pd.read_parquet('/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet')
print('enriched:', df.shape)
print('Has cat_ndc_target_2030:', 'cat_ndc_target_2030_mtco2e' in df.columns)
print('Has cat_policy_gap:', 'cat_policy_vs_ndc_gap_mtco2e' in df.columns)
print('Columns:', [c for c in df.columns if 'cat_' in c][:10])

df2 = pd.read_parquet('/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/output/pledge_vs_reality_v2.parquet')
print()
print('v2:', df2.shape)
print('Has cat_ndc_target_2030:', 'cat_ndc_target_2030_mtco2e' in df2.columns)
print('Has cat_policy_gap:', 'cat_policy_vs_ndc_gap_mtco2e' in df2.columns)
print('Columns:', [c for c in df2.columns if 'cat_' in c][:10])
