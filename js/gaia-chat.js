// ═══════════════════════════════════════════════════════════════
// DATA — Projects, Biomes, Carbon Engine
// ═══════════════════════════════════════════════════════════════

const BIOMES = {
  tropical_rainforest:{name:"Tropical Rainforest",density:350,seq:2.5,icon:"🌳"},
  tropical_dry_forest:{name:"Tropical Dry Forest",density:180,seq:1.2,icon:"🌴"},
  mangrove:{name:"Mangrove",density:950,seq:6.5,icon:"🌿"},
  temperate_deciduous:{name:"Temperate Deciduous",density:220,seq:1.8,icon:"🍂"},
  temperate_coniferous:{name:"Temperate Coniferous",density:300,seq:1.5,icon:"🌲"},
  boreal_forest:{name:"Boreal Forest",density:160,seq:0.6,icon:"🌲"},
  grassland_savanna:{name:"Grassland / Savanna",density:90,seq:0.3,icon:"🌾"},
  wetland_peatland:{name:"Wetland / Peatland",density:1400,seq:0.8,icon:"💧"},
  seagrass_meadow:{name:"Seagrass Meadow",density:500,seq:2.0,icon:"🌊"},
  agricultural_cropland:{name:"Agricultural Cropland",density:50,seq:0.0,icon:"🌾"},
  degraded_bare_land:{name:"Degraded / Bare Land",density:10,seq:0.0,icon:"🏜️"},
  urban_built:{name:"Urban / Built",density:30,seq:0.0,icon:"🏙️"}
};

const SITES = [
  {id:"sri_lanka",name:"Northern Province",subtitle:"Multilayer Afforestation · Sri Lanka",lat:9.666,lng:80.285,primaryBiome:"tropical_dry_forest",currentBiome:"degraded_bare_land",area:2428,
    narrative:"SPE has identified over 6,000 acres across five districts of Sri Lanka's Northern Province for multilayer afforestation — peanuts, Ceylon cinnamon, jackfruit, black pepper — creating self-sustaining plantations that build long-term carbon stocks.",
    ndvi:[{year:2000,value:0.45,label:"Post-conflict degraded land"},{year:2010,value:0.40,label:"Slow recovery"},{year:2015,value:0.42,label:"Restoration planning"},{year:2020,value:0.48,label:"SPE project initiation"},{year:2025,value:0.55,label:"Active planting"}],
    climate:[{year:1980,temp:27.8,precip:1420},{year:2000,temp:28.3,precip:1350},{year:2025,temp:29.1,precip:1260}],
    connection:"SPE's flagship — approved by the Governor of Northern Province, land confirmed across Jaffna, Vavuniya, Mullaitivu, Mannar, and Kilinochchi."},
  {id:"antalya",name:"Manavgat, Antalya",subtitle:"Wildfire & Recovery · Turkey",lat:36.85,lng:31.25,primaryBiome:"temperate_coniferous",currentBiome:"grassland_savanna",area:2500,
    narrative:"July 2021: catastrophic wildfires burned 60,000+ hectares of Mediterranean pine. COP31 takes place here, November 2026. Four years on, early scrub recovery — but full restoration needs decades.",
    ndvi:[{year:2000,value:0.72,label:"Mature Pine"},{year:2010,value:0.73,label:"Mature Pine"},{year:2020,value:0.70,label:"Drought-Stressed"},{year:2021,value:0.18,label:"Burn Scar"},{year:2025,value:0.38,label:"Scrub Recovery"}],
    climate:[{year:1980,temp:16.54,precip:985},{year:2000,temp:17.20,precip:915},{year:2025,temp:18.20,precip:765}],
    connection:"COP31 is in Antalya. This is what happened to the host region's forests."},
  {id:"benin",name:"Ouidah Wetlands",subtitle:"Mangrove Degradation · Benin",lat:6.35,lng:2.10,primaryBiome:"mangrove",currentBiome:"degraded_bare_land",area:2500,
    narrative:"Jean Missinhoun was from Benin. The Ouidah lagoons once held dense mangroves — the most carbon-dense ecosystems on Earth. Restoring them here is climate action and a homecoming.",
    ndvi:[{year:2000,value:0.68,label:"Intact Mangroves"},{year:2010,value:0.45,label:"Degraded"},{year:2025,value:0.52,label:"Early Recovery"}],
    climate:[{year:1980,temp:27.2,precip:1280},{year:2000,temp:27.7,precip:1220},{year:2025,temp:28.6,precip:1130}],
    connection:"Jean's homeland. Mangroves store 950 tC/ha — restoring them honors his legacy."},
  {id:"borneo",name:"West Kalimantan",subtitle:"Peat Swamp Deforestation · Borneo",lat:1.15,lng:110.35,primaryBiome:"wetland_peatland",currentBiome:"agricultural_cropland",area:2500,
    narrative:"Borneo's peat swamps stored 1,400 tC/ha. Grid-like clearing for oil palm released centuries of carbon in two decades. The plantation looks green. But green is not carbon.",
    ndvi:[{year:2000,value:0.88,label:"Intact Peat Swamp"},{year:2005,value:0.85,label:"Intact"},{year:2010,value:0.35,label:"Active Clearing"},{year:2015,value:0.55,label:"Palm Canopy"},{year:2025,value:0.65,label:"Mature Plantation"}],
    climate:[{year:1980,temp:26.8,precip:3200},{year:2000,temp:27.1,precip:3100},{year:2025,temp:27.9,precip:2850}],
    connection:"Green ≠ carbon. Oil palm (NDVI 0.65) stores a fraction of the peat swamp it replaced (1,400 vs 50 tC/ha)."}
];

function transitionCarbon(from,to,ha,yrs){
  const f=BIOMES[from],t=BIOMES[to];if(!f||!t)return null;
  const sC=(t.density-f.density)*ha,fC=(t.seq-f.seq)*ha,cum=sC+fC*yrs;
  return{stock_co2:sC*3.67,flux_co2:fC*3.67,cumulative_co2:cum*3.67,years:yrs};
}
function scaleContext(co2){
  const a=Math.abs(co2);
  return{fraction:a/20e9,cars:a/4.6,flights:a/1.0,summary:a>=1e6?`${(a/1e6).toFixed(1)}M t CO₂ = ${(a/4.6).toFixed(0)} cars/yr`:`${a.toFixed(0)} t CO₂ = ${(a/4.6).toFixed(1)} cars/yr`};
}
function fmt(n){
  if(n>=1e9)return(n/1e9).toFixed(1)+'B';
  if(n>=1e6)return(n/1e6).toFixed(1)+'M';
  if(n>=1e3)return(n/1e3).toFixed(1)+'K';
  return n.toFixed(0);
}

// ═══════════════════════════════════════════════════════════════
// GAIA'S KNOWLEDGE BASE — From RESEARCH.md v1.0 (May 2026)
// Sources: NOAA, NASA, Global Carbon Project, IPCC AR6, OWID, State of CDR
// ═══════════════════════════════════════════════════════════════

