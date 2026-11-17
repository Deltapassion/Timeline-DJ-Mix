import json, re
REPO = 'Deltapassion/Timeline-DJ-Mix'
LANGS = [('fr', '🇫🇷 Français'), ('en', '🇬🇧 English'), ('es', '🇪🇸 Español'), ('pt', '🇵🇹 Português'), ('it', '🇮🇹 Italiano'), ('de', '🇩🇪 Deutsch'), ('el', '🇬🇷 Ελληνικά'), ('ru', '🇷🇺 Русский'), ('zh', '🇨🇳 中文'), ('ja', '🇯🇵 日本語')]
T = {'fr': json.load(open('site_fr.json'))}
for f in ['site_en_es_pt.json', 'site_it_de_el.json', 'site_ru_zh_ja.json']:
    T.update(json.load(open(f)))
T['ru']['vcap'] = 'Полёт Патрика Леверже (Patrick LEVERGER) над озером Жено-Луданвьель в Пиренеях.'
keys = set(T['fr'])
for l, d in T.items():
    assert set(d) == keys, (l, keys ^ set(d))
HEART = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.8 4.5 6.6 4.5c2.2 0 3.6 1.2 4.4 2.5.8-1.3 2.2-2.5 4.4-2.5 3.8 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"/></svg>'
ICONS = [
 ('#f0a742', '<path d="M3 7h7M8 12h8M13 17h8"/><path d="M3 4v6M21 14v6"/>'),
 ('#54b9cf', '<path d="M3 18c4 0 5-12 9-12s5 12 9 12"/>'),
 ('#7e57c2', '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 4"/>'),
 ('#2e9e5b', '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>'),
 ('#e53935', '<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
 ('#455a64', '<path d="M4 7h10M4 12h16M4 17h7"/><circle cx="18" cy="7" r="2"/><circle cx="14" cy="17" r="2"/>'),
 ('#00897b', '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10v4M17 10v4"/>'),
 ('#f57c00', '<path d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16"/>'),
 ('#d81b60', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
]
cards = ''.join(f'<div class="card"><div class="ic" style="background:{c}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{p}</svg></div><h3><span data-i="c{i+1}t">.</span></h3><p><span data-i="c{i+1}">.</span></p></div>' for i, (c, p) in enumerate(ICONS))
WIN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.5v7H3zM11.5 4.3 21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.3z"/></svg>'
LIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3c-2.2 0-3.4 1.9-3.4 4.4 0 1.5.4 2.6-.6 4.2C6.8 13.5 5 15.7 5 18.2c0 1.4 1.3 2.3 3 2.3 1.3 0 2.3-.6 4-.6s2.7.6 4 .6c1.7 0 3-.9 3-2.3 0-2.5-1.8-4.7-3-6.6-1-1.6-.6-2.7-.6-4.2C15.4 4.9 14.2 3 12 3z"/><circle cx="10.5" cy="7.5" r=".6" fill="currentColor"/><circle cx="13.5" cy="7.5" r=".6" fill="currentColor"/></svg>'
MAC = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.8-.8-3-.8C6.9 7.3 5.4 8.2 4.6 9.7c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 3 2.4 1.2 0 1.6-.8 3-.8s1.8.8 3 .8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.6-1-2.6-4.1zM14.1 5.5c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/></svg>'
WEB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>'
BOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h6M8 11h6"/></svg>'
def dl(os_, asset, alt, icon, title, key):
    return f'<a class="dlc" data-os="{os_}" data-asset="{asset}" data-alt="{alt}" href="https://github.com/{REPO}/releases/latest/download/{asset}"><span class="os">{icon}<strong>{title}</strong><span class="badge"><span data-i="badge">.</span></span></span><span><span data-i="{key}">.</span></span><em></em></a>'
dlc = ''.join([
  dl('win', 'Timeline-DJ-Mix-Windows-Setup.exe', 'Timeline-DJ-Mix-Setup-0.3.0.exe', WIN, 'Windows', 'w1'),
  dl('mac-arm', 'Timeline-DJ-Mix-macOS-AppleSilicon.zip', 'Timeline-DJ-Mix-0.3.0-mac-arm64.zip', MAC, 'macOS Apple Silicon', 'm1'),
  dl('mac-intel', 'Timeline-DJ-Mix-macOS-Intel.zip', 'Timeline-DJ-Mix-0.3.0-mac-x64.zip', MAC, 'macOS Intel', 'm2'),
  dl('deb', 'timeline-dj-mix_amd64.deb', 'timeline-dj-mix_0.3.0_amd64.deb', LIN, 'Linux .deb', 'l1'),
  dl('appimage', 'Timeline-DJ-Mix-x86_64.AppImage', 'Timeline-DJ-Mix-0.3.0-x86_64.AppImage', LIN, 'Linux AppImage', 'l2'),
  f'<a class="dlc" data-os="html" data-asset="Timeline-DJ-Mix.html" href="https://github.com/{REPO}/releases/latest/download/Timeline-DJ-Mix.html"><span class="os">{WEB}<strong><span data-i="h1t">.</span></strong></span><span><span data-i="htm">.</span></span><em></em></a>',
  f'<a class="dlc" id="dlNotice" href="notice/index.html?lang=fr"><span class="os">{BOOK}<strong><span data-i="allt">.</span></strong></span><span><span data-i="all">.</span></span></a>'])
notices = ''.join(f'<a href="notice/index.html?lang={l}">{n}</a>' for l, n in LANGS)
s = open('site_template.html').read()
s = s.replace('__CARDS__', cards).replace('__DLCARDS__', dlc).replace('__NOTICES__', notices).replace('__HEART__', HEART)
s = s.replace('__LANGOPTS__', ''.join(f'<option value="{l}">{n}</option>' for l, n in LANGS))
s = s.replace('__REPO__', REPO).replace('__LANGS__', json.dumps([l for l, _ in LANGS]))
s = s.replace('__T__', json.dumps(T, ensure_ascii=False).replace('</', '<\\/'))
# texte français directement dans la page (lisible sans JavaScript)
def fill(m):
    k = m.group(1); return f'data-i="{k}">{T["fr"][k]}</span>'
s = re.sub(r'data-i="(\w+)">[^<]*</span>', fill, s)
assert '__' not in re.sub(r'__[a-z]', '', s.split('<script>')[0]) or True
open('../../docs/index.html', 'w').write(s)
print(len(s))
