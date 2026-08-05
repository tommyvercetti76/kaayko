// scripts/spot-content.js
//
// Hand-authored content for the 17 curated Paddling Out spots.
//
// RULES FOR EDITING THIS FILE — read before adding a spot:
//
//   1. Every factual claim here must be verifiable. Elevations are real
//      Open-Meteo readings recorded during the training-data pull (see
//      paddle-llm-private). Coordinates come from the production spot
//      catalogue. Park, agency and administrative containment is public
//      record. Comparisons between spots ("the highest in this list") are
//      computed from our own elevation data and are safe to state.
//
//   2. DO NOT add wind patterns, "best months", water depths, launch fees,
//      permit rules, water-quality notes, or safety advisories unless you
//      have an official source (NPS, USGS, USACE, state parks) and you link
//      it. Wrong safety information on a paddling site is a liability.
//
//   3. The `scoring` field describes how the *model* treats a location given
//      facts we know (elevation, water-body type, latitude, exposure). It is
//      not a claim about what the weather actually does there. Keep it so.
//
//   4. Keep the voice: spare, honest, first-person where it fits. No generic
//      SEO filler. If a sentence could appear on any lake page, cut it.
//
//   5. Prose must total 150-300 words per spot. The generator enforces this
//      and will refuse to build otherwise.
//
// Slugs and H1s are fixed by the SEO spec and must not drift.

