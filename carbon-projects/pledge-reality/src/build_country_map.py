import pandas as pd
import json

gcb = pd.read_csv('/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/processed/gcb_emissions.csv')
cw = pd.read_csv('/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/processed/cw_ndc_parsed.csv')

with open('/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/raw/wb_pop.json') as f:
    wb_data = json.load(f)
wb_map = {r['country']['value']: r['countryiso3code'] for r in wb_data[1]} if len(wb_data) > 1 else {}

cw_map = dict(zip(cw['country_cw'], cw['iso_code']))

manual_map = {
    'Brunei Darussalam': 'BRN',
    'Cape Verde': 'CPV',
    'Czechia': 'CZE',
    'Micronesia (Federated States of)': 'FSM',
    'Sao Tome and Principe': 'STP',
    'State of Palestine': 'PSE',
    'Timor-Leste': 'TLS',
    'Türkiye': 'TUR',
    'USA': 'USA',
    'Viet Nam': 'VNM',
    'Taiwan': 'TWN',
    'Kosovo': 'XKX',
    'Hong Kong': 'HKG',
    'Macao': 'MAC',
    'Greenland': 'GRL',
    'Bermuda': 'BMU',
    'Aruba': 'ABW',
    'Faeroe Islands': 'FRO',
    'Curaçao': 'CUW',
    'French Polynesia': 'PYF',
    'New Caledonia': 'NCL',
}

iso_mapping = {}
for c in gcb['country'].unique():
    if c in cw_map:
        iso_mapping[c] = cw_map[c]
    elif c in wb_map:
        iso_mapping[c] = wb_map[c]
    elif c in manual_map:
        iso_mapping[c] = manual_map[c]
    else:
        iso_mapping[c] = '' # No ISO code

pd.DataFrame(list(iso_mapping.items()), columns=['country', 'iso_code']).to_csv('/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/processed/country_iso_map.csv', index=False)
print("Created country_iso_map.csv")
