G = ("Cinematic 35mm film look, vertical 9:16, mostly true first-person point of view through his own eyes with the camera moving like his head, "
     "the hero is a young Saudi man whose face is never shown, a plain matte black sport watch with no logo on his left wrist, "
     "warm tungsten and golden practical lighting with deep soft shadows, rich saturated ambers, brass golds, deep reds and dark greens with small cool blue accents, "
     "heavy soft film grain, gentle halation on highlights, shallow depth of field with creamy bokeh, energetic handheld camera, "
     "other people may appear but always in soft focus or partly out of frame, realistic skin texture, natural hand anatomy with five fingers, "
     "no text, no logos, no brand names, no readable screens")
GREEN = "the phone screen is a flat solid chroma-key green, evenly lit, no reflections, held fairly steady"

# (n, time, title, kind, prompt, app/edit, transition into the next shot)
SH = [
("MORNING · 0–7.5 s · pace: wakes slowly, then speeds up", [
(1,"0.0–0.6","Alarm","POV",
 "First-person view lying on his side in bed in the dark, head on a white pillow, at eye level with a dark walnut nightstand, a smartphone on it buzzes and lights the room with a warm glow, dust in the light, sleepy slight head movement. "+GREEN,
 "Phone: alarm 5:30 (real Adro alarm/notification)","Hard cut on the second buzz"),
(2,"0.6–1.4","First thing he does","POV",
 "First-person view sitting on the edge of the bed in a grey cotton t-shirt, he picks up the smartphone and brings it close to his eyes with both hands, warm lamp bokeh behind, he is still drowsy, slight sway. "+GREEN,
 "APP · Home: “Good morning” · Recovery 82% · Sleep 7h 40m","Cut on his thumb swipe"),
(3,"1.4–2.0","To the bathroom","POV",
 "First-person view walking barefoot across a patterned Persian rug toward a half-open bathroom door, his hand pushes the door open into a glowing golden bathroom, motion blur, morning light",
 "","Door opens = cut (Gucci door transition)"),
(4,"2.0–2.7","Golden sink","Overhead",
 "Top-down shot straight above a round cream marble basin in a warm golden bathroom with brass fixtures, a hand turns an ornate brass tap and clear water pours into the round basin, two hands slide under the water, rich warm light",
 "Circle motif #1 (round basin)","Match cut on the water"),
(5,"2.7–3.2","Water to the face","POV macro",
 "Extreme slow-motion first-person view, two cupped hands lift water up toward the camera, droplets fly and catch golden light, the water hits the lens softly",
 "","Water hits the lens = cut"),
(6,"3.2–3.8","Towel","Insert",
 "Close shot, a wet hand with the black watch grabs a thick white towel from a round brass towel ring on a green tiled wall, warm light, droplets",
 "Circle motif #2 (brass ring)","Cut on the pull"),
(7,"3.8–4.4","Scale","POV",
 "First-person view looking straight down at his own bare feet stepping onto a slim glass scale on green and cream patterned tiles, he holds a smartphone in his left hand at the bottom of the frame, warm golden light. "+GREEN,
 "APP · Weight: 81.6 kg · ▼ 0.4 kg this week (trend line)","Whip pan right"),
(8,"4.4–5.4","Wardrobe","POV",
 "First-person view in front of an open walnut wardrobe, his hands flip fast through a row of crisp white thobes on wooden hangers, fabric swaying, he stops and pulls one out, warm closet light, energetic speed ramp",
 "Gucci-style clothes choice","Speed ramp into the next shot"),
(9,"5.4–6.0","Shemagh","Overhead",
 "Top-down shot above a made bed, two hands lay down and fold a red-and-white checkered shemagh with a quick practiced motion, a black watch beside it on the sheet, warm morning sunlight stripes",
 "","Cut on the fold"),
(10,"6.0–6.6","Watch on","Macro",
 "Extreme close-up of the plain matte black sport watch strapping onto a wrist with a white thobe cuff, the buckle clicks closed, warm light glints on the case",
 "The device that feeds Adro","Cut on the click"),
(11,"6.6–7.5","Breakfast","Overhead → POV",
 "Top-down shot of a breakfast tray on a dark green marble counter: two fried eggs, labneh with olive oil, olives, warm bread, a small brass dallah and a finjan of Saudi coffee, a hand with the white thobe cuff holds a smartphone above it as if taking a photo. "+GREEN,
 "APP · Meal camera → “Eggs, labneh, bread · 38 g protein”","Hard cut on the shutter"),
]),
("DRIVE · 7.5–10.5 s · pace: city rush", [
(12,"7.5–8.2","Engine","Insert",
 "Close shot inside a car, a finger in a white thobe sleeve presses a round glowing engine start button, the dashboard lights wake up in amber and blue, the keys swing",
 "Circle motif #3 (start button)","Cut on the engine sound"),
(13,"8.2–9.2","Riyadh morning","POV",
 "First-person view from the driver's seat, both hands on the steering wheel with the black watch on the left wrist and white thobe sleeves, driving on a wide Riyadh highway in golden morning sun, modern towers in the haze, lens flare, traffic around, quick look to the side mirror",
 "","Whip pan to the window"),
(14,"9.2–10.0","Drive-thru","POV",
 "First-person view from the driver's seat, the window is down, an attendant's hand passes an iced coffee in a clear cup through a drive-thru window, his hand takes it, condensation, warm sunlight, slightly busy and rushed",
 "","Cut as the cup lands"),
(15,"10.0–10.5","Cup holder","Overhead",
 "Top-down shot of the round lid of an iced coffee cup dropping into a car cup holder, ice rattles, warm light",
 "Circle motif #4 (cup lid)","Graphic match circle → office"),
]),
("OFFICE · 10.5–16.5 s · pace: busiest part of the day", [
(16,"10.5–11.2","Office doors","POV",
 "First-person view walking fast through glass office doors into a bright modern Riyadh office, colleagues in thobes and abayas walk past in soft focus, one raises a hand to say good morning, motion blur",
 "Life + rush","Cut on the doors closing"),
(17,"11.2–11.8","Desk","POV",
 "First-person view sitting down at a wooden desk, his hands open a laptop, the screen is bright and blurred, a coffee cup, notebook and pen, a phone buzzing on the desk, warm window light",
 "","Three micro-cuts 0.2 s each →"),
(18,"11.8–12.4","Rush (3 inserts)","Inserts",
 "Three very short close-ups in a busy office: a pen clicking, a hand turning a page of printed slides, a phone vibrating on a wooden desk with notification light flashes, warm light, energetic",
 "Cut on the beat ×3","Cut on the third beat"),
(19,"12.4–13.2","Meeting","POV",
 "First-person view sitting in a glass meeting room, colleagues gesturing around a table in soft focus, laptops open, a whiteboard with blurred diagrams, he glances down at the black watch on his wrist, warm afternoon light",
 "Watch shows 1:30 (edit)","Cut on the glance"),
(20,"13.2–13.8","The donut box","Overhead",
 "Top-down shot of a desk, a colleague drops an open box of glazed donuts on it, his hand with the white thobe cuff reaches toward a donut, warm office light, rich colors",
 "Circle motif #5 (donuts)","→ REWIND"),
(21,"13.8–14.4","⏪ REWIND (VHS)","Edit",
 "NOT GENERATED. Built in edit: Gucci-style tape rewind — image tears, tracking lines, cyan and blue bars, the hand flies backward, mirrored text “1:30 PM” flashes, small blue down arrow.",
 "Gucci signature","Snap back to the same frame"),
(22,"14.4–15.2","Second chance","Overhead",
 "Same top-down desk shot with the open donut box, his hand stops above it, a smartphone on the desk lights up beside the box, the hand pulls back. "+GREEN,
 "APP · AI coach: “Workout at 7 🏋️ Grab protein now?”","Cut on the hand pulling back"),
(23,"15.2–15.9","Better lunch","Insert",
 "Close shot, his hand takes a grilled chicken wrap out of a paper bag on the desk and holds a smartphone above it as if photographing it, warm light. "+GREEN,
 "APP · Food: “Chicken wrap · +32 g · 18 g protein left”","Cut on the shutter"),
(24,"15.9–16.5","Water","POV",
 "First-person view at an office water dispenser, a clear bottle fills up, bubbles rise, cool blue light mixed with warm office light, he twists the cap",
 "","Cut on the cap twist"),
]),
("GYM · 16.5–24.2 s · pace: peak energy", [
(25,"16.5–17.2","Gym door","POV",
 "First-person view pushing open a heavy black gym door at sunset, the gym inside glows with warm pendant lights, music energy, people training in soft focus, motion blur",
 "Door = cut (Gucci door)","Cut on the door slam"),
(26,"17.2–17.8","Fist bump","POV",
 "First-person view, a friend in a grey hoodie walks toward the camera laughing, his face in soft focus, he extends a fist and bumps the hero's fist which enters from the bottom of the frame wearing the black watch and a black t-shirt sleeve, warm gym lights",
 "Life","Cut on the bump"),
(27,"17.8–18.4","Together","Insert",
 "Close shot of a smartphone propped on a gym bench, two hands, one with a black watch, reach toward it at the same time, warm low light, chalk on the bench. "+GREEN,
 "APP · Train together: “Ali joined your workout”","Cut on the tap"),
(28,"18.4–19.0","Chalk","Overhead",
 "Top-down slow motion, two hands press into a round bowl of white chalk and lift, a cloud of chalk bursts into a warm spotlight beam in a dark gym",
 "Circle motif #6 (chalk bowl)","Cut through the chalk cloud"),
(29,"19.0–20.0","Under the bar","POV",
 "First-person view lying on a flat bench, looking straight up at a loaded barbell on the rack, his two chalked hands rise into frame and grip the bar, black watch on the left wrist, warm pendant lights behind, slow push-in",
 "","Speed ramp"),
(30,"20.0–20.8","The lift","POV",
 "First-person view lying on the bench, the loaded barbell presses up away from the camera toward the ceiling lights in slow motion, arms extend from the bottom of the frame, chalk particles float, the friend's hands spot from above in soft focus",
 "","Cut on lockout"),
(31,"20.8–21.3","Plates","Low wide",
 "Low floor-level wide shot, black iron weight plates slam onto a rack peg, chalk dust bounces, warm rim light, a friend's legs walk past",
 "Circle motif #7 (plates)","Cut on the clank"),
(32,"21.3–22.0","New best","Insert",
 "Close shot, a chalked hand with the black watch taps a smartphone lying on the bench, chalk fingerprints on the edge, warm light. "+GREEN,
 "APP · Live workout: “82.5 kg × 8 ✓ · New best”","Cut on the check tap"),
(33,"22.0–22.6","The crew","POV",
 "First-person view from the bench, two friends in the gym cheer and clap toward the camera, laughing, faces in soft focus, warm lights and chalk in the air, joyful energy",
 "Life","Whip pan"),
(34,"22.6–23.4","Rest","POV",
 "First-person view sitting on the bench breathing hard, looking down at a smartphone in his hand, sweat drops fall on the screen edge, warm gym lights blur behind. "+GREEN,
 "APP · Rest timer 1:30 counting down","Cut on the timer end"),
(35,"23.4–24.2","Golden hour","POV",
 "First-person view walking out of the gym into a parking lot at golden hour, keys swinging in his hand, the Riyadh skyline glowing orange in the distance, a gym bag strap on his shoulder",
 "","Cut on the step"),
]),
("EVENING · 24.2–27.6 s · pace: warm and human", [
(36,"24.2–25.0","Family kabsa","POV",
 "First-person view sitting on a floor cushion in a warm family majlis, looking down at a large round shared platter of kabsa with rice and chicken, several family members' hands reach in, laughter, warm lamp light, his right hand joins",
 "Circle motif #8 (round platter)","Cut on the reach"),
(37,"25.0–25.6","Gahwa","Insert",
 "Close shot, an older hand pours Arabic coffee from a brass dallah into a small finjan and passes it to his hand with the black watch, steam, warm light",
 "","Cut on the hand-off"),
(38,"25.6–26.2","Log it","Insert",
 "Close shot, he holds a smartphone above his plate of kabsa in the majlis as if photographing it, family in soft focus behind. "+GREEN,
 "APP · Meal result: “Kabsa · 1 plate · 640 kcal · Protein goal ✓”","Cut on the shutter"),
(39,"26.2–27.0","Little cousin","POV",
 "First-person view, a small laughing child runs into frame and jumps toward the camera for a hug, face blurred with motion, warm living room light, pure joy",
 "Life","Hug = black flash"),
(40,"27.0–27.6","Night drive","POV",
 "First-person view driving at night, hands on the steering wheel, Riyadh city lights pass as soft bokeh, quiet and calm, a slow breath",
 "","Cut on a passing light"),
]),
("NIGHT · 27.6–30.5 s · pace: slows down", [
(41,"27.6–28.2","Golden sink, night","Overhead",
 "Same top-down shot of the round cream marble basin in the golden bathroom, now at night with softer light, a hand turns the brass tap off and the last drops fall",
 "Echo of Shot 4","Cut on the last drop"),
(42,"28.2–29.2","Day complete","POV",
 "First-person view lying in bed at night, holding a smartphone above his face, faint glow on the white sheets, a warm bedside lamp at the edge of the frame. "+GREEN,
 "APP · Day recap: “Day complete ✓ · Protein ✓ · Water ✓ · Workout ✓”","Cut on the phone lowering"),
(43,"29.2–30.5","Lights out","POV",
 "First-person view lying on his side, same eye-level view across the dark walnut nightstand as Shot 1, his hand places the smartphone face-down beside a small warm lamp, the lamp fades to black, very slow",
 "A thin blue glow leaks from under the phone (edit)","Eyes close = black"),
]),
]