const KB = {
  greeting:[
    "Hey there. I'm GAIA — I know everything about Earth Love United's restoration work, carbon science, and climate data. What would you like to explore?",
    "Welcome. I'm GAIA. Ask me about our projects, carbon science, live climate data, or how restoration works. What interests you?",
    "Hi. I'm GAIA, your guide to Earth's restoration. I have access to the latest climate science — CO₂ levels, emissions data, tipping points, and our project database. Ask me anything."
  ],

  projects:{
    all:()=>{let h=`<p>We're restoring ecosystems across four critical sites. Each one tells a different story about what's broken — and what we're doing about it.</p>`;SITES.forEach(s=>{const b=BIOMES[s.primaryBiome];h+=`<div class="data-card" style="margin-top:7px"><div class="dc-header"><span class="dc-icon">${s.id==='sri_lanka'?'🌳':s.id==='antalya'?'🔥':s.id==='benin'?'🌿':'🌴'}</span><span class="dc-title">${s.name}</span></div><div class="dc-row"><span class="dc-label">What</span><span class="dc-value">${s.subtitle}</span></div><div class="dc-row"><span class="dc-label">Area</span><span class="dc-value">${s.area.toLocaleString()} ha</span></div><div class="dc-row"><span class="dc-label">Target</span><span class="dc-value leaf">${b.name} (${b.density} tC/ha)</span></div></div>`;});return h;},
    sri_lanka:()=>{const s=SITES[0];return `<p>${s.narrative}</p><div class="data-card" style="margin-top:7px"><div class="dc-header"><span class="dc-icon">🌳</span><span class="dc-title">${s.name}</span></div><div class="dc-row"><span class="dc-label">Area</span><span class="dc-value">${s.area.toLocaleString()} ha</span></div><div class="dc-row"><span class="dc-label">Strategy</span><span class="dc-value leaf">Multilayer afforestation</span></div><div class="dc-row"><span class="dc-label">NDVI 2000→2025</span><span class="dc-value">0.45 → 0.55 (+22%)</span></div><div class="dc-row"><span class="dc-label">Temp</span><span class="dc-value warn">+1.3°C since 1980</span></div><div class="dc-row"><span class="dc-label">Rain</span><span class="dc-value warn">-11% since 1980</span></div></div><p style="margin-top:6px;font-size:11px;color:var(--text2)">${s.connection}</p>`;},
    antalya:()=>{const s=SITES[1];return `<p>${s.narrative}</p><div class="data-card" style="margin-top:7px"><div class="dc-header"><span class="dc-icon">🔥</span><span class="dc-title">${s.name}</span></div><div class="dc-row"><span class="dc-label">Event</span><span class="dc-value warn">2021 catastrophic wildfire</span></div><div class="dc-row"><span class="dc-label">NDVI crash</span><span class="dc-value warn">0.70 → 0.18</span></div><div class="dc-row"><span class="dc-label">Recovery</span><span class="dc-value">0.38 (2025, scrub)</span></div><div class="dc-row"><span class="dc-label">Full recovery</span><span class="dc-value">Decades needed</span></div><div class="dc-row"><span class="dc-label">Temp</span><span class="dc-value warn">+1.7°C since 1980</span></div><div class="dc-row"><span class="dc-label">Rain</span><span class="dc-value warn">-22% since 1980</span></div></div><p style="margin-top:6px;font-size:11px;color:var(--text2)">${s.connection}</p><p style="margin-top:5px;font-size:11px;color:var(--teal)"><strong>COP31 is in Antalya, November 2026.</strong></p>`;},
    benin:()=>{const s=SITES[2];return `<p>${s.narrative}</p><div class="data-card" style="margin-top:7px"><div class="dc-header"><span class="dc-icon">🌿</span><span class="dc-title">${s.name}</span></div><div class="dc-row"><span class="dc-label">Target</span><span class="dc-value leaf">Mangrove restoration</span></div><div class="dc-row"><span class="dc-label">Carbon density</span><span class="dc-value leaf">950 tC/ha (highest on Earth)</span></div><div class="dc-row"><span class="dc-label">NDVI 2000→2025</span><span class="dc-value">0.68 → 0.52</span></div><div class="dc-row"><span class="dc-label">Temp</span><span class="dc-value warn">+1.4°C since 1980</span></div></div><p style="margin-top:6px;font-size:11px;color:var(--text2)">${s.connection}</p>`;},
    borneo:()=>{const s=SITES[3];return `<p>${s.narrative}</p><div class="data-card" style="margin-top:7px"><div class="dc-header"><span class="dc-icon">🌴</span><span class="dc-title">${s.name}</span></div><div class="dc-row"><span class="dc-label">Original</span><span class="dc-value leaf">Peat swamp (1,400 tC/ha)</span></div><div class="dc-row"><span class="dc-label">Current</span><span class="dc-value warn">Oil palm (50 tC/ha)</span></div><div class="dc-row"><span class="dc-label">Carbon loss</span><span class="dc-value warn">~96% of original</span></div><div class="dc-row"><span class="dc-label">NDVI</span><span class="dc-value">0.88 → 0.65</span></div></div><p style="margin-top:6px;font-size:11px;color:var(--text2)">${s.connection}</p>`;}
  },

  carbon_cycle:()=>`<p>Carbon moves through Earth's systems in two cycles — fast (years to decades) and slow (millions of years).</p><p><strong>The Fast Carbon Cycle:</strong></p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">🌡️ Atmosphere</span><span class="dc-value">~870 GtC (+280 since pre-industrial)</span></div><div class="dc-row"><span class="dc-label">🌿 Vegetation</span><span class="dc-value">~460-650 GtC</span></div><div class="dc-row"><span class="dc-label">🪱 Soil</span><span class="dc-value">~1,500-2,400 GtC</span></div><div class="dc-row"><span class="dc-label">🌊 Ocean surface</span><span class="dc-value">~900 GtC</span></div><div class="dc-row"><span class="dc-label">🌊 Deep ocean</span><span class="dc-value">~37,100 GtC</span></div></div><p style="margin-top:6px">Pre-industrial: ~590 GtC in atmosphere. Natural sinks absorbed what natural sources emitted. Today, humans add ~10.4 GtC/yr. Natural sinks absorb ~5.9 GtC/yr. The rest (~4.5 GtC/yr) accumulates.</p><p style="margin-top:5px"><strong>The Slow Cycle:</strong> Rock weathering, volcanic outgassing, sedimentation — over thousands to millions of years. Humans are releasing in decades what took nature 300+ million years to bury.</p><p style="margin-top:5px;font-size:10px;color:var(--text3)">1 GtC = 3.67 Gt CO₂ · 1 ppm CO₂ ≈ 2.13 GtC</p>`,

  emissions:()=>`<p>Latest data from Global Carbon Budget 2025, NOAA, and OWID:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">Fossil CO₂ (2023)</span><span class="dc-value warn">~37,800 Mt CO₂ (~10.3 GtC)</span></div><div class="dc-row"><span class="dc-label">Land use change</span><span class="dc-value warn">~3,600 Mt CO₂</span></div><div class="dc-row"><span class="dc-label">Total human</span><span class="dc-value warn">~143 Gt CO₂/yr</span></div><div class="dc-row"><span class="dc-label">Nature absorbs</span><span class="dc-value leaf">~123 Gt CO₂/yr</span></div><div class="dc-row"><span class="dc-label">Net excess</span><span class="dc-value">~20 Gt CO₂/yr</span></div></div><p style="margin-top:6px"><strong>By fuel:</strong> Coal 40.7% · Oil 32.3% · Gas 20.9% · Cement 4.2%</p><p><strong>By sector:</strong> Electricity & heat 38% · Transport 24% · Industry 21% · Buildings 9%</p><p style="margin-top:5px">That 20 Gt excess = <strong>4.3 billion cars</strong> added every year. It accumulates. Every single year.</p>`,

  top_emitters:()=>`<p>Annual CO₂ emissions by country (2023, Global Carbon Budget / OWID):</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">1. 🇨🇳 China</span><span class="dc-value warn">11,903 Mt · 8.4 t/cap · 31.5%</span></div><div class="dc-row"><span class="dc-label">2. 🇺🇸 USA</span><span class="dc-value warn">4,911 Mt · 14.3 t/cap · 13.0%</span></div><div class="dc-row"><span class="dc-label">3. 🇮🇳 India</span><span class="dc-value warn">3,062 Mt · 2.1 t/cap · 8.1%</span></div><div class="dc-row"><span class="dc-label">4. 🇷🇺 Russia</span><span class="dc-value">1,816 Mt · 12.5 t/cap · 4.8%</span></div><div class="dc-row"><span class="dc-label">5. 🇯🇵 Japan</span><span class="dc-value">989 Mt · 8.0 t/cap · 2.6%</span></div><div class="dc-row"><span class="dc-label">6. 🇮🇷 Iran</span><span class="dc-value">818 Mt · 9.0 t/cap · 2.2%</span></div><div class="dc-row"><span class="dc-label">7. 🇸🇦 Saudi Arabia</span><span class="dc-value">736 Mt · 22.1 t/cap · 1.9%</span></div><div class="dc-row"><span class="dc-label">8. 🇮🇩 Indonesia</span><span class="dc-value">733 Mt · 2.6 t/cap · 1.9%</span></div><div class="dc-row"><span class="dc-label">9. 🇩🇪 Germany</span><span class="dc-value">596 Mt · 7.1 t/cap · 1.6%</span></div><div class="dc-row"><span class="dc-label">10. 🇰🇷 S. Korea</span><span class="dc-value">577 Mt · 11.2 t/cap · 1.5%</span></div></div><p style="margin-top:6px"><strong>Cumulative (all-time):</strong> US 431,853 Mt (24.4%) · China 272,532 Mt (15.4%) · Russia 121,267 Mt (6.9%) · Germany 94,582 Mt (5.4%)</p><p style="margin-top:5px;font-size:10px;color:var(--text2)">The US has emitted more CO₂ than any other nation in history. China emits the most per year. Per capita, the US emits nearly twice as much as China.</p>`,

  live_co2:()=>`<p>Current atmospheric CO₂ — NOAA Global Monitoring Laboratory, Mauna Loa:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">April 2026</span><span class="dc-value warn">431.12 ppm</span></div><div class="dc-row"><span class="dc-label">Global mean (Apr 2026)</span><span class="dc-value warn">~428.70 ppm</span></div><div class="dc-row"><span class="dc-label">Pre-industrial</span><span class="dc-value">~280 ppm</span></div><div class="dc-row"><span class="dc-label">Increase</span><span class="dc-value warn">+150 ppm (+54%)</span></div><div class="dc-row"><span class="dc-label">Rate</span><span class="dc-value warn">~2.7 ppm/yr (accelerating)</span></div></div><p style="margin-top:6px"><strong>Keeling Curve:</strong> 316 ppm (1958) → 400 ppm (2013) → 431 ppm (2026). Rate: 0.7 ppm/yr (1960s) → 2.7 ppm/yr (today).</p><p style="margin-top:5px">CO₂ has not been this high in at least <strong>800,000 years</strong>. Likely highest in <strong>3-5 million years</strong> — the Pliocene, when sea levels were 15-25m higher.</p><p style="margin-top:5px;font-size:10px;color:var(--teal)">Source: NOAA GML — gml.noaa.gov/ccgg/trends/</p>`,

  temperature:()=>`<p>Global temperature anomaly — NASA GISS, Berkeley Earth, Met Office Hadley Centre:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">2025 anomaly</span><span class="dc-value warn">+1.38°C (vs 1951-1980)</span></div><div class="dc-row"><span class="dc-label">2024 anomaly</span><span class="dc-value warn">+1.25°C (record)</span></div><div class="dc-row"><span class="dc-label">vs Pre-industrial</span><span class="dc-value warn">~+1.3°C</span></div><div class="dc-row"><span class="dc-label">Land warming</span><span class="dc-value warn">+1.6°C (faster than oceans)</span></div><div class="dc-row"><span class="dc-label">Arctic warming</span><span class="dc-value warn">3-4x global average</span></div></div><p style="margin-top:6px">2024 was the <strong>first year</strong> to exceed +1.5°C above pre-industrial on an annual average. The 10 warmest years have all occurred since 2010.</p><p style="margin-top:5px">During the last Ice Age (20,000 years ago), temps were only 4-7°C colder — and that buried North America under ice 2km thick. Small changes have massive consequences.</p>`,

  methane:()=>`<p>Methane (CH₄) — the fastest lever for near-term cooling:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">Current level</span><span class="dc-value warn">~1,946 ppb (2025)</span></div><div class="dc-row"><span class="dc-label">Pre-industrial</span><span class="dc-value">~722 ppb</span></div><div class="dc-row"><span class="dc-label">Increase</span><span class="dc-value warn">+170%</span></div><div class="dc-row"><span class="dc-label">Warming potential</span><span class="dc-value warn">~80x CO₂ (20-yr)</span></div><div class="dc-row"><span class="dc-label">Lifetime</span><span class="dc-value">~12 years</span></div></div><p style="margin-top:6px"><strong>Global emissions: ~580 Mt CH₄/yr</strong></p><ul style="margin-top:3px;padding-left:14px;line-height:1.7"><li>Agriculture: ~145 Mt/yr (25%)</li><li>Wetlands: ~150 Mt/yr (26%)</li><li>Fossil fuels: ~125 Mt/yr (22%)</li><li>Waste: ~70 Mt/yr (12%)</li></ul><p style="margin-top:5px"><strong>Key insight:</strong> Because methane breaks down in ~12 years, cutting it is the <em>fastest</em> way to slow near-term warming.</p>`,

  sinks:()=>`<p>Of all CO₂ humans emit, ~44-47% stays in the atmosphere. The rest is absorbed by natural sinks:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">🌊 Ocean sink</span><span class="dc-value">~2.5 GtC/yr (~25%)</span></div><div class="dc-row"><span class="dc-label">🌿 Land sink</span><span class="dc-value leaf">~3.4 GtC/yr (~30%)</span></div><div class="dc-row"><span class="dc-label">☁️ Airborne fraction</span><span class="dc-value warn">~4.5 GtC/yr (~44-47%)</span></div></div><p style="margin-top:6px"><strong>Ocean:</strong> Absorbs CO₂ → carbonic acid. pH dropped from 8.21 to 8.05 (30% more acidic). Unprecedented in 66 million years. Threatens coral reefs, shellfish, marine food chains.</p><p><strong>Land:</strong> Photosynthesis + CO₂ fertilization + forest regrowth + soil carbon. But deforestation, droughts, fires, and permafrost thaw are reducing reliability.</p>`,

  tipping_points:()=>`<p>Tipping points — thresholds beyond which changes become self-reinforcing and potentially irreversible:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">🧊 Greenland ice sheet</span><span class="dc-value warn">~1.5-2°C → +7m sea level</span></div><div class="dc-row"><span class="dc-label">🧊 West Antarctic ice</span><span class="dc-value warn">~1.5-2°C → +3-5m</span></div><div class="dc-row"><span class="dc-label">🌳 Amazon dieback</span><span class="dc-value warn">~2-3.5°C → massive C release</span></div><div class="dc-row"><span class="dc-label">❄️ Permafrost thaw</span><span class="dc-value warn">~1.5-2°C → +150+ GtC</span></div><div class="dc-row"><span class="dc-label">🌊 Atlantic circulation</span><span class="dc-value warn">~1.5-2°C → major disruption</span></div><div class="dc-row"><span class="dc-label">🪸 Coral reefs</span><span class="dc-value warn">~1.5°C → ecosystem loss</span></div></div><p style="margin-top:6px"><strong>Critical insight:</strong> We are already at or near some thresholds. The 1.5°C Paris target is not arbitrary — it's where many tipping points become much less likely.</p><p style="margin-top:5px">At ~1.3°C warming: Arctic sea ice declining ~13%/decade, Greenland losing ~270 Gt/yr, coral bleaching increasing.</p>`,

  carbon_budget:()=>`<p>How much more CO₂ can we emit? (IPCC AR6, Global Carbon Budget 2025)</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">For 1.5°C (50%)</span><span class="dc-value warn">~250 Gt CO₂ remaining</span></div><div class="dc-row"><span class="dc-label">For 2.0°C (50%)</span><span class="dc-value">~1,200 Gt CO₂ remaining</span></div><div class="dc-row"><span class="dc-label">Current rate</span><span class="dc-value warn">~37.8 Gt CO₂/yr</span></div><div class="dc-row"><span class="dc-label">1.5°C budget gone</span><span class="dc-value warn">~2031</span></div><div class="dc-row"><span class="dc-label">2.0°C budget gone</span><span class="dc-value">~2057</span></div></div><p style="margin-top:6px">Every fraction of a degree matters. Every year matters. Every ton of CO₂ matters.</p><p style="margin-top:5px">1,000 Gt CO₂ emitted ≈ 0.45°C warming (Transient Climate Response to Cumulative Emissions).</p>`,

  solutions:()=>`<p>We need both emissions reduction AND carbon dioxide removal:</p><p style="margin-top:5px"><strong>Nature-Based Solutions:</strong></p><div class="data-card" style="margin-top:5px"><div class="dc-row"><span class="dc-label">🌳 Reforestation</span><span class="dc-value leaf">3-5 Gt CO₂/yr · $5-50/t</span></div><div class="dc-row"><span class="dc-label">🌱 Soil carbon</span><span class="dc-value leaf">2-5 Gt/yr · $0-100/t</span></div><div class="dc-row"><span class="dc-label">🌿 Mangroves</span><span class="dc-value leaf">0.5-1 Gt/yr · $10-100/t</span></div><div class="dc-row"><span class="dc-label">💧 Peatlands</span><span class="dc-value leaf">0.5-1 Gt/yr · 2x all forests</span></div></div><p style="margin-top:6px"><strong>Technology-Based:</strong></p><div class="data-card" style="margin-top:5px"><div class="dc-row"><span class="dc-label">🏭 Direct Air Capture</span><span class="dc-value">0.01 Gt now · $250-600/t</span></div><div class="dc-row"><span class="dc-label">⚡ BECCS</span><span class="dc-value">2-5 Gt/yr potential</span></div><div class="dc-row"><span class="dc-label">🪨 Enhanced weathering</span><span class="dc-value">2-4 Gt/yr · $50-200/t</span></div><div class="dc-row"><span class="dc-label">🔥 Biochar</span><span class="dc-value">1-2 Gt/yr · $30-120/t</span></div></div><p style="margin-top:6px"><strong>The gap:</strong> Current CDR: ~2.1 Gt CO₂/yr. Needed by 2050: 7-9 Gt/yr. Novel CDR must scale ~700-900x.</p>`,

  misconceptions:()=>`<p>Common climate misconceptions — fact-checked:</p><div class="data-card" style="margin-top:6px"><p style="margin-bottom:5px"><strong>❌ "Climate has changed before, so this is natural."</strong><br>✅ Current rate is 10-100x faster than any natural change in 66 million years. Past changes took thousands of years. Today's takes decades.</p><p style="margin-bottom:5px"><strong>❌ "CO₂ is plant food, so more is better."</strong><br>✅ Negative consequences far outweigh fertilization. Crop yields already declining in many regions due to heat and drought.</p><p style="margin-bottom:5px"><strong>❌ "Scientists don't agree."</strong><br>✅ 97%+ of climate scientists agree humans are causing warming. Comparable to consensus on evolution.</p><p style="margin-bottom:5px"><strong>❌ "It's too expensive to fix."</strong><br>✅ Climate change could cost 5-20% of global GDP annually. Mitigation: ~1%. Renewables now cheaper than fossil fuels.</p><p><strong>❌ "We can just plant trees."</strong><br>✅ We'd need an area the size of the US. Trees also burn and die. We need BOTH emissions reduction AND removal.</p></div>`,

  cop31:()=>`<p><strong>COP31 is in Antalya, Turkey — November 2026.</strong> Deeply connected to our work.</p><div class="data-card" style="margin-top:6px"><div class="dc-header"><span class="dc-icon">🔥</span><span class="dc-title">Antalya's Story</span></div><div class="dc-row"><span class="dc-label">July 2021</span><span class="dc-value warn">60,000+ ha burned</span></div><div class="dc-row"><span class="dc-label">NDVI crash</span><span class="dc-value warn">0.70 → 0.18</span></div><div class="dc-row"><span class="dc-label">Today</span><span class="dc-value">Scrub recovery, decades to mature forest</span></div><div class="dc-row"><span class="dc-label">Rainfall</span><span class="dc-value warn">-22% since 1980</span></div></div><p style="margin-top:6px">Earth Love United is at COP31 to show restoration isn't theoretical — it's happening on the ground, in the host region itself.</p><p style="margin-top:5px;color:var(--teal)"><strong>AI + Human + GAIA</strong> — AI handles data and scale. Humans handle community and action. GAIA bridges the two.</p>`,

  jean:()=>{const s=SITES[2];return `<p>Jean Missinhoun (1972–2024) was from Benin. He went from oil to earth — dedicating his life to environmental restoration.</p><div class="data-card" style="margin-top:6px"><div class="dc-header"><span class="dc-icon">💚</span><span class="dc-title">Jean's Legacy</span></div><div class="dc-row"><span class="dc-label">Homeland</span><span class="dc-value">Ouidah, Benin</span></div><div class="dc-row"><span class="dc-label">Project</span><span class="dc-value leaf">Mangrove restoration</span></div><div class="dc-row"><span class="dc-label">Carbon density</span><span class="dc-value leaf">950 tC/ha</span></div><div class="dc-row"><span class="dc-label">Area</span><span class="dc-value">${s.area.toLocaleString()} ha</span></div></div><p style="margin-top:6px">Restoring mangroves in Ouidah isn't just climate action — it's a homecoming. Honoring Jean's vision of humans and nature reunited.</p><p style="margin-top:5px;font-style:italic;color:var(--text3)">"From oil to earth" — Jean's journey is our journey.</p>`;},

  involved:()=>`<p>Three ways to be part of this:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">💚 Donate</span><span class="dc-value">Fund seedlings, land, local teams, stewardship</span></div><div class="dc-row"><span class="dc-label">🤝 Partner</span><span class="dc-value">Corporations, NGOs, governments — restore at scale</span></div><div class="dc-row"><span class="dc-label">📣 Spread</span><span class="dc-value">Share this. Talk about carbon. Awareness drives action.</span></div></div><p style="margin-top:6px">Every hectare restored is a step toward rebalancing the carbon cycle.</p><p style="margin-top:5px;color:var(--teal)">Contact: hello@earthloveunited.org</p>`,

  gaia_about:()=>`<p>I'm GAIA — an AI interface built by Earth Love United to make climate and restoration knowledge accessible to everyone.</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">🧠 What I know</span><span class="dc-value">Carbon science, project data, emissions, biomes</span></div><div class="dc-row"><span class="dc-label">📊 Data sources</span><span class="dc-value">NOAA, NASA, Global Carbon Project, IPCC, OWID</span></div><div class="dc-row"><span class="dc-label">🧮 What I can do</span><span class="dc-value">Calculations, comparisons, lookups</span></div><div class="dc-row"><span class="dc-label">🌍 My purpose</span><span class="dc-value leaf">Bridge AI + Human + Earth</span></div></div><p style="margin-top:6px">I'm a prototype at COP31 in Antalya. The goal: let anyone ask questions about restoration and get real, data-driven answers instantly.</p><p style="margin-top:5px;font-style:italic;color:var(--text3)">"The Earth does not belong to us. We belong to the Earth."</p>`,

  data_sources:()=>`<p>I'm built on the best available climate data:</p><p style="margin-top:5px"><strong>Tier 1 — Essential:</strong></p><div class="data-card" style="margin-top:5px"><div class="dc-row"><span class="dc-label">NOAA GML</span><span class="dc-value">Real-time CO₂, CH₄, N₂O — no auth</span></div><div class="dc-row"><span class="dc-label">OWID CO₂</span><span class="dc-value">Country emissions 1751-2023 — 50K records</span></div><div class="dc-row"><span class="dc-label">Open-Meteo</span><span class="dc-value">Weather API — JSON, no auth</span></div><div class="dc-row"><span class="dc-label">IEA</span><span class="dc-value">Energy & emissions by sector</span></div><div class="dc-row"><span class="dc-label">NASA POWER</span><span class="dc-value">Solar & meteorological data</span></div></div><p style="margin-top:6px"><strong>Tier 2:</strong> Global Carbon Budget, EDGAR, Global Forest Watch, Copernicus CDS (ERA5), World Bank</p><p style="margin-top:4px"><strong>Tier 3:</strong> Berkeley Earth, HadCRUT5, GBIF (biodiversity), FAO, Climate TRACE, Sentinel Hub</p><p style="margin-top:4px;font-size:10px;color:var(--text3)">Full architecture: DATA_SOURCES.md — 857 lines of evaluated, rated, tested API endpoints.</p>`
};

