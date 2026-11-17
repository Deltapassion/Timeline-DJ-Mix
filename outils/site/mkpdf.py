import os
import asyncio
from playwright.async_api import async_playwright
L = ['fr','en','es','pt','it','de','el','ru','zh','ja']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page()
        for l in L:
            await pg.goto('file://' + os.path.abspath('../../docs') + f'/notice/index.html?lang={l}')
            await pg.evaluate("() => document.querySelectorAll('img').forEach(i => i.loading = 'eager')")
            await pg.wait_for_function("() => [...document.querySelectorAll('article:not([hidden]) img')].every(i => i.complete && i.naturalWidth)", timeout=30000)
            await pg.pdf(path=f'../../docs/notice/notice-{l}.pdf', format='A4', print_background=True, margin={'top':'14mm','bottom':'14mm','left':'14mm','right':'14mm'},
                         display_header_footer=True, header_template='<span></span>', footer_template='<div style="font-size:8px;width:100%;text-align:center;color:#777">TIMELINE DJ MIX · <span class="pageNumber"></span>/<span class="totalPages"></span></div>')
            if l in ('fr','zh'):
                await pg.screenshot(path=f'notice_{l}.png', full_page=False)
        await b.close()
asyncio.run(main())
