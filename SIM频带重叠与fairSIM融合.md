# SIM 频带重叠与 fairSIM 的融合方式

> **一句话结论**：在单方向 SIM 里，超分辨区（$|q|>k_c$）内每一个频率**恰好只有一个频带**能把信息送到，边带之间零冗余；fairSIM 不去"挑选"那个频带，而是把所有搬移后的分量**全部累加**再除以 $\sum|H|^2+w^2$——几何自动保证超分辨区的求和只剩一项。

配套页面：`sim_pipeline_atlas.html` 步骤 06（频带搬移）、步骤 07（频谱支撑）、步骤 08（Wiener 融合）。
本页教学标度：检测截止 $k_c=10$ 格，照明波矢 $\mathbf{k}_1=(8,0)$、$\mathbf{k}_2=(4,7)$、$\mathbf{k}_3=(-4,7)$，$|\mathbf{k}_1|=8$。

本文所有数字都是实测或可一行复现的，见文末「复现」。

---

## 1. 问题从哪来

步骤 06 的「搬移后 · 红圈 q」那一排显示：同一个检测位置 $f$ 分离出三个分量，分别搬回

$$\Delta q = (0,0),\qquad \Delta q = (-8,0),\qquad \Delta q = (+8,0)$$

于是自然要问：**这三个分量里，谁在真正做超分辨？会不会三个都在贡献同一份信息？**

答案是：不会，而且**必然不会**。下面给证明。

---

## 2. 记号

解混后，第 $\ell$ 级在检测频率 $f$ 处携带的是样品的

$$S(q),\qquad q = f + \ell\,\mathbf{k}_1,\quad \ell\in\{-1,0,+1\}$$

即 $f = q - \ell\mathbf{k}_1$。检测能工作的条件是 $|f| \le k_c$，所以第 $\ell$ 级能交付的样品频率集合是

$$\Omega_\ell=\{\,q : |q-\ell\mathbf{k}_1|\le k_c\,\}$$

**三个半径 $k_c=10$ 的圆盘，圆心分别在 $(0,0)$、$(+8,0)$、$(-8,0)$。** 这就是步骤 07 中图那个胶囊的构成。

定义"超分辨区"为 $|q| > k_c$ ——宽场永远够不到的那部分。

---

## 3. 定理：两个边带不可能同时在超分辨区覆盖同一个 q

**命题**：若 $q \in \Omega_{+1} \cap \Omega_{-1}$，则 $|q| \le \sqrt{k_c^2 - |\mathbf{k}_1|^2} = \sqrt{100-64} = 6$。

**证明**（平行四边形恒等式）：

$$|q-\mathbf{k}_1|^2 + |q+\mathbf{k}_1|^2 = 2|q|^2 + 2|\mathbf{k}_1|^2$$

两个边带同时覆盖意味着左边两项都 $\le k_c^2$，故

$$2|q|^2 + 2|\mathbf{k}_1|^2 \le 2k_c^2 \quad\Longrightarrow\quad |q|^2 \le k_c^2 - |\mathbf{k}_1|^2 = 36$$

$$\boxed{|q| \le 6 < k_c = 10}\qquad\blacksquare$$

**读法**：$+1$ 和 $-1$ 的重叠区是一个**贴着原点的小透镜形**，最远只到 6 格，完全埋在宽场通带内部。到了超分辨区，它们**一点重叠都没有**。

### 实测验证

对方向数 = 1 枚举 $\pm24$ 格视野内每个 $q$，数有几个频带覆盖它（$h>0.01$）：

| 区域 | 覆盖者 = 1 | = 2 | = 3 |
|---|---|---|---|
| 超分辨区 $\lvert q\rvert>10$ | **308** | **0** | **0** |
| 全部 bin | 332 | 260 | 33 |

超分辨区里**没有任何一个 bin 的重数 ≥ 2**。全部冗余（260 + 33 个 bin）都在宽场内部，与定理一致。

---

## 4. 0 级完全不贡献超分辨

$\Omega_0 = \{|q|\le 10\}$，按定义就是宽场通带本身。实测各频带的支撑拆分：

