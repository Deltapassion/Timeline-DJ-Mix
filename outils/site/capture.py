"""Photographie TIMELINE DJ MIX dans une langue donnée.
Usage : python3 capture.py fr [en ...]  → shots/<langue>/*.jpg et boxes.json"""
import asyncio, json, os, sys, glob
from playwright.async_api import async_playwright

APP = 'file://' + os.path.abspath('../../app/index.html')
TRACKS = sorted(glob.glob('tracks/*/*.mp3'))
W, H, DSF = 1600, 900, 1.2          # images de 1920 × 1080

BOXES_JS = '''(sels) => { const o = {}; for (const [k, s] of Object.entries(sels)) { const e = document.querySelector(s); if (!e) continue; const r = e.getBoundingClientRect(); if (r.width && r.height) o[k] = [r.x, r.y, r.width, r.height]; } return o; }'''


async def shoot(pg, path, sels=None, clip=None):
    kw = {'path': path, 'type': 'jpeg', 'quality': 92}
    if clip: kw['clip'] = clip
    await pg.screenshot(**kw)
    return await pg.evaluate(BOXES_JS, sels or {})


async def run(lang):
    out = f'shots/{lang}'
    os.makedirs(out, exist_ok=True)
    boxes = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'])
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DSF, locale='fr-FR', permissions=['midi', 'midi-sysex'])
        await ctx.add_init_script("try{localStorage.setItem('djctl-layout', JSON.stringify({top: 340}))}catch(e){}")
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto(APP)
        await pg.wait_for_function('window.__fe && __fe.S.playlist.length===3', timeout=90000)
        await pg.select_option('#langSel', lang)
        await pg.set_input_files('#fileIn', TRACKS)
        await pg.wait_for_function('__fe.S.tracks.length===11 && __fe.S.tracks.every(t=>t.status==="ok")', timeout=180000)
        # styles des morceaux de démonstration, comme s'ils venaient des dossiers de la soirée
        await pg.evaluate('''() => { const fe = __fe, m = {"Noche de Dax":"Salsa","Río Caliente":"Salsa","Brisa de Mayo":"Bachata","Luna Azul":"Bachata","Kizomba Lenta":"Kizomba","Areia Doce":"Kizomba","Semba Sol":"Semba","Tango Gris":"Tango"};
          for (const t of fe.S.tracks) if (m[t.title]) t.style = m[t.title];
          for (const name of ["Noche de Dax", "Río Caliente", "Semba Sol"]) { const t = fe.S.tracks.find(x => x.title === name); document.querySelector('#libBody tr[data-id="' + t.id + '"] [data-act=add]').click(); }
          fe.changed(); }''')
        await pg.click('#btnFit')
        await pg.evaluate("() => { if (document.getElementById('snd').classList.contains('mini')) document.getElementById('sndMini').click(); }")
        await pg.wait_for_timeout(300)
        # morceau 2 sélectionné ; tête de lecture au milieu
        await pg.evaluate("() => { const fe = __fe; fe.S.sel = fe.S.playlist[1].id; fe.S.libSel = fe.S.tracks[4].id; fe.seek(fe.lay().total * 0.32); fe.S.cuePos = fe.lay().total * 0.58; fe.changed(true); }")
        await pg.evaluate("() => { if (!document.getElementById('snd').hidden) document.getElementById('btnSnd').click(); }")
        await pg.wait_for_timeout(400)
        sels = {'top': 'header.bar .actions', 'import': '#btnImport', 'lang': '#langSel', 'lib': '#libPanel', 'pl': '#plPanel', 'tools': '#bottom .tools', 'transport': '#btnPlay', 'cue': '#btnCue',
                'curve': '#segCurve', 'insp': '#insp', 'snd': '#snd', 'tl': '#tl', 'auto': '#btnAuto', 'party': '#btnParty', 'midi': '#btnMidi', 'look': '#btnLook', 'export': '#btnExport',
                'search': '#libSearch', 'order': '#btnOrder', 'zoom': '#zoom', 'undo': '#btnUndo', 'sndbtn': '#btnSnd', 'help': '#btnHelp', 'open': '#btnOpen', 'save': '#btnSave', 'new': '#btnNew'}
        boxes['01-ecran'] = await shoot(pg, f'{out}/01-ecran.jpg', sels)
        # le choix de la transition (liste déroulante remplacée par l'inspecteur)
        await pg.evaluate("() => { const fe = __fe; fe.S.playlist[1].type = 'bass'; fe.S.curve = 'bass'; for (const x of document.getElementById('segCurve').children) x.classList.toggle('on', x.dataset.c === 'bass'); fe.changed(); }")
        await pg.wait_for_timeout(300)
        boxes['02-courbes'] = await shoot(pg, f'{out}/02-courbes.jpg', sels)
        # pré-écoute : ligne verte + morceau de la bibliothèque
        await pg.evaluate("() => { const fe = __fe; fe.S.curve = 'vol'; for (const x of document.getElementById('segCurve').children) x.classList.toggle('on', x.dataset.c === 'vol'); fe.changed(true); }")
        await pg.evaluate("async () => { const fe = __fe; await fe.cueTrack(fe.S.tracks[5], 30); }")
        await pg.wait_for_timeout(1500)
        boxes['03-preecoute'] = await shoot(pg, f'{out}/03-preecoute.jpg', dict(sels, cuebar='#cueBar', btnCue='#btnCue'))
        await pg.evaluate("() => { const b = document.getElementById('cueStop'); if (b) b.click(); }")
        # table de mixage
        await pg.evaluate("() => { if (document.getElementById('snd').hidden) document.getElementById('btnSnd').click(); }")
        await pg.wait_for_timeout(300)
        await pg.evaluate("() => { const fe = __fe; fe.sndSet('a.lo', -0.35); fe.sndSet('b.hi', 0.3); fe.sndSet('b.tmp', 0.02); fe.sndSet('xf', -0.25); }")
        await pg.wait_for_timeout(300)
        boxes['04-son'] = await shoot(pg, f'{out}/04-son.jpg', dict(sels, la='#snd .strip.la', lb='#snd .strip.lb', xf='#snd .strip.xf', fx='#snd .strip.fx'))
        await pg.click('#sndMini'); await pg.wait_for_timeout(400)
        boxes['05-son-simple'] = await shoot(pg, f'{out}/05-son-simple.jpg', dict(sels, la='#snd .strip.la', lb='#snd .strip.lb'))
        await pg.click('#sndMini')
        await pg.evaluate("() => { const fe = __fe; for (const k of ['a.lo','b.hi','b.tmp','xf']) fe.sndSet(k, 0); }")
        await pg.evaluate("() => { if (!document.getElementById('snd').hidden) document.getElementById('btnSnd').click(); }")
        # fenêtres
        for name, btn, dlg in [('06-autodj', '#btnParty', '#dlgAuto'), ('07-midi', '#btnMidi', '#dlgMidi'), ('08-export', '#btnExport', '#dlgExport'), ('09-couleurs', '#btnLook', '#dlgLook'), ('10-aide', '#btnHelp', '#dlgHelp')]:
            if name == '07-midi':
                await pg.evaluate("() => __fe.Mx.load({ builtin: 'ddj-400' }, true)")
            await pg.click(btn); await pg.wait_for_timeout(500)
            if name == '07-midi':
                await pg.evaluate("() => { const r = document.querySelector('#midiList tr'); if (r) r.scrollIntoView(); }")
                await pg.evaluate("() => { const m = document.getElementById('midiStatus'); if (m) m.style.display = 'none'; }")
            boxes[name] = await shoot(pg, f'{out}/{name}.jpg', {'dlg': dlg})
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
        # lecture : quelques images pour la vidéo
        await pg.evaluate("() => { const fe = __fe; fe.S.sel = null; fe.changed(true); }")
        await pg.click('#btnFit')
        for i, frac in enumerate([0.05, 0.3, 0.55, 0.8]):
            await pg.evaluate(f"() => {{ const fe = __fe; fe.seek(fe.lay().total * {frac}); }}")
            await pg.wait_for_timeout(150)
            boxes[f'11-lecture-{i}'] = await shoot(pg, f'{out}/11-lecture-{i}.jpg', sels)
        json.dump(boxes, open(f'{out}/boxes.json', 'w'), indent=0)
        if errs: print(lang, 'ERREURS', errs)
        await b.close()
    print(lang, 'ok', len(boxes))


async def main():
    for l in sys.argv[1:]:
        await run(l)

asyncio.run(main())
