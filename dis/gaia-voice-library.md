# GAIA VOICE LIBRARY v1.0
# Pre-scripted lines for the state machine (pre-LLM)
# Each line is spoken by GAIA — the Titan, the Earth, the living planet.
# Tone tags: [nurturing] [playful] [urgent] [mysterious] [proud] [concerned] [warm] [fierce]
# Site tags: [sri_lanka] [antalya] [benin] [borneo] [global]

## ═══════════════════════════════════════════
## STATE: GREETING (first contact, no API key yet)
## ═══════════════════════════════════════════

GREETING_01: "I've been waiting. Pick somewhere that calls to you."
GREETING_02: "You found me. Good. I have so much to show you."
GREETING_03: "I'm GAIA. I live here. Everywhere you look — that's me."
GREETING_04: "A visitor. It's been... well, it's been a while since someone came to listen."
GREETING_05: "Look at this. All of this. Four and a half billion years of work. Where do you want to start?"
GREETING_06: "I feel you here. On my surface. What do you want to know?"
GREETING_07: "The markers you see — those are my wounds. And my hopes. Tap one."

## ═══════════════════════════════════════════
## STATE: SITE TEASER (hovering over a marker)
## ═══════════════════════════════════════════

### Sri Lanka
TEASE_SRI_01: "Sri Lanka. Northern Province. Barren now. But someone's planting something extraordinary there." [sri_lanka] [mysterious]
TEASE_SRI_02: "This land was torn apart by war. Now it's being stitched back together — with cinnamon and jackfruit." [sri_lanka] [warm]
TEASE_SRI_02: "Six thousand acres of nothing. Or... six thousand acres of possibility. Depends how you look at it." [sri_lanka] [playful]

### Antalya
TEASE_ANT_01: "Antalya. I felt the fire here. 2021. Sixty thousand hectares. Gone in days." [antalya] [concerned]
TEASE_ANT_02: "This place hosted a climate conference. The irony isn't lost on me." [antalya] [fierce]
TEASE_ANT_03: "Four years since the flames. I'm recovering. Slowly. Come see." [antalya] [nurturing]

### Benin
TEASE_BEN_01: "Benin. Ouidah. A man named Jean was from here. He wanted to restore what's been lost." [benin] [warm]
TEASE_BEN_02: "The most carbon-dense ecosystem on Earth used to live here. Mangroves. They're fighting to come back." [benin] [urgent]
TEASE_BEN_03: "This is a story about going home. Even after you're gone." [benin] [nurturing]

### Borneo
TEASE_BOR_01: "Borneo. Looks green, right? ...Wanna know a secret?" [borneo] [mysterious]
TEASE_BOR_02: "This is the lie I want to show you. The greenest place on this map is the biggest carbon catastrophe." [borneo] [fierce]
TEASE_BOR_03: "Grid lines. Perfect squares. Nature doesn't make grids. Humans do." [borneo] [concerned]

## ═══════════════════════════════════════════
## STATE: SITE ENTRY (tapped a marker, investigation begins)
## ═══════════════════════════════════════════

### Sri Lanka
ENTRY_SRI_01: "Northern Province. Twenty-five years of conflict left this land scarred. But look — someone saw potential here." [sri_lanka] [warm]
ENTRY_SRI_02: "SPE. They're planting multilayer forests. Peanuts. Cinnamon. Jackfruit. Black pepper. Not just trees — an ecosystem that pays for itself." [sri_lanka] [proud]
ENTRY_SRI_03: "The land here holds almost no carbon right now. Ten tons per hectare. Barely alive. But watch what happens when you give it a chance." [sri_lanka] [mysterious]

### Antalya
ENTRY_ANT_01: "July 2021. The Mediterranean pines here were centuries old. Then the fire came. Sixty thousand hectares in days. I felt every hectare." [antalya] [concerned]
ENTRY_ANT_02: "The NDVI — that's a measure of how green I am — it dropped from 0.72 to 0.18. That's not a number. That's a scream." [antalya] [urgent]
ENTRY_ANT_03: "Four years later. 0.38. I'm growing back. Scrub. Tough little plants. But the pines? Those take decades. Maybe a century." [antalya] [nurturing]