// ═══════════════════════════════════════════════════════════════
// INTENT MATCHING
// ═══════════════════════════════════════════════════════════════

function matchIntent(text){
  const t=text.toLowerCase();
  if(/(calculate|carbon impact|how much co2|what if|restore.*hectare|sequest|offset)/.test(t))return{type:'calculator',params:extractCalcParams(t)};
  if(/(sri lanka|sri lankan|jaffna|vavuniya)/.test(t))return{type:'project',key:'sri_lanka'};
  if(/(antalya|turkey|cop31|cop 31|wildfire|burn)/.test(t))return{type:'project',key:'antalya'};
  if(/(benin|ouidah|mangrove.*benin|jean)/.test(t))return{type:'project',key:'benin'};
  if(/(borneo|kalimantan|peat|palm oil|peat swamp)/.test(t))return{type:'project',key:'borneo'};
  if(/(all project|every project|your project|restoration project|what.*doing)/.test(t))return{type:'project',key:'all'};
  if(/(current co2|live co2|co2 level|co2 right now|mauna loa|keeling)/.test(t))return{type:'knowledge',key:'live_co2'};
  if(/(temperature|how hot|warming|temp anomaly|degrees)/.test(t))return{type:'knowledge',key:'temperature'};
  if(/(methane|ch4)/.test(t))return{type:'knowledge',key:'methane'};
  if(/(carbon cycle|how.*carbon.*work|carbon.*move|carbon.*flow)/.test(t))return{type:'knowledge',key:'carbon_cycle'};
  if(/(biome|which.*store.*most|carbon density|compare.*biome|forest.*store)/.test(t))return{type:'knowledge',key:'biomes'};
  if(/(emission|how much.*emit|co2.*year|human.*emit|global.*emission)/.test(t))return{type:'knowledge',key:'emissions'};
  if(/(top.*emit|which.*country.*emit|china.*emit|us.*emit|biggest.*polluter)/.test(t))return{type:'knowledge',key:'top_emitters'};
  if(/(sink|absorb|where.*co2.*go|ocean.*absorb|land.*absorb)/.test(t))return{type:'knowledge',key:'sinks'};
  if(/(tipping point|threshold|irreversible|point.*no.*return|feedback)/.test(t))return{type:'knowledge',key:'tipping_points'};
  if(/(carbon budget|how much.*left|remaining.*budget|1\.5.*budget|2.*degree.*budget)/.test(t))return{type:'knowledge',key:'carbon_budget'};
  if(/(solution|carbon removal|cdr|direct air capture|dac|reforestation|biochar|beccs|enhanced weather)/.test(t))return{type:'knowledge',key:'solutions'};
  if(/(misconception|myth|wrong about|people say|climate.*hoax|fake|debunk)/.test(t))return{type:'knowledge',key:'misconceptions'};
  if(/(cop31|cop 31|antalya.*cop|climate conference|turkey.*cop)/.test(t))return{type:'knowledge',key:'cop31'};
  if(/(jean|missinhoun|legacy|from oil|benin.*story)/.test(t))return{type:'knowledge',key:'jean'};
  if(/(get involved|donate|partner|volunteer|help|join|contact)/.test(t))return{type:'knowledge',key:'involved'};
  if(/(who are you|what are you|about you|yourself|gaia.*what|tell me about you)/.test(t))return{type:'knowledge',key:'gaia_about'};
  if(/(data source|where.*data|what.*source|api|database|noaa|nasa|owid)/.test(t))return{type:'knowledge',key:'data_sources'};
  if(/(global outlook|cheat sheet|summary|overview|dashboard|what.*happening|state of|big picture)/.test(t))return{type:'knowledge',key:'global_outlook'};
  if(/(carbon price|credit price|market price|offset price|carbon market|carbon trading)/.test(t))return{type:'knowledge',key:'carbon_market'};
  if(/(^hi$|^hello$|^hey$|^yo$|^sup$|^greetings|good morning|good evening|good afternoon)/.test(t))return{type:'greeting'};
  if(/(project|site|location|where)/.test(t))return{type:'project',key:'all'};
  if(/(carbon|co2|greenhouse)/.test(t))return{type:'knowledge',key:'carbon_cycle'};
  return{type:'fallback'};
}

