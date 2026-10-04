# 一次性工具：把 JS 原始碼裡含中文的字串／樣板字串改成 t('…', 參數…)
# 用法：python3 tools/i18n-convert.py <檔案…>   （會直接改檔，並把新出現的 key 印成 JSON）
import re, sys, json, os

CJK = re.compile(r'[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]')

def has_cjk(s): return bool(CJK.search(s))

def cook_template(raw):
    # 樣板字串原文 → 執行時的字串（只處理會出現的跳脫）
    out, i = [], 0
    while i < len(raw):
        c = raw[i]
        if c == '\\' and i + 1 < len(raw):
            n = raw[i + 1]
            out.append({'n': '\n', 't': '\t', '`': '`', '$': '$', '\\': '\\', "'": "'", '"': '"'}.get(n, '\\' + n)); i += 2; continue
        out.append(c); i += 1
    return ''.join(out)

def cook_string(raw):
    return cook_template(raw)

def js_single(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"

def collapse(s):
    return re.sub(r'\n\s*', ' ', s)

class Conv:
    def __init__(self, src):
        self.s, self.i, self.keys = src, 0, []

    def prev_sig(self, out):
        j = len(out) - 1
        while j >= 0 and out[j] in ' \t\n\r': j -= 1
        return out[j] if j >= 0 else ''

    def code(self, until_brace=False):
        s, out, depth = self.s, [], 0
        while self.i < len(s):
            c = s[self.i]
            nxt = s[self.i + 1] if self.i + 1 < len(s) else ''
            if c == '/' and nxt == '/':
                j = s.find('\n', self.i); j = len(s) if j < 0 else j
                out.append(s[self.i:j]); self.i = j; continue
            if c == '/' and nxt == '*':
                j = s.find('*/', self.i) + 2
                out.append(s[self.i:j]); self.i = j; continue
            if c == '/' and self.prev_sig(''.join(out[-40:]) if out else '') in '(,=:[!&|?{};' :
                # 正規表示式
                j, cls = self.i + 1, False
                while j < len(s):
                    if s[j] == '\\': j += 2; continue
                    if s[j] == '[': cls = True
                    elif s[j] == ']': cls = False
                    elif s[j] == '/' and not cls: break
                    j += 1
                j += 1
                while j < len(s) and s[j].isalpha(): j += 1
                out.append(s[self.i:j]); self.i = j; continue
            if c in '\'"':
                j = self.i + 1
                while s[j] != c:
                    j += 2 if s[j] == '\\' else 1
                raw = s[self.i + 1:j]; self.i = j + 1
                if has_cjk(raw):
                    key = cook_string(raw); self.keys.append(key)
                    out.append('tx(' + js_single(key) + ')')
                else:
                    out.append(c + raw + c)
                continue
            if c == '`':
                out.append(self.template()); continue
            if until_brace:
                if c == '{': depth += 1
                elif c == '}':
                    if depth == 0:
                        self.i += 1
                        return ''.join(out)
                    depth -= 1
            out.append(c); self.i += 1
        return ''.join(out)

    def template(self):
        s = self.s
        self.i += 1  # 跳過 `
        statics, exprs, cur = [], [], []
        while True:
            c = s[self.i]
            if c == '\\':
                cur.append(s[self.i:self.i + 2]); self.i += 2; continue
            if c == '`':
                self.i += 1; statics.append(''.join(cur)); break
            if c == '$' and s[self.i + 1] == '{':
                statics.append(''.join(cur)); cur = []
                self.i += 2
                exprs.append(self.code(until_brace=True))
                continue
            cur.append(c); self.i += 1
        if any(has_cjk(x) for x in statics):
            parts = []
            for k, st in enumerate(statics):
                parts.append(collapse(cook_template(st)))
                if k < len(exprs): parts.append('{%d}' % k)
            key = ''.join(parts)
            if re.search(r'\{(?!\d+\})|(?<!\{\d)\}', re.sub(r'\{\d+\}', '', key)):
                print('WARN brace in key:', key[:80], file=sys.stderr)
            self.keys.append(key)
            args = ''.join(', ' + e for e in exprs)
            return 'tx(' + js_single(key) + args + ')'
        # 沒有中文：保留原樣（內層已轉換）
        res = ['`']
        for k, st in enumerate(statics):
            res.append(st)
            if k < len(exprs): res.append('${' + exprs[k] + '}')
        res.append('`')
        return ''.join(res)

allkeys = []
for path in sys.argv[1:]:
    src = open(path, encoding='utf-8').read()
    cv = Conv(src)
    out = cv.code()
    if cv.keys:
        rel = os.path.relpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'core', 'i18n.js'), os.path.dirname(os.path.abspath(path)))
        if not rel.startswith('.'): rel = './' + rel
        imp = "import { tx } from '%s';\n" % rel
        # 插在第一個 import 之前（沒有 import 就插在第一個註解行之後）
        m = re.search(r'^import ', out, re.M)
        if m: out = out[:m.start()] + imp + out[m.start():]
        else:
            nl = out.find('\n') + 1
            out = out[:nl] + imp + out[nl:]
        open(path, 'w', encoding='utf-8').write(out)
    print(path, len(cv.keys), file=sys.stderr)
    allkeys += cv.keys
print(json.dumps(list(dict.fromkeys(allkeys)), ensure_ascii=False, indent=0))
