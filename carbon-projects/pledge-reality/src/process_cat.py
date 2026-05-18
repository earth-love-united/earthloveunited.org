#!/usr/bin/env python3
"""Process Climate Action Tracker ratings"""
import pandas as pd
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLEDGE_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PLEDGE_DIR, 'data')
RAW_DIR = os.path.join(DATA_DIR, 'raw')
PROC_DIR = os.path.join(DATA_DIR, 'processed')

RATING_SCORES = {
    '1.5°C Paris Agreement Compatible': 5,
    'Almost sufficient': 4,
    'Insufficient': 3,
    'Highly insufficient': 2,
    'Critically insufficient': 1,
}

CAT_COUNTRY_MAP = {
    'ARGENTINA': 'Argentina', 'INDONESIA': 'Indonesia',
    'IRAN (ISLAMIC REPUBLIC OF)': 'Iran', 'RUSSIAN FEDERATION': 'Russia',
    'SAUDI ARABIA': 'Saudi Arabia', 'THAILAND': 'Thailand',
    'TÜRKIYE': 'Turkey', 'USA': 'United States', 'VIET NAM': 'Vietnam',
    'CANADA': 'Canada', 'CHINA': 'China', 'EGYPT': 'Egypt', 'INDIA': 'India',
    'MEXICO': 'Mexico', 'NEW ZEALAND': 'New Zealand', 'SINGAPORE': 'Singapore',
    'AUSTRALIA': 'Australia', 'BRAZIL': 'Brazil', 'COLOMBIA': 'Colombia',
    'EU': 'European Union', 'GERMANY': 'Germany', 'JAPAN': 'Japan',
    'KAZAKHSTAN': 'Kazakhstan', 'PERU': 'Peru', 'SOUTH AFRICA': 'South Africa',
    'SOUTH KOREA': 'South Korea', 'SWITZERLAND': 'Switzerland',
    'UAE': 'United Arab Emirates', 'UNITED KINGDOM': 'United Kingdom',
    'BHUTAN': 'Bhutan', 'CHILE': 'Chile', 'COSTA RICA': 'Costa Rica',
    'ETHIOPIA': 'Ethiopia', 'KENYA': 'Kenya', 'MOROCCO': 'Morocco',
    'NEPAL': 'Nepal', 'NIGERIA': 'Nigeria', 'NORWAY': 'Norway',
    'PHILIPPINES': 'Philippines', 'THE GAMBIA': 'Gambia',
}

def process():
    df = pd.read_csv(os.path.join(RAW_DIR, 'cat_ratings.csv'))
    df['country'] = df['country'].str.strip().map(CAT_COUNTRY_MAP).fillna(df['country'])
    df['rating_score'] = df['rating'].map(RATING_SCORES)
    df['rating'] = df['rating'].str.strip()
    result = df[['country', 'rating', 'rating_score']].sort_values('country').reset_index(drop=True)
    os.makedirs(PROC_DIR, exist_ok=True)
    result.to_csv(os.path.join(PROC_DIR, 'cat_ratings.csv'), index=False)
    print(f"CAT: {len(result)} countries")
    print(result['rating'].value_counts().to_string())
    return result

if __name__ == '__main__':
    process()
