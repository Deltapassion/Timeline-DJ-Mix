"""Vidéo de présentation de TIMELINE DJ MIX : python3 video.py fr|en"""
import json, os, sys, subprocess, math
import numpy as np, soundfile as sf
from PIL import Image, ImageDraw, ImageFont, ImageFilter

LANG = sys.argv[1]
W, H, FPS, S = 1920, 1080, 30, 1.2
OUT = f'video/{LANG}'
os.makedirs(OUT, exist_ok=True)
SH = f'shots/{LANG}'
BOX = json.load(open(f'{SH}/boxes.json'))

N = {
'fr': {
 'intro': "Voici Timeline DJ Mix, le logiciel libre pour monter un mix DJ sur une timeline, morceau après morceau.",
 'ecran': "En haut, la bibliothèque et la playlist. Au milieu, la lecture et les réglages du morceau. En bas, la timeline : toute la soirée tient sur une seule ligne.",
 'lib': "Importez vos morceaux. Le logiciel calcule le tempo, la grille des temps et la tonalité. La pastille verte montre les tonalités compatibles, pour un mix harmonique.",
 'pl': "Ajoutez-les à la playlist. Chaque morceau est calé au tempo et enchaîné au précédent. Pour chacun, choisissez la transition : fondu calé, échange des basses, entrée franche, fondu simple ou coupe.",
 'tl': "Sur la timeline, glissez un bloc pour régler le chevauchement, et tirez ses bords pour couper. Pendant la transition, le tempo glisse doucement d'un morceau à l'autre.",
 'courbes': "Dessinez les courbes de volume, de graves et d'aigus à la souris. Ici, les graves passent d'un morceau à l'autre au milieu de la transition.",
 'insp': "Dans les réglages du morceau, vous ajustez le chevauchement, le tempo pendant la transition, et si besoin le BPM et la grille.",
 'cue': "Au casque, écoutez un morceau ou une transition sans arrêter le mix. La ligne verte montre où en est la pré-écoute, et se place où vous voulez. Avec une carte quatre canaux, le casque sort sur les voies trois et quatre.",
 'son': "La table de mixage : volume, égaliseur trois bandes, filtre et tempo pour chaque voie, crossfader, écho, flanger et réverb.",
 'simple': "En vue simple, un rond vert s'allume quand un réglage est au centre.",
 'auto': "L'Auto DJ remplit la playlist tout seul. Par exemple, trois salsas, trois bachatas, trois kizombas, puis il recommence. Idéal pour les soirées par styles.",
 'midi': "Branchez votre contrôleur : les mappings Mixx sont lus tels quels, pour Pioneer, Numark, Hercules, Reloop et bien d'autres. L'apprentissage MIDI fait le reste.",
 'export': "Enfin, exportez toute la soirée en MP3, FLAC, WAV ou AIFF, avec la liste des titres.",
 'couleurs': "Vous pouvez aussi choisir la couleur du fond et celle des boutons.",
 'langues': "Et changez de langue à tout moment : français, anglais, espagnol, portugais, italien, allemand, grec, russe, chinois et japonais.",
 'outro': "Timeline DJ Mix est gratuit et libre, pour Windows, Mac et Linux. Téléchargez-le sur le site du projet. Bonne soirée !",
 'card1': "par DJ LATIN JAZZ & DJ CRISLATINO", 'card2': "Le mix DJ monté sur timeline — logiciel libre",
 'end1': "Gratuit · Windows · macOS · Linux", 'voice': 'ff_siwis', 'tts': 'fr-fr'},
'en': {
 'intro': "This is Timeline DJ Mix, the free software that builds a DJ mix on a timeline, track after track.",
 'ecran': "At the top, the library and the playlist. In the middle, playback and the track settings. At the bottom, the timeline: the whole night fits on a single line.",
 'lib': "Import your tracks. The software works out the tempo, the beat grid and the key. The green dot shows compatible keys, for harmonic mixing.",
 'pl': "Add them to the playlist. Each track is matched to the tempo and joined to the previous one. For each one, choose the transition: beat-matched fade, bass swap, hard entry, simple fade or cut.",
 'tl': "On the timeline, drag a block to set the overlap, and pull its edges to trim it. During the transition, the tempo glides smoothly from one track to the next.",
 'courbes': "Draw volume, bass and treble curves with the mouse. Here, the bass passes from one track to the other in the middle of the transition.",
 'insp': "In the track settings, you adjust the overlap, the tempo during the transition, and if needed the BPM and the grid.",
 'cue': "In your headphones, listen to a track or a transition without stopping the mix. The green line shows where the preview is, and you can place it anywhere. With a four-channel card, the headphones come out on channels three and four.",
 'son': "The mixer: volume, three-band EQ, filter and tempo for each channel, crossfader, echo, flanger and reverb.",
 'simple': "In simple view, a green dot lights up when a control is centred.",
 'auto': "The Auto DJ fills the playlist on its own. For example, three salsas, three bachatas, three kizombas, then it starts again. Perfect for parties by style.",
 'midi': "Plug in your controller: Mixx mappings are read as they are, for Pioneer, Numark, Hercules, Reloop and many more. MIDI learn does the rest.",
 'export': "Finally, export the whole night as MP3, FLAC, WAV or AIFF, with the track list.",
 'couleurs': "You can also choose the background colour and the button colours.",
 'langues': "And switch languages at any time: French, English, Spanish, Portuguese, Italian, German, Greek, Russian, Chinese and Japanese.",
 'outro': "Timeline DJ Mix is free, open software for Windows, Mac and Linux. Download it from the project website. Enjoy your party!",
 'card1': "by DJ LATIN JAZZ & DJ CRISLATINO", 'card2': "The DJ mix built on a timeline — free software",
 'end1': "Free · Windows · macOS · Linux", 'voice': 'af_heart', 'tts': 'en-us'}}[LANG]

