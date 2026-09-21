"""늑대 뱃지 시트(6×5)를 칸별로 잘라 배경을 투명하게 만들고 512×512 PNG 로 저장한다.

사용: python scripts/slice-badge-sheet.py            (결과 scratch/band-badges/<코드>.png + _sheet.png)
올리기: node packages/supabase/upload_badge.mjs <코드> scratch/band-badges/<코드>.png
필요: pip install "rembg[cpu]" pillow numpy   (첫 실행 때 분할 모델 ~170MB 를 내려받는다)

GRID 는 시트의 칸 순서(행 → 열)와 업적 코드. None 은 쓰지 않는 칸(라벨이 잘못 박힌 칸).

배경 제거는 색으로 하지 않는다 — 남색 리본·어두운 방패 안쪽이 배경과 색이 비슷해 색 기준으로 지우면
리본이 통째로 사라졌다(1차 시도). 대신 칸을 3배로 키운 뒤 rembg(u2net 분할 모델)로 뱃지 실루엣을 뜬다.
그 위에 두 가지 보정만 한다: 배경색과 거의 같은 화소 중 칸 가장자리와 이어진 것만 마저 지우고(모델이 남긴
배경 조각), 뱃지 본체와 떨어진 작은 조각은 버린다(모델이 잡은 배경 잡티).
"""
import io, os, sys
from collections import deque
from PIL import Image, ImageFilter
import numpy as np
from rembg import new_session, remove

SRC = 'docs/assets/badge-sheet-wolf.png'  # 원본 시트(6×5, 남색 배경)
OUT = 'scratch/band-badges'
os.makedirs(OUT, exist_ok=True)
UP = 3  # 칸 확대 배율 — 모델이 가장자리를 더 정확히 잡는다

GRID = [
    ['profile_complete', 'first_den_post', 'first_review', 'first_blood', 'frequent_flyer', 'voice_of_the_people'],
    ['top_critic', 'conversation_starter', 'influencer', 'paparazzi', 'the_recruiter', 'full_time_hustler'],
    ['asia_circuit', 'early_bird', 'weekly_checkin', 'eagle_eye', 'the_final_word', 'oasis'],
    ['breakfast_club', 'icebreaker', None, 'sunrise_survivor', 'splash_zone', 'the_chameleon'],
    ['workshop_warrior', 'bootcamp_veteran', None, 'the_ambassador', 'the_tracker', 'thecontender'],
]

only = set(sys.argv[1:])
im = Image.open(SRC).convert('RGB')
W, H = im.size
cw, ch = W / 6, H / 5
session = new_session('u2net')

# 배경 표본 — 각 칸 네 모서리. 배경은 남색 가죽 질감이라 평균 (10, 15, 22) 근처에 몰려 있다.
samples = []
for r in range(5):
    for c in range(6):
        x0, y0, x1, y1 = int(c * cw), int(r * ch), int((c + 1) * cw) - 1, int((r + 1) * ch) - 1
        a = np.array(im)
        for (x, y) in [(x0, y0), (x1 - 6, y0), (x0, y1 - 6), (x1 - 6, y1 - 6)]:
            samples.append(a[y:y + 6, x:x + 6].reshape(-1, 3))
BG = np.concatenate(samples).mean(0)


def components(mask):
    """연결 성분 라벨링(4방향) — 작은 조각을 버릴 때 쓴다."""
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


sheet = Image.new('RGBA', (512 * 6, 512 * 5), (236, 228, 211, 255))
count = 0
for r, row in enumerate(GRID):
    for c, code in enumerate(row):
        if not code or (only and code not in only):
            continue
        box = (int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch))
        cell = im.crop(box).resize((int(cw * UP), int(ch * UP)), Image.LANCZOS)
        cut = remove(cell, session=session, post_process_mask=True)
        a = np.array(cut)
        alpha = a[..., 3].astype(int)
        rgb = a[..., :3].astype(int)

        # 보정 1) 배경색과 거의 같으면서 가장자리와 이어진 화소는 마저 지운다 — 모델이 남긴 배경 조각.
        dist = np.sqrt(((rgb - BG) ** 2).sum(-1))
        leftover = flood_border((dist < 26) & (alpha > 0))
        alpha[leftover] = 0
        # 보정 2) 뱃지 본체(가장 큰 덩어리)와 떨어진 작은 조각은 버린다 — 배경 잡티.
        solid = alpha > 40
        lab, n = components(solid)
        if n > 1:
            sizes = np.bincount(lab.ravel())[1:]
            keep = sizes >= max(600, sizes.max() * 0.03)
            drop = ~keep[lab - 1] & solid
            alpha[drop] = 0

        tile = Image.fromarray(np.dstack([a[..., :3], alpha.astype(np.uint8)]), 'RGBA')
        al = tile.getchannel('A').filter(ImageFilter.GaussianBlur(0.8))
        tile.putalpha(al)
        bbox = tile.getbbox()
        tile = tile.crop(bbox)
        side = int(max(tile.size) * 1.1)
        canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        canvas.paste(tile, ((side - tile.width) // 2, (side - tile.height) // 2), tile)
        out = canvas.resize((512, 512), Image.LANCZOS)
        out.save(f'{OUT}/{code}.png')
        sheet.paste(out, (c * 512, r * 512), out)
        count += 1
        print('ok', code)
sheet.save(f'{OUT}/_sheet.png')
print('saved', count)
