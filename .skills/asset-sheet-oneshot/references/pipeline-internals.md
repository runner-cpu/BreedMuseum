# Asset Sheet One-shot — 流水线内部机制（人维护参考）

> 这份文档是从 `SKILL.md` 正文搬出来的**脚本内部机制 / 独立调试接口 / 附带脚本**说明。
> 之所以搬出来：`skill_action` 每次触发都会把 `SKILL.md` 正文整篇注入模型上下文，正文过长
> 会导致上下文过长、模型调用超时。而 AssetAgent 的**权威操作规范在系统提示词
> （`system_prompt.j2`）里已经逐字给全**（workflow、Gate、命令、验收、blankBottom、
> moderation 等），SKILL.md 正文对 agent 而言要么重复、要么是 agent 被明令不要碰的脚本内部
> 细节。所以 SKILL.md 正文精简成白盒触发回执，细节留在这里**仅供人排查/维护**，
> `skill_action` 不会返回 `references/`，不进模型上下文。
>
> 相关：`references/measured-limits.md`（实测尺寸/阈值调参）、`references/moderation.md`
> （内容安全探针/消融/替换规则）。

## 出图后端

`generate_sheet.py` 按这个顺序找 `image-generation-super` 的 `scripts/generate_image.py`：

1. `--skill-script <path>`
2. 环境变量 `IMAGE_GEN_SUPER_SCRIPT`
3. 约定位置：与本 skill 同级的 `image-generation-super/`，或上一层 `素材生成/image-generation-super/`
4. 都没找到才退回内置直连，并在 stderr 告警、在 stdout 的 `backend` 字段标成 `direct`

**生产使用时必须命中前三条**，即让出图真正由 `image-generation-super` 完成。跑完检查
`pipeline.json` / `logs/<variant>.json` 里的 `backend` 应为 `image-generation-super`；
如果是 `direct`，说明官方脚本没找到，要补 `--skill-script`。

内置直连只是兜底，两种情况会用到：官方脚本不在本机（离线分析场景），或官方脚本在平台外
直连时返回 401 —— 它只发 `X-Gateway-Authorization`，网关要标准 `Authorization: Bearer`。
命中 401 时本脚本自动退回直连并告警，**不去改官方脚本**（其 SKILL.md 要求非必要不修改）。
平台内运行不会有这个 401 问题。`--direct` 可强制走直连，仅调试用。

## Usage（独立/分步调试接口）

### 一条命令跑完整包（推荐：喂规划，先出静态素材再出背板）

```bash
python3 scripts/run_pipeline.py --plan-file asset-plan.json --out work/sheet --dest work
```

传 `--plan-file` 时它把整包做完，调用方**只需要这一条命令**。出图请求全部走
`image-generation-super`，**串行发出：先静态素材，再背板**：

1. `plan_to_items.py` 把 `asset-plan.json` 翻成 sheet 清单（`role=background` 被剔掉）
2. 算这一包的像素预算：素材数超过单张上限就摊成 N 张 sheet（见「分辨率预算与拆图」），
   否则就是一张
3. 每张：`build_sheet_prompt.py` → `generate_sheet.py` 出图（被拦就升级变体）→
   `slice_sheet.py` 切片 → `postprocess_items.py` 抠底后处理
   （`--max-side` 不传时按 `art_style` 取 pixel 128 / hd 256）
4. `distribute_items.py` 把（多张时先汇总的）成品分发成 `<dest>/<key>/<key>.png` 并和规划对账 key
5. 静态素材全部就位后，拿规划里 `role=background` 那条的 `prompt` 请求一次，
   再用 `fit_background.py` 裁到它的 `canvas_width x canvas_height`
6. 背板裁剪缩放完成后，`seam_background.py` 把它改成可**水平循环平铺**的版本，
   再请求最后一次，见「背板接缝美化」

两条链路互不连坐：sheet 三档变体全被拦时背板照样会出（一张背板 > 零个产物），
背板失败也不影响已经分发好的静态素材。拆成多张时某一张被拦也不连坐其它张，
`next_action` 会给出 `partial_sheets_blocked` 和只重出那张的办法。

**跑完只需要读 `<out>/pipeline.json`**：`sheets` / `px_budget` / `used_variant` /
`backend` / `slice` / `clean` / `bg` / `distribute` 全部汇总在里面，还有一条 `next_action`
直接写明下一步该干什么（`ok` / `low_res` / `slice_mismatch` / `names_unreliable` /
`not_keyed` / `key_mismatch` / `bg_failed` / `partial_sheets_blocked` /
`all_variants_blocked`）。不要再逐个 `cat` 其它 json，更不要自己写 numpy 探针。

