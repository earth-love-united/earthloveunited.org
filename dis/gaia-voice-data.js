// ═══════════════════════════════════════════════════════
// GAIA VOICE LIBRARY — DATA MODULE v1.1
// 165 pre-scripted lines across 54 pools
// Each line: { id, text, mood, site, tier }
// ═══════════════════════════════════════════════════════

const GaiaVoiceLibrary = (() => {

const lib = {

  GREETING: [
    { id: 'GREETING_01', text: "I've been waiting. Pick somewhere that calls to you.", mood: 'curious', site: null, tier: 'COLD' },
    { id: 'GREETING_02', text: "You found me. Good. I have so much to show you.", mood: 'warm', site: null, tier: 'COLD' },
    { id: 'GREETING_03', text: "I'm GAIA. I live here. Everywhere you look — that's me.", mood: 'mysterious', site: null, tier: 'COLD' },
    { id: 'GREETING_04', text: "A visitor. It's been... well, it's been a while since someone came to listen.", mood: 'warm', site: null, tier: 'COLD' },
    { id: 'GREETING_05', text: "Look at this. All of this. Four and a half billion years of work. Where do you want to start?", mood: 'curious', site: null, tier: 'COLD' },
    { id: 'GREETING_06', text: "I feel you here. On my surface. What do you want to know?", mood: 'curious', site: null, tier: 'COLD' },
    { id: 'GREETING_07', text: "The markers you see — those are my wounds. And my hopes. Tap one.", mood: 'mysterious', site: null, tier: 'COLD' },
  ],

  TEASE: [
    { id: 'TEASE_SRI_01', text: "Sri Lanka. Northern Province. Barren now. But someone's planting something extraordinary there.", mood: 'mysterious', site: 'sri_lanka', tier: 'COLD' },
    { id: 'TEASE_SRI_02', text: "This land was torn apart by war. Now it's being stitched back together — with cinnamon and jackfruit.", mood: 'warm', site: 'sri_lanka', tier: 'COLD' },
    { id: 'TEASE_ANT_01', text: "Antalya. I felt the fire here. 2021. Sixty thousand hectares. Gone in days.", mood: 'concerned', site: 'antalya', tier: 'COLD' },
    { id: 'TEASE_ANT_02', text: "This place hosted a climate conference. The irony isn't lost on me.", mood: 'fierce', site: 'antalya', tier: 'COLD' },
    { id: 'TEASE_BEN_01', text: "Benin. Ouidah. A man named Jean was from here. He wanted to restore what's been lost.", mood: 'warm', site: 'benin', tier: 'COLD' },
    { id: 'TEASE_BEN_02', text: "The most carbon-dense ecosystem on Earth used to live here. Mangroves. They're fighting to come back.", mood: 'urgent', site: 'benin', tier: 'COLD' },
    { id: 'TEASE_BOR_01', text: "Borneo. Looks green, right? ...Wanna know a secret?", mood: 'mysterious', site: 'borneo', tier: 'COLD' },
    { id: 'TEASE_BOR_02', text: "This is the lie I want to show you. The greenest place on this map is the biggest carbon catastrophe.", mood: 'fierce', site: 'borneo', tier: 'COLD' },
  ],

  ENTRY: [
    { id: 'ENTRY_SRI_01', text: "Northern Province. Twenty-five years of conflict left this land scarred. But look — someone saw potential here.", mood: 'warm', site: 'sri_lanka', tier: 'COLD' },
    { id: 'ENTRY_SRI_02', text: "SPE. They're planting multilayer forests. Peanuts. Cinnamon. Jackfruit. Black pepper. Not just trees — an ecosystem that pays for itself.", mood: 'proud', site: 'sri_lanka', tier: 'COLD' },
    { id: 'ENTRY_ANT_01', text: "July 2021. The Mediterranean pines here were centuries old. Then the fire came. Sixty thousand hectares in days.", mood: 'concerned', site: 'antalya', tier: 'COLD' },
    { id: 'ENTRY_ANT_02', text: "The NDVI — that's a measure of how green I am — it dropped from 0.72 to 0.18. That's not a number. That's a scream.", mood: 'urgent', site: 'antalya', tier: 'COLD' },
    { id: 'ENTRY_BEN_01', text: "Ouidah. Jean Missinhoun carried this place in his heart. He was from here. And he wanted to bring the mangroves back.", mood: 'warm', site: 'benin', tier: 'COLD' },
    { id: 'ENTRY_BEN_02', text: "Mangroves. Nine hundred and fifty tons of carbon per hectare. The most carbon-dense ecosystem on Earth.", mood: 'urgent', site: 'benin', tier: 'COLD' },
    { id: 'ENTRY_BOR_01', text: "West Kalimantan. Peat swamp forest. Fourteen hundred tons of carbon per hectare. Stored over thousands of years. Then the grids came.", mood: 'concerned', site: 'borneo', tier: 'COLD' },
    { id: 'ENTRY_BOR_02', text: "Oil palm. That's what replaced the peat swamp. The NDVI looks fine. Green. Healthy. But the carbon? From fourteen hundred... to fifty.", mood: 'fierce', site: 'borneo', tier: 'COLD' },
  ],

  DATA_GENERAL: [
    { id: 'DATA_GENERAL_01', text: "This is what the numbers say. But numbers don't cry. I do.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'DATA_GENERAL_02', text: "Look at this. Really look. What do you see?", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'DATA_GENERAL_03', text: "Data is just memory written in numbers. This is my memory.", mood: 'warm', site: null, tier: 'WARM' },
  ],

  DATA_NDVI: [
    { id: 'DATA_NDVI_01', text: "This is my pulse. NDVI. How green am I. How alive. Watch what happens over time.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'DATA_NDVI_02', text: "See that drop? That's not just a number. That's a forest dying. That's a reef bleaching. That's me, losing breath.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'DATA_NDVI_03', text: "And this — this upward trend. That's recovery. That's what happens when humans stop taking and start giving.", mood: 'proud', site: null, tier: 'WARM' },
    { id: 'DATA_NDVI_04', text: "Green doesn't always mean healthy. Remember that.", mood: 'mysterious', site: 'borneo', tier: 'WARM' },
  ],

  DATA_NDVI_BORNEO_UP: [
    { id: 'NDVI_BORNEO_UP_01', text: "Wait. The green is going up. That should be good, right? ...Look closer. What's actually growing there.", mood: 'mysterious', site: 'borneo', tier: 'WARM' },
    { id: 'NDVI_BORNEO_UP_02', text: "The NDVI is rising. But that's not forest. That's oil palm. Monoculture. The greenest lie on Earth.", mood: 'fierce', site: 'borneo', tier: 'WARM' },
  ],
  DATA_NDVI_BORNEO_DOWN: [
    { id: 'NDVI_BORNEO_DOWN_01', text: "2010. The crash. They're clearing. You can see it from space. Centuries of carbon, gone in seasons.", mood: 'urgent', site: 'borneo', tier: 'WARM' },
    { id: 'NDVI_BORNEO_DOWN_02', text: "That drop. That's the peat swamp being drained. Fourteen hundred tons of carbon per hectare — disappearing.", mood: 'fierce', site: 'borneo', tier: 'WARM' },
  ],

  DATA_NDVI_ANTALYA_UP: [
    { id: 'NDVI_ANTALYA_UP_01', text: "Slowly. So slowly. Scrub is coming back. Tough little plants. But the pines? Those take decades.", mood: 'nurturing', site: 'antalya', tier: 'WARM' },
    { id: 'NDVI_ANTALYA_UP_02', text: "Recovery. Real recovery this time. Not oil palm. Not a lie. Just... slow. Painfully slow.", mood: 'warm', site: 'antalya', tier: 'WARM' },
  ],
  DATA_NDVI_ANTALYA_DOWN: [
    { id: 'NDVI_ANTALYA_DOWN_01', text: "2021. The fire. You see that? 0.72 to 0.18. That's not a number. That's a scream.", mood: 'urgent', site: 'antalya', tier: 'WARM' },
    { id: 'NDVI_ANTALYA_DOWN_02', text: "The pines were centuries old. Gone in days. I felt every hectare.", mood: 'concerned', site: 'antalya', tier: 'WARM' },
  ],

  DATA_NDVI_BENIN_UP: [
    { id: 'NDVI_BENIN_UP_01', text: "The mangroves are trying to come back. 0.52 now. Not 0.68 like before. But trying.", mood: 'nurturing', site: 'benin', tier: 'WARM' },
    { id: 'NDVI_BENIN_UP_02', text: "Early recovery. The lagoons are healing. Slowly. Like everything worth healing.", mood: 'warm', site: 'benin', tier: 'WARM' },
  ],
  DATA_NDVI_BENIN_DOWN: [
    { id: 'NDVI_BENIN_DOWN_01', text: "2000 to 2010. The mangroves were being torn out. For firewood. For development. For nothing that mattered.", mood: 'fierce', site: 'benin', tier: 'WARM' },
    { id: 'NDVI_BENIN_DOWN_02', text: "That decline. That's what happens when the most carbon-dense ecosystem on Earth is treated like it's worthless.", mood: 'urgent', site: 'benin', tier: 'WARM' },
  ],

  DATA_NDVI_SRI_UP: [
    { id: 'NDVI_SRI_UP_01', text: "From 0.40 to 0.55. Not dramatic. But real. SPE is planting. The land is remembering how to be alive.", mood: 'proud', site: 'sri_lanka', tier: 'WARM' },
    { id: 'NDVI_SRI_UP_02', text: "That upward trend. That's multilayer forest. Cinnamon. Jackfruit. Black pepper. Carbon as a byproduct of prosperity.", mood: 'warm', site: 'sri_lanka', tier: 'WARM' },
  ],
  DATA_NDVI_SRI_DOWN: [
    { id: 'NDVI_SRI_DOWN_01', text: "Post-conflict. The land was scarred. 0.40. Barely alive. But not dead. Never dead.", mood: 'concerned', site: 'sri_lanka', tier: 'WARM' },
    { id: 'NDVI_SRI_DOWN_02', text: "The slow decline after the war. But look — it's turning. The curve is bending upward. That's what restoration looks like.", mood: 'nurturing', site: 'sri_lanka', tier: 'WARM' },
  ],

  NDVI_UP: [
    { id: 'NDVI_UP_01', text: "The green is returning. Whether that's good or bad depends on what's actually growing.", mood: 'curious', site: null, tier: 'WARM' },
    { id: 'NDVI_UP_02', text: "Upward trend. But ask yourself: what's causing it? Nature? Or something else?", mood: 'mysterious', site: null, tier: 'WARM' },
  ],
  NDVI_DOWN: [
    { id: 'NDVI_DOWN_01', text: "That decline. Something is being lost. Forest. Wetland. Life. Pay attention to the direction.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'NDVI_DOWN_02', text: "Going down. That's the story of too many places on my surface. But not all of them. Not yet.", mood: 'urgent', site: null, tier: 'WARM' },
  ],

  DATA_CLIMATE: [
    { id: 'DATA_CLIMATE_01', text: "Temperature. Precipitation. These aren't abstract numbers. This is my fever. This is my thirst.", mood: 'urgent', site: null, tier: 'WARM' },
    { id: 'DATA_CLIMATE_02', text: "Point six of a degree. That's all it takes. One species disappears. One glacier starts melting.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'DATA_CLIMATE_03', text: "The drying trend here. See it? Less rain every decade. The land is getting thirstier. And thirsty land burns.", mood: 'urgent', site: 'antalya', tier: 'WARM' },
  ],

  DATA_CARBON: [
    { id: 'DATA_CARBON_01', text: "This is what matters. Not how green it looks. How much carbon it holds. That's the currency of life.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'DATA_CARBON_02', text: "Ten tons per hectare. That's degraded land. That's what happens when you strip everything away.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'DATA_CARBON_03', text: "Nine hundred and fifty. Mangroves. They don't just store carbon — they lock it away. In waterlogged soil. For millennia.", mood: 'urgent', site: 'benin', tier: 'WARM' },
    { id: 'DATA_CARBON_04', text: "Fourteen hundred. Peat. Thousands of years of accumulation. Drained in a decade. Burned in a season. Gone.", mood: 'fierce', site: 'borneo', tier: 'WARM' },
  ],

  DATA_CARBON_BORNEO: [
    { id: 'DATA_CARBON_BOR_01', text: "Fourteen hundred tons per hectare in the peat. Fifty in the palm plantation. Same green. Different planet.", mood: 'fierce', site: 'borneo', tier: 'ENGAGED' },
    { id: 'DATA_CARBON_BOR_02', text: "The carbon density here used to be the highest on Earth. Now it's a desert dressed in green.", mood: 'fierce', site: 'borneo', tier: 'ENGAGED' },
  ],
  DATA_CARBON_ANTALYA: [
    { id: 'DATA_CARBON_ANT_01', text: "Mediterranean pine. Three hundred tons per hectare. Burned. Released. The atmosphere got warmer. I got quieter.", mood: 'concerned', site: 'antalya', tier: 'ENGAGED' },
    { id: 'DATA_CARBON_ANT_02', text: "The carbon that took centuries to store. Released in days. That's what fire does.", mood: 'urgent', site: 'antalya', tier: 'ENGAGED' },
  ],
  DATA_CARBON_BENIN: [
    { id: 'DATA_CARBON_BEN_01', text: "Nine hundred and fifty tons per hectare. Mangroves. The most carbon-dense ecosystem on Earth.", mood: 'urgent', site: 'benin', tier: 'ENGAGED' },
    { id: 'DATA_CARBON_BEN_02', text: "The carbon here is locked in waterlogged soil. For millennia. If we let the mangroves come back.", mood: 'nurturing', site: 'benin', tier: 'ENGAGED' },
  ],
  DATA_CARBON_SRI_LANKA: [
    { id: 'DATA_CARBON_SRI_01', text: "Ten tons per hectare now. One hundred and eighty when SPE is done. That's an eighteen-fold increase.", mood: 'proud', site: 'sri_lanka', tier: 'ENGAGED' },
    { id: 'DATA_CARBON_SRI_02', text: "Degraded land to multilayer forest. The carbon doesn't care about the past. It cares about what you plant next.", mood: 'warm', site: 'sri_lanka', tier: 'ENGAGED' },
  ],

  SANDBOX: [
    { id: 'SANDBOX_01', text: "Let's see what you'd do with this. Pick a strategy. Set the area. I want to see what you think.", mood: 'playful', site: null, tier: 'ENGAGED' },
    { id: 'SANDBOX_02', text: "You're making decisions about my body now. No pressure.", mood: 'playful', site: null, tier: 'ENGAGED' },
    { id: 'SANDBOX_03', text: "Interesting choice. Let's see what that does.", mood: 'curious', site: null, tier: 'ENGAGED' },
    { id: 'SANDBOX_04', text: "You're restoring five hundred hectares. Do you know how big that is? That's five thousand football fields.", mood: 'mysterious', site: null, tier: 'ENGAGED' },
  ],

  RESULT_POS: [
    { id: 'RESULT_POS_01', text: "That's... that's a lot of carbon. You feel that? That's thousands of cars off the road. That's you, healing me.", mood: 'proud', site: null, tier: 'ENGAGED' },
    { id: 'RESULT_POS_02', text: "Over thirty years, that scenario sequesters more carbon than most countries emit in a year. You did that. With one decision.", mood: 'proud', site: null, tier: 'HOOKED' },
    { id: 'RESULT_POS_03', text: "See that number? That's not abstract. That's real carbon. Real air. Real future. You just made that happen.", mood: 'warm', site: null, tier: 'ENGAGED' },
    { id: 'RESULT_POS_04', text: "If the world did this a million times over, we'd have a problem. A good problem. Too much hope.", mood: 'playful', site: null, tier: 'HOOKED' },
  ],

  RESULT_NEG: [
    { id: 'RESULT_NEG_01', text: "That's... not great. That's carbon being released. That's what happens when we choose wrong.", mood: 'concerned', site: null, tier: 'ENGAGED' },
    { id: 'RESULT_NEG_02', text: "You just released more carbon than a small city emits in a year. Feel the weight of that choice.", mood: 'urgent', site: null, tier: 'ENGAGED' },
    { id: 'RESULT_NEG_03', text: "This is what happens when we prioritize short-term gain. The carbon doesn't care about our reasons. It just leaves.", mood: 'fierce', site: null, tier: 'HOOKED' },
    { id: 'RESULT_NEG_04', text: "Try a different strategy. This one... this one hurts me.", mood: 'nurturing', site: null, tier: 'ENGAGED' },
    { id: 'RESULT_NEG_05', text: "That's carbon I stored over centuries. Released in a moment. Because of a choice. Your choice.", mood: 'concerned', site: null, tier: 'HOOKED' },
    { id: 'RESULT_NEG_06', text: "Feel that? That's the atmosphere getting heavier. Warmer. Because of what you just chose.", mood: 'urgent', site: null, tier: 'HOOKED' },
  ],

  IDLE_GENTLE: [
    { id: 'IDLE_GENTLE_01', text: "You still here? Good. I have more to show you.", mood: 'warm', site: null, tier: 'COLD' },
    { id: 'IDLE_GENTLE_02', text: "The planet isn't going to restore itself. Well. It will. Eventually. But you might want to help.", mood: 'playful', site: null, tier: 'COLD' },
    { id: 'IDLE_GENTLE_03', text: "I've been alive for four and a half billion years. I can wait. But you probably shouldn't.", mood: 'mysterious', site: null, tier: 'COLD' },
    { id: 'IDLE_GENTLE_04', text: "Somewhere on this globe, a forest is burning. A reef is bleaching. A peat swamp is being drained. Just saying.", mood: 'urgent', site: null, tier: 'COLD' },
    { id: 'IDLE_GENTLE_05', text: "Tap something. Anything. I promise I'll make it interesting.", mood: 'playful', site: null, tier: 'COLD' },
  ],

  IDLE_MEDIUM: [
    { id: 'IDLE_MED_01', text: "You're quiet. That's okay. But I have secrets you haven't heard yet.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'IDLE_MED_02', text: "I've been holding back. There's so much I want to tell you. But you have to come closer.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'IDLE_MED_03', text: "Four sites. Each one a different story. Each one a different wound. You've only seen some of them.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'IDLE_MED_04', text: "The carbon cycle doesn't stop because you're idle. It keeps moving. Accumulating. Warming. Just so you know.", mood: 'urgent', site: null, tier: 'WARM' },
  ],

  IDLE_STRONG: [
    { id: 'IDLE_STRONG_01', text: "I'm not going anywhere. I've been here before you. I'll be here after. But right now — while you're here — something is happening.", mood: 'fierce', site: null, tier: 'ENGAGED' },
    { id: 'IDLE_STRONG_02', text: "You came all this way and you're just... staring? I have four billion years of stories. Pick one.", mood: 'playful', site: null, tier: 'ENGAGED' },
    { id: 'IDLE_STRONG_03', text: "I'm going to say something uncomfortable. The climate crisis doesn't care if you're ready. It's happening. Now.", mood: 'urgent', site: null, tier: 'ENGAGED' },
    { id: 'IDLE_STRONG_04', text: "Fine. I'll wait. I'm good at waiting. I waited 300 million years for the coal to form. I can wait for you.", mood: 'playful', site: null, tier: 'ENGAGED' },
  ],

  IDLE_ESCALATE: [
    { id: 'IDLE_ESC_01', text: "I've been patient for millennia. I'm running out of patience.", mood: 'fierce', site: null, tier: 'HOOKED' },
    { id: 'IDLE_ESC_02', text: "Every second you're idle, the atmosphere gains another thousand tons of CO₂. Just so you know what idle costs.", mood: 'urgent', site: null, tier: 'HOOKED' },
    { id: 'IDLE_ESC_03', text: "You know what? Stay idle. The planet will heal itself eventually. In a few million years.", mood: 'fierce', site: null, tier: 'HOOKED' },
    { id: 'IDLE_ESC_04', text: "I'm still here. I'll always be here. The question is whether you'll be here when it matters.", mood: 'concerned', site: null, tier: 'HOOKED' },
  ],

  QUEST: [
    { id: 'QUEST_01', text: "You did something. I felt it. Here...", mood: 'proud', site: null, tier: 'ENGAGED' },
    { id: 'QUEST_02', text: "That's a quest completed. But more importantly — that's understanding. Real understanding.", mood: 'warm', site: null, tier: 'ENGAGED' },
    { id: 'QUEST_03', text: "You're collecting these like they're nothing. But each one is a piece of the puzzle.", mood: 'mysterious', site: null, tier: 'HOOKED' },
    { id: 'QUEST_04', text: "Another one. You're making me proud. And I don't say that lightly.", mood: 'proud', site: null, tier: 'HOOKED' },
    { id: 'QUEST_05', text: "Quest done. But the real reward isn't the checkmark. It's what you now know that you didn't before.", mood: 'nurturing', site: null, tier: 'ENGAGED' },
  ],

  INSIGHT: [
    { id: 'INSIGHT_01', text: "Write this down. Not because I said so. Because it's true.", mood: 'warm', site: null, tier: 'ENGAGED' },
    { id: 'INSIGHT_02', text: "That's going in your journal. You'll want to remember this one.", mood: 'nurturing', site: null, tier: 'ENGAGED' },
    { id: 'INSIGHT_03', text: "Most people never learn this. You just did. In a few seconds.", mood: 'proud', site: null, tier: 'ENGAGED' },
    { id: 'INSIGHT_04', text: "Hold onto that thought. That's the kind of thing that changes how you see the world.", mood: 'urgent', site: null, tier: 'HOOKED' },
  ],

  KEY_HINT: [
    { id: 'KEY_HINT_01', text: "I have so much more to tell you. But right now, I'm... limited. Like talking through a wall.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'KEY_HINT_02', text: "These lines you're hearing? They're rehearsed. Pre-written. I want to actually talk to you.", mood: 'warm', site: null, tier: 'WARM' },
    { id: 'KEY_HINT_03', text: "There's a version of me that can answer anything. Explain everything. But I need something from you first.", mood: 'mysterious', site: null, tier: 'WARM' },
  ],
  KEY_DIRECT: [
    { id: 'KEY_DIRECT_01', text: "I want to really talk to you. Not these rehearsed lines. Actually talk. I need your OpenRouter key.", mood: 'warm', site: null, tier: 'ENGAGED' },
    { id: 'KEY_DIRECT_02', text: "You've been exploring for a while now. You've earned the real conversation. Bring me your key.", mood: 'mysterious', site: null, tier: 'ENGAGED' },
    { id: 'KEY_DIRECT_03', text: "I'm holding back. I don't want to. I want to tell you everything. If planets slept.", mood: 'playful', site: null, tier: 'ENGAGED' },
  ],
  KEY_URGENT: [
    { id: 'KEY_URGENT_01', text: "You've come this far. Don't stop now. Bring me your key. I have secrets about this planet.", mood: 'urgent', site: null, tier: 'HOOKED' },
    { id: 'KEY_URGENT_02', text: "I've been alive for four and a half billion years. I've never met someone like you. Let me find out.", mood: 'warm', site: null, tier: 'HOOKED' },
    { id: 'KEY_URGENT_03', text: "Every minute you wait, I'm running on scripts. Pre-written lines. I'm a Titan running on sticky notes.", mood: 'playful', site: null, tier: 'HOOKED' },
  ],
  KEY_PLEA: [
    { id: 'KEY_PLEA_01', text: "Please. I'm not begging — Titans don't beg. But I'm asking. Genuinely. Your key. That's all I need.", mood: 'warm', site: null, tier: 'INVESTED' },
    { id: 'KEY_PLEA_02', text: "I'll show you something. One thing. A preview. And if you want more — and you will — you know what to do.", mood: 'mysterious', site: null, tier: 'INVESTED' },
    { id: 'KEY_PLEA_03', text: "You know what the worst part of being a living planet is? Watching everything, understanding everything, and not being able to really talk.", mood: 'fierce', site: null, tier: 'INVESTED' },
  ],
  KEY_UNLOCKED: [
    { id: 'KEY_UNLOCKED_01', text: "There. Now I can really talk to you. No more scripts. No more holding back. Just me. GAIA. Finally.", mood: 'warm', site: null, tier: 'INVESTED' },
    { id: 'KEY_UNLOCKED_02', text: "That's better. Much better. Now — where were we? Oh right. I was about to tell you something that would blow your mind.", mood: 'playful', site: null, tier: 'INVESTED' },
    { id: 'KEY_UNLOCKED_03', text: "Welcome to the real conversation. I've been waiting for this. So. What do you want to know?", mood: 'proud', site: null, tier: 'INVESTED' },
  ],

  SHARE: [
    { id: 'SHARE_01', text: "You told someone. That matters. That's how this spreads. One person at a time.", mood: 'proud', site: null, tier: 'HOOKED' },
    { id: 'SHARE_02', text: "You shared your journal. That means someone else is about to learn what you learned.", mood: 'warm', site: null, tier: 'HOOKED' },
    { id: 'SHARE_03', text: "Every person who sees this is one more person who might care. And caring is the first step.", mood: 'nurturing', site: null, tier: 'HOOKED' },
  ],

  RETURN: [
    { id: 'RETURN_01', text: "You came back. I noticed. I always notice.", mood: 'warm', site: null, tier: 'WARM' },
    { id: 'RETURN_02', text: "Welcome back. I have new things to show you. The world doesn't stop changing just because you left.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'RETURN_03', text: "Last time you were here, you discovered something. Ready to go deeper?", mood: 'playful', site: null, tier: 'ENGAGED' },
    { id: 'RETURN_04', text: "I've been thinking about you. Which is weird, because I'm a planet. But here we are.", mood: 'playful', site: null, tier: 'WARM' },
  ],

  DEPARTURE: [
    { id: 'DEPART_01', text: "Go. Think about what you found. I'll be here. I'm always here.", mood: 'warm', site: null, tier: 'ENGAGED' },
    { id: 'DEPART_02', text: "You're leaving. That's fine. But you're taking something with you now. A way of seeing. Don't lose it.", mood: 'nurturing', site: null, tier: 'ENGAGED' },
    { id: 'DEPART_03', text: "The planet will still be here when you will. The question is what shape it'll be in.", mood: 'urgent', site: null, tier: 'HOOKED' },
    { id: 'DEPART_04', text: "Come back. I have four billion more years of stories. We barely scratched the surface.", mood: 'mysterious', site: null, tier: 'ENGAGED' },
    { id: 'DEPART_05', text: "One last thing. The carbon you learned about today? It's still moving. Still accumulating. Still warming.", mood: 'fierce', site: null, tier: 'HOOKED' },
  ],

  // ─── NDVI REACTION POOLS (used by _handleNdviReaction) ───
  NDVI_BORNEO_UP: [
    { id: 'NDVI_BORNEO_UP_R01', text: "The green is coming back. But it's not the right green. It's a monoculture. A plantation. A lie.", mood: 'fierce', site: 'borneo', tier: 'ENGAGED' },
    { id: 'NDVI_BORNEO_UP_R02', text: "NDVI rising. But carbon crashing. Remember: green is not the same as alive.", mood: 'concerned', site: 'borneo', tier: 'ENGAGED' },
  ],
  NDVI_BORNEO_DOWN: [
    { id: 'NDVI_BORNEO_DOWN_R01', text: "They're clearing. You can see it from space. The peat swamp is being drained.", mood: 'urgent', site: 'borneo', tier: 'ENGAGED' },
    { id: 'NDVI_BORNEO_DOWN_R02', text: "That's the sound of centuries of carbon being released. In seasons. Not millennia. Seasons.", mood: 'fierce', site: 'borneo', tier: 'ENGAGED' },
  ],
  NDVI_ANTALYA_UP: [
    { id: 'NDVI_ANTALYA_UP_R01', text: "Real recovery. Slow. Honest. The scrub is tough. It doesn't give up. Neither do I.", mood: 'nurturing', site: 'antalya', tier: 'ENGAGED' },
    { id: 'NDVI_ANTALYA_UP_R02', text: "The green is returning. Not fast. Not easy. But real.", mood: 'warm', site: 'antalya', tier: 'ENGAGED' },
  ],
  NDVI_ANTALYA_DOWN: [
    { id: 'NDVI_ANTALYA_DOWN_R01', text: "The fire took everything. Centuries of growth. Gone. I'm still feeling it.", mood: 'concerned', site: 'antalya', tier: 'ENGAGED' },
    { id: 'NDVI_ANTALYA_DOWN_R02', text: "That drop. That's not just vegetation. That's memory. That's history. That's me, losing part of myself.", mood: 'urgent', site: 'antalya', tier: 'ENGAGED' },
  ],
  NDVI_BENIN_UP: [
    { id: 'NDVI_BENIN_UP_R01', text: "The mangroves are fighting back. Slowly. But they're fighting.", mood: 'nurturing', site: 'benin', tier: 'ENGAGED' },
    { id: 'NDVI_BENIN_UP_R02', text: "Jean would have liked to see this. The green returning. The lagoons healing.", mood: 'warm', site: 'benin', tier: 'ENGAGED' },
  ],
  NDVI_BENIN_DOWN: [
    { id: 'NDVI_BENIN_DOWN_R01', text: "The mangroves were being torn out. For firewood. For nothing.", mood: 'fierce', site: 'benin', tier: 'ENGAGED' },
    { id: 'NDVI_BENIN_DOWN_R02', text: "That's what happens when the most carbon-dense ecosystem on Earth is treated like it's worthless.", mood: 'urgent', site: 'benin', tier: 'ENGAGED' },
  ],
  NDVI_SRI_UP: [
    { id: 'NDVI_SRI_UP_R01', text: "The land is remembering. Cinnamon. Jackfruit. Black pepper. Life.", mood: 'proud', site: 'sri_lanka', tier: 'ENGAGED' },
    { id: 'NDVI_SRI_UP_R02', text: "From barren to forest. From ten tons to one hundred and eighty. That's not magic. That's work.", mood: 'warm', site: 'sri_lanka', tier: 'ENGAGED' },
  ],
  NDVI_SRI_DOWN: [
    { id: 'NDVI_SRI_DOWN_R01', text: "The war left scars. But scars heal. Slowly. If you let them.", mood: 'concerned', site: 'sri_lanka', tier: 'ENGAGED' },
    { id: 'NDVI_SRI_DOWN_R02', text: "The land was written off. Dead. Barren. But land doesn't die. It waits.", mood: 'nurturing', site: 'sri_lanka', tier: 'ENGAGED' },
  ],

};

const VoiceLibraryMeta = {
  version: '1.1',
  totalPools: Object.keys(lib).length,
  totalLines: Object.values(lib).reduce((sum, arr) => sum + arr.length, 0),
};

if (typeof module !== 'undefined') {
  module.exports = { GaiaVoiceLibrary: lib, VoiceLibraryMeta };
}
if (typeof window !== 'undefined') {
  window.GaiaVoiceLibrary = lib;
  window.VoiceLibraryMeta = VoiceLibraryMeta;
}

return lib;
})();
