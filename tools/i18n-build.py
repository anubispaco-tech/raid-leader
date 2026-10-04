# 產生語言檔：掃描 src 裡所有 tx('…') 的 key，用片段翻譯表（src/i18n/en-frags-*.json）組出整句，寫成 src/i18n/en.js
#   python3 tools/i18n-build.py        → 列出缺翻譯的片段
import re, json, glob, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from importlib import import_module
F = import_module('i18n-frag')

root = os.path.join(os.path.dirname(__file__), '..')
TX = re.compile(r"\btx\('((?:[^'\\]|\\.)*)'")
def unesc(s): return re.sub(r"\\(.)", lambda m: {'n': '\n'}.get(m.group(1), m.group(1)), s)

keys = []
for f in sorted(glob.glob(os.path.join(root, 'src/**/*.js'), recursive=True)):
    if '/i18n/' in f or f.endswith('i18n.js'): continue
    for m in TX.finditer(open(f, encoding='utf-8').read()):
        k = unesc(m.group(1))
        if k not in keys: keys.append(k)

tr = {}
for f in sorted(glob.glob(os.path.join(root, 'src/i18n/en-frags-*.json'))):
    tr.update(json.load(open(f, encoding='utf-8')))

missing, out, bad = [], {}, []
PH = re.compile(r'\{\d+\}')
for k in keys:
    fr = F.fragments_of(k)
    for x in fr:
        if x not in tr and x not in missing: missing.append(x)
    v = F.rebuild(k, tr)
    if sorted(PH.findall(v)) != sorted(PH.findall(k)): bad.append((k, v))
    if v != k: out[k] = v
js = '// 由 tools/i18n-build.py 產生，請改 en-frags-*.json 後重新產生\nexport default ' + json.dumps(out, ensure_ascii=False, indent=0) + ';\n'
open(os.path.join(root, 'src/i18n/en.js'), 'w', encoding='utf-8').write(js)
print(f'{len(keys)} keys, {len(out)} translated, {len(missing)} missing fragments, {len(bad)} placeholder mismatches')
for x in missing: print('MISSING', json.dumps(x, ensure_ascii=False))
for k, v in bad: print('BAD', json.dumps(k, ensure_ascii=False)[:100], '→', json.dumps(v, ensure_ascii=False)[:100])