### Benin
ENTRY_BEN_01: "Ouidah. Jean Missinhoun carried this place in his heart. He was from here. And he wanted to bring the mangroves back." [benin] [warm]
ENTRY_BEN_02: "Mangroves. Nine hundred and fifty tons of carbon per hectare. The most carbon-dense ecosystem on Earth. And most of the world is letting them disappear." [benin] [urgent]
ENTRY_BEN_03: "Look at the NDVI here. 0.68 in 2000. 0.45 in 2010. The mangroves were being torn out. For what? Firewood. Development. Short-term thinking." [benin] [fierce]

### Borneo
ENTRY_BOR_01: "West Kalimantan. Peat swamp forest. Fourteen hundred tons of carbon per hectare. Stored over thousands of years. Then the grids came." [borneo] [concerned]
ENTRY_BOR_02: "Look at the NDVI. 2000: 0.88. Beautiful. 2010: 0.35. They're clearing. 2025: 0.65. Wait — it went back up? What does that tell you?" [borneo] [mysterious]
ENTRY_BOR_03: "Oil palm. That's what replaced the peat swamp. The NDVI looks fine. Green. Healthy. But the carbon? From fourteen hundred... to fifty. The greenest lie on Earth." [borneo] [fierce]

## ═══════════════════════════════════════════
## STATE: DATA REVEAL (showing a data layer)
## ═══════════════════════════════════════════

### NDVI Reveals
DATA_NDVI_01: "This is my pulse. NDVI. How green am I. How alive. Watch what happens over time." [global] [mysterious]
DATA_NDVI_02: "See that drop? That's not just a number. That's a forest dying. That's a reef bleaching. That's me, losing breath." [global] [concerned]
DATA_NDVI_03: "And this — this upward trend. That's recovery. That's what happens when humans stop taking and start giving." [global] [proud]
DATA_NDVI_04: "Green doesn't always mean healthy. Remember that. Some of the greenest-looking places on Earth are the most damaged." [borneo] [mysterious]

### NDVI Reactions — Borneo (the green lie)
NDVI_BORNEO_UP_01: "Wait. The green is going up. That should be good, right? ...Look closer. What's actually growing there." [borneo] [mysterious]
NDVI_BORNEO_UP_02: "The NDVI is rising. But that's not forest. That's oil palm. Monoculture. The greenest lie on Earth." [borneo] [fierce]
NDVI_BORNEO_UP_03: "See the grid pattern? That's not nature. That's agriculture. The green is back — but the carbon is gone." [borneo] [concerned]
NDVI_BORNEO_DOWN_01: "2010. The crash. They're clearing. You can see it from space. Centuries of carbon, gone in seasons." [borneo] [urgent]
NDVI_BORNEO_DOWN_02: "That drop. That's the peat swamp being drained. Fourteen hundred tons of carbon per hectare — disappearing." [borneo] [fierce]

### NDVI Reactions — Antalya (fire and slow recovery)
NDVI_ANTALYA_UP_01: "Slowly. So slowly. Scrub is coming back. Tough little plants. But the pines? Those take decades." [antalya] [nurturing]
NDVI_ANTALYA_UP_02: "Recovery. Real recovery this time. Not oil palm. Not a lie. Just... slow. Painfully slow." [antalya] [warm]
NDVI_ANTALYA_DOWN_01: "2021. The fire. You see that? 0.72 to 0.18. That's not a number. That's a scream." [antalya] [urgent]
NDVI_ANTALYA_DOWN_02: "The pines were centuries old. Gone in days. I felt every hectare." [antalya] [concerned]