def rect(cap, keys, pad=24):
    b = BOX[cap]; ks = keys if isinstance(keys, (list, tuple)) else [keys]
    x0 = min(b[k][0] for k in ks) - pad; y0 = min(b[k][1] for k in ks) - pad
    x1 = max(b[k][0] + b[k][2] for k in ks) + pad; y1 = max(b[k][1] + b[k][3] for k in ks) + pad
    return [max(0, x0) * S, max(0, y0) * S, min(1600, x1) * S, min(900, y1) * S]

FULL = [0, 0, W, H]
# (texte, image(s), cadre de départ, cadre d'arrivée)
SCENES = [
 ('intro', 'CARD', None, None),
 ('ecran', '01-ecran', FULL, [40, 30, W - 40, H - 30]),
 ('lib', '01-ecran', FULL, rect('01-ecran', 'lib')),
 ('pl', '01-ecran', rect('01-ecran', 'lib'), rect('01-ecran', 'pl')),
 ('tl', '01-ecran', FULL, rect('01-ecran', 'tl', 10)),
 ('courbes', '02-courbes', rect('02-courbes', 'tl', 10), rect('02-courbes', ['curve', 'tl'], 10)),
 ('insp', '02-courbes', FULL, rect('02-courbes', 'tools')),
 ('cue', '03-preecoute', FULL, rect('03-preecoute', ['cuebar', 'tl'], 10)),
 ('son', '04-son', FULL, rect('04-son', 'snd')),
 ('simple', '05-son-simple', rect('05-son-simple', 'snd'), rect('05-son-simple', ['la', 'lb'])),
 ('auto', '06-autodj', FULL, rect('06-autodj', 'dlg')),
 ('midi', '07-midi', FULL, rect('07-midi', 'dlg')),
 ('export', '08-export', FULL, rect('08-export', 'dlg')),
 ('couleurs', '09-couleurs', FULL, rect('09-couleurs', 'dlg')),
 ('langues', 'LANGS', None, None),
 ('outro', 'END', None, None),
]

# ---------- voix ----------
from kokoro_onnx import Kokoro
K = Kokoro(os.path.join(os.environ.get('TTS_DIR', 'tts'), 'kokoro-v1.0.onnx'), os.path.join(os.environ.get('TTS_DIR', 'tts'), 'voices-v1.0.bin'))
SR = 24000
voice = {}
for key, *_ in SCENES:
    p = f'{OUT}/{key}.wav'
    if not os.path.exists(p):
        a, sr = K.create(N[key], voice=N['voice'], speed=1.0 if LANG == 'en' else 1.02, lang=N['tts'])
        sf.write(p, a, sr)
    voice[key] = sf.read(p)[0]

# ---------- images ----------
def ease(t): return 0.5 - 0.5 * math.cos(math.pi * min(1, max(0, t)))

def fit169(r):
    x0, y0, x1, y1 = r; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; w, h = x1 - x0, y1 - y0
    if w / h < 16 / 9: w = h * 16 / 9
    else: h = w * 9 / 16
    w = min(w, W); h = min(h, H)
    cx = min(max(cx, w / 2), W - w / 2); cy = min(max(cy, h / 2), H - h / 2)
    return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]

def view(im, r):
    r = [round(v) for v in r]
    return im.crop(r).resize((W, H), Image.BILINEAR)

BG = Image.open('../../docs/assets/fond.jpg').convert('RGB')
BG = BG.resize((W, round(BG.height * W / BG.width))).crop((0, 0, W, H)) if BG.height * W / BG.width >= H else BG.resize((W, H))
ICON = Image.open('../../build/icones/timeline-dj-mix-512.png').convert('RGBA').resize((220, 220), Image.LANCZOS)
F_T = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', 112)
F_S = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 40)
F_U = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 44)

