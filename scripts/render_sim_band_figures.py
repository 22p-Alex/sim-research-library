"""Draw the frequency coordinates used in SIM频带重叠与fairSIM融合.md.

Uses only the Python standard library. Run from any directory:
    python3 scripts/render_sim_band_figures.py
"""
from html import escape
from math import sqrt
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "web/figures"
INK, MUTED = "#1d3040", "#607383"
ZERO, PLUS, MINUS = "#526776", "#226bb5", "#bd581e"


def text(x, y, value, size=21, color=INK, anchor="start", weight=400):
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" '
            f'text-anchor="{anchor}" font-weight="{weight}">{escape(value)}</text>')


def circle(x, y, r, color, fill="none", opacity=1):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" stroke="{color}" '
            f'stroke-width="2" fill="{fill}" fill-opacity="{opacity}"/>')


def line(x1, y1, x2, y2, color="#b4c1ca", dash=""):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="{color}" stroke-width="1.3" stroke-dasharray="{dash}"/>')


def point(x, y, color):
    return f'<circle cx="{x}" cy="{y}" r="6" fill="{color}" stroke="white" stroke-width="2"/>'


def panel(x, y, w, h):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="15" fill="white" stroke="#dce4e9"/>'


def svg(width, height, title, description, body):
    markers = ''.join(
        f'<marker id="{name}" viewBox="0 0 10 10" refX="9" refY="5" '
        f'markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M 0 0 L 10 5 L 0 10 Z" fill="{color}"/></marker>'
        for name, color in [("plus", PLUS), ("minus", MINUS)]
    )
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">'
            f'<title id="title">{escape(title)}</title><desc id="desc">{escape(description)}</desc>'
            f'<defs>{markers}</defs><rect width="100%" height="100%" fill="#f7f9fb"/>'
            '<g font-family="PingFang SC, Microsoft YaHei, sans-serif">'
            + ''.join(body) + '</g></svg>\n')


def fixed_detector():
    body = []
    scale, cy, kc, k = 14, 304, 10, 8
    for x, cx, f, heading, subtitle in [
        (20, 280, (6, 0), "A  固定探测点 f = (6, 0)", "沿照明方向取点：只有一个分量在宽场圆外。"),
        (610, 880, (0, 8), "B  固定探测点 f = (0, 8)", "二维取点：两个边带可以同时在宽场圆外。"),
    ]:
        body += [panel(x, 20, 570, 490), text(x+22, 61, heading, 25, weight=650),
                 text(x+22, 96, subtitle, 19, MUTED),
                 circle(cx, cy, kc*scale, "#a4b2bd", "#eaf0f4", .7),
                 line(x+28, cy, x+542, cy), line(cx, 133, cx, 454),
                 text(x+536, cy-10, "qₓ", 19, MUTED),
                 text(cx+10, 141, "qᵧ", 19, MUTED)]
        for tick in [-10, 0, 10]:
            body += [line(cx+tick*scale, cy-4, cx+tick*scale, cy+4),
                     text(cx+tick*scale, cy+25, str(tick), 17, MUTED, "middle")]
        sx, sy = cx+f[0]*scale, cy-f[1]*scale
        for order, color, marker in [(1, PLUS, "plus"), (-1, MINUS, "minus")]:
            qx, qy = f[0]-order*k, f[1]
            tx, ty = cx+qx*scale, cy-qy*scale
            bend = 76 if f[1] == 0 else 0
            body.append(f'<path d="M {sx} {sy-9} Q {(sx+tx)/2} {sy-bend-9} {tx} {ty-9}" '
                        f'fill="none" stroke="{color}" stroke-width="2" marker-end="url(#{marker})"/>')
            body += [point(tx, ty, color),
                     text(tx, ty+60 if f[1] == 0 else ty-33,
                          f'{order:+d}：({qx}, {qy})', 21, color, "middle", 600)]
        body += [point(sx, sy, ZERO),
                 text(sx, sy+94 if f[1] == 0 else sy+42, f'0：({f[0]}, {f[1]})', 21, ZERO, "middle", 600),
                 text(x+285, 484, "浅灰圆：宽场支撑 |q| < 10    ·    照明 k = (8, 0)", 18, MUTED, "middle")]
    return svg(1200, 530, "固定探测频率，比较三份不同的样品频率",
               "左图 f=(6,0) 产生 q=(6,0),(-2,0),(14,0)，一个在半径10之外；"
               "右图 f=(0,8) 产生 q=(0,8),(-8,8),(8,8)，两个在半径10之外。", body)