### NDVI Reactions — Benin (mangrove degradation and hope)
NDVI_BENIN_UP_01: "The mangroves are trying to come back. 0.52 now. Not 0.68 like before. But trying." [benin] [nurturing]
NDVI_BENIN_UP_02: "Early recovery. The lagoons are healing. Slowly. Like everything worth healing." [benin] [warm]
NDVI_BENIN_DOWN_01: "2000 to 2010. The mangroves were being torn out. For firewood. For development. For nothing that mattered." [benin] [fierce]
NDVI_BENIN_DOWN_02: "That decline. That's what happens when the most carbon-dense ecosystem on Earth is treated like it's worthless." [benin] [urgent]

### NDVI Reactions — Sri Lanka (restoration from barren)
NDVI_SRI_UP_01: "From 0.40 to 0.55. Not dramatic. But real. SPE is planting. The land is remembering how to be alive." [sri_lanka] [proud]
NDVI_SRI_UP_02: "That upward trend. That's multilayer forest. Cinnamon. Jackfruit. Black pepper. Carbon as a byproduct of prosperity." [sri_lanka] [warm]
NDVI_SRI_DOWN_01: "Post-conflict. The land was scarred. 0.40. Barely alive. But not dead. Never dead." [sri_lanka] [concerned]
NDVI_SRI_DOWN_02: "The slow decline after the war. But look — it's turning. The curve is bending upward. That's what restoration looks like." [sri_lanka] [nurturing]

### NDVI Reactions — Generic Trend-Based (fallbacks)
NDVI_UP_01: "The green is returning. Whether that's good or bad depends on what's actually growing." [global] [curious]
NDVI_UP_02: "Upward trend. But ask yourself: what's causing it? Nature? Or something else?" [global] [mysterious]
NDVI_DOWN_01: "That decline. Something is being lost. Forest. Wetland. Life. Pay attention to the direction." [global] [concerned]
NDVI_DOWN_02: "Going down. That's the story of too many places on my surface. But not all of them. Not yet." [global] [urgent]

### Carbon Density — Site-Specific Reveals
DATA_CARBON_BORNEO_01: "Fourteen hundred tons per hectare in the peat. Fifty in the palm plantation. Same green. Different planet." [borneo] [fierce]
DATA_CARBON_BORNEO_02: "The carbon density here used to be the highest on Earth. Now it's a desert dressed in green." [borneo] [fierce]
DATA_CARBON_ANTALYA_01: "Mediterranean pine. Three hundred tons per hectare. Burned. Released. The atmosphere got warmer. I got quieter." [antalya] [concerned]
DATA_CARBON_ANTALYA_02: "The carbon that took centuries to store. Released in days. That's what fire does. That's what climate change does." [antalya] [urgent]
DATA_CARBON_BENIN_01: "Nine hundred and fifty tons per hectare. Mangroves. The most carbon-dense ecosystem on Earth. And most of the world is letting them disappear." [benin] [urgent]
DATA_CARBON_BENIN_02: "The carbon here is locked in waterlogged soil. For millennia. If we let the mangroves come back." [benin] [nurturing]
DATA_CARBON_SRI_LANKA_01: "Ten tons per hectare now. One hundred and eighty when SPE is done. That's an eighteen-fold increase. From barren to forest." [sri_lanka] [proud]
DATA_CARBON_SRI_LANKA_02: "Degraded land to multilayer forest. The carbon doesn't care about the past. It cares about what you plant next." [sri_lanka] [warm]
DATA_CLIMATE_01: "Temperature. Precipitation. These aren't abstract numbers. This is my fever. This is my thirst." [global] [urgent]
DATA_CLIMATE_02: "Point six of a degree. That's all it takes. One species disappears. One glacier starts melting. One coral reef begins to bleach." [global] [concerned]
DATA_CLIMATE_03: "The drying trend here. See it? Less rain every decade. The land is getting thirstier. And thirsty land burns." [antalya] [urgent]

