# 实测数据与已知约束

## 1. 网关

- 端点 `https://app-dr6mrcqei51d-api-eLMlzK2Oljw9-gateway.appmiaoda.com/image2`
  （可用 `IMAGE_GENERATIONS_URL` 覆盖），模型 `gpt-image-2`。
- 载荷 `{"model":"gpt-image-2","prompt":...,"size":...}`，返回 `data[0].b64_json` + `revised_prompt`。
- **认证**：只发 `X-Gateway-Authorization` 会 401
  （`token extraction failed for header 'Authorization'`），必须带标准 `Authorization: Bearer <key>`。
  `generate_sheet.py` 两个头都发。
- Key 从环境变量 `INTEGRATIONS_API_KEY` 读，**不要写进任何产物文件**。

## 2. 尺寸

`size` 只接受 `1024x1024` / `1536x1024` / `1024x1536` / `2848x1152`。

| 请求档位 | 实际是否等于请求值 |
|---|---|
| `2848x1152` | **3/3 精确** |
| `1024x1024` | 89 张里只有 12 张符合；多数返回 `1254x1254`，5 张连长宽比都变了 |

所以 sheet 固定用 `2848x1152` —— 这是唯一被可靠遵守的一档，
横向比例也正好适合 4~6 列的网格。

## 3. 透明底

网关会在 `revised_prompt` 里回显 `background: transparent`，但**仍然返回 RGB**；
反而在没主动要求时有 4/89 偶发带 alpha。即：**透明底不可控**，
不能替代抠图，这也是本 skill 必须带 `clean_asset.py` 后处理的原因。
3 张 sheet 全部 RGB 无 alpha。

## 4. 出图质量（3 张 sheet）

- **数量与顺序**：13 / 10 / 8 全部严格符合 prompt，阅读顺序与编号一一对应，
  没有出现标签文字、格线、水印。
- **风格一致性**：sheet 最大的收益。同一张图内像素粒度、描边、调色板天然统一；
  逐张生成时每张的像素块大小和描边风格会飘。
- **相对比例**：`app-e6ma4rlxg4jl` 里 BOSS(667×562) > 角色(390×395) > 道具 > 子弹(234×75)，
  符合 prompt 的 `game-consistent scale`。
- **姿态变体**：靠「与第 N 项完全同一个对象」的图内互指代替图生图参考图，
  `hero_jump` 与 `hero_idle` 保持住了同一个角色。

## 5. 切片与后处理

切片阈值（`slice_sheet.py`，3 张实图调出来的）：
`THRESH=244`、`MIN_GAP_COL=80`、`MIN_GAP_ROW=40`、`MIN_SIDE=16`、`ROW_TOL=160`，
**先按列切再在列带内按行切**（直接按行切会被高素材把上下两行连成一片）。
31/31 切准。

调这套阈值时踩过的坑：`MIN_GAP=10` 会把弹道拖尾、爆炸粒子拆成多块（切出 17/15/12）；
一味加大 gap 又会出现顶边 1~5px 杂线和垂直方向两行粘连。

**切片必须留白边**：`clean_asset.detect_background` 判白底要求四边有 ≥55%（`WHITE_BORDER`）
近白像素，紧裁（PAD=2）会让它认不出白底、退化成 `opaque_art` 不抠图。
所以 `slice_sheet.py` 把每个素材贴到大一圈（默认 pad=16）的纯白画布上导出，
最小外接矩形交给 `clean_asset.trim_content` 做。实测这样 31/31 全部 `bg_kind=white` 抠底成功。

## 6. 仍然存在的差距

sheet 切片单个素材是 172~667px，线上 meowa 同名素材是 6~124px（已抠底并裁到主体最小外接矩形），
差 4~10 倍。用 `postprocess_items.py --max-side` 做 **NEAREST** 降采样（像素风绝不能用双线性）。
一组实测（`app-e6ma4rlxg4jl`，`--max-side 128`）：

```
415x422 -> 382x390 -> 125x128   透明 52%
676x557 -> 642x525 -> 128x105   透明 36%
262x99  -> 230x63  -> 128x35    透明 31%
```
（列依次为：切片带白边尺寸 → 抠底裁剪后 → 降采样后）
