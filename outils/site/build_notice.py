import json, os, html
VERSION = json.load(open('../../package.json'))['version']
from PIL import Image, ImageDraw, ImageFont
LANGS = [('fr', '🇫🇷 Français'), ('en', '🇬🇧 English'), ('es', '🇪🇸 Español'), ('pt', '🇵🇹 Português'), ('it', '🇮🇹 Italiano'), ('de', '🇩🇪 Deutsch'), ('el', '🇬🇷 Ελληνικά'), ('ru', '🇷🇺 Русский'), ('zh', '🇨🇳 中文'), ('ja', '🇯🇵 日本語')]
S = 1.2
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
# figures : section → [(capture, zone à découper ou None, repères, clé de légende)]
FIG = {1: [('01-ecran', None, ['undo', 'lists', 'import', 'midi', 'lang', 'lib', 'pl', 'transport', 'restart', 'insp', 'tl'], 'cap')],
       2: [('01-ecran', 'lib', [], 'cap')], 3: [('01-ecran', 'pl', [], 'cap')], 4: [('01-ecran', 'tl', [], 'cap')],
       5: [('02-courbes', ('tools', 'tl'), [], 'cap')], 6: [('01-ecran', 'tools', [], 'cap')],
       7: [('03-preecoute', None, ['btnCue', 'cuebar', 'GREEN'], 'cap'), ('01-ecran', 'tools', ['outmaster', 'outmode', 'outcue', 'outinfo', 'restart'], 'cap2', 'leg2')],
       8: [('04-son', 'snd', ['la', 'xf', 'lb', 'fx'], 'cap'), ('05-son-simple', 'snd', [], 'cap2')],
       9: [('06-autodj', 'dlg', [], 'cap')], 10: [('07-midi', 'dlg', [], 'cap')], 11: [('08-export', 'dlg', [], 'cap')], 13: [('09-couleurs', 'dlg', [], 'cap')]}

def marker(d, x, y, n):
    r = 15
    d.ellipse([x - r - 2, y - r - 2, x + r + 2, y + r + 2], fill='white')
    d.ellipse([x - r, y - r, x + r, y + r], fill='#e53935')
    d.text((x, y + 1), str(n), font=FONT, fill='white', anchor='mm')

def make_img(lang, cap, zone, marks, out):
    im = Image.open(f'shots/{lang}/{cap}.jpg').convert('RGB')
    bx = json.load(open(f'shots/{lang}/boxes.json'))[cap]
    d = ImageDraw.Draw(im)
    for i, k in enumerate(marks):
        if k == 'GREEN':
            x, y, w, h = bx['tl']; px, py = (x + 10 + 0.58 * (w - 40)) * S + 26, (y + 40) * S
        else:
            x, y, w, h = bx[k]
            if k in ('lib', 'pl'): px, py = (x + w * 0.47) * S, (y + 16) * S
            elif k == 'insp': px, py = (x + w - 26) * S, (y + h / 2) * S
            elif k == 'tl': px, py = (x + w - 34) * S, (y + 62) * S
            elif k == 'cuebar': px, py = (x + w * 0.6) * S, (y + h / 2) * S
            elif k in ('la', 'lb', 'xf', 'fx'): px, py = (x + 10) * S, (y + 8) * S
            else: px, py = (x + w) * S + 4, y * S - 1   # coin haut-droit, à cheval : le texte du bouton reste lisible
            px, py = min(max(px, 18), 1902), min(max(py, 18), 1062)
        marker(d, px, py, i + 1)
    if zone:
        ks = zone if isinstance(zone, tuple) else (zone,)
        x0 = min(bx[k][0] for k in ks); y0 = min(bx[k][1] for k in ks)
        x1 = max(bx[k][0] + bx[k][2] for k in ks); y1 = max(bx[k][1] + bx[k][3] for k in ks)
        im = im.crop((int(max(0, x0) * S), int(max(0, y0) * S), int(min(1600, x1) * S), int(min(900, y1) * S)))
    if im.width > 1400: im = im.resize((1400, round(im.height * 1400 / im.width)), Image.LANCZOS)
    im.save(out, quality=82, optimize=True, progressive=True)