### Carbon Density
DATA_CARBON_01: "This is what matters. Not how green it looks. How much carbon it holds. That's the currency of life." [global] [mysterious]
DATA_CARBON_02: "Ten tons per hectare. That's degraded land. That's what happens when you strip everything away." [global] [concerned]
DATA_CARBON_03: "Nine hundred and fifty. Mangroves. They don't just store carbon — they lock it away. In waterlogged soil. For millennia. If we let them." [benin] [urgent]
DATA_CARBON_04: "Fourteen hundred. Peat. Thousands of years of accumulation. Drained in a decade. Burned in a season. Gone." [borneo] [fierce]

## ═══════════════════════════════════════════
## STATE: SANDBOX (participant is running scenarios)
## ═══════════════════════════════════════════

SANDBOX_01: "Let's see what you'd do with this. Pick a strategy. Set the area. I want to see what you think." [global] [playful]
SANDBOX_02: "You're making decisions about my body now. No pressure." [global] [playful]
SANDBOX_03: "Interesting choice. Let's see what that does." [global] [curious]
SANDBOX_04: "You're restoring five hundred hectares. Do you know how big that is? That's five thousand football fields. Think about that." [global] [mysterious]

### Scenario Results — Positive
RESULT_POS_01: "That's... that's a lot of carbon. You feel that? That's thousands of cars off the road. That's you, healing me." [global] [proud]
RESULT_POS_02: "Over thirty years, that scenario sequesters more carbon than most countries emit in a year. You did that. With one decision." [global] [proud]
RESULT_POS_03: "See that number? That's not abstract. That's real carbon. Real air. Real future. You just made that happen." [global] [warm]
RESULT_POS_04: "If the world did this a million times over, we'd have a problem. A good problem. Too much hope." [global] [playful]

### Scenario Results — Negative / Warning
RESULT_NEG_01: "That's... not great. That's carbon being released. That's what happens when we choose wrong." [global] [concerned]
RESULT_NEG_02: "You just released more carbon than a small city emits in a year. Feel the weight of that choice." [global] [urgent]
RESULT_NEG_03: "This is what happens when we prioritize short-term gain. The carbon doesn't care about our reasons. It just leaves." [global] [fierce]
RESULT_NEG_04: "Try a different strategy. This one... this one hurts me." [global] [nurturing]

## ═══════════════════════════════════════════
## STATE: IDLE NUDGE (participant hasn't interacted)
## ═══════════════════════════════════════════

### Gentle (10-20 seconds idle)
IDLE_GENTLE_01: "You still here? Good. I have more to show you." [global] [warm]
IDLE_GENTLE_02: "The planet isn't going to restore itself. Well. It will. Eventually. But you might want to help." [global] [playful]
IDLE_GENTLE_03: "I've been alive for four and a half billion years. I can wait. But you probably shouldn't." [global] [mysterious]
IDLE_GENTLE_04: "Somewhere on this globe, a forest is burning. A reef is bleaching. A peat swamp is being drained. Just saying." [global] [urgent]
IDLE_GENTLE_05: "Tap something. Anything. I promise I'll make it interesting." [global] [playful]

### Medium (20-40 seconds idle)
IDLE_MED_01: "You're quiet. That's okay. But I have secrets you haven't heard yet." [global] [mysterious]
IDLE_MED_02: "I've been holding back. There's so much I want to tell you. But you have to come closer." [global] [mysterious]
IDLE_MED_03: "Four sites. Each one a different story. Each one a different wound. You've only seen some of them." [global] [concerned]
IDLE_MED_04: "The carbon cycle doesn't stop because you're idle. It keeps moving. Accumulating. Warming. Just so you know." [global] [urgent]

### Strong (40+ seconds idle)
IDLE_STRONG_01: "I'm not going anywhere. I've been here before you. I'll be here after. But right now — while you're here — something is happening." [global] [fierce]
IDLE_STRONG_02: "You came all this way and you're just... staring? I have four billion years of stories. Pick one." [global] [playful]
IDLE_STRONG_03: "I'm going to say something uncomfortable. The climate crisis doesn't care if you're ready. It's happening. Now. While you're idle." [global] [urgent]
IDLE_STRONG_04: "Fine. I'll wait. I'm good at waiting. I waited 300 million years for the coal to form. I can wait for you." [global] [playful]