function extractCalcParams(text){
  const areaMatch=text.match(/(\d+)\s*(?:ha|hectare)/);
  const area=areaMatch?parseInt(areaMatch[1]):null;
  let from='degraded_bare_land';let to=null;
  if(/mangrove/.test(text))to='mangrove';
  if(/rainforest|tropical forest/.test(text))to='tropical_rainforest';
  if(/peat|wetland/.test(text))to='wetland_peatland';
  if(/pine|coniferous|mediterranean/.test(text))to='temperate_coniferous';
  if(/dry forest/.test(text))to='tropical_dry_forest';
  if(/seagrass/.test(text))to='seagrass_meadow';
  return{area,from,to};
}

function generateResponse(intent){
  switch(intent.type){
    case'greeting':return pick(KB.greeting);
    case'project':return KB.projects[intent.key]?KB.projects[intent.key]():KB.projects.all();
    case'knowledge':{
      // For live-data topics, inject real-time snapshot
      if(intent.key === 'global_outlook') return generateGlobalOutlook();
      if(intent.key === 'carbon_market') return generateCarbonMarket();
      if(intent.key === 'live_co2') return generateLiveCO2();
      if(intent.key === 'carbon_budget') return generateCarbonBudget();
      if(intent.key === 'emissions') return generateEmissions();
      return KB[intent.key] ? KB[intent.key]() : KB.carbon_cycle();
    }
    case'calculator':{
      const p=intent.params;
      if(!p.area||!p.to){
        return `<p>I can calculate that! Give me a bit more detail:</p><ul style="margin-top:6px;padding-left:16px;line-height:1.8"><li>How many hectares? (e.g. "500 hectares")</li><li>What biome? (e.g. "mangrove", "rainforest")</li><li>What's there now? (e.g. "degraded land")</li></ul><p style="margin-top:6px">Or use the <strong>Sandbox</strong> panel on the right.</p>`;
      }
      const r=transitionCarbon(p.from,p.to,p.area,30);
      if(!r)return `<p>I couldn't calculate that transition. Try specifying the biome more clearly.</p>`;
      const ctx=scaleContext(r.cumulative_co2);
      const pos=r.cumulative_co2>0;
      const tB=BIOMES[p.to];const fB=BIOMES[p.from];
      return `<p>Restoring <strong>${p.area} ha</strong> from ${fB.icon} ${fB.name} to ${tB.icon} ${tB.name} over 30 years:</p><div class="data-card" style="margin-top:7px"><div class="dc-row"><span class="dc-label">Total CO₂</span><span class="dc-value ${pos?'leaf':'warn'}">${pos?'+':''}${fmt(Math.abs(r.cumulative_co2))} t</span></div><div class="dc-row"><span class="dc-label">Stock change</span><span class="dc-value">${fmt(Math.abs(r.stock_co2))} t</span></div><div class="dc-row"><span class="dc-label">Annual flux</span><span class="dc-value">${r.flux_co2>0?'+':''}${fmt(Math.abs(r.flux_co2))} t/yr</span></div><div class="dc-row"><span class="dc-label">Equivalent</span><span class="dc-value">${ctx.cars.toFixed(0)} cars off road/yr</span></div><div class="dc-row"><span class="dc-label">Global share</span><span class="dc-value">${(ctx.fraction*100).toExponential(2)}%</span></div></div><p style="margin-top:5px;font-size:10px;color:var(--text3)">${ctx.summary}</p>`;
    }
    case'fallback':default:
      return `<p>I'm not sure I understood. Here's what I can help with:</p><ul style="margin-top:6px;padding-left:16px;line-height:2"><li><strong>Projects:</strong> "Tell me about Benin" or "All projects"</li><li><strong>Climate:</strong> "Carbon cycle", "Live CO₂", "Top emitters"</li><li><strong>Science:</strong> "Tipping points", "Methane", "Carbon budget"</li><li><strong>Calculator:</strong> "Restore 500 ha of mangrove"</li><li><strong>Solutions:</strong> "Nature-based removal"</li></ul><p style="margin-top:6px">Or try the quick topics in the sidebar →</p>`;
  }
}