def shifted_support():
    body = [panel(20, 20, 756, 650), panel(796, 20, 384, 650),
            text(45, 61, "固定样品频率 q：数一数有几个频带覆盖它", 25, weight=650),
            text(45, 97, "三个半径 10 的圆盘；中心分别为 −k、0、+k。", 20, MUTED)]
    cx, cy, scale, kc, k = 395, 390, 17, 10, 8
    body += [circle(cx, cy, kc*scale, ZERO, "#eaf0f4", .65),
             circle(cx-k*scale, cy, kc*scale, PLUS, "#5a9cdd", .08),
             circle(cx+k*scale, cy, kc*scale, MINUS, "#e69963", .08)]
    dy = sqrt(kc*kc-k*k)*scale
    body.append(f'<path d="M {cx} {cy-dy} A {kc*scale} {kc*scale} 0 0 1 {cx} {cy+dy} '
                f'A {kc*scale} {kc*scale} 0 0 1 {cx} {cy-dy}" fill="#8d73b5" fill-opacity=".18"/>')
    body += [line(58, cy, 740, cy), line(cx, 127, cx, 575),
             text(734, cy-12, "qₓ", 19, MUTED), text(cx-14, 139, "qᵧ", 19, MUTED, "end")]
    for tick in [-18, -8, 0, 8, 18]:
        body += [line(cx+tick*scale, cy-5, cx+tick*scale, cy+5),
                 text(cx+tick*scale, cy+27, str(tick), 17, MUTED, "middle")]
    body += [point(cx+14*scale, cy, MINUS), text(cx+14*scale, cy-29, "q = (14, 0)", 21, MINUS, "middle", 600),
             point(cx, cy-14*scale, INK), text(cx+17, cy-14*scale+7, "q = (0, 14)：无覆盖", 20, INK),
             text(217, 598, "+1 级：中心 (−8, 0)", 20, PLUS, "middle", 600),
             text(395, 637, "0 级：中心 (0, 0)", 20, ZERO, "middle", 600),
             text(588, 598, "−1 级：中心 (8, 0)", 20, MINUS, "middle", 600)]
    body += [text(821, 67, "目标 q = (14, 0)", 24, weight=650),
             text(821, 108, "需要读取的探测位置 f = q + ℓk", 19, MUTED),
             text(821, 155, "0 级    →  f = (14, 0)    不可达", 20, ZERO),
             text(821, 198, "+1 级  →  f = (22, 0)    不可达", 20, PLUS),
             text(821, 241, "−1 级  →  f = (6, 0)      可达", 20, MINUS, weight=650),
             line(821, 281, 1154, 281), text(821, 326, "两个边带的交叠", 23, weight=650),
             text(821, 369, "紫色透镜区完全位于 |q| < 6。", 20),
             text(821, 408, "所以在 |q| > 10 的超分辨区，", 20),
             text(821, 447, "同一方向最多只有一个有效边带。", 20),
             line(821, 484, 1154, 484), text(821, 533, "“最多一个”不等于“必有一个”。", 20, weight=600),
             text(821, 574, "例如 q = (0, 14)，三个圆都够不到。", 19),
             text(821, 630, "圆周处 H = 0；有效支撑不含圆周。", 18, MUTED)]
    return svg(1200, 690, "单方向搬移后，固定目标样品频率的覆盖关系",
               "q=(14,0)只有中心在(8,0)的负一级圆盘覆盖；q=(0,14)无覆盖。"
               "正负边带交叠处都在半径6以内。", body)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in [("sim-fixed-detector-frequency.svg", fixed_detector()),
                       ("sim-shifted-band-support.svg", shifted_support())]:
        (OUT / name).write_text(data, encoding="utf-8")
        print(OUT / name)