def card(lines, big=True):
    im = BG.copy()
    shade = Image.new('RGBA', (W, H), (8, 20, 34, 150)); im = Image.alpha_composite(im.convert('RGBA'), shade)
    im.alpha_composite(ICON, ((W - 220) // 2, 170))
    d = ImageDraw.Draw(im)
    d.text((W // 2, 520), 'TIMELINE DJ MIX', font=F_T, fill='white', anchor='mm')
    y = 640
    for txt, f, col in lines:
        d.text((W // 2, y), txt, font=f, fill=col, anchor='mm'); y += 72
    return im.convert('RGB')

CARD = card([(N['card1'], F_S, '#e8f1f8'), (N['card2'], F_S, '#cfe0ee')])
END = card([(N['end1'], F_S, '#e8f1f8'), ('deltapassion.github.io/Timeline-DJ-Mix', F_U, '#ffffff'), ('ko-fi.com/djlatinjazz  ♥', F_S, '#ff8fa8')])
LANG_IMGS = [Image.open(f'shots/{l}/01-ecran.jpg').convert('RGB') for l in ['fr', 'en', 'es', 'pt', 'it', 'de', 'el', 'ru', 'zh', 'ja']]
HEAD = [0, 0, W, 200 * S]   # bandeau du haut, où l'on voit la langue changer

# ---------- rendu ----------
XF = int(0.5 * FPS)
ff = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', f'{OUT}/video.tmp.mp4'], stdin=subprocess.PIPE)
prev = None
starts = []
t_total = 0
for key, src, r0, r1 in SCENES:
    dur = len(voice[key]) / SR + (1.6 if key in ('intro', 'outro') else 0.9)
    if key == 'langues': dur = max(dur, 10 * 1.15 + 0.6)
    n = int(round(dur * FPS))
    starts.append(t_total + (0.5 if key == 'intro' else 0.35))
    if src not in ('CARD', 'END', 'LANGS'):
        im = Image.open(f'{SH}/{src}.jpg').convert('RGB')
        a, b = fit169(r0), fit169(r1)
    for i in range(n):
        t = i / (n - 1)
        if src == 'CARD':
            z = 1.0 + 0.04 * t; w, h = W / z, H / z; fr = CARD.crop((round((W - w) / 2), round((H - h) / 2), round((W + w) / 2), round((H + h) / 2))).resize((W, H), Image.BILINEAR)
        elif src == 'END':
            fr = END
        elif src == 'LANGS':
            per = (n - FPS * 0.6) / 10; k = min(9, int(i / per)); u = (i - k * per) / per
            base = LANG_IMGS[k]
            if k > 0 and u < 0.12: base = Image.blend(LANG_IMGS[k - 1], LANG_IMGS[k], u / 0.12)
            fr = view(base, [0, 0, 1400, 787.5])
        else:
            e = ease(min(1, t / 0.55))
            r = [a[j] + (b[j] - a[j]) * e for j in range(4)]
            fr = view(im, r)
        if prev is not None and i < XF:
            fr = Image.blend(prev, fr, (i + 1) / (XF + 1))
        if key == 'outro' and i > n - 20:
            fr = Image.blend(fr, Image.new('RGB', (W, H)), (i - (n - 20)) / 20)
        ff.stdin.write(fr.tobytes())
        last = fr
    prev = last
    t_total += n / FPS
ff.stdin.close(); ff.wait()
assert ff.returncode == 0

# ---------- son : voix + musique douce ----------
total = t_total
track = np.zeros(int(total * SR) + SR)
for (key, *_), st in zip(SCENES, starts):
    v = voice[key]; i0 = int(st * SR); track[i0:i0 + len(v)] += v[:len(track) - i0]
sf.write(f'{OUT}/voix.wav', track, SR)
music = ['tracks/Salsa/Noche de Dax.mp3', 'tracks/Bachata/Brisa de Mayo.mp3', 'tracks/Kizomba/Areia Doce.mp3']
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', music[0], '-i', music[1], '-i', music[2],
                '-filter_complex', '[0][1]acrossfade=d=6[a];[a][2]acrossfade=d=6,aresample=48000,volume=0.13[m]', '-map', '[m]', f'{OUT}/musique.wav'], check=True)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f'{OUT}/video.tmp.mp4', '-i', f'{OUT}/voix.wav', '-i', f'{OUT}/musique.wav',
                '-filter_complex', f'[1]aresample=48000,volume=1.6,asplit=2[vo1][vo2];[2]atrim=0:{total:.2f},afade=t=in:d=1.5,afade=t=out:st={total - 3:.2f}:d=3[m];[m][vo1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[md];[md][vo2]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]',
                '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', f'{OUT}/presentation.tmp.mp4'], check=True)
os.replace(f'{OUT}/presentation.tmp.mp4', f'video/presentation-{LANG}.mp4')
print(LANG, 'ok', round(total, 1), 's')