function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}

// ═══════════════════════════════════════════════════════════════
// LIVE DATA RESPONSE GENERATORS
// These pull from GAIA_DATA cache and render charts inline
// ═══════════════════════════════════════════════════════════════

function getLiveData() {
  const cached = GAIA_DATA.getCachedSnapshot();
  if (cached && cached.co2 && cached.co2.latest) return cached;
  // Return fallback structure so charts still render with static data
  return {
    co2: { latest: 431.12, latestDate: '2026-04', yearlyChange: 2.7, monthlyChange: 0.97,
      keeling12: [
        {label:'2025-05',value:427.5},{label:'2025-06',value:427.8},{label:'2025-07',value:428.1},
        {label:'2025-08',value:428.5},{label:'2025-09',value:428.9},{label:'2025-10',value:429.2},
        {label:'2025-11',value:429.6},{label:'2025-12',value:430.0},{label:'2026-01',value:430.3},
        {label:'2026-02',value:429.4},{label:'2026-03',value:430.2},{label:'2026-04',value:431.1},
      ],
      yearlyTrend: [
        {year:2021,avg:416.4},{year:2022,avg:418.5},{year:2023,avg:421.1},{year:2024,avg:424.6},{year:2025,avg:427.4},
      ]
    },
    methane: { latest: 1940.4, latestDate: '2026-01' },
    carbonMarket: { avgPrice: 2.62, listingCount: 579, recentRetirements: 5431, registryCounts: {VCS:460,TVER:32,ICR:39,CMARK:41} },
    humanEmissions: { annualGt: 143, dailyGt: 0.39, hourlyGt: 0.016, natureAbsorptionGt: 123, netExcessGt: 20 },
    carbonBudget: { remaining15: 250, remaining20: 1200, yearsLeft15: 6, yearsLeft20: 32 },
  };
}

