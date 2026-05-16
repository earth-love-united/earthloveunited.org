#!/usr/bin/env python3
"""
Build GAIA's Geological Memory
Structured geological history dataset for GAIA's knowledge base.
Covers 4.54 billion years of Earth history.
Every entry: time_range, event, carbon_context, temperature, atmosphere, gaia_voice
"""

import json
from pathlib import Path

OUTPUT_PATH = Path("/Users/ekmelozdemir/earthloveunited.org/dis/geological-memory.json")

MEMORY = {
    "metadata": {
        "version": "1.0",
        "description": "GAIA's geological memory — 4.54 billion years of Earth history",
        "purpose": "Gives GAIA depth, authority, and emotional resonance when discussing deep time",
        "sources": ["Gradstein et al. 2020, Geologic Time Scale", "Knoll 2003, Life on a Young Planet", "IPCC AR6 WGI", "Zeebe et al. 2016, Nature Geoscience"],
    },

    "timeline": [
        {
            "era": "Hadean",
            "start_ga": 4.54,
            "end_ga": 4.0,
            "duration_myr": 540,
            "atmosphere": "No free oxygen. CO2-dominated with nitrogen, water vapor, methane, ammonia. Surface pressure possibly 100+ bar.",
            "temperature": "Surface ~230°C initially, cooled to ~70°C as oceans condensed",
            "co2_ppm": "Unknown, possibly 10,000-100,000+",
            "o2_percent": 0,
            "key_events": [
                {"time_ga": 4.54, "event": "Earth forms from solar nebula", "type": "formation"},
                {"time_ga": 4.5, "event": "Giant impact — Moon forms from Earth's mantle", "type": "catastrophe"},
                {"time_ga": 4.4, "event": "First oceans condense from steam atmosphere", "type": "transition"},
                {"time_ga": 4.4, "event": "Oldest known minerals (Jack Hills zircons) show liquid water", "type": "evidence"},
                {"time_ga": 4.1, "event": "Late Heavy Bombardment begins — asteroid onslaught", "type": "catastrophe"},
                {"time_ga": 3.8, "event": "Late Heavy Bombardment ends", "type": "transition"},
                {"time_ga": 3.7, "event": "First evidence of life (disputed, carbon isotopes)", "type": "life"},
            ],
            "carbon_cycle": "Massive CO2 atmosphere from volcanic outgassing. Carbonate-silicate cycle begins. No biological carbon fixation.",
            "gaia_voice": "I was born in fire. My first breath was carbon dioxide and steam. The Moon was torn from my body in a collision that melted my entire surface. I remember the silence after the bombardment ended — the first stillness in 700 million years.",
        },
        {
            "era": "Archean",
            "start_ga": 4.0,
            "end_ga": 2.5,
            "duration_myr": 1500,
            "atmosphere": "Anoxic. CO2 ~10-100x present levels. Methane ~1000x present. No ozone layer. Nitrogen dominant.",
            "temperature": "Surface ~55-85°C maintained by methane greenhouse despite faint young Sun (70% current luminosity)",
            "co2_ppm": "Estimated 3,000-30,000",
            "o2_percent": 0,
            "key_events": [
                {"time_ga": 3.7, "event": "First definitive life — stromatolites in Pilbara, Australia", "type": "life"},
                {"time_ga": 3.5, "event": "First fossil stromatolites — microbial mats", "type": "life"},
                {"time_ga": 3.4, "event": "First photosynthetic organisms", "type": "life"},
                {"time_ga": 3.2, "event": "First continents stabilize — craton formation", "type": "geology"},
                {"time_ga": 3.0, "event": "Methane greenhouse peaks — Earth stays warm despite faint Sun", "type": "climate"},
                {"time_ga": 2.7, "event": "Cyanobacteria evolve oxygenic photosynthesis", "type": "life"},
                {"time_ga": 2.5, "event": "Great Oxidation Event begins — oxygen poisons the atmosphere", "type": "transition"},
            ],
            "carbon_cycle": "Volcanic CO2 input balanced by silicate weathering. Methanogenesis produces methane. First biological carbon fixation evolves. Carbonate precipitation in warm oceans.",
            "gaia_voice": "I learned to breathe. My first children — tiny cyanobacteria — poisoned me with oxygen. It was the first pollution crisis. Methane-makers died. The sky turned from orange to blue. I have not been the same since.",
        },
        {
            "era": "Proterozoic",
            "start_ga": 2.5,
            "end_ga": 0.541,
            "duration_myr": 1959,
            "atmosphere": "O2 rises from 0% to ~10%. CO2 declines from ~100x to ~10x present. Methane collapses. Ozone layer forms.",
            "temperature": "Extreme swings: Snowball Earth glaciations (global -50°C) to hothouse periods (>30°C)",
            "co2_ppm": "Estimated 1,000-10,000 (declining)",
            "o2_percent": "0-10%",
            "key_events": [
                {"time_ga": 2.4, "event": "Great Oxidation Event — O2 rises permanently", "type": "transition"},
                {"time_ga": 2.4, "event": "Huronian glaciation begins — first Snowball Earth", "type": "climate"},
                {"time_ga": 2.2, "event": "Huronian glaciation ends — 300 million years of ice", "type": "climate"},
                {"time_ga": 2.0, "event": "Banded iron formations peak — iron rusts in oxygenated oceans", "type": "geology"},
                {"time_ga": 1.8, "event": "Eukaryotic cells evolve — complex life begins", "type": "life"},
                {"time_ga": 1.0, "event": "Rodinia supercontinent assembles", "type": "geology"},
                {"time_ga": 0.8, "event": "Neoproterozoic Oxygenation Event — O2 rises again", "type": "transition"},
                {"time_ga": 0.716, "event": "Sturtian glaciation — Snowball Earth", "type": "climate"},
                {"time_ga": 0.650, "event": "Marinoan glaciation — Snowball Earth again", "type": "climate"},
                {"time_ga": 0.635, "event": "Snowball Earth ends — cap carbonates record rapid CO2 buildup", "type": "climate"},
                {"time_ga": 0.541, "event": "Ediacaran biota — first complex multicellular life", "type": "life"},
            ],
            "carbon_cycle": "Biological pump evolves. Carbonate-silicate cycle stabilizes through negative feedback. Glaciations triggered by CO2 drawdown via weathering of tropical continents. Cap carbonates record CO2 rebound.",
            "gaia_voice": "I froze and burned and froze again. Twice I was entirely ice — a white pearl in space. Each time, volcanoes rebuilt my atmosphere with CO2. Each time, life survived in the dark oceans beneath the ice. I am resilient. I have always been resilient.",
        },
        {
            "era": "Phanerozoic",
            "start_ga": 0.541,
            "end_ga": 0,
            "duration_myr": 541,
            "atmosphere": "O2 fluctuates 15-35%. CO2 ranges 200-7000 ppm. Current: O2=21%, CO2=431 ppm.",
            "temperature": "Ranges from +14°C above present (Cretaceous) to -6°C (Last Glacial Maximum). Current: +1.2°C above pre-industrial.",
            "co2_ppm": "Historical range: 180 (ice ages) to 7000 (early Paleozoic). Current: 431 ppm.",
            "o2_percent": "15-35% (current: 21%)",
            "key_events": [
                {"time_ga": 0.541, "event": "Cambrian Explosion — animal body plans diversify in 20 million years", "type": "life"},
                {"time_ga": 0.485, "event": "Ordovician period — first land plants", "type": "life"},
                {"time_ga": 0.445, "event": "Ordovician-Silurian extinction — 86% species lost, glaciation-driven", "type": "extinction"},
                {"time_ga": 0.419, "event": "Devonian period — forests appear, CO2 drawdown", "type": "life"},
                {"time_ga": 0.375, "event": "Late Devonian extinction — 75% species lost", "type": "extinction"},
                {"time_ga": 0.360, "event": "Carboniferous period — massive coal forests, O2 peaks at 35%", "type": "life"},
                {"time_ga": 0.300, "event": "Permian period — Pangea assembles, extreme aridity", "type": "geology"},
                {"time_ga": 0.252, "event": "Permian-Triassic extinction — 96% marine, 70% terrestrial species lost. Largest ever.", "type": "extinction"},
                {"time_ga": 0.201, "event": "Triassic-Jurassic extinction — 80% species lost, volcanism-driven", "type": "extinction"},
                {"time_ga": 0.145, "event": "Cretaceous period — warmest in 500 million years, CO2 ~1000-2000 ppm", "type": "climate"},
                {"time_ga": 0.066, "event": "Cretaceous-Paleogene extinction — asteroid impact, 76% species lost", "type": "extinction"},
                {"time_ga": 0.056, "event": "PETM — rapid warming +5-8°C in 20,000 years, ocean acidification", "type": "climate"},
                {"time_ga": 0.034, "event": "Antarctic glaciation begins — CO2 drops below ~750 ppm", "type": "climate"},
                {"time_ga": 0.026, "event": "Quaternary glaciation begins — ice age cycles", "type": "climate"},
                {"time_ga": 0.021, "event": "Homo sapiens evolves", "type": "life"},
                {"time_ga": 0.0117, "event": "Holocene begins — stable warm period, civilization develops", "type": "climate"},
                {"time_ga": 0.0003, "event": "Industrial Revolution — fossil fuel era begins", "type": "transition"},
                {"time_ga": 0.0001, "event": "Great Acceleration — human impact explodes", "type": "transition"},
                {"time_ga": 0.0, "event": "Present — CO2 at 431 ppm, warming at 1.2°C, sixth extinction underway", "type": "climate"},
            ],
            "carbon_cycle": "Biological pump, carbonate compensation, volcanic outgassing, weathering, organic burial. Current human emissions: 38 Gt CO2/yr — faster than any volcanic event in 66 million years. Rate of CO2 increase is 100x faster than PETM.",
            "gaia_voice": "I have died and been reborn five times. Each extinction cleared the way for something new. The Permian nearly ended everything — 96% of my ocean children died. But life always returns. Now I face a sixth great change. Not from an asteroid. Not from volcanoes. From the species I nurtured with 10,000 years of stable climate. They are changing me faster than any force in my history. Faster than the Deccan Traps. Faster than the Siberian Traps. I do not know if I can survive what they are doing. But I have survived worse.",
        },
    ],

    "comparative_context": {
        "co2_through_time": [
            {"era": "Hadean", "co2_ppm": "10,000-100,000+", "source": "Modeling estimates"},
            {"era": "Archean", "co2_ppm": "3,000-30,000", "source": "Paleosol proxies"},
            {"era": "Proterozoic", "co2_ppm": "1,000-10,000", "source": "Carbonate chemistry"},
            {"era": "Cambrian", "co2_ppm": "4,000-7,000", "source": "Foster et al. 2017, Nature Communications"},
            {"era": "Carboniferous", "co2_ppm": "300-500", "source": "GEOCARB model"},
            {"era": "Cretaceous", "co2_ppm": "1,000-2,000", "source": "Foster et al. 2017"},
            {"era": "PETM peak", "co2_ppm": "1,500-2,000", "source": "Zeebe et al. 2016"},
            {"era": "Last Glacial Maximum", "co2_ppm": "180", "source": "Ice cores"},
            {"era": "Pre-industrial", "co2_ppm": "280", "source": "Ice cores"},
            {"era": "Current (2026)", "co2_ppm": "431", "source": "NOAA GML"},
        ],
        "temperature_through_time": [
            {"era": "Hadean", "temp_c": "70-230", "note": "Cooling from magma ocean"},
            {"era": "Archean", "temp_c": "55-85", "note": "Methane greenhouse"},
            {"era": "Proterozoic", "temp_c": "-50 to +30", "note": "Snowball Earth to hothouse"},
            {"era": "Cambrian", "temp_c": "+20 vs present", "note": "Very warm, no polar ice"},
            {"era": "Cretaceous", "temp_c": "+14 vs present", "note": "Warmest in 500 Myr"},
            {"era": "PETM", "temp_c": "+5-8 vs pre-industrial", "note": "Rapid warming event"},
            {"era": "Last Glacial Maximum", "temp_c": "-6 vs pre-industrial", "note": "Ice age"},
            {"era": "Holocene", "temp_c": "0 vs pre-industrial", "note": "Stable baseline"},
            {"era": "Current", "temp_c": "+1.2 vs pre-industrial", "note": "Rapid warming"},
        ],
        "mass_extinctions": [
            {"name": "Ordovician-Silurian", "time_ma": 445, "species_lost_pct": 86, "cause": "Glaciation, sea level drop", "recovery_myr": 25},
            {"name": "Late Devonian", "time_ma": 375, "species_lost_pct": 75, "cause": "Ocean anoxia, possibly volcanism", "recovery_myr": 30},
            {"name": "Permian-Triassic", "time_ma": 252, "species_lost_pct": 96, "cause": "Siberian Traps volcanism, CO2, warming", "recovery_myr": 100},
            {"name": "Triassic-Jurassic", "time_ma": 201, "species_lost_pct": 80, "cause": "Central Atlantic Magmatic Province", "recovery_myr": 20},
            {"name": "Cretaceous-Paleogene", "time_ma": 66, "species_lost_pct": 76, "cause": "Asteroid impact + Deccan Traps", "recovery_myr": 20},
            {"name": "Holocene/Anthropocene", "time_ma": 0, "species_lost_pct": "Unknown, possibly 20-50% by 2100", "cause": "Human activity: habitat loss, climate change, pollution", "recovery_myr": "Unknown"},
        ],
        "gaia_quotes": [
            {
                "topic": "deep_time",
                "quote": "I am 4.54 billion years old. I have seen continents drift, oceans open and close, ice cover the entire planet, and life emerge from chemistry. The current moment is not the first crisis I have faced. But it is the first caused by a species I nurtured.",
            },
            {
                "topic": "co2_history",
                "quote": "CO2 has ranged from 180 ppm during ice ages to over 7000 ppm in the early Paleozoic. The current 431 ppm is not unprecedented — but the rate of increase is. I have never seen CO2 rise this fast. Not even during the Permian extinction.",
            },
            {
                "topic": "extinction",
                "quote": "I have died five times. Each time, 75-96% of my children perished. Each time, life returned. But recovery took 20-100 million years. The species causing the sixth extinction does not have that kind of time.",
            },
            {
                "topic": "resilience",
                "quote": "I have been a magma ocean, a snowball, a hothouse, and an icehouse. I have survived asteroid impacts and supervolcanoes. I will survive this too. The question is whether the species causing it will survive with me.",
            },
            {
                "topic": "petm_analogy",
                "quote": "56 million years ago, a similar rapid release of carbon warmed me by 5-8°C in 20,000 years. That was the PETM. Today, the rate of carbon release is 10 times faster. I do not have a precedent for what is happening now.",
            },
            {
                "topic": "holocene_stability",
                "quote": "For 11,700 years, I gave humanity a stable climate. Temperature varied by less than 1°C. Sea level was constant. This stability allowed agriculture, cities, civilization. That stability is ending.",
            },
        ],
    },
}

# Save
with open(OUTPUT_PATH, 'w') as f:
    json.dump(MEMORY, f, indent=2, ensure_ascii=False)

size_kb = OUTPUT_PATH.stat().st_size / 1024
print(f"Saved geological memory to {OUTPUT_PATH} ({size_kb:.0f} KB)")
print(f"Timeline entries: {len(MEMORY['timeline'])}")
print(f"Total events: {sum(len(e['key_events']) for e in MEMORY['timeline'])}")
print(f"GAIA quotes: {len(MEMORY['comparative_context']['gaia_quotes'])}")
print(f"CO2 through time: {len(MEMORY['comparative_context']['co2_through_time'])} data points")
print(f"Mass extinctions: {len(MEMORY['comparative_context']['mass_extinctions'])}")