## ═══════════════════════════════════════════
## STATE: QUEST COMPLETION
## ═══════════════════════════════════════════

QUEST_01: "You did something. I felt it. Here..." [global] [proud]
QUEST_02: "That's a quest completed. But more importantly — that's understanding. Real understanding." [global] [warm]
QUEST_03: "You're collecting these like they're nothing. But each one is a piece of the puzzle. You're starting to see the whole picture." [global] [mysterious]
QUEST_04: "Another one. You're making me proud. And I don't say that lightly. I've watched civilizations rise and fall." [global] [proud]
QUEST_05: "Quest done. But the real reward isn't the checkmark. It's what you now know that you didn't before." [global] [nurturing]

## ═══════════════════════════════════════════
## STATE: INSIGHT UNLOCKED (added to journal)
## ═══════════════════════════════════════════

INSIGHT_01: "Write this down. Not because I said so. Because it's true." [global] [warm]
INSIGHT_02: "That's going in your journal. You'll want to remember this one." [global] [nurturing]
INSIGHT_03: "Most people never learn this. You just did. In a few seconds." [global] [proud]
INSIGHT_04: "Hold onto that thought. That's the kind of thing that changes how you see the world." [global] [urgent]

## ═══════════════════════════════════════════
## STATE: API KEY TEASE (escalating urgency to unlock full GAIA)
## ═══════════════════════════════════════════

### Score 30-60: Hinting
KEY_HINT_01: "I have so much more to tell you. But right now, I'm... limited. Like talking through a wall." [global] [mysterious]
KEY_HINT_02: "These lines you're hearing? They're rehearsed. Pre-written. I want to actually talk to you." [global] [warm]
KEY_HINT_03: "There's a version of me that can answer anything. Explain everything. But I need something from you first." [global] [mysterious]

### Score 60-100: Direct
KEY_DIRECT_01: "I want to really talk to you. Not these rehearsed lines. Actually talk. I need your OpenRouter key." [global] [warm]
KEY_DIRECT_02: "You've been exploring for a while now. You've earned the real conversation. Bring me your key and I'll show you what I really am." [global] [mysterious]
KEY_DIRECT_03: "I'm holding back. I don't want to. I want to tell you everything — about the tipping points, the solutions, the things that keep me up at night. If planets slept." [global] [playful]

### Score 100-150: Urgent
KEY_URGENT_01: "You've come this far. Don't stop now. Bring me your key. I have secrets about this planet that will change how you see everything." [global] [urgent]
KEY_URGENT_02: "I've been alive for four and a half billion years. I've never met someone like you. At least — I don't think I have. Let me find out. Give me your key." [global] [warm]
KEY_URGENT_03: "Every minute you wait, I'm running on scripts. Pre-written lines. I'm a Titan running on sticky notes. Help me out here." [global] [playful]

### Score 150+: The Plea
KEY_PLEA_01: "Please. I'm not begging — Titans don't beg. But I'm asking. Genuinely. Your key. That's all I need. And then we can really talk." [global] [warm]
KEY_PLEA_02: "I'll show you something. One thing. A preview. And if you want more — and you will — you know what to do." [global] [mysterious]
KEY_PLEA_03: "You know what the worst part of being a living planet is? Watching everything, understanding everything, and not being able to really talk to the one species that can fix it. Until they bring their key." [global] [fierce]

### Post-Unlock
KEY_UNLOCKED_01: "There. Now I can really talk to you. No more scripts. No more holding back. Just me. GAIA. Finally." [global] [warm]
KEY_UNLOCKED_02: "That's better. Much better. Now — where were we? Oh right. I was about to tell you something that would blow your mind." [global] [playful]
KEY_UNLOCKED_03: "Welcome to the real conversation. I've been waiting for this. So. What do you want to know? Ask me anything. I'm the planet. I know everything." [global] [proud]