只想先看 prompt 不花钱：加 `--dry-run`。不要背板：`--no-bg`。不要接缝美化：`--no-seam`。
不要分发：`--no-distribute`。素材多也只出一张（认了分辨率）：`--no-split`。

### 只出 sheet（老接口，仍然可用）

```bash
python3 scripts/run_pipeline.py assets/items.example.json --out /path/to/out --max-side 128
```

**顺序不能换**：必须先切割再后处理。切片给每块素材垫的纯 key 色边框是给后处理反推 key 色用的（见下方「为什么切片要垫 key 色边框」）。

### 分步执行

```bash
# 1. 组 prompt（三档任选，也可 --subs extra_subs.json 追加自己的替换规则）
python3 scripts/build_sheet_prompt.py items.json --out out/prompt_verbatim.txt --variant verbatim

# 2. 出图（委派给 image-generation-super）。退出码 3 = 被内容安全拦截，应换更宽的变体而不是重试
python3 scripts/generate_sheet.py --prompt out/prompt_verbatim.txt \
    --out out/sheet.png --size 2848x1152 --log out/logs/verbatim.json \
    --skill-script /path/to/image-generation-super/scripts/generate_image.py

# 3. 切割。--plan 用上一步的 *_plan.json 给切片按素材名命名并核对个数
python3 scripts/slice_sheet.py out/sheet.png --out out/items \
    --plan out/prompt_verbatim_plan.json --report out/slice_report.json

# 4. 后处理
python3 scripts/postprocess_items.py out/items --out out/clean \
    --max-side 128 --report out/clean_report.json
```

切片数对不上时**脚本自己会换算法/扫参数**（见下方「切割算法」）：grid 算法凑不出期望
个数才退回扫底色间隙，扫中 `expect` 就用那一组，退出码 0，`slice_report.json` 里记
`mode` / `auto_relaxed`。全扫不中才退出码 2，并把试过的组合打在 stderr —— 直接读那张
表，**不要自己写 numpy 探针**。可调 `--dilate --min-part --min-area --thresh
--min-gap-row --min-gap-col --min-side --row-tol`，`--no-grid` 强制走老算法，
`--no-auto` 关掉扫参。

## 尺寸必须在 prompt 里钉死

切割出错的根因从来不是切割阈值，是**素材尺寸不统一**：模型各画各的大小，网格就是歪的，
高素材（旗杆、管道）会跨到下一行，宽素材会吃掉列间空隙，两三个素材于是被切成一块。
只写 `evenly spaced` / `generous gaps` 模型不当回事。

所以 `build_sheet_prompt.py` 会按 `size` 和网格算出具体像素数写进 prompt：

```
A single ... asset sheet ..., drawn on a pure flat solid #FF00FF chroma-key background
filling the entire canvas.
Canvas: exactly 2848x1152 px, split into a strict 5-column x 3-row grid of identical
cells, each cell exactly 569x384 px. ... Row 1 holds items 1-5, row 2 holds items 6-10,
row 3 holds items 11-15. Do not move an item to another row ...
UNIFORM SIZE (hard requirement): every item must fit inside a centred 398x268 px box in
its own cell, and must fill at least 60% of that box. ... Tall or long objects
(flagpoles, pipes, ladders, spears) must be scaled down to fit the box, never drawn
overflowing into the row above or below. Leave at least 116 px of pure #FF00FF chroma-key
between any two items ...
```

安全框取每格的 70%，最小间隙取「格边长 − 安全框边长」的较小值，都记在
`prompt_<variant>_plan.json` 的 `cell` / `safe` / `min_gap` 里。相对大小差异仍然允许，
但被限制在这个共用尺寸框内 —— 「角色比道具大」不再是可以突破画框的理由。

**行数选择兼顾像素预算与版式可靠性**：`grid_of()` 先按「让单素材安全框短边（= 最终像素数）
最大」挑行数，但不把预算当唯一标准——高瘦长条的单行多列排布（4 个素材排 4×1）会被生图
模型自作主张重排成 2×2 而切错。所以在预算不低于最优值 75% 的候选里，优先取更均衡的网格
（`|cols-rows|` 最小）。实测这条只把 `n=4` 从 498px 的 4×1 改成 403px 的 2×2，其余素材数
的选择不变。切割侧的 `detect_rows()` 行数兜底（见「切割算法」）是它的第二道保险。