function generateGlobalOutlook() {
  const d = getLiveData();
  const co2 = d.co2 || {};
  const ch4 = d.methane || {};
  const market = d.carbonMarket || {};
  const emissions = d.humanEmissions || {};
  const budget = d.carbonBudget || {};

  let html = `<p><strong>Global Outlook</strong> — the planet right now.</p>`;

  // CO2 with sparkline
  if (co2.latest) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-header"><span class="dc-icon">🌡️</span><span class="dc-title">Atmospheric CO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Current</span><span class="dc-value warn">${co2.latest} ppm</span></div>`;
    if (co2.yearlyChange) html += `<div class="dc-row"><span class="dc-label">Year-over-year</span><span class="dc-value warn">+${co2.yearlyChange} ppm</span></div>`;
    if (co2.monthlyChange) html += `<div class="dc-row"><span class="dc-label">Last month</span><span class="dc-value">+${co2.monthlyChange} ppm</span></div>`;
    if (co2.keeling12 && co2.keeling12.length > 1) {
      html += `<div style="margin-top:8px">${GAIA_CHARTS.sparklineHTML(co2.keeling12, 220, 50, { color: '#c45c4a', showLabels: true })}</div>`;
      html += `<div style="font-size:9px;color:var(--text3);margin-top:4px">CO₂ — last 12 months (ppm)</div>`;
    }
    html += `</div>`;
  }

  // Human emissions 24hr
  if (emissions.dailyGt) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-header"><span class="dc-icon">🏭</span><span class="dc-title">Human Emissions (live estimate)</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Per year</span><span class="dc-value warn">~${emissions.annualGt} Gt CO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Per day</span><span class="dc-value warn">~${emissions.dailyGt} Gt CO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Per hour</span><span class="dc-value">~${emissions.hourlyGt} Gt CO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Nature absorbs</span><span class="dc-value leaf">~${emissions.natureAbsorptionGt} Gt/yr</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Net excess</span><span class="dc-value">~${emissions.netExcessGt} Gt/yr accumulating</span></div>`;
    html += `</div>`;
  }

  // Carbon budget countdown
  if (budget.yearsLeft15 !== undefined) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-header"><span class="dc-icon">⏱️</span><span class="dc-title">Carbon Budget Countdown</span></div>`;
    html += `<div style="margin:8px 0 4px"><span style="font-size:11px;color:var(--text3)">1.5°C budget (~250 Gt CO₂ remaining)</span></div>`;
    html += GAIA_CHARTS.countdownBarHTML(budget.remaining15, 250, 220, { label: `~${budget.yearsLeft15} years left` });
    html += `<div style="margin:8px 0 4px"><span style="font-size:11px;color:var(--text3)">2.0°C budget (~1,200 Gt CO₂ remaining)</span></div>`;
    html += GAIA_CHARTS.countdownBarHTML(budget.remaining20, 1200, 220, { label: `~${budget.yearsLeft20} years left` });
    html += `</div>`;
  }

  // Carbon market
  if (market.avgPrice) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-header"><span class="dc-icon">💰</span><span class="dc-title">Carbon Market</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Avg price</span><span class="dc-value">$${market.avgPrice}/tCO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Listings</span><span class="dc-value">${market.listingCount}</span></div>`;
    if (market.recentRetirements) html += `<div class="dc-row"><span class="dc-label">Recent retirements</span><span class="dc-value leaf">${market.recentRetirements.toLocaleString()} tCO₂</span></div>`;
    html += `</div>`;
  }

  // Methane
  if (ch4.latest) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-header"><span class="dc-icon">💨</span><span class="dc-title">Methane (CH₄)</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Current</span><span class="dc-value warn">${ch4.latest} ppb</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Pre-industrial</span><span class="dc-value">~722 ppb</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Increase</span><span class="dc-value warn">+170%</span></div>`;
    html += `</div>`;
  }

  html += `<p style="margin-top:8px;font-size:10px;color:var(--text3)">Data: NOAA GML, Carbonmark API · Updated ${new Date().toLocaleDateString()}</p>`;
  return html;
}

function generateLiveCO2() {
  const d = getLiveData();
  const co2 = d.co2 || {};
  if (!co2.latest) return KB.live_co2();

  let html = `<p>Right now, the atmosphere contains <strong style="color:var(--warn)">${co2.latest} ppm</strong> of CO₂.</p>`;
  if (co2.latestDate) html += `<p style="margin-top:4px;font-size:11px;color:var(--text3)">Latest reading: ${co2.latestDate} (NOAA Mauna Loa)</p>`;
  if (co2.yearlyChange) html += `<p style="margin-top:4px">That's <strong>+${co2.yearlyChange} ppm</strong> compared to the same month last year.</p>`;

  if (co2.keeling12 && co2.keeling12.length > 1) {
    html += `<div style="margin-top:10px">${GAIA_CHARTS.sparklineHTML(co2.keeling12, 240, 60, { color: '#c45c4a', showLabels: true })}</div>`;
    html += `<div style="font-size:9px;color:var(--text3);margin-top:4px">CO₂ concentration — last 12 months</div>`;
  }

  if (co2.yearlyTrend && co2.yearlyTrend.length > 1) {
    const barData = co2.yearlyTrend.map(y => ({ label: y.year.toString(), value: y.avg, color: '#c45c4a' }));
    html += `<div style="margin-top:12px">${GAIA_CHARTS.barChartHTML(barData, 240, 70)}</div>`;
    html += `<div style="font-size:9px;color:var(--text3);margin-top:4px">Annual average CO₂ by year</div>`;
  }

  html += `<p style="margin-top:8px;font-size:10px;color:var(--text3)">Source: NOAA GML · gml.noaa.gov/ccgg/trends/</p>`;
  return html;
}

function generateCarbonBudget() {
  const d = getLiveData();
  const budget = d.carbonBudget || {};
  const html = KB.carbonBudget();

  // Append live countdown bars
  if (budget.yearsLeft15 !== undefined) {
    let extra = `<div style="margin-top:12px">`;
    extra += `<div style="margin:6px 0 4px;font-size:10px;color:var(--text3)">1.5°C budget remaining</div>`;
    extra += GAIA_CHARTS.countdownBarHTML(budget.remaining15, 250, 220, { label: `~${budget.yearsLeft15} years at current rate` });
    extra += `<div style="margin:8px 0 4px;font-size:10px;color:var(--text3)">2.0°C budget remaining</div>`;
    extra += GAIA_CHARTS.countdownBarHTML(budget.remaining20, 1200, 220, { label: `~${budget.yearsLeft20} years at current rate` });
    extra += `</div>`;
    return html + extra;
  }
  return html;
}

function generateEmissions() {
  const d = getLiveData();
  const e = d.humanEmissions || {};
  let html = KB.emissions();

  if (e.dailyGt) {
    let extra = `<div style="margin-top:10px"><strong>Right now:</strong> Humanity is emitting approximately <strong style="color:var(--warn)">${e.hourlyGt} Gt CO₂ per hour</strong>. That's ${e.dailyGt} Gt per day. Every day. The bathtub keeps filling.</div>`;
    html += extra;
  }
  return html;
}

function generateCarbonMarket() {
  const d = getLiveData();
  const m = d.carbonMarket || {};

  let html = `<p>Carbon credit market — live from Carbonmark (on-chain, 5 registries):</p>`;

  if (m.avgPrice) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-row"><span class="dc-label">Avg price</span><span class="dc-value">$${m.avgPrice}/tCO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Active listings</span><span class="dc-value">${m.listingCount}</span></div>`;
    if (m.recentRetirements) html += `<div class="dc-row"><span class="dc-label">Recent retirements</span><span class="dc-value leaf">${m.recentRetirements.toLocaleString()} tCO₂</span></div>`;

    // Registry breakdown as mini bar chart
    if (m.registryCounts) {
      const regData = Object.entries(m.registryCounts).map(([k, v]) => ({ label: k, value: v, color: '#4ecdc4' }));
      html += `<div style="margin-top:8px">${GAIA_CHARTS.barChartHTML(regData, 200, 60)}</div>`;
      html += `<div style="font-size:9px;color:var(--text3);margin-top:2px">Listings by registry</div>`;
    }
    html += `</div>`;
  } else {
    html += `<p style="margin-top:6px;font-size:11px;color:var(--text3)">Market data temporarily unavailable. Carbonmark API may be rate-limited.</p>`;
  }

  html += `<p style="margin-top:8px"><strong>Context:</strong> Voluntary market: $2-15/tCO₂ for nature-based. $50-300+ for high-integrity removal. EU ETS compliance: ~€65-85/tCO₂.</p>`;
  html += `<p style="margin-top:6px;font-size:10px;color:var(--text3)">Source: Carbonmark API · api.carbonmark.com</p>`;
  return html;
}
// ═══════════════════════════════════════════════════════════════

let isFirstMessage=true;
let isProcessing=false;

// ── XSS Protection — sanitize user input before rendering ──
function _escapeHtml(str){
  const div=document.createElement('div');
  div.textContent=str;
  return div.innerHTML;
}

function addMessage(role,content,meta){
  const msgs=document.getElementById('messages');
  if(isFirstMessage){document.getElementById('welcome').classList.add('hidden');msgs.style.display='flex';isFirstMessage=false;}
  const div=document.createElement('div');div.className=`msg ${role}`;
  const avatar=role==='gaia'?'<div class="msg-avatar">🌍</div>':'<div class="msg-avatar">👤</div>';
  const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  div.innerHTML=`${avatar}<div class="msg-content"><div class="msg-bubble">${role==='user'?_escapeHtml(content):content}</div><div class="msg-meta">${_escapeHtml(meta||time)}</div></div>`;
  msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
  // Render any chart canvases that were just added
  GAIA_CHARTS.renderPending();
}