os.makedirs('../../docs/notice/img', exist_ok=True)
arts = []
for lang, _ in LANGS:
    N = json.load(open(f'notice_{lang}.json'))
    os.makedirs(f'../../docs/notice/img/{lang}', exist_ok=True)
    toc = ''.join(f'<a href="#{lang}-s{i+1}">{i+1}. {html.escape(s["t"])}</a>' for i, s in enumerate(N['s']))
    body = ''
    for i, s in enumerate(N['s']):
        body += f'<section id="{lang}-s{i+1}"><h2>{i+1}. {html.escape(s["t"])}</h2>' + ''.join(f'<p>{p}</p>' for p in s['p'])
        for j, fig in enumerate(FIG.get(i, [])):
            cap, zone, marks, ck = fig[:4]; lk = fig[4] if len(fig) > 4 else 'leg'
            name = f'{i+1:02d}-{j}.jpg'
            make_img(lang, cap, zone, marks, f'../../docs/notice/img/{lang}/{name}')
            leg = ''
            if marks and s.get(lk):
                assert len(s[lk]) == len(marks), (lang, i)
                leg = '<ol class="leg">' + ''.join(f'<li><b>{k+1}</b><span>{html.escape(t)}</span></li>' for k, t in enumerate(s[lk])) + '</ol>'
            body += f'<figure><img src="img/{lang}/{name}" alt="{html.escape(s[ck])}" loading="lazy"><figcaption>{html.escape(s[ck])}</figcaption>{leg}</figure>'
        body += '</section>'
    arts.append(f'<article lang="{lang}" data-lang="{lang}" hidden><div class="head"><h1>{html.escape(N["title"])}</h1><div class="sub">{html.escape(N["sub"])} · {N["ver"]}</div></div>'
                f'<p class="intro">{N["intro"]}</p><nav class="toc"><b>{N["toc"]}</b>{toc}</nav>{body}'
                f'<footer>TIMELINE DJ MIX {VERSION} · DJ LATIN JAZZ &amp; DJ CRISLATINO · Claude.ai · GNU GPL v2+ · https://deltapassion.github.io/Timeline-DJ-Mix/</footer></article>')