| 频带 | $\Delta q$ | 落在宽场内 | **超出宽场** | 超出占比 |
|---|---|---|---|---|
| 0 级 | $(0,0)$ | 293 | **0** | **0%** |
| +1 级 | $(-8,0)$ | 152 | **141** | 48.1% |
| −1 级 | $(+8,0)$ | 152 | **141** | 48.1% |

**0 级是"白给"的那一份**——它恢复的就是宽场本来能看见的图像，增量严格为零。它的价值在于提供低频的准确幅度与相位，不在于分辨率。

$+1$ 与 $-1$ 各有一半支撑在宽场外，但按第 3 节，**这两半朝向相反**：$+1$ 撑到 $q=-18$，$-1$ 撑到 $q=+18$。

> ⚠️ 措辞陷阱：说"$\pm1$ 各贡献 48%"容易被读成"两个边带一起贡献同一个 $q$"。准确说法是：超分辨那圈里，**一半的弧归 $+1$、另一半归 $-1$，互不重叠**。

---

## 5. 覆盖到 ≠ 恢复得好

支撑是几何概念，能不能用还要看权重。沿 $-x$ 轴量 $+1$ 级的检测 OTF：

| $q$ | −9 | −10 | −11 | −12 | −13 | −14 | −15 | −16 | −17 | −18 |
|---|---|---|---|---|---|---|---|---|---|---|
| 在宽场内？ | 是 | 是 | **否** | 否 | 否 | 否 | 否 | 否 | 否 | 否 |
| $\lvert H\rvert$ | 0.873 | 0.747 | **0.624** | 0.505 | 0.391 | 0.285 | 0.188 | 0.104 | 0.037 | **0** |

- 真正可用的超分辨段是 $q = 11\text{–}15$ 格（权重 0.62 → 0.19）
- $q = 16\text{–}18$ 格名义上"够得着"，实际权重 $\le 0.10$

这就是步骤 07 中图那个圆盘**边缘发黑**的原因：支撑到了，信号没了。

一个交叉验证：三方向细条纹样品周期 7.5 px，即 $f = 128/7.5 = 17.07$ 格。代入非相干 OTF

$$\mathrm{OTF}(\rho)=\frac{2}{\pi}\bigl(\arccos\rho-\rho\sqrt{1-\rho^2}\bigr),\qquad \rho=\frac{|17.07-8|}{10}=0.907$$

得 $0.034$，即预测保留 3.4% 对比度；页面实测 $3.5/122.3 = 2.9\%$（差额是 Wiener 与切趾）。数量级吻合。

---

## 6. fairSIM 怎么做：不挑选，全加

### 6.1 每个频带都有正负两个搬移分量

`SimAlgorithm.java:638-640`

```java
int pos = b * 2, neg = (b * 2) - 1; // pos/neg contr. to band
otfPr.applyOtf(shifted[pos], b,  par.px(b),  par.py(b));
otfPr.applyOtf(shifted[neg], b, -par.px(b), -par.py(b));
```

`applyOtf` 的 Javadoc（`OtfProvider.java:545-546`）明确写着 **"Multiplied conjugated OTF to a vector"**，所以这里乘的是 $H^*$，不是 $H$。

### 6.2 全部搬移分量累加到同一个 q 网格

`SimAlgorithm.java:657-659`

```java
for (int i = 0; i < par.nrBand() * 2 - 1; i++) {
    fullResult.add(shifted[i]);
}
```

$2N_{\text{band}}-1$ 个分量（0 级 1 个 + 每级 2 个）**逐个加**进同一个输出频谱。没有任何分支在问"这个 $q$ 该用哪一级"。

### 6.3 分母是 OTF 平方和

`WienerFilter.java:60-85`，对每个 $(d,b)$ 累加两个偏移位置的 $|H|^2$：

```java
double rad1 = MTool.fhypot(xh - dir.px(b), yh - dir.py(b)) * cyclMicron;
double rad2 = MTool.fhypot(xh + dir.px(b), yh + dir.py(b)) * cyclMicron;
float otfVal1 = sp.otf().getOtfVal(b, rad1, false).absSq();
float otfVal2 = sp.otf().getOtfVal(b, rad2, false).absSq();
vec.set(x, y, vec.get(x, y) + otfVal1 + otfVal2);
```