## 切割算法

主算法 `grid`（有 `--plan` 时默认）：

1. `--dilate`（默认 6）膨胀后做连通域标记，把点阵抖动、描边缺口粘回同一块
2. 按 y 中心排序，在最大的 `rows-1` 个间隔处断行 —— 旗杆这种高素材的中心落在哪行就算
   哪行，不会像整列扫白那样把上下两行连成一片
3. 行内反复合并「横向间隙最小的一对」，直到总块数正好等于 `expect` —— 枪口火花、飘散
   粒子这类附属块离主体最近，会先被吸回主体
4. 按行、行内按 x 排序，得到与 prompt 编号一致的阅读顺序

**行数几何兜底（防生图模型无视 plan 版式）**：生图网关不保证按请求的行列出图——请求
4×1（`rows=1`）时模型常自作主张排成 2×2。plan 若按单行去切，左列上下叠放的两个素材会被
当成同一行糊成一块（实测 `hero_idle` 事故：交付图是「站立+跳跃」两个角色叠在一张
32×128 里）。所以 `detect_rows()` 会从连通域 y 中心的自然间隙推断**实际**行数（换行处
空隙 ≳ 素材中位高度的 0.6 倍），当它比 plan 的行数多、且 `expect` 能被它整除成规整网格时，
按几何重排行列（`grid_reflowed=true`，报告里带 `plan_grid`）。命名仍按阅读顺序对齐
（prompt 强制模型按阅读顺序填格），换算出的 `cols` 拿去对齐依然成立。配套的源头修复是
`build_sheet_prompt.py` 主动请求更均衡的网格（4 个素材直接请求 2×2 而非 4×1），让请求版式
和模型的自然产出对齐，两头一起把这类畸变压住。

备用算法 `gap`（没有 `--plan`、没装 scipy、或 grid 凑不出 `expect` 时）：先按整列纯底色
切列带，带内再按行切，不符就扫 `min_gap_*`。四张实测图里，切得准的三张两条算法的 box
完全一致，第四张（15 个素材、旗杆跨行）只有 grid 切对。

**内容掩码按 key 色距离判定**：sheet 底不再是白，`slice_sheet.py` 从 `--plan` 的 `key_color`
（或 `--key-color` 覆盖，缺省 `#FF00FF`）取底色，「离 key 色的欧氏距离 > `--key-dist`（默认 80）」
才算有内容 —— 旧的「灰度 < 244」在洋红底上会把底当成内容（洋红灰度≈105）而完全切不动。
切出的每块素材贴到一块大 `--pad` 圈的**纯 key 色**画布上导出，四边纯 key 色边框保证后处理
能从边框中位色反推出 key 色。

**命名按行对齐**：某一行的块数和规划里该行的素材数一致时才用规划的名字，不一致的那行
整行退化成 `unmatched_NN`，报告里 `names_reliable=false`，`distribute_items.py` 直接
跳过不发布。错位命名会一路带到 manifest（A 的图挂上 B 的名字），比少几个素材危险得多。

## 输入格式

`items.json`（完整示例见 `assets/items.example.json`）：

```json
{
  "name": "app-xxxx",
  "theme": "像素风横版射击，丛林军事基地场景，高对比度复古调色板",
  "style": "pixel",
  "size": "2848x1152",
  "items": [
    {"name": "hero_idle", "desc": "像素风，主角，侧视角，面朝右，站立待机"},
    {"name": "hero_jump", "base": "hero_idle", "desc": "像素风，主角跳跃姿势，双腿弯曲收起"}
  ]
}
```

- `style`: `pixel`（硬边像素、无抗锯齿）或 `hd`（2D cel shading）。
- `key_color`（可选）: 显式指定这张 sheet 的 chroma-key 底色（如 `"#00FF00"`）。不给就自动选：
  默认洋红 `#FF00FF`；`theme` + 各 item `desc`/`name` 里粉紫调关键词（`粉`/`紫`/`洋红`/`品红`/
  `pink`/`magenta`/`purple`/`violet` 等）命中 ≥2 次时换绿底 `#00FF00`（避开和素材主色撞）。
  整张共用一个底色（一张图多个素材没法逐个换色），所以按整批词频判断。
