#!/usr/bin/env python3
"""
Process Global Carbon Budget 2025 National Fossil CO2 Emissions
Output: country, year, fossil_co2_mtC, fossil_co2_mtCO2
"""
import pandas as pd
import numpy as np
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLEDGE_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PLEDGE_DIR, 'data')
RAW_DIR = os.path.join(DATA_DIR, 'raw')
PROC_DIR = os.path.join(DATA_DIR, 'processed')

# Country name normalization from GCB names to standard names
GCB_COUNTRY_MAP = {
    'AFGHANISTAN': 'Afghanistan',
    'ALBANIA': 'Albania',
    'ALGERIA': 'Algeria',
    'ANDORRA': 'Andorra',
    'ANGOLA': 'Angola',
    'ANGUILLA': 'Anguilla',
    'ANTIGUA & BARBUDA': 'Antigua and Barbuda',
    'ARGENTINA': 'Argentina',
    'ARMENIA': 'Armenia',
    'ARUBA': 'Aruba',
    'AUSTRALIA': 'Australia',
    'AUSTRIA': 'Austria',
    'AZERBAIJAN': 'Azerbaijan',
    'BAHAMAS': 'Bahamas',
    'BAHRAIN': 'Bahrain',
    'BANGLADESH': 'Bangladesh',
    'BARBADOS': 'Barbados',
    'BELARUS': 'Belarus',
    'BELGIUM': 'Belgium',
    'BELIZE': 'Belize',
    'BENIN': 'Benin',
    'BERMUDA': 'Bermuda',
    'BHUTAN': 'Bhutan',
    'BONAIRE, SAINT EUSTATIUS, AND SABA': 'Bonaire',
    'BOSNIA & HERZEGOVINA': 'Bosnia and Herzegovina',
    'BOTSWANA': 'Botswana',
    'BRAZIL': 'Brazil',
    'BRITISH VIRGIN ISLANDS': 'British Virgin Islands',
    'BRUNEI (DARUSSALAM)': 'Brunei',
    'BULGARIA': 'Bulgaria',
    'BURKINA FASO': 'Burkina Faso',
    'BURUNDI': 'Burundi',
    'CAMBODIA': 'Cambodia',
    'CANADA': 'Canada',
    'CAPE VERDE': 'Cape Verde',
    'CENTRAL AFRICAN REPUBLIC': 'Central African Republic',
    'CHAD': 'Chad',
    'CHILE': 'Chile',
    'CHINA (MAINLAND)': 'China',
    'COLOMBIA': 'Colombia',
    'COMOROS': 'Comoros',
    'CONGO': 'Republic of the Congo',
    'COOK ISLANDS': 'Cook Islands',
    'COSTA RICA': 'Costa Rica',
    'COTE D IVOIRE': "Cote d'Ivoire",
    'CROATIA': 'Croatia',
    'CUBA': 'Cuba',
    'CURACAO': 'Curacao',
    'CYPRUS': 'Cyprus',
    'CZECHIA': 'Czech Republic',
    'DEMOCRATIC PEOPLE S REPUBLIC OF KOREA': 'North Korea',
    'DEMOCRATIC REPUBLIC OF THE CONGO (FORMERLY ZAIRE)': 'DR Congo',
    'DENMARK': 'Denmark',
    'DJIBOUTI': 'Djibouti',
    'DOMINICA': 'Dominica',
    'DOMINICAN REPUBLIC': 'Dominican Republic',
    'ECUADOR': 'Ecuador',
    'EGYPT': 'Egypt',
    'EL SALVOR': 'El Salvador',
    'EL SALVADOR': 'El Salvador',
    'EQUATORIAL GUINEA': 'Equatorial Guinea',
    'ERITREA': 'Eritrea',
    'ESTONIA': 'Estonia',
    'ETHIOPIA': 'Ethiopia',
    'FAEROE ISLANDS': 'Faroe Islands',
    'FEDERATED STATES OF MICRONESIA': 'Micronesia',
    'FIJI': 'Fiji',
    'FINLAND': 'Finland',
    'FRANCE (INCLUDING MONACO)': 'France',
    'FRENCH POLYNESIA': 'French Polynesia',
    'GABON': 'Gabon',
    'GAMBIA': 'Gambia',
    'GEORGIA': 'Georgia',
    'GERMANY': 'Germany',
    'GHANA': 'Ghana',
    'GREECE': 'Greece',
    'GREENLAND': 'Greenland',
    'GRENADA': 'Grenada',
    'GUATEMALA': 'Guatemala',
    'GUINEA': 'Guinea',
    'GUINEA BISSAU': 'Guinea-Bissau',
    'GUYANA': 'Guyana',
    'HAITI': 'Haiti',
    'HONDURAS': 'Honduras',
    'HONG KONG SPECIAL ADMINSTRATIVE REGION OF CHINA': 'Hong Kong',
    'HUNGARY': 'Hungary',
    'ICELAND': 'Iceland',
    'INDIA': 'India',
    'INDONESIA': 'Indonesia',
    'IRAQ': 'Iraq',
    'IRELAND': 'Ireland',
    'ISLAMIC REPUBLIC OF IRAN': 'Iran',
    'ISRAEL': 'Israel',
    'ITALY (INCLUDING SAN MARINO)': 'Italy',
    'JAMAICA': 'Jamaica',
    'JAPAN': 'Japan',
    'JORDAN': 'Jordan',
    'KAZAKHSTAN': 'Kazakhstan',
    'KENYA': 'Kenya',
    'KIRIBATI': 'Kiribati',
    'KOSOVO': 'Kosovo',
    'KUWAIT': 'Kuwait',
    'KYRGYZSTAN': 'Kyrgyzstan',
    'LAO PEOPLE S DEMOCRATIC REPUBLIC': 'Laos',
    'LATVIA': 'Latvia',
    'LEBANON': 'Lebanon',
    'LESOTHO': 'Lesotho',
    'LIBERIA': 'Liberia',
    'LIBYAN ARAB JAMAHIRIYAH': 'Libya',
    'LIECHTENSTEIN': 'Liechtenstein',
    'LITHUANIA': 'Lithuania',
    'LUXEMBOURG': 'Luxembourg',
    'MACAU SPECIAL ADMINISTRATIVE REGION OF CHINA': 'Macau',
    'MACEDONIA': 'North Macedonia',
    'MADAGASCAR': 'Madagascar',
    'MALAWI': 'Malawi',
    'MALAYSIA': 'Malaysia',
    'MALDIVES': 'Maldives',
    'MALI': 'Mali',
    'MALTA': 'Malta',
    'MARSHALL ISLANDS': 'Marshall Islands',
    'MAURITANIA': 'Mauritania',
    'MAURITIUS': 'Mauritius',
    'MEXICO': 'Mexico',
    'MONGOLIA': 'Mongolia',
    'MONTENEGRO': 'Montenegro',
    'MONTSERRAT': 'Montserrat',
    'MOROCCO': 'Morocco',
    'MOZAMBIQUE': 'Mozambique',
    'MYANMAR (FORMERLY BURMA)': 'Myanmar',
    'NAMIBIA': 'Namibia',
    'NAURU': 'Nauru',
    'NEPAL': 'Nepal',
    'NETHERLANDS': 'Netherlands',
    'NEW CALEDONIA': 'New Caledonia',
    'NEW ZEALAND': 'New Zealand',
    'NICARAGUA': 'Nicaragua',
    'NIGER': 'Niger',
    'NIGERIA': 'Nigeria',
    'NIUE': 'Niue',
    'NORWAY': 'Norway',
    'OCCUPIED PALESTINIAN TERRITORY': 'Palestine',
    'OMAN': 'Oman',
    'PAKISTAN': 'Pakistan',
    'PALAU': 'Palau',
    'PANAMA': 'Panama',
    'PAPUA NEW GUINEA': 'Papua New Guinea',
    'PARAGUAY': 'Paraguay',
    'PERU': 'Peru',
    'PHILIPPINES': 'Philippines',
    'PLURINATIONAL STATE OF BOLIVIA': 'Bolivia',
    'POLAND': 'Poland',
    'PORTUGAL': 'Portugal',
    'QATAR': 'Qatar',
    'REPUBLIC OF CAMEROON': 'Cameroon',
    'REPUBLIC OF KOREA': 'South Korea',
    'REPUBLIC OF MOLDOVA': 'Moldova',
    'REPUBLIC OF SOUTH SUDAN': 'South Sudan',
    'REPUBLIC OF SUDAN': 'Sudan',
    'ROMANIA': 'Romania',
    'RUSSIAN FEDERATION': 'Russia',
    'RWANDA': 'Rwanda',
    'SAINT HELENA': 'Saint Helena',
    'SAINT LUCIA': 'Saint Lucia',
    'SAINT MARTIN (DUTCH PORTION)': 'Sint Maarten',
    'SAMOA': 'Samoa',
    'SAO TOME & PRINCIPE': 'Sao Tome and Principe',
    'SAUDI ARABIA': 'Saudi Arabia',
    'SENEGAL': 'Senegal',
    'SERBIA': 'Serbia',
    'SEYCHELLES': 'Seychelles',
    'SIERRA LEONE': 'Sierra Leone',
    'SINGAPORE': 'Singapore',
    'SLOVAKIA': 'Slovakia',
    'SLOVENIA': 'Slovenia',
    'SOLOMON ISLANDS': 'Solomon Islands',
    'SOMALIA': 'Somalia',
    'SOUTH AFRICA': 'South Africa',
    'SPAIN': 'Spain',
    'SRI LANKA': 'Sri Lanka',
    'ST. KITTS-NEVIS': 'Saint Kitts and Nevis',
    'ST. PIERRE & MIQUELON': 'Saint Pierre and Miquelon',
    'ST. VINCENT & THE GRENADINES': 'Saint Vincent and the Grenadines',
    'SURINAME': 'Suriname',
    'ESWATINI': 'Eswatini',
    'SWEDEN': 'Sweden',
    'SWITZERLAND': 'Switzerland',
    'SYRIAN ARAB REPUBLIC': 'Syria',
    'TAIWAN': 'Taiwan',
    'TAJIKISTAN': 'Tajikistan',
    'THAILAND': 'Thailand',
    'TIMOR-LESTE (FORMERLY EAST TIMOR)': 'Timor-Leste',
    'TOGO': 'Togo',
    'TONGA': 'Tonga',
    'TRINIDAD AND TOBAGO': 'Trinidad and Tobago',
    'TUNISIA': 'Tunisia',
    'TURKIYE': 'Turkey',
    'TURKMENISTAN': 'Turkmenistan',
    'TURKS AND CAICOS ISLANDS': 'Turks and Caicos',
    'TUVALU': 'Tuvalu',
    'UGANDA': 'Uganda',
    'UKRAINE': 'Ukraine',
    'UNITED ARAB EMIRATES': 'United Arab Emirates',
    'UNITED KINGDOM': 'United Kingdom',
    'UNITED REPUBLIC OF TANZANIA': 'Tanzania',
    'UNITED STATES OF AMERICA': 'United States',
    'URUGUAY': 'Uruguay',
    'UZBEKISTAN': 'Uzbekistan',
    'VANUATU': 'Vanuatu',
    'VENEZUELA': 'Venezuela',
    'VIET NAM': 'Vietnam',
    'WALLIS AND FUTUNA ISLANDS': 'Wallis and Futuna',
    'YEMEN': 'Yemen',
    'ZAMBIA': 'Zambia',
    'ZIMBABWE': 'Zimbabwe',
    # Mixed-case exact matches from GCB 2025 Excel
    'USA': 'United States',
    'Türkiye': 'Turkey',
}