END = [
("30.5–31.3","Circles flash","0.1 s each, every circle from the day flashes in order — basin, towel ring, start button, cup lid, donuts, chalk bowl, plates, kabsa platter — and collapses into one blue dot (#3355FF)."),
("31.3–32.3","Open ring","The dot draws into the open ring. Never closes, never rotates."),
("32.3–33.0","adro","The ring slides into the “o” of adro (white wordmark, blue ring)."),
("33.0–35.0","Title","Gucci-style spaced words: Your &nbsp;&nbsp; whole &nbsp;&nbsp; day. &nbsp;&nbsp; Coached. · then COMING SOON · then the Arabic line (IBM Plex Sans Arabic) <span class='arin'>يشوف يومك كله… ويدرّبك عليه.</span>"),
]

def esc(s): return s.replace('&','&amp;').replace('<','&lt;')
rows=[]
for title, shots in SH:
    rows.append(f'<h2>{title}</h2>')
    for n,t,name,kind,p,app,tr in shots:
        cls = 'shot rw' if 'REWIND' in name else 'shot'
        a = f'<div class="ap"><b>{"APP" if app.startswith("APP") else "Edit"}:</b> {esc(app.replace("APP · ","",1))}</div>' if app else ''
        rows.append(f'<div class="{cls}"><div class="sh"><span class="n">{n}</span><b>{name}</b><span class="k">{kind}</span><span class="tm">{t} s</span><span class="tr">→ {esc(tr)}</span></div><div class="pr">{esc(p)}</div>{a}</div>')