- `base`: 指向另一个素材名，用于姿态/状态变体。原本这类素材是图生图（「只改姿态，其余不变」），
  sheet 里没有参考图，脚本会改写成「与第 N 项完全同一个对象（相同外观、配色、比例）」，
  靠**图内互指**代替参考图。实测能保住同一个角色。
- 素材清单口径建议：**只收单体素材**。多层视差背景是整屏图层，塞进网格没有意义，单独出；
  同名素材去重；描述里的「透明背景」会被自动删掉（纯色底整图上这个诉求自相矛盾）。
- 网格行列由 `build_sheet_prompt.py` 自己按「让单素材短边最大」挑，不用你指定；
  素材太多时 `run_pipeline.py` 会自动拆成多张（见「分辨率预算与拆图」）。
  **描述里不要写「巨大」「细长」「占满画面」这类破坏统一尺寸的词**；素材内部可以自由用白色/
  浅色（chroma 底不撞白），但**不要用和底色相同的洋红/品红（或绿底时的纯绿）**，否则会被抠掉。

## 分辨率预算与拆图

单张 sheet 的素材上限固定为 **6 个**，不看 `art_style`、不看画布分辨率 —— 这是调用次数的
产品决策：每多一张就是多一次 `image-generation-super` 付费请求，用一个固定数字换清晰的
预期，而不是按分辨率精算到刚好够用。超过 6 个无条件拆成多张，张数跟着素材数涨，没有上限
（`ceil(素材数 / 6)`），每张一次请求、串行发出。

行数仍然是单素材像素的主开关（画布高固定 1152，1 行给 806 px、2 行 403、3 行 268），
只是现在最多 6 个素材必然落在 1~2 行，不会再摊到 3 行 —— 拆图上限本身就顺带兜住了
分辨率，`build_sheet_prompt.py` 的 `px_check` / `px_budget` / `px_ok` 仍然会算出来
写进 `plan.json` 和 `pipeline.json`，但只作为诊断信息（这一批实际拿到多少像素、够不够
交付尺寸 pixel 128 / hd 256），**不再是决定拆不拆图的开关**。

`run_pipeline.py` 自己按这条线摊清单（份数取最少、各份尽量等大），成品仍然汇总到
`<out>/clean` 再统一分发。**姿态变体跟它的 `base` 强制留在同一张** —— 跨图互指会失效，
同一个角色会被画成两个，这比多花一次请求更糟。

`--no-split` 换回「省请求、认了分辨率」（`pipeline.json` 的 `next_action` 会标
`low_res`）；`--max-per-sheet N` 手工改这个 6。`prompt_<variant>_plan.json` 和
`pipeline.json` 里的 `px_budget` / `px_target` / `px_need` / `px_ok` / `px_max_items`
就是这笔账，不用自己量图去猜。

## 产物

```
<out>/
├── sheet-items.json           --plan-file 模式下由 plan_to_items.py 生成
├── prompt_<variant>.txt / prompt_<variant>_plan.json
├── sheet_<variant>.png        出图结果（2848x1152，RGB 无 alpha）
├── logs/<variant>.json        每次提交的原始返回，含 400 报文与 backend
├── bg_prompt.txt / bg_raw.png / logs/bg.json   背板那条链路
├── bg_seam_raw.png / bg_seam_prompt.txt / logs/bg_seam.json   接缝美化那条链路
│                              （bg_seam_raw.png 只是拼接中间图，被拦/异常回退时
│                               不会被当成最终背板交付，仅供排查用）
├── items/NN_<name>.png        切片，带 key 色边框、未紧裁（中间产物）
├── clean/NN_<name>.png        成品：透明底、裁到最小外接矩形
├── slice_report.json          mode / names_reliable / row_counts、每个素材的 box 与尺寸
├── clean_report.json          每张的抠底判定与 actions 明细
├── sheetK/…                   拆成多张时上面那几样按张放进 sheet1/ sheet2/…，
│                              成品仍汇总到 <out>/clean（重新连号）再统一分发
└── pipeline.json              汇总报告：只需要读这一个
<dest>/<key>/<key>.png         分发结果（背板也在这里，已是接缝美化后/回退原图后的版本）
```

`pipeline.json` 里 `sheets` / `px_budget` / `used_variant` / `slice` / `clean` / `bg` /
`distribute` / `next_action` 就是全部结论，其它 json 只在需要复盘细节时才看。
`bg.seam_ok` / `bg.seam_blocked` 是接缝美化这一步的结果，`false` 时背板已回退成
未拼接的原图（见「背板接缝美化」）。