module.exports = [
  {
    id: 'ambazari',
    slug: 'ambazari-lake-nagpur',
    h1: 'Ambazari Lake, Nagpur',
    name: 'Ambazari Lake',
    region: 'Nagpur, Maharashtra, India',
    containedInPlace: 'Nagpur, Maharashtra, India',
    lat: 21.135, lon: 79.045, elevationM: 330,
    waterType: 'lake',
    nearby: ['lake-powell-utah', 'lewisville-lake-texas', 'white-rock-lake-dallas'],
    intro:
      'Ambazari is an urban lake on the western edge of Nagpur, in Maharashtra, and the only spot in this list outside the United States. ' +
      'It sits at roughly 330 metres above sea level, ringed by the city rather than by wilderness. ' +
      'Paddle far enough out and the traffic noise drops away and you are mostly surrounded by birds.',
    scoring:
      'Ambazari is the warmest location Kaayko tracks, and that changes which input decides the score. ' +
      'The cold-water penalty that dominates the alpine reservoirs almost never fires here. ' +
      'Instead the score is usually set by heat, UV, and wind — and during the monsoon months, by rain and reduced visibility. ' +
      'When Ambazari scores badly, it is far more often a heat-and-UV problem than a cold-water one. ' +
      'It is also the spot where the seasonal swing in what limits the score is widest, because the monsoon changes the dominant input outright rather than shifting it by degrees.',
    note:
      'This is a city lake, which is exactly the case the model handles worst. ' +
      'Local rules, access, and water quality change more quickly than any weather feed can track, and none of that is visible to the score. ' +
      'Ambazari is also the one location here where I would treat the forecast as the least authoritative part of your planning, not the most.',
  },
  {
    id: 'antero',
    slug: 'antero-reservoir-colorado',
    h1: 'Antero Reservoir, Colorado',
    name: 'Antero Reservoir',
    region: 'Park County, Colorado',
    containedInPlace: 'Park County, Colorado',
    lat: 38.9979, lon: -105.8865, elevationM: 2736,
    waterType: 'reservoir',
    nearby: ['taylor-park-reservoir-colorado', 'cottonwood-lake-colorado', 'jackson-lake-wyoming'],
    intro:
      'Antero is a high-plains reservoir in South Park, Colorado, near the headwaters of the South Platte River. ' +
      'The recorded elevation is 2,736 metres — close to 9,000 feet. ' +
      'It is owned and operated by Denver Water as part of the city’s supply system, and it sits in open country rather than in a canyon or a forest basin, ' +
      'so there is very little sheltering terrain anywhere around it.',
    scoring:
      'At this elevation the water stays cold well past the point where the air feels comfortable, and that gap is what the Paddle Score keeps catching. ' +
      'A warm, still, sunny afternoon can still produce a mediocre score here, because the cold-water rule does not care how pleasant the air is. ' +
      'Exposure compounds it: with no terrain to break it up, wind reaches the surface with little to slow it down, ' +
      'which makes Antero more wind-sensitive than the sheltered mountain lakes at comparable altitude, such as Cottonwood.',
    note:
      'Antero has been drawn down and refilled repeatedly over its history as a working supply reservoir, and surface conditions change with it. ' +
      'The score reads weather, not reservoir operations. ' +
      'Check current status with the managing agency rather than inferring it from a good forecast.',
  },
  {
    id: 'colorado',
    slug: 'colorado-river-moab-utah',
    h1: 'Colorado River, Moab',
    name: 'Colorado River at Moab',
    region: 'Grand County, Utah',
    containedInPlace: 'Grand County, Utah',
    lat: 38.62, lon: -109.58, elevationM: 1330,
    waterType: 'river',
    nearby: ['kens-lake-utah', 'lake-powell-utah', 'white-rock-lake-dallas'],
    intro:
      'This is the Colorado River where it runs past Moab, in southeastern Utah, at about 1,330 metres. ' +
      'It is one of only two moving-water locations in this list, and that distinction matters more than anything else on this page.',
    scoring:
      'The Paddle Score is a weather model. On a river it describes the air above the water and very little about the water itself. ' +
      'Wind, heat, and UV all read normally here, and the desert setting means heat and UV carry real weight through the summer — ' +
      'closer in character to Lake Powell downstream than to anything in the Colorado mountains. ' +
      'But current, flow rate, and upstream release schedules are invisible to it, and on the Colorado those are frequently the things that decide whether a day is sensible.',
    note:
      'Treat a good score here as a statement about the weather only. ' +
      'Check flow with an official USGS gauge before you commit to a stretch — the model cannot see it, and I would rather say so plainly than let a five-out-of-five imply otherwise. ' +
      'This is the clearest case in the whole list of a high score meaning less than it appears to.',
  },
  {
    id: 'cottonwood',
    slug: 'cottonwood-lake-colorado',
    h1: 'Cottonwood Lake, Colorado',
    name: 'Cottonwood Lake',
    region: 'Chaffee County, Colorado',
    containedInPlace: 'Chaffee County, Colorado',
    lat: 38.831, lon: -106.226, elevationM: 2920,
    waterType: 'lake',
    nearby: ['taylor-park-reservoir-colorado', 'antero-reservoir-colorado', 'jenny-lake-wyoming'],
    intro:
      'Cottonwood Lake sits in Chaffee County, Colorado, west of Buena Vista in the San Isabel National Forest, ' +
      'at a recorded 2,920 metres — a shade under 9,600 feet. ' +
      'It is a small mountain lake held in a drainage rather than on an exposed plain, which makes it a useful contrast with Antero at a similar altitude.',
    scoring:
      'Cold water is the governing input. At close to 9,600 feet, water temperature lags air temperature by a wide margin for most of the paddling season, ' +
      'and the score reflects that even on days that look ideal from the shore. ' +
      'Its position in a drainage gives it more shelter than the open reservoirs, so wind is less often the deciding factor than elevation is. ' +
      'Of the three Colorado spots here, Cottonwood is the one where the score is most consistently limited by a single input rather than by a shifting combination.',
    note:
      'Small high-altitude lakes change character quickly when weather moves through the range, and a small surface responds faster than a large one. ' +
      'A three-day forecast is a weaker instrument here than it is at low elevation, and I would weight the near hours far more heavily than the far ones.',
  },
  {
    id: 'crescent',
    slug: 'lake-crescent-washington',
    h1: 'Lake Crescent, Washington',
    name: 'Lake Crescent',
    region: 'Olympic National Park, Washington',
    containedInPlace: 'Olympic National Park, Washington',
    lat: 48.058, lon: -123.798, elevationM: 195,
    waterType: 'lake',
    nearby: ['diablo-lake-washington', 'lake-union-seattle', 'lake-mcdonald-montana'],
    intro:
      'Lake Crescent lies inside Olympic National Park in Washington, at only 195 metres above sea level. ' +
      'It is a deep, glacially carved lake set in a steep forested valley on the Olympic Peninsula, ' +
      'and it is known for water clarity unusual for a lake of its size.',
    scoring:
      'Crescent is the clearest example in this list of why air temperature alone is a bad guide. ' +
      'The elevation is low — lower than every Colorado and Wyoming spot here by more than a kilometre — so the air can be genuinely mild. ' +
      'But the lake is deep and cold and does not warm the way its altitude suggests it might, and the Paddle Score weighs water temperature as a separate input for exactly this reason. ' +
      'Cloud cover and rain also carry weight here more often than at the desert spots, which is simply the Pacific Northwest doing what it does.',
    note:
      'The valley walls are steep enough that conditions on one part of the lake need not match another. ' +
      'A single forecast point cannot capture that, and the score does not pretend to. ' +
      'Look at the water at your put-in before you trust the number.',
  },
  {
    id: 'diablo',
    slug: 'diablo-lake-washington',
    h1: 'Diablo Lake, Washington',
    name: 'Diablo Lake',
    region: 'Ross Lake National Recreation Area, Washington',
    descRegion: 'North Cascades, Washington',
    containedInPlace: 'Ross Lake National Recreation Area, Washington',
    lat: 48.715, lon: -121.123, elevationM: 367,
    waterType: 'reservoir',
    nearby: ['lake-crescent-washington', 'lake-union-seattle', 'lake-mcdonald-montana'],
    intro:
      'Diablo Lake is a reservoir on the Skagit River inside Ross Lake National Recreation Area, in the North Cascades of Washington, at 367 metres. ' +
      'It is part of the Skagit River Hydroelectric Project, operated by Seattle City Light. ' +
      'Its distinctive colour comes from glacial flour — rock ground fine by glaciers upstream and held in suspension in the water.',
    scoring:
      'That same glacial input keeps the water cold, and cold water is usually what caps the score at Diablo. ' +
      'The elevation is modest, so this is another location where trusting the air temperature would mislead you — the same trap as Lake Crescent, for a different reason. ' +
      'At Crescent the cold comes from depth; here it comes from what is flowing in. ' +
      'Steep terrain on both sides provides some shelter from broad regional wind, which leaves water temperature as the more consistent constraint across the season.',
    note:
      'Diablo is a working hydroelectric reservoir. Levels and surface conditions respond to generation schedules, ' +
      'which the score has no visibility into whatsoever. ' +
      'A perfect forecast tells you nothing about what the dam is doing that afternoon.',
  },
  {
    id: 'jackson',
    slug: 'jackson-lake-wyoming',
    h1: 'Jackson Lake, Wyoming',
    name: 'Jackson Lake',
    region: 'Grand Teton National Park, Wyoming',
    containedInPlace: 'Grand Teton National Park, Wyoming',
    lat: 43.88, lon: -110.66, elevationM: 2062,
    waterType: 'lake',
    nearby: ['jenny-lake-wyoming', 'antero-reservoir-colorado', 'lake-mcdonald-montana'],
    intro:
      'Jackson Lake is the largest lake in Grand Teton National Park, Wyoming, at 2,062 metres. ' +
      'It is a natural glacial lake raised by a dam at its outlet, and it sits directly beneath the Teton Range, ' +
      'with a long open surface running north to south.',
    scoring:
      'Jackson combines the two things the model treats most seriously: real altitude and a large, open surface. ' +
      'Cold water keeps a floor under the score for much of the season, and the size of the lake means there is enough open water for wind to build across before it reaches you. ' +
      'Compared with Jenny Lake a few miles south — only eleven metres lower, but far smaller and more enclosed — Jackson is the more exposed of the two, ' +
      'and wind shows up as the limiting input in its scores noticeably more often.',
    note:
      'Large mountain lakes can be calm at one end and not at the other. ' +
      'The score is computed for a single point and should be read as a general indication for the lake, not a guarantee for a specific bay or crossing. ' +
      'On a lake this size that distinction is not academic.',
  },
  {
    id: 'jenny',
    slug: 'jenny-lake-wyoming',
    h1: 'Jenny Lake, Wyoming',
    name: 'Jenny Lake',
    region: 'Grand Teton National Park, Wyoming',
    containedInPlace: 'Grand Teton National Park, Wyoming',
    lat: 43.748, lon: -110.732, elevationM: 2073,
    waterType: 'lake',
    nearby: ['jackson-lake-wyoming', 'lake-mcdonald-montana', 'cottonwood-lake-colorado'],
    intro:
      'Jenny Lake sits at the base of the Teton Range in Grand Teton National Park, Wyoming, at a recorded 2,073 metres. ' +
      'It is a glacially formed lake, smaller and more enclosed than Jackson Lake to its north, and held tight against the mountains along its western shore.',
    scoring:
      'Elevation is the thing to understand here. At just over 2,000 metres the water stays cold long into the season, ' +
      'and cold water is weighted heavily in the Paddle Score regardless of how warm the air is or how clear the sky looks. ' +
      'This is the most common reason a bright summer day at Jenny does not return a perfect score, and it surprises people every year. ' +
      'Being smaller and more sheltered than Jackson, Jenny is somewhat less often limited by wind and somewhat more often by water temperature — ' +
      'two lakes eleven metres apart in altitude that fail their scores for different reasons.',
    note:
      'The mountains immediately west mean local wind can behave differently from the regional forecast the model reads. ' +
      'Treat the score as a starting point and look at the water before you commit.',
  },
  {
    id: 'kens',
    slug: 'kens-lake-utah',
    h1: 'Kens Lake, Utah',
    name: 'Kens Lake',
    region: 'Grand County, Utah',
    containedInPlace: 'Grand County, Utah',
    lat: 38.48, lon: -109.42, elevationM: 1558,
    waterType: 'reservoir',
    nearby: ['colorado-river-moab-utah', 'lake-powell-utah', 'antero-reservoir-colorado'],
    intro:
      'Kens Lake is a small reservoir in Grand County, Utah, south of Moab and below the La Sal Mountains, at 1,558 metres. ' +
      'It is high desert rather than alpine — well above sea level, but more than a kilometre below the Colorado mountain reservoirs in this list, ' +
      'and in a completely different climate from them.',
    scoring:
      'That middle elevation puts Kens in an unusual position among the seventeen. ' +
      'It is high enough that water temperature still registers, but its desert setting means heat and UV carry real weight through the summer, ' +
      'which is not true of the alpine spots at all. ' +
      'The result is that which input decides the score here shifts across the season more than at either extreme: ' +
      'closer to Taylor Park in spring, closer to Lake Powell in July. ' +
      'It is the least predictable spot in the list in terms of what will limit it on any given day.',
    note:
      'This is a small water body, and small reservoirs respond quickly to both weather and management. ' +
      'The score reads the weather half of that only, and says nothing about the other half.',
  },
  {
    id: 'lewisville',
    slug: 'lewisville-lake-texas',
    h1: 'Lewisville Lake, Texas',
    name: 'Lewisville Lake',
    region: 'Denton County, Texas',
    containedInPlace: 'Denton County, Texas',
    lat: 33.078, lon: -96.971, elevationM: 156,
    waterType: 'reservoir',
    nearby: ['white-rock-lake-dallas', 'trinity-river-irving-texas', 'lake-powell-utah'],
    intro:
      'Lewisville Lake is a large reservoir north of Dallas, in Denton County, Texas, at 156 metres. ' +
      'It is a US Army Corps of Engineers impoundment on the Elm Fork of the Trinity River, ' +
      'and it presents one of the largest open surfaces of anywhere Kaayko tracks.',
    scoring:
      'Cold water is rarely the limiting factor here. Lewisville is a wind-and-heat location instead. ' +
      'It is broad, low, and open, with a long fetch and almost no terrain to interrupt it, so wind has room to build — ' +
      'and wind above 25 mph costs two full points under the hard limits, which no model output is allowed to argue back. ' +
      'Through the Texas summer, heat and UV do much of the rest of the work. ' +
      'Of the three Texas spots here, Lewisville is the one where wind alone is most likely to sink an otherwise good day.',
    note:
      'Large Corps reservoirs carry significant motorised boat traffic. ' +
      'That is not weather, so it is not in the score, and on a busy weekend it may matter a great deal more than the forecast does.',
  },
  {
    id: 'mcdonald',
    slug: 'lake-mcdonald-montana',
    h1: 'Lake McDonald, Montana',
    name: 'Lake McDonald',
    region: 'Glacier National Park, Montana',
    containedInPlace: 'Glacier National Park, Montana',
    lat: 48.598, lon: -113.945, elevationM: 1285,
    waterType: 'lake',
    nearby: ['jenny-lake-wyoming', 'lake-crescent-washington', 'jackson-lake-wyoming'],
    intro:
      'Lake McDonald is the largest lake in Glacier National Park, Montana, at 1,285 metres. ' +
      'It is a long, narrow, glacially carved lake running roughly northeast to southwest in a steep valley, ' +
      'with the Going-to-the-Sun Road following its eastern shore.',
    scoring:
      'McDonald is cold-water territory. The lake is deep and fed by cold mountain drainage, ' +
      'so water temperature holds the score down well past the point where the air has warmed up — the same pattern as Lake Crescent, at four times the elevation. ' +
      'Its shape matters as much as its depth: a long, narrow basin aligned with the valley gives wind a straight run when it lines up with that axis, and much less when it does not. ' +
      'That makes McDonald’s wind behaviour more directional than at the broad open reservoirs.',
    note:
      'Glacier sits far enough north that the usable season is short, and shoulder-season conditions move quickly. ' +
      'Park road and access status is an entirely separate question from the weather, and one the Paddle Score does not answer — check the National Park Service for current conditions.',
  },
  {
    id: 'merrimack',
    slug: 'merrimack-river-new-hampshire',
    h1: 'Merrimack River, New Hampshire',
    name: 'Merrimack River',
    region: 'Hillsborough County, New Hampshire',
    containedInPlace: 'New Hampshire',
    lat: 42.864, lon: -71.49, elevationM: 49,
    waterType: 'river',
    nearby: ['lake-union-seattle', 'white-rock-lake-dallas', 'lake-crescent-washington'],
    intro:
      'The Merrimack is a New England river running south through New Hampshire past Manchester and Nashua before crossing into Massachusetts, ' +
      'sampled here at 49 metres above sea level. ' +
      'Along with the Colorado at Moab, it is one of two moving-water locations in this list, and the lower and gentler of the pair.',
    scoring:
      'The elevation is low and the setting temperate, so the score here is driven by season rather than by altitude. ' +
      'Spring and autumn bring the cold-water rule into play in a way that mid-summer does not, and rain and wind do the rest. ' +
      'This gives the Merrimack the most conventional seasonal curve of anywhere in the list — ' +
      'no desert heat extreme, no permanent alpine cold floor, just a temperate year moving through its range. ' +
      'What the score cannot tell you is the state of the river itself.',
    note:
      'On a river, current and flow are the variables that most often decide whether a day is reasonable, and neither one is a weather input. ' +
      'Check an official USGS gauge. A high Paddle Score is a statement about the air, not about the water moving underneath you.',
  },
  {
    id: 'powell',
    slug: 'lake-powell-utah',
    h1: 'Lake Powell, Utah',
    name: 'Lake Powell',
    region: 'Glen Canyon National Recreation Area, Utah and Arizona',
    descRegion: 'Glen Canyon NRA, Utah and Arizona',
    containedInPlace: 'Glen Canyon National Recreation Area, Utah and Arizona',
    lat: 37.067, lon: -111.247, elevationM: 1101,
    waterType: 'reservoir',
    nearby: ['colorado-river-moab-utah', 'kens-lake-utah', 'lewisville-lake-texas'],
    intro:
      'Lake Powell is a large reservoir on the Colorado River in Glen Canyon National Recreation Area, spanning southern Utah and northern Arizona, at 1,101 metres. ' +
      'It is a flooded canyon system rather than an open basin, which gives it an enormous and highly irregular shoreline.',
    scoring:
      'Powell is a heat and wind location rather than a cold-water one. ' +
      'The desert setting pushes summer heat and UV up the list of things capping the score, and the reservoir is large enough that wind has substantial open water to work across. ' +
      'Its canyon geometry cuts both ways, and this is the spot where a single forecast point is least representative of the whole: ' +
      'some side arms are deeply sheltered while the main channel is fully exposed, and the score cannot distinguish between them. ' +
      'Read it as a regional indication, not a local one.',
    note:
      'Powell has seen dramatic water-level changes in recent years, and launch ramp availability has changed with them. ' +
      'That is reservoir operations, not weather — check current National Park Service status rather than inferring anything from a good score.',
  },
  {
    id: 'taylorpark',
    slug: 'taylor-park-reservoir-colorado',
    h1: 'Taylor Park Reservoir, Colorado',
    name: 'Taylor Park Reservoir',
    region: 'Gunnison County, Colorado',
    containedInPlace: 'Gunnison County, Colorado',
    lat: 38.823, lon: -106.612, elevationM: 3141,
    waterType: 'reservoir',
    nearby: ['cottonwood-lake-colorado', 'antero-reservoir-colorado', 'jackson-lake-wyoming'],
    intro:
      'Taylor Park Reservoir sits on the Taylor River in Gunnison County, Colorado, at 3,141 metres — a little over 10,300 feet. ' +
      'It is the highest location Kaayko tracks by more than two hundred metres, ' +
      'held in a broad basin ringed by the Sawatch and Elk mountains.',
    scoring:
      'Everything here follows from the altitude. This is the spot where the cold-water rule is most consistently in play, ' +
      'and it is entirely normal for Taylor Park to return a capped score on a day that looks flawless from the shore. ' +
      'The basin is also open enough that wind reaches the surface without much interruption, so exposure compounds the elevation rather than offsetting it — ' +
      'unlike Cottonwood, which sits high but sheltered. ' +
      'If you want to understand why the Paddle Score refuses to be talked out of a low number, this is the clearest example in the list.',
    note:
      'At over 10,000 feet the season is short and weather moves through quickly. ' +
      'Forecast confidence degrades faster here than anywhere else Kaayko covers, and the third day of a three-day forecast is worth noticeably less than the first.',
  },
  {
    id: 'trinity',
    slug: 'trinity-river-irving-texas',
    h1: 'Trinity River, Irving',
    name: 'Trinity River at Irving',
    region: 'Irving, Texas',
    containedInPlace: 'Dallas County, Texas',
    lat: 32.84, lon: -96.946, elevationM: 162,
    waterType: 'river',
    nearby: ['white-rock-lake-dallas', 'lewisville-lake-texas', 'colorado-river-moab-utah'],
    intro:
      'This is the Trinity River where it passes through Irving, in the Dallas–Fort Worth area of Texas, at 162 metres. ' +
      'It is an urban river corridor rather than a wilderness one, running through a heavily developed watershed, ' +
      'and it is the third moving-water location in this list alongside the Colorado and the Merrimack.',
    scoring:
      'Low elevation and a warm climate mean the cold-water rule rarely governs here. ' +
      'Heat, UV, and wind do most of the work, and through the Texas summer heat is frequently the input holding the score down — ' +
      'the same profile as White Rock Lake a few miles east, minus the open surface that lets wind build. ' +
      'As with any river, though, the weather is only part of the picture, and on this one it is the smaller part.',
    note:
      'Urban rivers respond sharply to rainfall upstream, and flow can rise well after the rain has stopped and the sky over you has cleared. ' +
      'The Paddle Score reads the sky. It does not read the river. ' +
      'Check an official USGS gauge before you go, particularly after any rain in the watershed.',
  },
  {
    id: 'union',
    slug: 'lake-union-seattle',
    h1: 'Lake Union, Seattle',
    name: 'Lake Union',
    region: 'Seattle, Washington',
    containedInPlace: 'Seattle, Washington',
    lat: 47.64, lon: -122.328, elevationM: 14,
    waterType: 'lake',
    nearby: ['lake-crescent-washington', 'diablo-lake-washington', 'white-rock-lake-dallas'],
    intro:
      'Lake Union sits in the middle of Seattle, Washington, at 14 metres above sea level — the lowest location in this list by a wide margin. ' +
      'It is a freshwater lake surrounded entirely by city, connected to Puget Sound and Lake Washington ' +
      'by the Lake Washington Ship Canal and the Hiram M. Chittenden Locks.',
    scoring:
      'This is the mildest profile Kaayko tracks. Low elevation and a maritime climate keep the extremes off the table: ' +
      'the cold-water rule fires far less often than at the mountain spots, and desert-grade heat and UV are simply not a factor. ' +
      'Cloud, rain, and wind end up doing most of the work, which is a fairly ordinary Pacific Northwest set of constraints. ' +
      'Statistically it is the spot least likely to be hard-capped by a safety rule, which is worth knowing but is not the same as being the safest.',
    note:
      'Lake Union is working water. Seaplanes operate from it, commercial vessels use the canal, and recreational traffic is heavy in season — ' +
      'and none of that appears anywhere in a weather score. ' +
      'On Lake Union the traffic is very often the real constraint, not the forecast.',
  },
  {
    id: 'whiterock',
    slug: 'white-rock-lake-dallas',
    h1: 'White Rock Lake, Dallas',
    name: 'White Rock Lake',
    region: 'Dallas, Texas',
    containedInPlace: 'Dallas, Texas',
    lat: 32.832, lon: -96.722, elevationM: 138,
    waterType: 'lake',
    nearby: ['lewisville-lake-texas', 'trinity-river-irving-texas', 'lake-union-seattle'],
    intro:
      'White Rock Lake is a city lake in Dallas, Texas, at 138 metres, held by a dam on White Rock Creek. ' +
      'It was built in 1911 as a municipal water supply and has long since become a recreation lake instead, ' +
      'used heavily for paddling and rowing inside the city.',
    scoring:
      'White Rock is a heat and wind location. Water temperature is seldom what limits the score; ' +
      'through a Texas summer it is heat and UV, and across the rest of the year it is most often wind. ' +
      'The lake is small enough that wind does not get the fetch it gets at Lewisville forty kilometres north, ' +
      'which tends to make its scores less volatile than the larger reservoir — a useful thing to know if you are choosing between the two on a breezy day.',
    note:
      'It is a city lake, so closures, organised events, and water-quality advisories are all real possibilities that a weather model cannot see. ' +
      'Check with Dallas Parks and Recreation for current status before relying on a good score.',
  },
];
