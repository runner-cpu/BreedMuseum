"""将 Markdown 文档转换为排版整洁的 PDF（支持中文、标题、表格、列表）。"""
import re
import sys

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)

pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
FONT = 'STSong-Light'

styles = {
    'title': ParagraphStyle('title', fontName=FONT, fontSize=20, leading=28, spaceAfter=18, textColor=colors.HexColor('#1a3a2a')),
    'h1': ParagraphStyle('h1', fontName=FONT, fontSize=16, leading=22, spaceBefore=16, spaceAfter=10, textColor=colors.HexColor('#1a3a2a')),
    'h2': ParagraphStyle('h2', fontName=FONT, fontSize=13, leading=18, spaceBefore=12, spaceAfter=8, textColor=colors.HexColor('#2d5a3d')),
    'h3': ParagraphStyle('h3', fontName=FONT, fontSize=11.5, leading=16, spaceBefore=10, spaceAfter=6, textColor=colors.HexColor('#2d5a3d')),
    'body': ParagraphStyle('body', fontName=FONT, fontSize=10, leading=16, spaceAfter=6),
    'quote': ParagraphStyle('quote', fontName=FONT, fontSize=9.5, leading=15, spaceAfter=6, leftIndent=12, textColor=colors.HexColor('#555555')),
    'list': ParagraphStyle('list', fontName=FONT, fontSize=10, leading=16, spaceAfter=4, leftIndent=16),
    'cell': ParagraphStyle('cell', fontName=FONT, fontSize=9, leading=13),
    'cellHead': ParagraphStyle('cellHead', fontName=FONT, fontSize=9, leading=13, textColor=colors.white),
}


def inline(text: str) -> str:
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'`([^`]+)`', r'<font color="#7a5c18">\1</font>', text)
    return text


def convert(md_path: str, pdf_path: str):
    lines = open(md_path, encoding='utf-8').read().splitlines()
    story = []
    i = 0
    first_title = True
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip() or line.strip() == '---':
            i += 1
            continue
        # 表格块
        if line.strip().startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
                i += 1
            # 过滤分隔行（如 | --- | --- |）
            rows = [r for r in rows if not all(re.fullmatch(r':?-{2,}:?', c) for c in r if c)]
            if rows:
                ncol = max(len(r) for r in rows)
                data = []
                for ri, r in enumerate(rows):
                    r = r + [''] * (ncol - len(r))
                    st = styles['cellHead'] if ri == 0 else styles['cell']
                    data.append([Paragraph(inline(c), st) for c in r])
                avail = A4[0] - 4 * cm
                t = Table(data, colWidths=[avail / ncol] * ncol)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a3a2a')),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f2ea')]),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(Spacer(1, 4))
                story.append(t)
                story.append(Spacer(1, 8))
            continue
        m = re.match(r'^(#{1,4})\s+(.*)$', line)
        if m:
            level, text = len(m.group(1)), m.group(2)
            if level == 1 and first_title:
                story.append(Paragraph(inline(text), styles['title']))
                first_title = False
            elif level == 1:
                story.append(Paragraph(inline(text), styles['h1']))
            elif level == 2:
                story.append(Paragraph(inline(text), styles['h1']))
            elif level == 3:
                story.append(Paragraph(inline(text), styles['h2']))
            else:
                story.append(Paragraph(inline(text), styles['h3']))
            i += 1
            continue
        if line.strip().startswith('>'):
            story.append(Paragraph(inline(line.strip().lstrip('>').strip()), styles['quote']))
            i += 1
            continue
        m = re.match(r'^\s*([-*]|\d+\.)\s+(.*)$', line)
        if m:
            bullet = '•' if m.group(1) in ('-', '*') else m.group(1)
            story.append(Paragraph(f'{bullet} {inline(m.group(2))}', styles['list']))
            i += 1
            continue
        story.append(Paragraph(inline(line.strip()), styles['body']))
        i += 1

    doc = SimpleDocTemplate(pdf_path, pagesize=A4,
                            leftMargin=2 * cm, rightMargin=2 * cm,
                            topMargin=2 * cm, bottomMargin=2 * cm,
                            title=md_path.split('/')[-1])
    doc.build(story)
    print(f'已生成: {pdf_path}')


if __name__ == '__main__':
    convert(sys.argv[1], sys.argv[2])