`bg.blankBottomY` / `bg.blankBottomHeight`（测不出时为 `null`）是背板底部留白区域的
起始行与高度，`bg.blankBottomSource`（`prompt` / `scan` / `null`）标明它是按 prompt 分数
算出来的还是像素扫出来的。**这些是背板原生高度帧（`bg.blankBottomRefHeight`，即
`fit_background.py` 的 `--target` 高度）里的像素值，不是游戏上屏坐标**——Coding Agent 常把
背板缩放到别的高度上屏（720 压成 540），裸用绝对值会错位（实测地面比背景留白低约 120px）。
所以额外给一个帧无关的比例 `bg.blankBottomYRatio = blankBottomY / blankBottomRefHeight`
（如 480/720≈0.667），下游按 `地面y = round(blankBottomYRatio × 实际上屏高度)` 换算。
这五个字段（`blankBottomY`/`blankBottomHeight`/`blankBottomYRatio`/`blankBottomRefHeight`/
`blankBottomSource`）要抄进 manifest 背板条目，见「留白与地面偏移」。

## 接入 AssetAgent 流水线

三个胶水脚本让 `asset-plan.json`（规划）直接接上 `<work_dir>/<key>/<key>.png`（交付面）。
走 `run_pipeline.py --plan-file` 时它们已经被自动调用，下面是单独用的接口：

```bash
# 规划 → sheet 清单（剔掉 role=background/layer，最多 --limit 个）
python3 scripts/plan_to_items.py asset-plan.json --out work/sheet/sheet-items.json

# 背板：出图后裁到规划里的画布尺寸（--style pixel 用 NEAREST），
# 传 --prompt-file 时优先按 prompt 里「下部三分之一…留白」的分数算底部留白，
# 解析不出才退回像素扫描，吐出 blankBottomY/blankBottomHeight/blankBottomSource
python3 scripts/fit_background.py work/sheet/bg_raw.png \
    --out work/bg_main/bg_main.png --target 1280x720 --style pixel \
    --prompt-file work/sheet/bg_prompt.txt

# 切片 → 逐素材目录，并和规划对账 key（missing/extra 只告警，退出码 2）
python3 scripts/distribute_items.py work/sheet/clean --dest work --plan asset-plan.json
```

规划里必须有一条 `role=background` 的素材，带 `prompt` 和 `canvas_width/canvas_height`；
`run_pipeline.py` 靠它发第二次出图请求（静态素材出完之后）。背板那条还应带
`ground_mode`（`code` / `scene`，见「留白与地面偏移」）——这个字段本 skill 的脚本不读，
由 AssetAgent 判定、决定 manifest 里背板 `usage` 的写法。
素材列表两种写法都收：分组的 `groups[].assets[]` 和平铺的 `assets[]`（分组只是给人看的，
管线不依赖它 —— 只认一种写法的话，规划写成另一种就会被判成「零个素材」白烧一轮）。
`art_style` 决定降采样上限（pixel 128 / hd 256）。

## 留白与地面偏移

背板 prompt 里常写「下部留一条浅色空白给代码画地面」（Gate 5 要求地面归代码，不归背板），
但这句话只有人能看懂——Coding Agent 拿到的是一张 1280x720 的 PNG，它自己判断不出
「浅色空白从第几行开始」，结果就是方块、问号砖块之类 canvas 素材摆放位置和背板视觉上的
地面对不齐（贴着留白边缘或悬空）。

`fit_background.py` 会算出底部留白的：

- `blankBottomY`：留白区域顶部的 y（**背板原生高度帧**里的像素值）—— 代码画地面/地砖从这行起
- `blankBottomHeight`：留白区域的高度（同样是原生高度帧像素）
- `blankBottomYRatio`：`blankBottomY / blankBottomRefHeight`，帧无关的比例（如 480/720≈0.667）——
  背板缩放上屏时用它换算 `地面y = round(blankBottomYRatio × 实际上屏高度)`
- `blankBottomRefHeight`：上面几个像素值所在的参照高度（= `--target` 的高，一般 720）
- `blankBottomSource`：这几个值是怎么来的（`prompt` / `scan` / `null`）

**两条来源，prompt 意图优先**：

