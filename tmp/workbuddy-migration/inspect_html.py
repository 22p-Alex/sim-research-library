from pathlib import Path
from html.parser import HTMLParser
import re
import difflib

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path('/Users/22p/WorkBuddy/毕业设计/01-理论知识库/交互演示/SIM交互实验室')
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.offsets = [0]
        for m in re.finditer('\n', text): self.offsets.append(m.end())
        self.stack = []
        self.nodes = []
        self.feed(text)

    def pos(self):
        line, col = self.getpos()
        return self.offsets[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start = self.pos()
        node = dict(tag=tag, attrs=dict(attrs), start=start, content=start+len(self.get_starttag_text()))
        self.nodes.append(node)
        if tag in VOID: node.update(close=node['content'], end=node['content'])
        else: self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            node = self.stack.pop()
            node.update(close=node['content'], end=node['content'])

    def handle_endtag(self, tag):
        if not self.stack: return
        for i in range(len(self.stack)-1, -1, -1):
            if self.stack[i]['tag'] == tag:
                for node in self.stack[i:]:
                    node.update(close=self.pos(), end=self.text.index('>', self.pos())+1)
                del self.stack[i:]
                return

    def by_id(self): return {n['attrs']['id']: n for n in self.nodes if 'id' in n['attrs']}

    def inner(self, node): return self.text[node['content']:node['close']]

def replace(text, edits):
    last = len(text) + 1
    for start, end, value in sorted(edits, reverse=True):
        assert end <= last, (start, end, last)
        text = text[:start] + value + text[end:]
        last = start
    return text

if __name__ == '__main__':
    source = (SOURCE/'sim_interactive_demo.html').read_text()
    source = re.sub(r'\sdata-(?:page-node-id|dm-ref)="[^"]*"', '', source)
    source = re.sub(r'<style id="__dm_[^"]*">.*?</style>', '', source, flags=re.S)
    source = re.sub(r' style=""', '', source)
    source = source.replace('<body style="position: relative;">', '<body>')
    page = Page(source)
    edits = []
    for node in page.nodes:
        if 'data-tex' in node['attrs']:
            edits.append((node['content'], node['close'], ''))
    source = replace(source, edits)
    local = (ROOT/'tmp/workbuddy-migration/before/sim_interactive_demo.html').read_text()
    p, q = Page(local), Page(source)
    a, b = p.by_id(), q.by_id()
    edits = []
    for key in a.keys() & b.keys():
        old, new = a[key], b[key]
        if not p.inner(old).strip() or old['tag'] == 'output' or key in ['t1_cP','t1_cH','t1_cM','t1_cG','wAme','wAphotons','wAquality','wAk3']:
            edits.append((new['content'], new['close'], p.inner(old)))
        if key in ['tab1Btn','tab2Btn','tab1Content','tab2Content','wAclearA','wApairResults','t1_cv_illum_lens','t1_txt_ex_badge','t1_txt_det_badge','wAc3b']:
            edits.append((new['start'], new['content'], local[old['start']:old['content']]))
    source = replace(source, edits)
    source = re.sub(r' open=""', '', source)
    source = source.replace('<html lang="zh-CN"><head>', '<html lang="zh-CN">\n<head>')
    source = re.sub(r'\n{3,}', '\n\n', source).replace('</body></html>', '</body>\n</html>')
    (ROOT/'tmp/workbuddy-migration/clean-source.html').write_text(source)
    diff = difflib.unified_diff(local.splitlines(), source.splitlines(), fromfile='local', tofile='source', n=2)
    (ROOT/'tmp/workbuddy-migration/html.diff').write_text('\n'.join(diff))
    p, q = Page(local), Page(source)
    a, b = p.by_id(), q.by_id()
    print('Removed IDs:', sorted(a.keys()-b.keys()))
    print('Added IDs:', sorted(b.keys()-a.keys()))
    for key in a.keys() & b.keys():
        x, y = a[key]['attrs'], b[key]['attrs']
        if x != y: print('ATTR', key, x, '->', y)
    print('Source without editor metadata and rendered math:', len(source), 'characters')