def process():
    print("Loading GCB National Fossil Emissions...")
    df = pd.read_excel(
        os.path.join(RAW_DIR, 'gcb_national_fossil_emissions_v2025.xlsx'),
        sheet_name='Territorial Emissions',
        header=None
    )
    
    # Row 11 has country names, row 0 has "MtC/yr" unit label
    # Column 0 has years starting from row 12
    header_row = 11
    data_start_row = 12
    
    # Extract year column and country columns
    years = df.iloc[data_start_row:, 0].values
    country_names = df.iloc[header_row, 1:].values
    
    # Build mapping: col_index -> country_name
    records = []
    for col_idx in range(1, len(country_names) + 1):
        gcb_name = country_names[col_idx - 1]
        if pd.isna(gcb_name):
            continue
        
        gcb_name = str(gcb_name).strip()
        # Try exact match, then uppercase (map has UPPERCASE keys), then special cases
        country = GCB_COUNTRY_MAP.get(gcb_name, 
                  GCB_COUNTRY_MAP.get(gcb_name.upper(), gcb_name))
        
        # Skip regions and special categories
        if any(skip in gcb_name for skip in ['KP Annex', 'Non KP', 'OECD', 'Non-OECD', 'EU27',
                                                      'Africa', 'Asia', 'Central America', 'Europe',
                                                      'Middle East', 'North America', 'Oceania', 'South America',
                                                      'International', 'Statistical', 'World']):
            continue
        
        # Extract emissions for this country
        emissions = df.iloc[data_start_row:, col_idx].values
        
        for i, year in enumerate(years):
            if pd.isna(year) or pd.isna(emissions[i]):
                continue
            year = int(year)
            if year < 2015 and year not in [1990, 2000, 2005, 2006, 2008, 2010, 2012, 2013, 2014]:
                continue
            if year > 2024:
                continue
            
            val = float(emissions[i])
            if val < 0:
                val = 0.0
            
            records.append({
                'country': country,
                'year': year,
                'fossil_co2_mtC': round(val, 3),
                'fossil_co2_mtCO2': round(val * 3.664, 3)
            })
    
    result = pd.DataFrame(records)
    result = result.sort_values(['country', 'year']).reset_index(drop=True)
    
    os.makedirs(PROC_DIR, exist_ok=True)
    result.to_csv(os.path.join(PROC_DIR, 'gcb_emissions.csv'), index=False)
    
    print(f"Processed {len(result)} country-year records")
    print(f"Countries: {result['country'].nunique()}")
    print(f"Years: {result['year'].min()} - {result['year'].max()}")
    print(f"\nSample (top emitters 2024):")
    top = result[result['year'] == 2024].nlargest(10, 'fossil_co2_mtCO2')
    print(top[['country', 'year', 'fossil_co2_mtCO2']].to_string(index=False))
    
    return result

if __name__ == '__main__':
    process()