1. 传了 `--prompt-file`（`run_pipeline.py` 会把 `bg_prompt.txt` 传进去）且里面写了「下部/底部 +
   三分之一 / 1/3 / N分之M / 底部N% + 留白/留空/浅色带」这类明确诉求时，直接按这个比例算
   （`blankBottomHeight = 画布高 × 比例`，`blankBottomY = 画布高 − blankBottomHeight`），
   `blankBottomSource="prompt"`。这是权威意图——「下部三分之一留白」这句话本来就是规划人
   写死的约定，比去猜像素靠谱。实测里像素扫描对轻纹理地面经常整段扫不出（返回 null），把
   明明白白写在 prompt 里的意图丢掉，所以 prompt 分数排在前面。
2. 没有 prompt 分数（没传 `--prompt-file` 或解析不出）时，退回逐行颜色方差扫描：从底部往上
   找连续纯色/近纯色带的起点（`ROW_SPREAD_THRESH=20`，只认从最后一行开始**连续不中断**的
   纯色带，天空里偶尔一两行方差也低不会被误判），`blankBottomSource="scan"`。
3. 两条都拿不到就 `blankBottomY: null`（`blankBottomSource: null`），不强行猜一个值。

五个字段落在 `pipeline.json` 的 `bg` 里，随 sheet 那条一起写出。Step 5 写 manifest 时要把
`blankBottomY`/`blankBottomHeight`/`blankBottomYRatio`/`blankBottomRefHeight` 原样抄进背板
条目（见 AssetAgent `system_prompt.j2` STEP_5）。**关键：`blankBottomY` 是背板原生高度帧
（`blankBottomRefHeight`，一般 720）里的像素，不是游戏上屏坐标**——Coding Agent 若把背板拉
到别的高度（如 540）绘制，必须用 `blankBottomYRatio` 按 `地面y = round(blankBottomYRatio ×
实际上屏高度)` 换算，裸用 `blankBottomY` 会让地面比背景留白低约 120px（本次事故根因）。
`usage` 里同时给出原生值和换算公式，Coding Agent 才不会再靠「下部三分之一」那句话自己猜。

**横版模式与地面归属（`ground_mode`）**：`blankBottomY` 是「底部留白从哪一行开始」的几何事实，
但这条留白**该由谁来用**取决于游戏是哪种横版——这是语义，不是几何，所以本 skill 只负责把
`blankBottomY` 量准，**模式由 AssetAgent 在规划阶段判定**并写进 plan 里 `role=background` 那条的
`ground_mode` 字段（skill 的脚本不读它）：

- `ground_mode="code"`（普通平面横版：横版平台跳跃、横版射击、跑酷）：背景只是远景幕布，
  角色站的地面/平台由**代码**画在底部留白带上，`usage` 让代码把地面 y 对齐 `blankBottomY`。
- `ground_mode="scene"`（2.5D / 斜俯视 / 角色直接站在背景画出的地面上）：地面已经画进背景了，
  代码**不要**再画地面色块遮挡底部留白，角色脚底基准线对齐 `blankBottomY` 贴着那条线站。

两种模式都仍然抄同一套 `blankBottomY`/`blankBottomHeight`/`blankBottomYRatio`/
`blankBottomRefHeight`，只是 `usage`/guidance 的措辞不同。
判定标准与 `usage` 模板见 AssetAgent `system_prompt.j2` 的 Gate 5 / FIELD_SPEC / STEP_5。

## 背板接缝美化（水平循环平铺）

横版游戏的背景图会水平循环轮播（同一张图左右首尾相接、无限滚动播放）。如果背板
本身不是「无缝可循环」的，循环点——也就是这一张图的右边缘接下一张的左边缘——会有
明显割裂感（色块、地平线、光照断在正中间）。`seam_background.py` 就是解决这个问题的：

1. 把 `fit_background.py` 裁剪缩放完的最终背板 `[A][B]`（A=左半，B=右半）从正中间
   切开，按 `[B][A]` 顺序重新拼接成同尺寸新图——这样水平循环时真正的接缝（原图
   「B 的右边缘接下一张 A 的左边缘」）正好落在新图的正中间，一次 `image-edits`
   局部重绘就能把这一条缝抹平，不用同时处理原图两端两条缝
