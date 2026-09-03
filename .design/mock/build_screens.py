import html, json, pathlib, re, sys
src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
canvas = json.loads((src / "canvas.json").read_text())
sections = [("First run", ["Setup", "SetupMirror"]),
            ("Plan", ["WeekPlan", "Plan", "Main", "MainDark"]),
            ("Do", ["Focus", "Tray", "Capture"]),
            ("Verify and review", ["Inbox", "CloseRating", "CloseDay", "Week"]),
            ("Settings and edge states", ["Settings", "States"]),
            ("Mobile companion (P2)", ["MobileToday", "MobileCapture", "MobileInbox"])]

dark = (src / "Main.dc.html").read_text().replace('<div class="app">', '<div class="app dark">', 1).replace("<title>Today</title>", "<title>Today, dark</title>")
(src / "MainDark.dc.html").write_text(dark)

def clean(doc):
    doc = doc.replace('<script src="./support.js"></script>', "")
    doc = re.sub(r'<script type="text/x-dc".*?</script>', "", doc, flags=re.S)
    doc = re.sub(r'href="(\w+)\.dc\.html"', lambda m: f'href="#{m.group(1)}" target="_top"', doc)
    return doc

nav, body = [], []
for title, names in sections:
    nav.append(f'<li class="grp">{title}</li>')
    body.append(f'<h2 class="sec">{title}</h2>')
    for n in names:
        b = canvas["boards"][n + ".dc.html"]
        w, h, label = b["w"], b["h"], b["title"]
        nav.append(f'<li><a href="#{n}">{html.escape(label)}</a></li>')
        doc = clean((src / f"{n}.dc.html").read_text())
        fixed = w < 1440
        body.append(
            f'<section class="screen" id="{n}"><h3>{html.escape(label)}</h3>'
            f'<div class="frame" style="max-width:{w}px"><iframe title="{html.escape(label)}" '
            f'style="width:{w}px;height:{h}px" data-fixed="{int(fixed)}" '
            f'srcdoc="{html.escape(doc, quote=True)}"></iframe></div></section>')

page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>skkil-time screens</title>
<link href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@700&family=Red+Hat+Text:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{{--ground:#E4E6E1;--ink:#1A1D21;--ink2:#5B6169;--line:#D3D6D0}}
body{{margin:0;background:var(--ground);color:var(--ink);font-family:"Red Hat Text",system-ui,sans-serif}}
header{{padding:32px 16px 8px;max-width:1440px;margin:0 auto}}
header h1{{font-family:"Red Hat Display",sans-serif;margin:0 0 4px;font-size:28px}}
header p{{margin:0;color:var(--ink2)}}
nav ul{{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px}}
nav li.grp{{width:100%;font-weight:600;color:var(--ink2);margin-top:8px}}
nav a{{color:var(--ink)}}
main{{max-width:1440px;margin:0 auto;padding:0 16px 80px}}
h2.sec{{font-family:"Red Hat Display",sans-serif;font-size:22px;margin:56px 0 0;padding-top:16px;border-top:1px solid var(--line)}}
.screen{{margin-top:28px;scroll-margin-top:16px}}
.screen h3{{font-size:14px;font-weight:600;margin:0 0 8px;color:var(--ink2)}}
.frame{{overflow-x:auto;border:1px solid var(--line);background:#F2F3F0;width:fit-content;max-width:100%}}
iframe{{display:block;border:0;max-width:none}}
</style></head><body>
<header><h1>skkil-time v1.1 screens</h1><p>Departure board direction, refined from IMPROVEMENTS.md (2026-10-23). Sample data throughout. Scroll, or jump:</p>
<nav><ul>{"".join(nav)}</ul></nav></header>
<main>{"".join(body)}</main>
<script>
document.querySelectorAll("iframe").forEach(f=>f.addEventListener("load",()=>{{
  try{{const h=f.contentDocument.documentElement.scrollHeight; if(h>0&&f.dataset.fixed==="0") f.style.height=h+"px";}}catch(e){{}}
}}));
</script>
</body></html>'''
out.write_text(page)
print(out, len(page)//1024, "KB")