UI = {l: {k: json.load(open(f'notice_{l}.json'))[k] for k in ('back', 'pdf', 'title')} for l, _ in LANGS}
page = '''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TIMELINE DJ MIX — Notice</title><meta name="description" content="Notice illustrée de TIMELINE DJ MIX en dix langues.">
<link rel="icon" href="../assets/favicon.png"><style>
body{font-family:Inter,'DejaVu Sans','Noto Sans CJK SC','Noto Sans CJK JP',Arial,sans-serif;color:#1d2733;font-size:10.5pt;line-height:1.55;margin:0;background:#f4f6f9}
main{max-width:980px;margin:0 auto;padding:18px clamp(12px,3vw,32px) 40px;background:#fff;box-shadow:0 0 0 1px #dfe5ec}
.head{border-bottom:3px solid #e8962a;padding:6px 0 10px;margin-bottom:12px}
h1{margin:0;font-size:24pt;color:#14304f}
.sub{color:#4a5a6a;margin-top:2px}
.intro{background:#fdf3e4;border-radius:8px;padding:10px 14px;margin:0 0 6px}
h2{color:#c46d0b;font-size:14pt;margin:22px 0 6px;border-left:5px solid #e8962a;padding-left:8px;break-after:avoid}
p{margin:4px 0 6px}
code{background:#eef3fa;border-radius:3px;padding:0 3px;font-size:9.5pt}
figure{margin:10px 0 14px;break-inside:avoid}
figure img{width:100%;border:1px solid #c8d3df;border-radius:6px;display:block}
figcaption{font-size:9.5pt;color:#4a5a6a;font-style:italic;margin-top:4px;text-align:center}
ol.leg{list-style:none;padding:0;margin:6px 0 0;columns:2;column-gap:22px;font-size:9.5pt}
ol.leg li{display:flex;gap:8px;align-items:flex-start;margin:0 0 4px;break-inside:avoid}
ol.leg b{flex:none;background:#e53935;color:#fff;border-radius:50%;width:20px;height:20px;line-height:20px;text-align:center;font-size:9pt}
nav.toc{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:9.5pt;margin:10px 0}
nav.toc b{width:100%}
nav.toc a{color:#14304f;text-decoration:none}
footer{margin-top:22px;border-top:1px solid #c8d3df;padding-top:6px;font-size:8.5pt;color:#6b7785}
.top{position:sticky;top:0;z-index:10;background:#14304f;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18)}
.top .in{max-width:1180px;margin:0 auto;padding:8px clamp(12px,3vw,32px);display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.top a{color:#fff}
.top a.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:700;font-size:14pt;margin-right:auto;white-space:nowrap}
.top a.brand img{width:30px;height:30px;border-radius:7px}
.top a.small{font-size:10pt}
.top a.pdf{background:#e8962a;color:#1b1206;text-decoration:none;border-radius:8px;padding:6px 12px;font-weight:600;font-size:10pt}
.top select{font:inherit;font-size:10pt;border-radius:8px;padding:5px 8px}
@media (max-width:640px){ol.leg{columns:1}}
@media print{.top{display:none} main{box-shadow:none;max-width:none;padding:0} body{background:#fff} nav.toc a{color:#14304f}}
</style></head><body>
<header class="top"><div class="in">
  <a class="brand" href="../index.html"><img src="../assets/icon.png" alt="">TIMELINE DJ MIX <span style="font-weight:400;font-size:10pt;opacity:.75">__VERSION__</span></a>
  <a class="small" id="back" href="../index.html">Retour au site</a>
  <a class="pdf" id="pdf" href="notice-fr.pdf" download>⬇ <span>Télécharger le PDF</span></a>
  <select id="lang" aria-label="Langue / Language">__OPTS__</select>
</div></header>
<main>__ARTS__</main>
<script>
(function(){
  var UI = __UI__, LANGS = Object.keys(UI);
  function pick(){ var q = new URLSearchParams(location.search).get("lang"); if (LANGS.indexOf(q) >= 0) return q;
    try { var s = localStorage.getItem("timelinedjmix-lang"); if (LANGS.indexOf(s) >= 0) return s; } catch(e){}
    var n = navigator.languages || [navigator.language || "fr"]; for (var i = 0; i < n.length; i++){ var c = String(n[i]).slice(0,2).toLowerCase(); if (LANGS.indexOf(c) >= 0) return c; } return "fr"; }
  function set(l){
    document.querySelectorAll("article").forEach(function(a){ a.hidden = a.dataset.lang !== l; });
    document.documentElement.lang = l; document.title = "TIMELINE DJ MIX — " + UI[l].title;
    document.getElementById("lang").value = l;
    document.getElementById("back").textContent = UI[l].back; document.getElementById("back").href = "../index.html?lang=" + l;
    document.querySelector("#pdf span").textContent = UI[l].pdf; document.getElementById("pdf").href = "notice-" + l + ".pdf";
    try { localStorage.setItem("timelinedjmix-lang", l); } catch(e){}
    var u = new URL(location.href); u.searchParams.set("lang", l); history.replaceState(null, "", u);
  }
  document.getElementById("lang").addEventListener("change", function(e){ set(e.target.value); });
  set(pick());
})();
</script></body></html>'''
page = page.replace('__VERSION__', VERSION).replace('__OPTS__', ''.join(f'<option value="{l}">{n}</option>' for l, n in LANGS)).replace('__ARTS__', ''.join(arts)).replace('__UI__', json.dumps(UI, ensure_ascii=False))
open('../../docs/notice/index.html', 'w').write(page)
print(len(page))
