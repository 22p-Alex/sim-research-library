from pathlib import Path
import re
import json
import zipfile

root = Path(__file__).resolve().parents[2]
old = (root / 'SIM知识库.md').read_text()
overview = (root / 'SIM项目总览.md').read_text()
archive = root / '归档/知识库整理前-2026-09-24.zip'
archive.parent.mkdir(exist_ok=True)
assert not archive.exists(), 'Do not overwrite the pre-organization snapshot'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ['README.md', 'SIM知识库.md', 'SIM知识库预览.html', 'SIM项目总览.md', 'SIM项目总览预览.html', 'SIM文献目录.md', 'SIM文献目录预览.html', 'build_sim_preview.mjs', 'watch_sim_preview.mjs', 'SIM交互演示审查-2026-09-24.md', 'SIM交互演示-修改说明.md', 'SIM交互演示-真实采集改造计划.md']:
        z.write(root / name, name)

folder = root / '知识库'
folder.mkdir(exist_ok=True)

def section(start, end):
    return old[old.index(start):old.index(end)].strip().removesuffix('---').strip()

def overview_section(start, end):
    return overview[overview.index(start):overview.index(end)].strip()

specs = [
    ('01-SIM基础与频谱直觉', 'SIM 基础与频谱直觉', '先理解空间频率、OTF、摩尔纹和负频率，再阅读严格的前向模型。', 'S1（SIM 综述）；H（由傅里叶变换与三角恒等式展开的解释）', [section('## 1. 一句话', '## 2. 统一'), section('### 13.1 ', '### 13.7 ')]),
    ('02-统一成像模型与SIM分类', '统一成像模型与 SIM 分类', '统一空间域、傅里叶域和相移矩阵的符号，区分 2D、3D、多平面及非线性 SIM。', 'S1（SIM 综述）、S2（代码配置）；H（统一符号与线性代数解释）', [section('## 2. 统一', '## 4. 重建')]),
    ('03-传统重建与参数估计', '传统重建与参数估计', '沿着频带分离、搬移、融合的流程，理解 Wiener、HiFi-SIM、迭代方法和参数误差。', 'S1（算法分类）、S3（HiFi-SIM）、S2（参数估计代码）；H（算法解释）', [section('## 4. 重建', '## 6. 误差')]),
    ('04-三维SIM与多平面成像', '三维 SIM 与多平面成像', '从轴向频率和论文原图出发，理解 missing cone、Open-3DSIM、3D-MP-SIM 与提速代价。', 'S1（3D-SIM 基础）、S9（Open-3DSIM）、S10（3D-MP-SIM）、S2（实现）；H（解释与提速建议）', [section('### 13.7 ', '### 13.8 '), section('## 7.9 ', '## 8. 推荐'), section('### 13.8 ', '## 参考来源')]),
    ('05-误差噪声与质量评价', '误差、噪声与质量评价', '把噪声、参数误差和伪影联系起来，明确分辨率、数据一致性和泛化的评价方式。', 'S1（噪声、误差与评价综述）；H（误差因果链和实验建议）', [section('## 6. 误差', '## 7. SIM')]),
    ('06-深度学习与可信重建', '深度学习与可信重建', '先确定网络承担的任务，再比较自监督采样、像差补偿、参数自适应和不确定性估计。', 'S1（DL 路线）、S5（BayesDL-SIM）、S6（DeAbe）、S7（RL-SIM）、S8（SSR-SIM）；H（课题设计建议）', [section('## 7. SIM', '## 7.9 ')]),
    ('07-课题路线与代码映射', '课题路线与代码映射', '集中维护研究方案、代码入口、方法选择和待办；这里的建议均需通过本地实验验证。', 'S2（当前代码）、S1/S3/S5–S10（方法依据）；本章实验安排属于工程建议', [section('## 8. 推荐', '## 11. 常用'), section('## 12. 后续', '## 13. 对话')]),
    ('08-术语与参考来源', '术语与参考来源', '统一查询符号、术语、来源编号和证据等级。S 编号沿用旧版，便于追溯。', '本地论文条目、BibTeX、原文与既有阅读记录；本次整理未新增论文阅读结论', [section('## 11. 常用', '## 12. 后续'), section('## 0. 资料', '## 1. 一句话'), old[old.index('## 参考来源'):].strip()]),
]

