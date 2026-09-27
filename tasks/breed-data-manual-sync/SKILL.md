---
name: breed-data-manual-sync
description: 畜禽品种数据与手册同步规范。当用户要求新增、修改、删除、补录博物馆品种数据（猪/牛/羊/鸡/鸭/鹅/马/兔/鸽/骆驼/鹿等任何畜禽条目）时必须触发，确保 src/data 变更与 docs/品种数据手册.md 保持同步。
---

# 品种数据与手册同步规范

## 何时触发
- 用户要求扩充、补录、修改、删除任何品种数据（`src/data/breeds.ts` 或 `src/data/extraBreeds*.ts`）
- 用户要求核查名录、比对缺漏品种
- 用户要求更新品种分类、濒危等级、图片、坐标等字段

## 必须执行的同步动作

### 1. 数据文件规范
- 新增批次品种写入新的 `src/data/extraBreedsN.ts`（N 为下一个序号），禁止改动既有批次文件的条目内容（去重除外）
- 每个品种必须包含 Breed 接口全部字段：`id`（英文 kebab-case）、`name`、`englishName`、`province`、`longitude`、`latitude`、`category`、`endangered`（普通/易危/濒危）、`appearance`、`performance`、`radar`（meat/milk/reproduction/labor/adaptability 五维）、`story`、`image`
- 图片必须通过 `image_search` 工具获取真实 URL，禁止编造；一个品种一张图，URL 不得与其他品种重复
- 新增前必须用脚本核查品种名是否已存在（防重复）
- 新增后必须在 `src/data/breeds.ts` 中 import 并 spread 注册新批次

### 2. 手册同步（每次数据变更必做）
变更完成后必须更新 `docs/品种数据手册.md`：
- 更新「数据总览」中的总数、分类统计、濒危等级统计（用脚本实测，禁止手填估计值）
- 在「批次变更记录」追加一条记录：日期、批次号、文件、增减数量、内容摘要
- 若新增/调整了类别，同步更新「类别体系」一节

### 3. 统计脚本（实测数据来源）
统计必须用以下方式实测（每个条目恰含一个 category 字段）：
```bash
python3 -c "
import re, glob
from collections import Counter
cats, names = Counter(), Counter()
for f in sorted(glob.glob('src/data/*.ts')):
    text = open(f).read()
    for c in re.findall(r\"category: '([^']+)'\", text): cats[c] += 1
    for n in re.findall(r\"(?<![a-zA-Z])name: '([^']+)'\", text):
        if re.search(r'[一-鿿]', n): names[n] += 1
print(sum(cats.values()), len(names), dict(cats.most_common()))
print('重复:', [n for n, c in names.items() if c > 1])
"
```

### 4. 收尾验证
- 运行 `npm run lint` 必须通过
- 手册与代码数据一致后，方可向用户汇报总数

## 禁止事项
- 禁止在手册中填写未经脚本实测的统计数字
- 禁止删除批次变更记录中的历史记录
- 禁止跳过手册更新直接汇报完成