endrows=''.join(f'<tr><td>{a}</td><td><b>{b}</b></td><td>{c}</td></tr>' for a,b,c in END)

html=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Adro · Your whole day</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Sora:wght@400;600;800&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet">
<style>
@page{{size:A4;margin:11mm 11mm 10mm}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:Sora,sans-serif;color:#15151a;font-size:9.4px;line-height:1.42}}
.ar{{font-family:'IBM Plex Sans Arabic';direction:rtl;text-align:right;font-size:10px}}
.arin{{font-family:'IBM Plex Sans Arabic';direction:rtl;unicode-bidi:isolate}}
header{{display:flex;align-items:center;gap:12px;border-bottom:3px solid #3355ff;padding-bottom:7px}}
header h1{{font-size:19px;font-weight:800}} header h1 span{{color:#3355ff}}
header p{{color:#666;font-size:9.6px}}
h2{{font-size:11.5px;margin:10px 0 4px;color:#1f2fb8;border-left:4px solid #3355ff;padding-left:8px;break-after:avoid;letter-spacing:.3px}}
.box{{background:#f5f6fa;border-radius:10px;padding:7px 11px;margin:7px 0;break-inside:avoid}}
.box b{{color:#1f2fb8}}
.ar ul{{padding-right:15px}} ul{{padding-left:15px}} li{{margin:1px 0}}
.mono,.pr{{font-family:'IBM Plex Mono',monospace;font-size:8.6px;background:#fff;border:1px solid #e3e5ee;border-radius:6px;padding:4px 7px;color:#222}}
.shot{{break-inside:avoid;margin:3px 0 5px}}
.shot.rw .pr{{background:#15151a;color:#fff;border-color:#15151a}}
.sh{{display:flex;align-items:baseline;gap:7px;margin-bottom:2px}}
.n{{background:#3355ff;color:#fff;border-radius:5px;padding:0 5px;font-weight:600;min-width:20px;text-align:center}}
.k{{color:#fff;background:#8a8fa3;border-radius:4px;padding:0 5px;font-size:8.4px}}
.tm{{color:#666}} .tr{{margin-left:auto;color:#1f2fb8;font-size:8.6px}}
.ap{{margin-top:2px;font-size:8.9px;color:#0b6b3a}}
table{{width:100%;border-collapse:collapse;font-size:9px;break-inside:avoid}}
th{{background:#3355ff;color:#fff;text-align:left;padding:3px 6px;font-weight:600}}
td{{border-bottom:1px solid #e6e8f0;padding:3px 6px;vertical-align:top}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.foot{{margin-top:10px;color:#999;font-size:8.3px;text-align:center}}
</style></head><body>
<header><svg width="36" height="36" viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="#3355ff" stroke-width="8" stroke-linecap="round" stroke-dasharray="75.4 94.2" transform="rotate(-90 20 20)"/></svg>
<div><h1>ADRO — “Your whole day” <span>(Gucci × Oura style)</span></h1>
<p>9:16 vertical · 35 s · 43 shots · mostly eye-level POV, hands only sometimes · one busy Riyadh day · real Adro screens composited in edit</p></div></header>

<div class="box ar"><b>الفكرة:</b> يوم كامل لشاب سعودي، مزحوم وحي ومليان ناس: البيت، والحمام، والدولاب، والسيارة، والدوام، والجيم مع أصحابه، والعشا مع أهله، والنوم. القطع سريع جداً مثل Gucci، وكل لقطة تقريباً نص ثانية. وAdro موجود بشكل طبيعي على جواله طول اليوم. و<b>أول شي يسويه لما يقعد من النوم: يفتح الجوال</b>.
<ul>
<li><b>الكاميرا:</b> أغلبها من عيونه. يدينه تطلع أحياناً، مو طول الوقت. ووجهه ما يبين أبداً.</li>
<li><b>الانتقالات:</b> نفس طريقة Gucci: قطع على الحركة، والباب يفتح على مكان جديد، وقطع مع لفة الكاميرا السريعة، وتسريع وتبطيء، وترجيع VHS مرة وحدة.</li>
<li><b>الحمام مثلهم:</b> مغسلة دايرية رخام، وحنفية نحاس، وضوء ذهبي، وتصوير من فوق، والماي يجي على العدسة.</li>
<li><b>الدولاب مثلهم:</b> يقلّب الثياب البيض بسرعة ويختار واحد، والشماغ ينطوي على السرير.</li>
<li><b>جديد:</b> سواقة في الرياض مع درايف ثرو، ودوام مزحوم فيه اجتماع، وعشا كبسة مع الأهل.</li>
<li><b>شاشات Adro حقيقية:</b> الصفحة الرئيسية، والوزن، وتصوير الأكل، والمدرب الذكي، والتمرين مع صديق، والتمرين المباشر، ووقت الراحة، وملخص اليوم.</li>
<li><b>لمسة إبداعية:</b> الدواير. كل اليوم فيه أشياء دايرية: المغسلة، وغطا القهوة، وزر السيارة، والدونات، وصحن الطباشير، والأوزان، وصحن الكبسة. في الآخر كلها تومض ورا بعض، وتتجمع في نقطة زرقاء، وتصير دائرة شعار Adro.</li>
</ul></div>

<h2>GLOBAL STYLE — paste at the start of every prompt</h2>
<div class="mono">{esc(G)}</div>
<div class="box" style="margin-top:5px"><b>Wardrobe continuity:</b> Morning = grey cotton t-shirt · Day = crisp white thobe (shemagh at the office) · Gym = black t-shirt, grey-hoodie friend “Ali” · Evening = white thobe, no shemagh · <b>same plain black watch on the left wrist all day.</b><br>
<b>Phone shots:</b> every shot marked APP uses a flat chroma-green screen, and a <b>real Adro screen recording</b> is tracked onto it in edit. Never let the AI draw the app.</div>
{''.join(rows)}

<h2>ENDING · 30.5–35 s — built in edit</h2>
<table><tr><th style="width:62px">Time</th><th style="width:92px">Beat</th><th>What happens</th></tr>{endrows}</table>

<div class="two">
<div><h2>TRANSITION GRAMMAR (from Gucci × Oura)</h2><ul>
<li><b>Match on action:</b> a move starts in one shot and finishes in the next.</li>
<li><b>Door cuts:</b> every door he pushes opens a new place (bathroom, gym).</li>
<li><b>Whip pans</b> bridge places (scale → wardrobe, highway → drive-thru).</li>
<li><b>Speed ramps</b> on the wardrobe, the bar and the gym door.</li>
<li><b>Graphic match</b> of circles from top-down shots.</li>
<li><b>One VHS rewind</b> at the donut box: the day rewinds and he chooses again.</li>
<li><b>Micro-cut bursts</b> (0.2 s) for the office rush.</li>
<li><b>Echo shots:</b> sink morning/night, nightstand morning/night.</li></ul></div>
<div><h2>SOUND</h2><ul>
<li>A warm, groovy beat that speeds up from morning to the gym and calms down at night. Every cut lands on the beat.</li>
<li>Foley in every shot: alarm, tap, water, hangers, buckle click, engine, ice, pen, donut box, chalk, plates, friends cheering, coffee pour, child laughing.</li>
<li>A tape-rewind sound on the VHS moment.</li>
<li>Total silence when the lamp goes out, then a soft chime on the ring.</li></ul>
<h2>PRODUCTION & COST</h2><ul>
<li>~38 generations (shot 21 and the ending are built in edit). 3–4 s each; only the best ~0.5–1 s is used.</li>
<li>Start with one reference image (hand + watch + thobe cuff), used in every shot.</li></ul>
<table style="margin-top:4px"><tr><th>Option</th><th>Credits</th></tr>
<tr><td>Kling 3.0 (all shots)</td><td>~230</td></tr>
<tr><td>Kling 3.0 + Cinema Studio 4.0 for 5 hero shots (sink, wardrobe, lift, kabsa, lights out)</td><td>~340</td></tr>
<tr><td>Kling 4.0 (all shots)</td><td>~495</td></tr>
<tr><td>Cinema Studio 4.0 (all shots)</td><td>~1,060</td></tr></table></div></div>
<div class="foot">Adro · “Your whole day” · Gucci × Oura style · November 2026</div>
</body></html>'''
open('script.html','w').write(html)
print('ok', sum(len(s) for _,s in SH))
