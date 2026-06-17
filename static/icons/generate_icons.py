"""1회성 아이콘 생성 스크립트. PWA 아이콘(icon-192/512/512-maskable) 래스터화 용도로만 쓰고,
런타임 의존성이 아니므로 따로 실행 환경에 포함하지 않는다.
"""
from PIL import Image, ImageDraw

ACCENT = (37, 99, 235, 255)  # #2563eb
WHITE = (255, 255, 255, 255)


def draw_checklist_glyph(draw, cx, cy, scale):
    """cx, cy 중심에 scale(반경 기준) 크기의 흰색 체크리스트 글리프를 그린다."""
    line_w = max(2, int(scale * 0.09))
    box = scale * 0.34
    gap = scale * 0.46

    for i, dy in enumerate((-gap, 0, gap)):
        y = cy + dy
        x0 = cx - scale * 0.62
        # 체크박스
        draw.rounded_rectangle(
            [x0, y - box / 2, x0 + box, y + box / 2],
            radius=box * 0.22,
            outline=WHITE,
            width=line_w,
        )
        if i == 0:
            # 첫 줄은 체크 표시 채움
            cx0, cy0 = x0 + box * 0.22, y
            cx1, cy1 = x0 + box * 0.42, y + box * 0.24
            cx2, cy2 = x0 + box * 0.8, y - box * 0.28
            draw.line([(cx0, cy0), (cx1, cy1)], fill=WHITE, width=line_w)
            draw.line([(cx1, cy1), (cx2, cy2)], fill=WHITE, width=line_w)
        # 텍스트 라인
        line_x0 = x0 + box + scale * 0.18
        line_x1 = cx + scale * 0.62
        draw.line([(line_x0, y), (line_x1, y)], fill=WHITE, width=line_w)


def make_icon(path, size, rounded=True, safe_zone_padding=0.0):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if rounded:
        radius = size * 0.22
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=ACCENT)
    else:
        draw.rectangle([0, 0, size - 1, size - 1], fill=ACCENT)

    cx = cy = size / 2
    scale = size / 2 * (1 - safe_zone_padding)
    draw_checklist_glyph(draw, cx, cy, scale)

    img.save(path)


if __name__ == "__main__":
    make_icon("icon-192.png", 192, rounded=True)
    make_icon("icon-512.png", 512, rounded=True)
    # maskable: 안전 영역(반경 80%) 밖은 마스크에 의해 잘릴 수 있으므로
    # 배경은 꽉 채우고(코너 둥글림 없이) 글리프만 더 작게 중앙 배치
    make_icon("icon-512-maskable.png", 512, rounded=False, safe_zone_padding=0.22)
    print("done")