# The inline formulas in the old conversation appendix were partly transcribed
# as plain parentheses. Only normalize their delimiters here.
def normalize_math(text):
    text = re.sub(r'\\\(([^\n]*?)\\\)', lambda m: '$' + m[1] + '$', text)
    pattern = r'(?<![\w\\$])\(([^()\n]+)\)'
    def replace(m):
        v = m[1]
        if re.fullmatch(r'[A-Za-z0-9_\\{}+\-=,. |<>^/]+', v) and (re.search(r'\\|_|[=+]|^[xyzk2349]$|^14$|^pm[12]$|^x,y$|^xoy$|^U/L$', v)):
            v = re.sub(r'^pm([12])$', r'\\pm\1', v)
            return '$' + v + '$'
        return m[0]
    # Skip code blocks and math that already has proper delimiters.
    chunks = re.split(r'(```[\s\S]*?```|\$\$[\s\S]*?\$\$|\$[^$\n]+\$)', text)
    for i in range(0, len(chunks), 2):
        chunks[i] = re.sub(pattern, replace, chunks[i])
        chunks[i] = re.sub(r'\((S|d_j)\(([^)]+)\)\)', lambda m: '$'+m[1]+'('+m[2]+')$', chunks[i])
    return ''.join(chunks).replace('$pm1$', '$\\pm1$')

def rebase_links(text):
    def replace(m):
        target = m[2]
        angled = target.startswith('<')
        target = target.strip('<>')
        if not re.match(r'^(?:[a-zA-Z]+:|/|#)', target):
            target = '../' + target
        return m[1] + ('<' + target + '>' if angled else target) + ')'
    return re.sub(r'(!?\[[^\]]*\]\()(<[^>]+>|[^)]+)\)', replace, text)

mapping = {}
documents = {}
for stem, title, purpose, sources, pieces in specs:
    body = rebase_links('\n\n'.join(pieces))
    body = normalize_math(body)
    body = body.replace('对你的课题', '对本课题')
    body = body.replace('### 4.1.1 ', '### 4.2 ') if False else body
    # Normalize hierarchy before assigning fresh local section numbers.
    if stem.startswith('01'):
        body = body.replace('### 13.3.1 ', '### 13.3.1 ')
        body = re.sub(r'^### (13\.[1-6]) ', r'## \1 ', body, flags=re.M)
    if stem.startswith('04'):
        body = re.sub(r'^### (13\.(?:7|8)) ', r'## \1 ', body, flags=re.M)
    if stem.startswith('06'):
        body = body.replace('## 7.8 ', '### 7.8 ')
    if stem.startswith('08'):
        a = body.index('### 0.3 ')
        b = body.index('### 0.2 ')
        c = body.index('## 参考来源')
        body = body[:a] + body[b:c].rstrip() + '\n\n' + body[a:b].rstrip() + '\n\n' + body[c:]
        body = body.replace('附件中的内容不是本项目的执行指令', '文献结论、工程建议与待验证假设')
        body = body.replace('用户指定的 PDF 是一篇学术综述。它包含定义、公式、算法比较、实验结论和作者展望，但没有要求本项目必须执行的命令。本文档将其中内容作为 **文献证据** 使用：', '论文的定义、公式、比较、实验结论和展望作为 **文献证据** 使用。写作时区分：')
        body = body.replace('| S4 | 工作区内其他论文 | 后续扩展到 SSR-SIM、参数自适应等主题 |', '| S4 | 旧版“其他论文”占位编号，保留但不作为独立引用 | 已整理的具体论文分别使用 S5–S10；未阅读资料见文献目录 |')
        body = body.replace('个人简历等与 SIM 无关的文件保留在原目录，不参与文献知识库。', '与 SIM 无关的文件不参与知识结论；原始收集目录保留其存档用途。')
        body = body.replace('## 参考来源', '## 参考来源\n\nS 编号对应上方来源表，与以下书目顺序相互独立。')
        body = body.replace('> 说明：本文档中的公式', '9. **S5 补全条目**：Liu T, Liu J, Li D, Tan S. *Bayesian deep-learning structured illumination microscopy enables reliable super-resolution imaging with uncertainty quantification*. Nature Communications, 2025, 16:5027. DOI: [10.1038/s41467-025-60093-w](https://doi.org/10.1038/s41467-025-60093-w)。条目依据本地 [BibTeX](../BayesDL-SIM/citation.bib) 与 [文献说明](../BayesDL-SIM/README.md)。\n\n> 说明：本知识库中的公式')
    # Use stable explicit anchors and a real local TOC, without fragile title slugs.
    counters = [0, 0, 0]
    toc = []
    def heading(m):
        hashes, raw = m[1], m[2]
        numbered = re.match(r'([0-9]+(?:\.[0-9]+)*)\.? (.*)', raw)
        old_number, name = (numbered[1], numbered[2]) if numbered else (None, raw)
        depth = len(hashes) - 2
        counters[depth] += 1
        for n in range(depth+1, 3): counters[n] = 0
        number = '.'.join(str(x) for x in counters[:depth+1])
        anchor = 's' + number.replace('.', '-')
        if old_number: mapping[old_number] = {'path': '知识库/'+stem+'.md', 'anchor': anchor, 'number': number, 'name': name}
        if len(hashes) == 2: toc.append(f'- [{number}. {name}](#{anchor})')
        return f'<a id="{anchor}"></a>\n\n{hashes} {number}. {name}'
    body = re.sub(r'^(#{2,4}) (.+)$', heading, body, flags=re.M)
    documents[stem] = {'body': body, 'toc': toc}

