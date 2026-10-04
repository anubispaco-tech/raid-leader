# 把 key 拆成「要翻譯的文字片段」：標籤之間的文字、以及 aria-label / placeholder / title 屬性值
import re, json, sys
CJK = re.compile(r'[　-〿一-鿿＀-￯]')
TAG = re.compile(r'<[^>]*>')
ATTR = re.compile(r'((?:aria-label|placeholder|title)=")([^"]*)(")')

def frags(key):
    out = []
    pos = 0
    for m in TAG.finditer(key):
        out.append(('text', key[pos:m.start()])); out.append(('tag', m.group())); pos = m.end()
    out.append(('text', key[pos:]))
    return out

def fragments_of(key):
    res = []
    for kind, s in frags(key):
        if kind == 'text':
            core = s.strip()
            if CJK.search(core): res.append(core)
        else:
            for a in ATTR.finditer(s):
                if CJK.search(a.group(2)): res.append(a.group(2))
    # 不在標籤內的屬性字串（例如 'disabled title="…"'）
    return res

def rebuild(key, tr):
    out = []
    for kind, s in frags(key):
        if kind == 'text':
            core = s.strip()
            if CJK.search(core):
                lead = s[:len(s) - len(s.lstrip())].replace('\u3000', ' '); trail = s[len(s.rstrip()):].replace('\u3000', ' ')
                out.append(lead + tr.get(core, core) + trail)
            else:
                out.append(s)
        else:
            out.append(ATTR.sub(lambda a: a.group(1) + (tr.get(a.group(2), a.group(2)) if CJK.search(a.group(2)) else a.group(2)) + a.group(3), s))
    return ''.join(out)

if __name__ == '__main__':
    keys = json.load(open(sys.argv[1]))
    fr = []
    for k in keys:
        for f in fragments_of(k):
            if f not in fr: fr.append(f)
    json.dump(fr, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
    print(len(fr), sum(len(x) for x in fr))