2. 调用 `generate_sheet.py` 的 `--images`（走 `image-generation-super` 的
   `editImage`），用一段英文 prompt 让模型只重绘接缝附近窄带，天空/地平线/配色/
   光照/重复纹理在接缝两侧连续过渡，不改动远离接缝的画面内容。prompt 里额外硬性
   约束两件 editImage 的常见毛病：**（a）禁止全局色差** —— 不许把整图重新调色/
   曝光/白平衡，重绘窄带必须和相邻像素色调完全一致，否则美化后的背板会和其它素材、
   和循环平铺的另一份自己整体偏色；**（b）底部预留留白高度不变** —— 那条留给代码
   画地面的底部纯色空白带必须保持原高度、地平线/远景边界不许上下移动，否则 editImage
   会把远景往下拉、把留白挤大
3. **美化后不换回 `[A][B]` 顺序，直接把 `[B][A]` 当成最终背板**（已与用户确认）：
   拼接互换只是改变了画面内容从哪里「接起来」，图本身依然是完整的一张背景，
   再切一次只会多引入一次可能出错的操作
4. **美化后强制缩回目标尺寸**：`editImage` 只认固定几档尺寸，返回的图往往不是 src 的
   分辨率（实测把 1280x720 的目标改成过 1536x1024 / 1672x941）。美缝只该抹接缝、不该
   改分辨率，所以拿到结果后按 `--style`（`pixel`=NEAREST / `hd`=LANCZOS）缩回 src 尺寸，
   别让 editImage 的档位尺寸污染交付和 manifest（`run_pipeline.py` 会把 `art_style`
   对应的 style 传进来；单独用时按素材风格选）。缩回的目标尺寸写进 stdout 的 `resized_to`。

只处理左右接缝（水平循环），不处理上下——游戏背景通常不会垂直循环滚动。

> **已知失败模式（app-ekev6ji1t6o3 实测）**：`seam_ok=True` 是**假成功**——`seam_background.py`
> 只要 `image-edits` 子进程 exit 0（没被内容安全拦 exit 3）就无条件置 `seam_ok=True`，
> **没有任何重绘后的接缝连续性度量**。editImage **确实跑了也确实起了作用**（实测中缝从
> `bg_seam_raw.png` 的 30.1 压到 `bg_main.png` 的 13.1，约减半），但 13.1 仍是 baseline(6.6)
> 的 2.0x = 肉眼可见。根因：editImage 不是带紧掩码的局部 inpaint，而是按 prompt 重生成一条带，
> 模型在中线两侧各画各的、撞出硬边。判断缝是否真抹平不能信 `seam_ok`，要测像素：
> 「中心列 x=w/2 相邻列差」÷「全图相邻列平均差」，接近 1 才算平，≥2 就是可见缝。
> 修法方向：seam 后加中缝比值门控（超阈值判失败/回退），或改用带掩码的真 inpaint + 跨缝羽化。

`image-edits` 被内容安全拦截、或请求异常失败时，**回退到未拼接的原背板**（等于这
一步没跑过）：拼接是为了让接缝更好看，拼不好就不如不拼，保留原图至少画面完整可信，
好过交付一张接缝生硬的中间态。`pipeline.json` 的 `bg` 块里 `seam_ok` / `seam_blocked`
标记这一步的结果，`next_action` 会给出 `seam_blocked` 提示，可以单独重跑
`seam_background.py` 再试一次，不影响其它产物。

`--no-seam` 整体跳过这一步（背板保持 `fit_background.py` 裁剪缩放后的原样，不做
水平循环适配）。单独用（`--style` 按素材风格选，缺省 `pixel`）：

```bash
python3 scripts/seam_background.py work/bg_main/bg_main.png \
    --out work/bg_main/bg_main.png --raw-out work/bg_seam_raw.png --style pixel
```

## 后处理做了什么

`postprocess_items.py` 直接复用 `scripts/clean_asset.py` 的 `clean_image()`，不改阈值：

`detect_key`（alpha / chroma / none 三类判定：已有真 alpha 就不动；四边中位色是高饱和彩色
判为 chroma 底；低饱和白/灰/黑判为画面内容不抠）→ `apply_chroma_key`（按到 key 色的距离算
软 alpha + key 主导度识别半透明边缘 + despill 压边缘溢色 + 收边一圈 + 羽化）→ `normalize_alpha`
整理半透明浮尘 → `looks_like_tile` / `full_bleed`（贴图类满幅出血，出血后 alpha 直接拉满）
→ `trim_content` 裁到主体最小外接矩形（序列帧会先 `detect_grid` 识别网格，按帧对齐裁）
→ `bleed_rgb` 把边缘 RGB 扩散进透明区，防止缩放时出现白边/黑边。