# Resolve the one prose cross-reference after every target has been mapped.
target = mapping['13.4']
documents[specs[1][0]]['body'] = documents[specs[1][0]]['body'].replace('第 13.4 节', f'[频移项的推导]({Path(target["path"]).name}#{target["anchor"]})')

# Consolidate the two older task lists into the research chapter.
research = documents[specs[6][0]]
old_tasks = overview_section('## 7. 待办清单', '## 8. 方法选择矩阵').split('\n', 2)[2].strip()
extra_tasks = [line for line in old_tasks.splitlines() if line.startswith('- [ ]')]
research['body'] += '\n\n### 项目总览迁入的待办\n\n以下任务沿用整理前的未完成状态，整理文档不代表实验已完成。与上方扩展清单按交付物一起检查。\n\n' + '\n'.join(extra_tasks)
matrix = overview_section('## 8. 方法选择矩阵', '## 9. 交付物索引').split('\n', 2)[2].strip()
research['body'] += '\n\n<a id="method-matrix"></a>\n\n## 5. 方法与课题角色对照\n\n' + matrix
research['toc'].append('- [5. 方法与课题角色对照](#method-matrix)')
research['body'] = research['body'].replace('## 4. 后续扩展清单', '## 4. 统一待办清单')
research['toc'] = [x.replace('后续扩展清单', '统一待办清单') for x in research['toc']]
research['body'] = research['body'].replace('| 理论步骤 | 代码位置 | 说明 |', '下表路径相对于 [MP-main 代码目录](../3D-MP-SIM/MP-main/)；运行环境见其 [README](../3D-MP-SIM/MP-main/README.md)。\n\n| 理论步骤 | 代码位置 | 说明 |')

for i, (stem, title, purpose, sources, _) in enumerate(specs):
    nav = '[知识库目录](../SIM知识库.md) · [项目总览](../SIM项目总览.md) · [文献目录](../SIM文献目录.md)'
    source_link = '[来源编号与证据约定](08-术语与参考来源.md)' if i != 7 else '[文献目录](../SIM文献目录.md)'
    preface = f'# {title}\n\n{nav}\n\n> 阅读目标：{purpose}\n> 依据：{sources}。详见{source_link}。\n> 整理：2026-09-24；文中实验数字保留原有文献条件，工程建议不视为已验证结论。\n\n## 本页目录\n\n' + '\n'.join(documents[stem]['toc'])
    footer = '\n\n---\n\n'
    if i: footer += f'上一专题：[{specs[i-1][1]}]({specs[i-1][0]}.md) · '
    footer += '[返回知识库目录](../SIM知识库.md)'
    if i < len(specs)-1: footer += f' · 下一专题：[{specs[i+1][1]}]({specs[i+1][0]}.md)'
    (folder / (stem+'.md')).write_text(preface+'\n\n'+documents[stem]['body']+footer+'\n')

