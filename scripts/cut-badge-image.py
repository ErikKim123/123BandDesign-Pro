"""자유 배치된 뱃지 이미지에서 지정한 영역을 잘라 배경을 투명하게 만들고 512×512 PNG 로 저장한다.

사용: python scripts/cut-badge-image.py <이미지> <코드>:<x0>,<y0>,<x1>,<y1> [...]
  예: python scripts/cut-badge-image.py docs/assets/badge-sheet-wolf-extra.png \\
        newsletter_subscribe:20,20,500,520 first_contact:540,20,1000,540 audience_judge:250,500,780,1024
결과: scratch/band-badges/<코드>.png   올리기: node packages/supabase/upload_badge.mjs <코드> scratch/band-badges/<코드>.png
필요: pip install "rembg[cpu]" pillow numpy

격자 시트는 scripts/slice-badge-sheet.py 를 쓴다. 배경 제거 방식은 그쪽과 같다(rembg 분할 + 잔여 배경·잡티 보정).
"""
import os, sys
from collections import deque
from PIL import Image, ImageFilter
import numpy as np
from rembg import new_session, remove

OUT = 'scratch/band-badges'
os.makedirs(OUT, exist_ok=True)
UP = 2  # 영역 확대 배율 — 영역이 이미 400px 안팎이라 2배면 충분

src = sys.argv[1]
specs = [(a.split(':')[0], tuple(int(v) for v in a.split(':')[1].split(','))) for a in sys.argv[2:]]
im = Image.open(src).convert('RGB')
session = new_session('u2net')

# 배경 표본 — 이미지 네 모서리 12px
a0 = np.array(im)
corners = [a0[:12, :12], a0[:12, -12:], a0[-12:, :12], a0[-12:, -12:]]
BG = np.concatenate([c.reshape(-1, 3) for c in corners]).mean(0)


def components(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), dtype=np.int32)
    n = 0
    for y in range(h):
        for x in range(w):
            if mask[y, x] and lab[y, x] == 0:
                n += 1
                lab[y, x] = n
                q = deque([(y, x)])
                while q:
                    cy, cx = q.popleft()
                    for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = n
                            q.append((ny, nx))
    return lab, n


def flood_border(cand):
    h, w = cand.shape
    seen = np.zeros_like(cand, dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


sheet = Image.new('RGBA', (512 * len(specs), 512), (236, 228, 211, 255))
for i, (code, box) in enumerate(specs):
    cell = im.crop(box)
    cell = cell.resize((cell.width * UP, cell.height * UP), Image.LANCZOS)
    cut = remove(cell, session=session, post_process_mask=True)
    a = np.array(cut)
    alpha = a[..., 3].astype(int)
    rgb = a[..., :3].astype(int)
    # 배경색과 거의 같으면서 가장자리와 이어진 화소는 마저 지운다 (배경의 은은한 광채 포함)
    dist = np.sqrt(((rgb - BG) ** 2).sum(-1))
    alpha[flood_border((dist < 30) & (alpha > 0))] = 0
    # 본체와 떨어진 작은 조각은 버린다
    solid = alpha > 40
    lab, n = components(solid)
    if n > 1:
        sizes = np.bincount(lab.ravel())[1:]
        keep = sizes >= max(600, sizes.max() * 0.03)
        alpha[~keep[lab - 1] & solid] = 0
    tile = Image.fromarray(np.dstack([a[..., :3], alpha.astype(np.uint8)]), 'RGBA')
    tile.putalpha(tile.getchannel('A').filter(ImageFilter.GaussianBlur(0.8)))
    tile = tile.crop(tile.getbbox())
    side = int(max(tile.size) * 1.1)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(tile, ((side - tile.width) // 2, (side - tile.height) // 2), tile)
    out = canvas.resize((512, 512), Image.LANCZOS)
    out.save(f'{OUT}/{code}.png')
    sheet.paste(out, (i * 512, 0), out)
    print('ok', code)
sheet.save(f'{OUT}/_extra_sheet.png')