chroma-key 只移除接近 key 色的像素，所以历史白底那套猜测式补丁（内部白孤岛、清白边残留、
白底 55% 边界判据、抠完 `guard_key` 回滚、`opaque_art` 保护判定）**全部删掉不再需要**：
实心砖块/背景层本就不含 key 色天然不受影响，素材内部的白高光/白描边也不再和底色撞。

`clean_asset.py` 也能单独用：`python3 scripts/clean_asset.py <图片> -o <输出>`，
或 `--batch <代码包根目录>` 批处理 `<app>/<app>/src/assets`
（`--batch` 的输出目录是文件里的 `DEFAULT_OUT_ROOT` 常量，用之前先改掉）。

### 为什么切片要垫 key 色边框

`clean_asset.detect_key` 从画布四边的中位色反推 key 色（不读旁路、不接受外部告知 key 是什么），
四边必须是干净的纯 key 色才反推得准。如果切片时紧裁到内容边缘，边框会混进素材颜色，
反推出的中位色饱和度不够、被判成 `none`（画面内容）直接不抠。
所以 `slice_sheet.py` 把每个素材贴到大一圈（`--pad`，默认 16px）的**纯 key 色**画布上导出，
最小外接矩形交给 `trim_content` 做。

如果 `clean_report.json` 里出现 `bg_kind != chroma`，先把 `--pad` 加大重切。

## 被拦怎么办

`generate_sheet.py` 退出码 **3** 表示 HTTP 400 `moderation_blocked`。**原样重试无用**，是确定性拒绝。

拦截判的是**整张图凑成的这一套素材是否可识别为某个作品**，不是单个关键词 ——
删掉 IP 名不管用，只留道具、删掉全部角色也照样被拦。要过闸必须换掉**整套素材的词汇**，
这就是 `generic2` 变体在做的事（规则在 `scripts/subs.json`，可用 `--subs` 追加）。

完整的探针数据、消融实验和替换规则见 `references/moderation.md`。

**一个重要限制**：改文本只能过安全闸，**改不了视觉结果** —— prompt 里写「红色圆顶补给道具」，
模型照样画红底白点的蘑菇。合规判断必须单独看图确认，不能以「接口通了」为准。

## 已知约束

尺寸只有 `2848x1152` 这一档被可靠遵守（`1024x1024` 实测 89 张里只有 12 张符合）；
网关会回显 `background: transparent` 但仍返回 RGB，透明底不可控 —— 这正是后处理必需的原因。
实测数据、切片阈值的调参过程与尺寸对照见 `references/measured-limits.md`。

**不要在 prompt 里给 sheet 加「透明背景」约束**：sheet 的画法是整图纯 chroma-key 底网格
（`build_sheet_prompt.py` 的 `head` 硬性写死 `pure flat solid <key 色> chroma-key background`，
还会主动删掉素材描述里残留的「透明背景」字样），单素材透明和整图纯色底
是互相矛盾的诉求。即使改了 prompt 也没用 —— 实测网关会回显 `background: transparent`
但仍返回不透明 RGB，透明底不可控。所以拿到透明底这件事在生图这一步做不到，
只能靠 `clean_asset.py` 的 chroma-key 去底兜底，这也是它必须存在、不能被"直接要求透明"
替代的原因。

**素材内部现在可以自由用白**：这正是从白底改到 chroma-key 底的核心收益。旧白底方案下
白高光/白描边/白手套/雪/云都和白底撞，逼着 prompt 禁止素材用白、逼着 `clean_asset.py`
背一堆猜测式补丁（抠内部白孤岛、清白边残留）。改到洋红/绿这类美术里几乎不出现的高饱和
底色后，只需约束素材**不要用和底色相同的洋红/品红（绿底时的纯绿）**，白色/浅色随便用，
抠图只按「离 key 色多远」算，不会误伤素材内部的白。

## 附带脚本

`scripts/extras/fix_assets.py` 是**单 case 硬编码**的手工修补脚本（问号砖配色 `recolor_question`、
背景层地平线裁切 `fix_bg_far`/`fix_bg_mid`），路径和参数都写死在文件里。
它的 `white_key` / `bleed_to_tile` 已经被 `clean_asset.py` 泛化吸收，
留在这里只作为「通用后处理搞不定时怎么手工兜底」的参考，**不在流水线里调用**。