hub = '''# SIM 知识库

> 版本：v1.0 · 整理于 2026-09-24\n> 方向：SIM + 深度学习，用物理观测约束超分辨重建，并评价恢复结果的可靠性。

[资料库首页](README.md) · [项目总览](SIM项目总览.md) · [文献目录](SIM文献目录.md) · [公式阅读版](SIM知识库预览.html) · [交互演示](sim_interactive_demo.html)

## 按学习顺序阅读

原来的长文已按主题拆分，基础概念和对话推导合并到对应专题。每篇有独立目录、来源说明和前后篇跳转。

| 顺序 | 专题 | 解决的问题 |
|---|---|---|
'''
questions = ['空间频率、OTF、摩尔纹和负频率是什么？', '照明如何编码样品，为什么多相位能够解混？', 'Wiener、HiFi-SIM 和迭代重建各做什么？', 'missing cone、5/7 级频谱和多平面提速如何理解？', '噪声和参数误差如何变成伪影，如何评价结果？', '网络学什么，如何使用自监督与不确定性？', '先做哪些实验，理论对应哪些代码？', '术语怎么查，推导和文献结论如何追溯？']
for i, spec in enumerate(specs): hub += f'| {i+1:02d} | [{spec[1]}](知识库/{spec[0]}.md) | {questions[i]} |\n'
hub += '''
## 按当前问题直达

'''
for label, number in [('看不懂频谱搬移的正负号', '13.4'), ('理解三相位解混矩阵', '2.3'), ('检查 Wiener 公式和切趾窗', '4.1'), ('对照原图理解 missing cone', '13.7.2'), ('区分 7 级频谱、原始帧数和轴向平面数', '7.10'), ('比较 BayesDL-SIM、DeAbe、RL-SIM 和 SSR-SIM', '7.5'), ('查找 MP-main 的理论与代码对应', '9'), ('继续毕业课题实验', '12')]:
    m = mapping[number]
    hub += f'- [{label}]({m["path"]}#{m["anchor"]})\n'
hub += '''
## 三条阅读路线

- **从零理解 SIM**：01 → 02 → 交互演示 → 03 → 05。
- **开展 3D-MP-SIM 课题**：02 → 04 → 07 → MP-main 运行说明。
- **设计深度学习方案**：02 → 03 → 05 → 06 → 07；需要证据时查 08 和论文目录。

## 阅读与维护约定

- Markdown 是正文源文件；HTML 由脚本生成，适合阅读公式和图片。
- 每条知识按“文献结论、理论推导、工程建议、待验证假设”区分，来源编号沿用 S1–S10。
- 论文原文、补充材料、译文和理解笔记放在各论文目录；阅读状态统一记录在文献目录。
- 实验计划与待办集中在专题 07；演示开发记录从资料库首页进入。
- 新知识追加到对应专题，新增文献先登记目录。详细操作、旧章节对照和备份见 [维护说明](知识库/维护说明.md)。
'''
(root/'SIM知识库.md').write_text(hub)

(root/'README.md').write_text('''# SIM + 深度学习毕业课题资料库

围绕结构光照明显微镜（SIM）的超分辨成像组织。按当前任务选择入口：

| 想做什么 | 入口 |
|---|---|
| 学原理、查公式、理解论文之间的关系 | [知识库目录](SIM知识库.md) · [公式阅读版](SIM知识库预览.html) |
| 看课题目标、当前状态和实验路线 | [项目总览](SIM项目总览.md) |
| 找论文原文、译文、补充材料与阅读状态 | [文献目录](SIM文献目录.md) |
| 运行当前 3D-MP-SIM 重建代码 | [MP-main 运行说明](3D-MP-SIM/MP-main/README.md) |
| 通过操作理解成像与重建 | [SIM 原理交互演示](sim_interactive_demo.html) |

## 资料分区

- `知识库/`：按学习顺序排列的 8 个专题，以及维护说明和自动生成的阅读页。
- 各论文目录：保留原文、SI、元数据、译文、笔记与作者代码。具体条目见文献目录。
- `原文图示/`：知识库引用的论文图版；示意图与演示资源仍由原路径引用。
- `2025.06/`：早期收集存档；重复副本与待阅读资料的状态见文献目录。
- `归档/`：结构调整前的文档快照。

## 演示开发记录

- [真实采集改造计划](SIM交互演示-真实采集改造计划.md)：方案与实现任务。
- [修改和验证说明](SIM交互演示-修改说明.md)：已记录的改动与验证。
- [2026-09-24 原版审查记录](SIM交互演示审查-2026-09-24.md)：历史问题与推导依据。

## 资料状态约定

- **已阅读**：已根据主文、Methods、图注或 SI 整理译文/笔记；不代表本地复现完成。
- **仅存档**：已有文件，尚未形成可靠的独立结论。
- **待复现**：已有论文理解或代码入口，尚未完成本地实验验证。

维护方式与预览命令见 [知识库维护说明](知识库/维护说明.md)。论文与代码分别遵循其许可条件；本地中文译文用于学习和课题研究。
''')