`WienerFilter.java:120-127` 取倒数并加 $w^2$：

```java
ret.set(x, y, 1 / (ret.get(x, y) + (float) (wParam * wParam)));
```

### 6.4 合起来

$$\hat S(q)=\frac{\displaystyle\sum_{d}\sum_{\ell=-N_{\text{band}}+1}^{N_{\text{band}}-1} H^{*}\!\bigl(q-\ell\mathbf{k}_d\bigr)\,A_{d,\ell}\bigl(q-\ell\mathbf{k}_d\bigr)}{\displaystyle\sum_{d}\sum_{\ell}\bigl|H(q-\ell\mathbf{k}_d)\bigr|^{2}+w^{2}}$$

这是**加权平均**（严格说是 Wiener 最小均方估计），不是选择。分子 $H^*\!\cdot(H\,S) = |H|^2 S$，分母把所有贡献过的 $|H|^2$ 加起来，所以多处覆盖时自动按信噪比分配权重。

页面对照：步骤 08 的「fairSIM 实际分母 $D + w^2$」和步骤 07 右图「OTF 平方和」画的就是这个分母。

---

## 7. 为什么"全加"在超分辨区仍然正确

因为在 $|q| > k_c$ 处，求和**自动只剩一项**：

- $\ell = 0$ 项要求 $|q| \le k_c$ → 直接为零
- $\ell = +1$ 与 $\ell = -1$ 不能同时非零 → 第 3 节定理

于是分母退化：

$$\hat S(q)\;=\;\frac{H^{*}(q-\ell^{\ast}\mathbf{k}_1)\,A_{\ell^{\ast}}}{\bigl|H(q-\ell^{\ast}\mathbf{k}_1)\bigr|^{2}+w^{2}}\;\approx\;\frac{A_{\ell^{\ast}}(\cdot)}{H(\cdot)}$$

fairSIM 不需要"知道"哪个频带是超分辨来源——**几何保证了无效项在分母里本来就是 0**。这是这个写法优雅的地方：一套统一的累加公式同时处理冗余区和独占区。

---

## 8. 代价：零冗余 = 零校验 + 噪声放大

超分辨区只有一个贡献者，意味着：

1. **没有交叉校验。** 两个独立测量可以互相对账、平均掉噪声；一个不行。这一带的误差完全来自那一次测量。
2. **分母极小。** $\sum|H|^2$ 只剩一项，而这一项在第 5 节的表里从 0.62 掉到 0.04。$1/|H|^2$ 在 $q=-17$ 处是 $1/0.037^2 \approx 730$ 倍放大。
3. **$w^2$ 是唯一的刹车。** 这就是 Wiener 参数 $w$ 在超分辨边缘决定成败的原因——$w$ 太小，边缘噪声爆炸；$w$ 太大，把仅有的一点高频一起压掉。页面上 $w=0.05$ 是个折中。

这也解释了为什么"名义 2× 分辨率"在实践中往往只兑现成 1.6–1.8×：外圈那点支撑的权重太低，被 $w^2$ 正则掉了。

---

## 9. 多方向才真正造出冗余

实测方向数 = 3 时，超分辨区的覆盖重数分布：

| 覆盖者个数 | 1 | 2 | 3 |
|---|---|---|---|
| bin 数 | 342 | **250** | 4 |

约 **42%** 的超分辨 bin 被**两个不同方向**的边带同时送到。注意这与第 3 节的定理不矛盾——定理说的是**同一方向**的两个边带，多方向的 $\mathbf{k}_2,\mathbf{k}_3$ 朝向不同，重叠区可以伸到 $|q|>10$。

所以三方向有两层收益，容易只记住第一层：

| | 收益 | 体现 |
|---|---|---|
| 第一层 | 补齐各向异性 | 支撑从胶囊变成圆；12/6 点方向被补上 |
| 第二层 | 在超分辨区造出真实冗余 | 42% 的超分辨 bin 有 ≥2 个独立测量，Wiener 平均才真正起作用 |