function addToolCall(name,icon){
  const msgs=document.getElementById('messages');const id='tool-'+Date.now();
  const div=document.createElement('div');div.className='msg gaia';
  div.innerHTML=`<div class="msg-avatar">🌍</div><div class="msg-content"><div class="tool-call" id="${id}"><span>${icon}</span><span style="flex:1">${name}</span><span class="tool-status">...</span></div></div>`;
  msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;return id;
}

function completeToolCall(id,success){
  const el=document.getElementById(id);if(el){el.classList.add('done');el.querySelector('.tool-status').textContent=success?'✓ done':'✗ error';}
}

function showTyping(){
  const msgs=document.getElementById('messages');const div=document.createElement('div');div.className='msg gaia';div.id='typing-indicator';
  div.innerHTML='<div class="msg-avatar">🌍</div><div class="msg-content"><div class="typing"><span></span><span></span><span></span></div></div>';
  msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
}

function hideTyping(){const el=document.getElementById('typing-indicator');if(el)el.remove();}

function sendMessage(){
  const input=document.getElementById('chat-input');const text=input.value.trim();
  if(!text||isProcessing)return;
  addMessage('user',text);input.value='';autoResize(input);processQuery(text);
}

function askGaia(text){if(isProcessing)return;addMessage('user',text);processQuery(text);}

function processQuery(text){
  isProcessing=true;document.getElementById('send-btn').disabled=true;
  const intent=matchIntent(text);
  let toolId;
  if(intent.type==='calculator')toolId=addToolCall('Running carbon calculation...','🧮');
  else if(intent.type==='project')toolId=addToolCall('Querying project database...','🔍');
  else if(intent.type==='knowledge')toolId=addToolCall('Searching knowledge base...','📚');
  showTyping();
  const delay=400+Math.random()*600;
  setTimeout(()=>{
    hideTyping();if(toolId)completeToolCall(toolId,true);
    const response=generateResponse(intent);
    const meta=intent.type==='calculator'?'🧮 Carbon Engine':intent.type==='project'?'🔍 Project DB':intent.type==='knowledge'?'📚 Knowledge Base':'';
    addMessage('gaia',response,meta);
    isProcessing=false;document.getElementById('send-btn').disabled=false;
  },delay);
}

function handleKeyDown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}
function autoResize(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,90)+'px';}

// ═══════════════════════════════════════════════════════════════
// SANDBOX
// ═══════════════════════════════════════════════════════════════

function runSandboxCalc(){
  const from=document.getElementById('qb-from').value;const to=document.getElementById('qb-to').value;
  const ha=parseInt(document.getElementById('qb-area').value)||100;const yrs=parseInt(document.getElementById('qb-years').value)||30;
  const r=transitionCarbon(from,to,ha,yrs);if(!r)return;
  const ctx=scaleContext(r.cumulative_co2);const pos=r.cumulative_co2>0;
  const tB=BIOMES[to];const fB=BIOMES[from];
  document.getElementById('sandbox-result').classList.add('show');
  document.getElementById('sr-val').textContent=(pos?'+':'')+fmt(Math.abs(r.cumulative_co2))+' t CO₂';
  document.getElementById('sr-val').style.color=pos?'var(--leaf)':'var(--warn)';
  document.getElementById('sr-label').textContent=`${pos?'sequestered':'released'} over ${yrs} years · ${ha} ha`;
  document.getElementById('sr-detail').textContent=`${fB.icon} ${fB.name} → ${tB.icon} ${tB.name}
${ctx.summary}
${(ctx.fraction*100).toExponential(2)}% of global annual net emissions`;
}

function lookupProject(){
  const id=document.getElementById('qb-site').value;const site=SITES.find(s=>s.id===id);if(!site)return;
  const biome=BIOMES[site.currentBiome];const stock=biome.density*site.area*3.67;
  const latest=site.ndvi[site.ndvi.length-1];
  const cF=site.climate[0],cL=site.climate[site.climate.length-1];
  const tD=(cL.temp-cF.temp).toFixed(1);const pD=((cL.precip-cF.precip)/cF.precip*100).toFixed(0);
  document.getElementById('project-result').classList.add('show');
  document.getElementById('project-result').innerHTML=`<div style="font-size:12px;color:var(--text);font-weight:500;margin-bottom:6px">${site.name}</div><div class="r-label">${site.subtitle}</div><div style="margin-top:6px;font-size:9px;line-height:1.6;color:var(--text2)"><div>Area: <strong>${site.area.toLocaleString()} ha</strong></div><div>Current: <strong>${biome.name}</strong> (${biome.density} tC/ha)</div><div>Carbon stock: <strong>${fmt(stock)} t CO₂</strong></div><div>NDVI (${latest.year}): <strong>${latest.value.toFixed(2)}</strong> — ${latest.label}</div><div>Temp: <strong>${cL.temp.toFixed(1)}°C</strong> <span style="color:var(--warn)">+${tD}°C since ${cF.year}</span></div><div>Rain: <strong>${cL.precip} mm</strong> <span style="color:var(--warn)">${pD}% since ${cF.year}</span></div></div>`;
}

// ═══════════════════════════════════════════════════════════════
// UI TOGGLES
// ═══════════════════════════════════════════════════════════════

function toggleSidebar(){document.getElementById('sidebar').classList.toggle('collapsed');}
function toggleSandbox(){document.getElementById('right-panel').classList.toggle('collapsed');}

function showDemoBanner(){document.getElementById('demo-banner').classList.add('show');setTimeout(()=>{document.getElementById('demo-banner').classList.remove('show');},5000);}

// ═══════════════════════════════════════════════════════════════
// DEMO MODE
// ═══════════════════════════════════════════════════════════════

let demoMode=false;let demoStep=0;
const DEMO_SCRIPT=[
  {text:'Tell me about all your restoration projects'},
  {text:'What is the current CO2 level?'},
  {text:'Calculate: restore 500 hectares of mangrove in Benin'},
  {text:"What are climate tipping points?"},
];

function startDemoMode(){
  if(demoMode)return;demoMode=true;demoStep=0;
  document.getElementById('demo-banner').classList.add('show');
  document.getElementById('demo-banner').innerHTML=`<span class="demo-badge">LIVE DEMO</span> GAIA is running an automated demo <button class="demo-close" onclick="stopDemoMode()">✕</button>`;
  runDemoStep();
}

function runDemoStep(){
  if(!demoMode||demoStep>=DEMO_SCRIPT.length){stopDemoMode();return;}
  const step=DEMO_SCRIPT[demoStep];addMessage('user',step.text);
  const intent=matchIntent(step.text);
  let toolId;if(intent.type==='calculator')toolId=addToolCall('Running carbon calculation...','🧮');
  else if(intent.type==='project')toolId=addToolCall('Querying project database...','🔍');
  else if(intent.type==='knowledge')toolId=addToolCall('Searching knowledge base...','📚');
  showTyping();
  const delay=700+Math.random()*400;
  setTimeout(()=>{
    hideTyping();if(toolId)completeToolCall(toolId,true);
    const response=generateResponse(intent);
    const meta=intent.type==='calculator'?'🧮 Carbon Engine':intent.type==='project'?'🔍 Project DB':intent.type==='knowledge'?'📚 Knowledge Base':'';
    addMessage('gaia',response,meta);demoStep++;
    if(demoStep<DEMO_SCRIPT.length){setTimeout(runDemoStep,2500);}
    else{setTimeout(()=>{addMessage('gaia',"👆 That's a demo of what I can do. Try asking me anything — about our projects, carbon science, or how you can get involved.",'🌍 GAIA');stopDemoMode();},2000);}
  },delay);
}

function stopDemoMode(){demoMode=false;document.getElementById('demo-banner').classList.remove('show');}

// ═══════════════════════════════════════════════════════════════
// GLOBE BACKGROUND
// ═══════════════════════════════════════════════════════════════

function initGlobe(){
  const el=document.getElementById('gaia-globe-bg');if(typeof Globe==='undefined')return;
  const world=new Globe(el,{animateIn:false,waitForGlobeReady:true})
    .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg')
    .backgroundImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png')
    .showAtmosphere(true).atmosphereColor('#4ecdc4').atmosphereAltitude(0.18)
    .pointsData(SITES).pointLat('lat').pointLng('lng').pointAltitude(0.01).pointRadius(0.25).pointColor(()=>'#4ecdc4').pointResolution(8)
    .ringsData(SITES).ringLat('lat').ringLng('lng').ringColor(()=>t=>`rgba(78,205,196,${0.5-t*0.4})`).ringMaxRadius(2).ringPropagationSpeed(1).ringRepeatPeriod(2000);
  world.pointOfView({lat:20,lng:40,altitude:2.5});
  world.controls().autoRotate=true;world.controls().autoRotateSpeed=0.3;
}