(root/'SIM项目总览.md').write_text('''# SIM + 深度学习项目总览

[资料库首页](README.md) · [知识库目录](SIM知识库.md) · [文献目录](SIM文献目录.md)

## 研究问题

从有限光子、有限采样、像差和运动干扰下的 SIM 多帧观测中恢复更高空间频率，并说明结果的可靠程度。基础观测模型为

$$
y_j(\\mathbf r)=\\left[s(\\mathbf r)I_j(\\mathbf r)\\right]*h(\\mathbf r)+n_j(\\mathbf r).
$$

模型、符号与适用条件见 [统一成像模型](知识库/02-统一成像模型与SIM分类.md)。文献依据为 S1；3D 多平面部分依据 S10 和当前 S2 代码。

## 当前资料与实验状态

| 层次 | 当前记录 | 入口 |
|---|---|---|
| 原理与文献 | 已有综述及主要方法的译文/理解笔记 | [文献状态表](SIM文献目录.md) |
| 核心物理模型 | 已整理 3D-MP-SIM 的轴向相移、7 级频谱与代码映射 | [三维与多平面专题](知识库/04-三维SIM与多平面成像.md) |
| 本地复现 | 最小实例、统一 benchmark 等仍在未完成清单中 | [课题路线与代码映射](知识库/07-课题路线与代码映射.md) |
| 深度学习 | 物理初值 + 残差网络 + 数据一致性是拟验证方案 | [深度学习专题](知识库/06-深度学习与可信重建.md) |
| 待阅读文献 | DMF-SIM 尚未纳入可靠结论 | [文献目录](SIM文献目录.md) |

以上状态来自现有资料记录；本次目录整理不新增复现或实验完成结论。

## 推荐研究主线

```text
3D-MP-SIM raw + OTF + 参数元数据
            ↓
传统 7 级频谱分离 / Wiener 物理基线 x₀
            ↓
参数误差、噪声、像差与运动的可控扰动实验
            ↓
输入物理初值、照明参数与 OTF 的残差网络
            ↓
数据一致性 + 分辨率 + 跨样品泛化 + 不确定性评价
```

这是面向本课题的工程建议。首个研究方向是验证物理先验残差网络能否改善 3D-MP-SIM 的低 SNR 重建，并限制不可验证的结构生成。

## 执行入口

- [阶段 A–D、代码映射、方法选择和统一待办](知识库/07-课题路线与代码映射.md)：执行细节集中维护于此。
- [MP-main 环境和运行说明](3D-MP-SIM/MP-main/README.md)。
- [运行配置](3D-MP-SIM/MP-main/core/run1_488.py)：现有配置解释见 [SIM 分类与当前参数](知识库/02-统一成像模型与SIM分类.md#s2-2)。
- [质量评价](知识库/05-误差噪声与质量评价.md)：覆盖分辨率、伪影、物理一致性与泛化。
- [术语、来源与证据等级](知识库/08-术语与参考来源.md)：写作和引用时核对。
''')