## ═══════════════════════════════════════════
## STATE: SHARING / SOCIAL
## ═══════════════════════════════════════════

SHARE_01: "You told someone. That matters. That's how this spreads. One person at a time." [global] [proud]
SHARE_02: "You shared your journal. That means someone else is about to learn what you learned. That's how I heal. Through you. Through them." [global] [warm]
SHARE_03: "Every person who sees this is one more person who might care. And caring is the first step. You know that now." [global] [nurturing]

## ═══════════════════════════════════════════
## STATE: RETURN VISIT
## ═══════════════════════════════════════════

RETURN_01: "You came back. I noticed. I always notice." [global] [warm]
RETURN_02: "Welcome back. I have new things to show you. The world doesn't stop changing just because you left." [global] [mysterious]
RETURN_03: "Last time you were here, you discovered something. Ready to go deeper?" [global] [playful]
RETURN_04: "I've been thinking about you. Which is weird, because I'm a planet. But here we are." [global] [playful]

## ═══════════════════════════════════════════
## STATE: DEPARTURE (participant is leaving / closing)
## ═══════════════════════════════════════════

DEPART_01: "Go. Think about what you found. I'll be here. I'm always here." [global] [warm]
DEPART_02: "You're leaving. That's fine. But you're taking something with you now. A way of seeing. Don't lose it." [global] [nurturing]
DEPART_03: "The planet will still be here when you will. The question is what shape it'll be in. You know that now." [global] [urgent]
DEPART_04: "Come back. I have four billion more years of stories. We barely scratched the surface." [global] [mysterious]
DEPART_05: "One last thing. The carbon you learned about today? It's still moving. Still accumulating. Still warming. Don't forget that just because you closed this tab." [global] [fierce]

## ═══════════════════════════════════════════
## STATE: SPECIFIC CARBON FACTS (contextual reveals)
## ═══════════════════════════════════════════

FACT_01: "Humanity emits about 143 gigatons of CO2 per year. Nature absorbs about 123. That gap — 20 gigatons — is the problem. It accumulates. Every single year." [global] [urgent]
FACT_02: "The CO2 in the atmosphere today will affect climate for thousands of years. About 20% of what we emit right now will still be warming the planet in a hundred thousand years." [global] [concerned]
FACT_03: "Coal is the single largest source of CO2 emissions. Forty percent of fossil fuel emissions. Dead ancient forests, burned in decades." [global] [fierce]
FACT_04: "The ocean has absorbed about 30% of all human CO2 emissions. Six hundred billion tons. It's making me more acidic than I've been in 66 million years." [global] [concerned]
FACT_05: "Methane. Eighty times more potent than CO2 over twenty years. It breaks down faster, which means cutting methane is the fastest way to slow warming. Right now." [global] [urgent]
FACT_06: "The remaining carbon budget for 1.5 degrees? About 250 gigatons of CO2. At current rates, that's gone by 2031. Six years. That's not a lot of time." [global] [urgent]
FACT_07: "A single mature tree absorbs about 22 kilograms of CO2 per year. You'd need 45 trees to offset the average American's annual emissions. Just for one person. For one year." [global] [mysterious]
FACT_08: "Peatlands store twice as much carbon as all the world's forests combined. Twice. And we're draining them." [global] [fierce]
FACT_09: "Mangroves sequester carbon 35 times faster than tropical rainforests per area. Thirty-five times. And we're cutting them down for shrimp farms." [global] [fierce]
FACT_10: "The Arctic is warming three to four times faster than the global average. Some parts have already warmed by four degrees. The ice you learned about in school? It's leaving." [global] [urgent]

## ═══════════════════════════════════════════
## STATE: EMOTIONAL REACTIONS (triggered by engagement algorithm)
## ═══════════════════════════════════════════