---

## 10. 一页总结

| 问题 | 答案 | 依据 |
|---|---|---|
| 同一 $q$ 上三个分量都在贡献吗？ | 超分辨区**恰好一个**；宽场内最多三个 | 第 3 节定理 + 实测重数分布 |
| 0 级有用吗？ | 对分辨率**零贡献**，只负责低频准确性 | 293 bins 全在宽场内，超出数 = 0 |
| $\pm1$ 级各干什么？ | 朝相反两侧拉伸，重叠区最远只到 $\sqrt{k_c^2-|\mathbf k|^2}=6$ 格 | 平行四边形恒等式 |
| fairSIM 怎么融合？ | 全加 + 除以 $\sum\lvert H\rvert^2+w^2$，不做选择 | `SimAlgorithm.java:638,657`；`WienerFilter.java:60,120` |
| 为什么全加不出错？ | 无效项在分母里自动为 0 | 第 7 节 |
| 代价？ | 超分辨区零校验、噪声放大，靠 $w$ 压制 | 第 8 节权重表 |
| 多方向的额外好处？ | 造出真实冗余（42%） | 第 9 节 |

---

## 11. 复现

### 第 3 / 4 节的重数与支撑统计（纯几何，不需要页面）

```bash
node -e '
const kc=10, k=[8,0];
const hist={}, histSR={};
for (let by=-24; by<=24; by++) for (let bx=-24; bx<=24; bx++) {
  const q=Math.hypot(bx,by); let c=0;
  if (q<=kc) c++;
  if (Math.hypot(bx-k[0],by-k[1])<=kc) c++;
  if (Math.hypot(bx+k[0],by+k[1])<=kc) c++;
  if (!c) continue;                       // 跳过没被任何频带覆盖的 bin
  hist[c]=(hist[c]||0)+1;
  if (q>kc) histSR[c]=(histSR[c]||0)+1;
}
console.log("全部:", JSON.stringify(hist), " 超分辨区:", JSON.stringify(histSR));
'
# 输出： 全部: {"1":332,"2":260,"3":33}   超分辨区: {"1":308}
```

### 第 5 节权重、第 9 节三方向分布（读页面真实数据）

在页面控制台执行（`window.SIMAtlasPage` 由 `sim-atlas.js:720` 暴露）：

```js
// 沿 -x 轴读 +1 级的 OTF 权重
var P = SIMAtlasPage, A = SIMAtlas, n = P.pipe.spectrumSize, b = P.pipe.groups[0].bands[1];
[11,12,13,14,15,16,17,18].map(d => [d, b.h[A.idx(-d,0,n)]]);

// 超分辨区的覆盖重数分布（当前方向数）
var hist = {};
for (var by=-24; by<=24; by++) for (var bx=-24; bx<=24; bx++) {
  if (Math.hypot(bx,by) <= 10) continue;
  var c = P.pipe.bands.filter(bb => bb.active && (bb.h[A.idx(bx,by,n)]||0) > 0.01).length;
  hist[c] = (hist[c]||0)+1;
}
hist
```

### fairSIM 源码位置

| 内容 | 文件:行 |
|---|---|
| 正负搬移分量各乘共轭 OTF | `SimAlgorithm.java:638-640` |
| 全部搬移分量累加 | `SimAlgorithm.java:657-659` |
| 中间结果里 $\pm$ 配对相加 | `SimAlgorithm.java:679-682` |
| Wiener 分母 $= \sum\lvert H\rvert^2$ | `WienerFilter.java:60-86` |
| 取倒数并加 $w^2$ | `WienerFilter.java:120-127` |
| `applyOtf` 乘共轭的说明 | `OtfProvider.java:545-546` |

根目录：`Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/`

---

## 相关

- 胶囊几何与凹口深度：`SIM单方向学习指南.md` 第 2 节
- 各向异性的实测扇区数据：`SIM单方向学习指南.md` 第 3 节
- 条纹朝向 ⊥ 波矢：`SIM单方向学习指南.md` 第 1.1 节