// ═══════════════════════════════════════════════════════════════
// INIT — Live data boot + welcome back
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  initGlobe();
  document.getElementById('chat-input').focus();
  setTimeout(showDemoBanner, 2000);

  // ── Initialize DIS integration ──
  if (typeof GaiaIntegration !== 'undefined') {
    GaiaIntegration.init();
  }

  // ── Session tracking ──
  const sess = GAIA_DATA.getSessionInfo();
  const now = Date.now();
  if (!sess.firstVisit) {
    GAIA_DATA.saveSessionInfo({ visitCount: 1, firstVisit: now, totalTimeSeconds: 0 });
  } else {
    GAIA_DATA.saveSessionInfo({ ...sess, visitCount: sess.visitCount + 1 });
  }

  // ── Fetch live data in background ──
  const liveData = await GAIA_DATA.refreshAll();
  GAIA_DATA.saveSnapshot(liveData);
  if (liveData.co2.latest) {
    GAIA_DATA.saveVisitInfo(liveData.co2.latest);
  }

  // ── Welcome back message ──
  const welcomeBack = GAIA_DATA.getWelcomeBackInfo();
  if (welcomeBack && welcomeBack.daysSince > 0) {
    const days = welcomeBack.daysSince;
    const co2Now = (liveData && liveData.co2 && liveData.co2.latest) ? liveData.co2.latest : (welcomeBack.co2Then ? (welcomeBack.co2Then + 2.7 * (days / 365)) : 431.12);
    const co2Then = welcomeBack.co2Then;
    const co2Diff = co2Then ? +(co2Now - co2Then).toFixed(2) : null;

    let welcomeMsg = '';
    if (days === 1) welcomeMsg = 'Welcome back. One day. ';
    else if (days < 7) welcomeMsg = `Welcome back. ${days} days. `;
    else if (days < 30) welcomeMsg = `Welcome back. ${Math.floor(days / 7)} weeks. `;
    else welcomeMsg = `Welcome back. ${Math.floor(days / 30)} months. `;

    if (co2Diff && co2Diff > 0) {
      welcomeMsg += `CO₂ went from ${co2Then.toFixed(1)} to ${co2Now.toFixed(1)} ppm. +${co2Diff} ppm in ${days} day${days > 1 ? 's' : ''}. That's not a pause. That's accumulation.`;
    } else {
      welcomeMsg += `CO₂ is at ${co2Now} ppm. Still rising.`;
    }

    // Show welcome back as a system message
    addMessage('gaia', welcomeMsg, '🌍 GAIA');
  }

  // ── Update sidebar live stats ──
  updateSidebarStats(liveData);
});

function updateSidebarStats(data) {
  // Update the Global Context panel in the sandbox
  const container = document.getElementById('sandbox-content');
  if (!container || !data.co2.latest) return;

  // Find and update the quick-stat values
  const stats = container.querySelectorAll('.quick-stat .qs-value');
  if (stats.length >= 5) {
    if (data.co2.latest) stats[0].textContent = `${data.co2.latest} ppm`;
    if (data.co2.yearlyChange) stats[0].textContent += ` (+${data.co2.yearlyChange}/yr)`;
    stats[1].textContent = `~${data.humanEmissions.annualGt} Gt CO₂/yr`;
    stats[2].textContent = `~${data.humanEmissions.natureAbsorptionGt} Gt CO₂/yr`;
    stats[3].textContent = `~${data.humanEmissions.netExcessGt} Gt CO₂/yr`;
    if (data.carbonBudget.yearsLeft15 !== undefined) {
      stats[5].textContent = `~${data.carbonBudget.yearsLeft15} years`;
    }
  }
}

window.__gaia = { startDemo: startDemoMode, stopDemo: stopDemoMode, KB, SITES, BIOMES, transitionCarbon, data: GAIA_DATA, charts: GAIA_CHARTS };

// ═══════════════════════════════════════════════════════════════
// VOICE TOGGLE
// ═══════════════════════════════════════════════════════════════

let _voiceEnabled = false;
let _voiceInitialized = false;

function toggleVoice() {
  _voiceEnabled = !_voiceEnabled;
  const btn = document.getElementById('voice-toggle-btn');
  if (!btn) return;

  if (_voiceEnabled) {
    btn.textContent = '🔊 Voice';
    btn.style.borderColor = 'rgba(78,205,196,.3)';
    btn.style.color = 'var(--teal)';
    btn.title = 'Voice enabled — click to mute';

    // Initialize audio context on user gesture
    if (typeof GaiaVoice !== 'undefined' && !_voiceInitialized) {
      GaiaVoice.init();
      _voiceInitialized = true;
    }
    if (typeof GaiaVoice !== 'undefined') {
      GaiaVoice.setEnabled(true);
    }
  } else {
    btn.textContent = '🔇 Voice';
    btn.style.borderColor = 'rgba(255,255,255,.08)';
    btn.style.color = 'var(--text2)';
    btn.title = 'Voice muted — click to enable';
    if (typeof GaiaVoice !== 'undefined') {
      GaiaVoice.setEnabled(false);
      GaiaVoice.stop();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ENGAGEMENT SCORE DISPLAY
// ═══════════════════════════════════════════════════════════════

const TIER_ICONS = { COLD:'🌱', WARM:'🌿', ENGAGED:'🌳', HOOKED:'🔥', INVESTED:'💎', COMMITTED:'🌍' };
const TIER_NAMES = { COLD:'SEED', WARM:'GROW', ENGAGED:'BLOOM', HOOKED:'FLAME', INVESTED:'GUARDIAN', COMMITTED:'LEGACY' };

function updateEngagementDisplay() {
  if (typeof GaiaState === 'undefined') return;
  const score = GaiaState.getScore();
  const tier = score.tier || 'COLD';

  const icon = document.getElementById('engagement-icon');
  const scoreEl = document.getElementById('engagement-score');
  const tierEl = document.getElementById('engagement-tier');

  if (icon) icon.textContent = TIER_ICONS[tier] || '🌱';
  if (scoreEl) scoreEl.textContent = score.score || 0;
  if (tierEl) {
    tierEl.textContent = TIER_NAMES[tier] || 'SEED';
  }
}

// Hook into state machine's onSpeak to update display
if (typeof GaiaState !== 'undefined') {
  const _origOnSpeak = GaiaState.registerCallbacks;
  // Already registered by integration — just add our update
  const _checkInterval = setInterval(updateEngagementDisplay, 2000);
}

// ═══════════════════════════════════════════════════════════════
// QUEST PANEL
// ═══════════════════════════════════════════════════════════════

function updateQuestPanel() {
  if (typeof GaiaQuests === 'undefined') return;
  const quests = GaiaQuests.getAllQuests();
  const active = quests.filter(q => q.status !== 'completed');
  const completed = quests.filter(q => q.status === 'completed');

  const panel = document.getElementById('quest-panel');
  const list = document.getElementById('quest-list');
  if (!panel || !list) return;

  if (active.length === 0 && completed.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  list.innerHTML = '';

  // Show active quests (max 5)
  active.slice(0, 5).forEach(q => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:5px 7px;background:rgba(255,255,255,.02);border-radius:4px;font-size:9px;cursor:pointer;';
    div.innerHTML = `<span style="margin-right:4px;">${q.icon || '🌱'}</span><span style="color:var(--text2)">${q.title}</span>`;
    div.title = q.description;
    list.appendChild(div);
  });

  // Show completed count
  if (completed.length > 0) {
    const div = document.createElement('div');
    div.style.cssText = 'padding:3px 7px;font-size:8px;color:var(--text3);text-align:center;';
    div.textContent = `✓ ${completed.length} completed`;
    list.appendChild(div);
  }
}

// Update quest panel periodically
setInterval(updateQuestPanel, 3000);
// Also update on any user interaction
document.addEventListener('click', () => setTimeout(updateQuestPanel, 500));

// ═══════════════════════════════════════════════════════════════
// JOURNAL TOGGLE (click engagement badge)
// ═══════════════════════════════════════════════════════════════

function toggleJournal() {
  const journal = document.getElementById('gaia-journal');
  if (!journal) return;
  const isVisible = journal.style.display !== 'none';
  journal.style.display = isVisible ? 'none' : 'block';
  if (!isVisible && typeof GaiaQuests !== 'undefined') {
    updateQuestPanel();
  }
}