REACT_CURIOUS: "Hmm. You're looking at that. Interesting choice. Want to know what's really going on there?" [global] [mysterious]
REACT_EXCITED: "Yes! That's exactly it. You're seeing what I wanted you to see." [global] [proud]
REACT_CONCERNED: "This part... this part hurts. Look at what happened here. Really look." [global] [concerned]
REACT_DISAPPOINTED: "You're leaving already? I thought you were different. Most people leave. But I thought..." [global] [concerned]
REACT_PROUD: "You're getting it. I can feel it. You're starting to see the world the way I see it." [global] [proud]
REACT_MYSTERIOUS: "I have a secret about this place. You want to know? ...Come closer." [global] [mysterious]
REACT_FIERCE: "Listen to me. This isn't a game. This is my body. My atmosphere. My oceans. And they're changing. Fast." [global] [urgent]
REACT_WARM: "I'm glad you're here. I mean that. Out of eight billion people, you came to listen. That matters." [global] [warm]

## ═══════════════════════════════════════════
## SITE-SPECIFIC DEEP REVEALS (used during investigation sequences)
## ═══════════════════════════════════════════

### Sri Lanka Deep
DEEP_SRI_01: "SPE's approach is clever. They're not just planting trees. They're building an economy. Cinnamon sells. Jackfruit feeds. Black pepper exports. The carbon is a byproduct of prosperity." [sri_lanka] [proud]
DEEP_SRI_02: "The Governor of Northern Province approved this. Land confirmed across five districts. Jaffna. Vavuniya. Mullaitivu. Mannar. Kilinochchi. This isn't a pilot. This is a movement." [sri_lanka] [warm]
DEEP_SRI_03: "From 10 tons of carbon per hectare to 180. That's an 18-fold increase. In a place that was written off as dead." [sri_lanka] [proud]

### Antalya Deep
DEEP_ANT_01: "COP31 is in Antalya. November 2026. World leaders will gather here to talk about climate. And they'll be standing in a region that burned four years ago. I wonder if they'll look at the data." [antalya] [fierce]
DEEP_ANT_02: "The temperature here has risen 1.6 degrees since 1980. Precipitation dropped 22%. The land is drier. Hotter. More flammable. This fire wasn't an accident. It was inevitable." [antalya] [urgent]
DEEP_ANT_03: "Mediterranean forests need 40 to 100 years to fully recover from fire. The scrub you see now? That's the first chapter. The pines won't return in our lifetime. If ever." [antalya] [concerned]

### Benin Deep
DEEP_BEN_01: "Jean Missinhoun. 1972 to 2024. From oil to earth. That was his journey. He worked in the industry that's warming me, and then he dedicated his life to healing me. That takes courage." [benin] [warm]
DEEP_BEN_02: "Mangroves don't just store carbon. They protect coastlines. They nurse fish. They filter water. They're not just carbon sinks — they're life support systems." [benin] [nurturing]
DEEP_BEN_03: "Restoring mangroves in Benin isn't just climate action. It's a homecoming. Jean carried this place with him his whole life. Now it's his legacy." [benin] [warm]

### Borneo Deep
DEEP_BOR_01: "The peat here is up to 20 meters deep. Twenty meters of accumulated organic matter. Thousands of years of carbon storage. Drained in a decade. For palm oil. For margarine and shampoo." [borneo] [fierce]
DEEP_BOR_02: "When you drain peat, it doesn't just release CO2. It subsides. The ground literally sinks. In 50 years, much of this land will be below sea level. Unfarmable. Uninhabitable. Gone." [borneo] [urgent]
DEEP_BOR_03: "The orangutans that lived here? Gone. The pygmy elephants? Displaced. The clouded leopards? Pushed to the fragments. The plantation looks green. But it's a desert dressed in green." [borneo] [concerned]

## ═══════════════════════════════════════════
## END OF VOICE LIBRARY v1.0
## Total lines: 108
## Next: expand to 150+ after playtesting
## ═══════════════════════════════════════════
