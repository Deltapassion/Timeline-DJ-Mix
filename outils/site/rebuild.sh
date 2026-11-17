set -e
# Refait captures, site, notice (HTML et PDF) et vidéos. Prérequis : node scripts/assembler.js, Python 3 avec playwright, pillow, numpy, soundfile, kokoro-onnx, et ffmpeg.
cd "$(dirname "$0")"
python3 capture.py fr en es pt it de el ru zh ja
python3 - <<'P'
from PIL import Image
for l in ['fr','en','es','pt','it','de','el','ru','zh','ja']:
    for src, dst in [('01-ecran','ecran'),('04-son','son'),('06-autodj','autodj'),('07-midi','midi')]:
        Image.open(f'shots/{l}/{src}.jpg').resize((1440, 810), Image.LANCZOS).save(f'../../docs/captures/{l}/{dst}.jpg', quality=80, optimize=True, progressive=True)
P
python3 build_site.py
python3 build_notice.py
rm -f ../../docs/notice/*.pdf; python3 mkpdf.py
python3 video.py fr
python3 video.py en
echo FINI
