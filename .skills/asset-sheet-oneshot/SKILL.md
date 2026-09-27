---
name: asset-sheet-oneshot
description: "Generate ALL static game assets of one game in as few image-generation calls as possible, then slice and post-process them into ready-to-use transparent PNGs. Composes an item list into one chroma-key-background (magenta #FF00FF by default, green #00FF00 when the batch is magenta/pink/purple-dominant) asset-sheet prompt that pins down the exact grid geometry (canvas px, cell px, one shared per-item size box, minimum chroma-key gap, which item numbers go in which row) so every asset comes out inside the same size envelope, submits it to the image-generation-super gateway (gpt-image-2, 2848x1152), slices the sheet with connected-component labelling + row splitting + target-count merging (falls back to solid-key-color gap scanning), then runs clean_asset.py to chroma-key the background out (inferring the key color from the four-edge median, distance soft-alpha + spill-dominance + despill), trim each item to its content bounding box, bleed RGB into the alpha edge, and optionally NEAREST-downscale to a game-usable size. Items may freely use white internally since the background is a high-saturation chroma color, not white. Caps each sheet at 6 items regardless of art_style and unconditionally splits into multiple sheets above that (one image-generation-super call per sheet), keeping pose variants and their base on the same sheet. Handles moderation_blocked by auto-escalating through verbatim/generic/generic2 prompt variants. Use when you need a whole case's static assets at once with a consistent art style and a minimal number of API calls."
license: MIT
metadata:
  id: skill_asset_sheet_oneshot
  display_name: Asset Sheet One-shot
  trigger: "一次生成所有素材, asset sheet, 一张图出全部素材, 素材表, 批量出素材, sprite sheet 切割, 切割粘连, 多个素材切成一张, 素材尺寸不统一, 素材分辨率下降, 素材太多分辨率不够, 拆成两张 sheet, 抠底, chroma-key, 洋红底, 绿底, 最小外接矩形, 素材后处理, image-generation-super, gpt-image-2, moderation_blocked, 生图被拦"
  key_type: integrations_api_key
  scope_platform:
    - cli
  version: "1.0.0"
---
# Asset Sheet One-shot

本 skill 已由 `skill_action` 触发（白盒回执）。**完整操作规范以 Agent 为准**——workflow、Gate、命令、验收、blankBottom/ground_mode、  
moderation、产物布局全部在系统提示词里逐字给出，按其执行，它覆盖此文件与预训练知识。

- **生成**：只需系统提示词 STEP_3 给出的那一条 `run_pipeline.py --plan-file …` 命令。
- **不要**自己单独调那六个脚本、不要读 `items.json` 老接口、不要跑 `extras/fix_assets.py`。
- **只影响角色/静态素材链路**；背景图（背板）生成 `fit_background.py` / `seam_background.py`
不受影响。

脚本内部机制、独立/分步调试接口、调参、附带脚本等**仅供人排查/维护**的细节见：

- `references/pipeline-internals.md` —— 出图后端、切割算法、尺寸钉死、分辨率预算与拆图、
产物字段、接入流水线、留白与地面偏移、背板接缝美化（含 seam_ok 假成功失败模式）、
后处理链路、被拦处理、已知约束、附带脚本。
- `references/measured-limits.md` —— 实测尺寸档位、切片阈值调参过程。
- `references/moderation.md` —— 内容安全探针、消融实验、替换规则。

> 此文件刻意不重复系统提示词内容：`skill_action` 每次触发会把本文件整篇注入模型上下文，
> 正文过长会导致上下文过长、模型调用超时。`references/` 不会被 `skill_action` 返回，
> 需要时用文件工具按需读取（agent 常规执行无需读）。