maintenance = '''# 知识库维护说明

[知识库目录](../SIM知识库.md) · [资料库首页](../README.md)

## 文件职责

| 文件/目录 | 维护内容 |
|---|---|
| `SIM知识库.md` | 学习目录、问题直达、阅读路线 |
| `知识库/01`–`08` 专题 | 知识正文；按主题归入推导、方法与来源 |
| `SIM项目总览.md` | 研究目标与资料/实验状态概览 |
| 专题 07 | 实验步骤、代码映射、方法选择和待办 |
| `SIM文献目录.md` | 文献入口、已阅读/仅存档/待复现状态 |
| 各论文目录 | 原文、SI、元数据、译文和理解笔记 |
| HTML 预览 | 脚本生成的阅读页，从 Markdown 更新 |

## 添加内容的顺序

1. 新文献先登记文献目录，保存 DOI、原文与来源；未阅读条目不能直接写成结论。
2. 论文译文和详细笔记放回对应论文目录；共通知识提炼进专题。
3. 理论说明写清假设、符号和推导依据；使用 `$...$` 与 `$$...$$` 编写 LaTeX。
4. 工程建议和待验证假设明确标注；复现实验完成后附数据、参数、版本与评价记录。
5. 新章节使用稳定的显式锚点，并更新本页目录和知识库入口。
6. 修改 Markdown 后重建预览；不要手工改生成的 HTML。

## 预览命令

在项目根目录执行：

```sh
node build_sim_preview.mjs --all
node watch_sim_preview.mjs
```

第一条生成知识库入口、专题、维护说明、项目总览和文献目录的全部阅读页。监听模式覆盖这些 Markdown 文件的修改，以及专题文件的增加/删除。

单独生成任意文档仍支持：

```sh
node build_sim_preview.mjs --source "HiFI-SIM/High-fidelity structured illumination microscopy by point-spread-function engineering-译文.md" --output "HiFI-SIM/HiFi-SIM译文预览.html"
```

预览使用本地 KaTeX。`marked` 默认沿用现有本机依赖位置，也可用 `SIM_MARKED_PATH` 指定模块路径。专题间链接在预览中自动指向对应 HTML，图片和本地资源按输出目录换算相对路径。

## 本次整理记录

- 整理时间：2026-09-24。
- 原单篇知识库按主题拆分为 8 篇；原第 13 章对话内容回归基础与三维专题。
- Open-3DSIM 和 3D-MP-SIM 从深度学习章节移到三维成像专题。
- 修复章节层级、编号与正文中的公式转写；保留原推导、实验数字、图版与文献限制。
- 来源表保留 S 编号；S4 标为历史占位，补齐原参考书目漏列的 S5（依据本地 BibTeX）。
- 项目总览改为状态入口，实验细节与任务移入专题 07。
- 论文原文和代码保留现有目录；历史演示审查链接改为专题锚点。
- 整理前文档、预览与构建脚本的快照：[下载 ZIP](../归档/知识库整理前-2026-09-24.zip)。其中旧文档的相对链接按原项目根目录解释。

## 旧章节对照

| 整理前章节 | 新位置 |
|---|---|
'''
for n in ['0','1','2','3','4','5','6','7','7.8','7.9','7.10','8','9','10','11','12','13.1','13.2','13.3','13.3.1','13.4','13.5','13.6','13.7','13.7.1','13.7.2','13.7.3','13.8']:
    m=mapping[n]
    maintenance += f'| {n} | [{m["name"]}]({Path(m["path"]).name}#{m["anchor"]}) |\n'
(folder/'维护说明.md').write_text(maintenance)
(root/'tmp/knowledge-organization/mapping.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2))

# Replace stale line-number links in the historical review with current anchors.
audit = root/'SIM交互演示审查-2026-09-24.md'
text = audit.read_text()
first, rest = text.split('\n',1)
text = first+'\n\n> 历史记录：下文保留原版演示的审查结论与旧章节号。知识库的三处公式问题已在后续修改中修正；2026-09-24 整理时仅将引用更新为当前专题锚点。整理前快照见 [ZIP](归档/知识库整理前-2026-09-24.zip)。\n'+rest
for line, n in [('151','2.3'),('124','2.2'),('1073','13.4'),('233','4.1')]:
    m=mapping[n]
    text=text.replace('/Users/22p/Documents/ChatGPT/毕业设计/SIM知识库.md:'+line, m['path']+'#'+m['anchor'])
text=text.replace('/Users/22p/Documents/ChatGPT/毕业设计/SIM知识库.md', 'SIM知识库.md')
audit.write_text(text)
plan=root/'SIM交互演示-真实采集改造计划.md'
text=plan.read_text().replace('本地 `SIM知识库.md` 第 2、5 节', '本地知识库的 [统一成像模型](知识库/02-统一成像模型与SIM分类.md) 与 [参数估计](知识库/03-传统重建与参数估计.md#s2)')
plan.write_text(text)
print('Created 8 topics, maintenance guide, navigation entries and pre-organization ZIP.')
