#!/usr/bin/env python3
from pathlib import Path

SIZE = 1024

# Palette sourced from in-game colors (script.js)
COLORS = {
    "grass": (201, 246, 183),
    "grass_dark": (182, 234, 166),
    "path": (242, 215, 166),
    "roof": (255, 178, 200),
    "house": (255, 242, 248),
    "trim": (255, 211, 231),
    "door": (217, 160, 107),
    "window": (143, 211, 255),
    "tree": (140, 216, 165),
    "trunk": (179, 122, 84),
    "outline": (166, 107, 69),
}

def clamp(v, lo=0, hi=255):
    return max(lo, min(hi, v))


def draw_rect(pixels, x0, y0, x1, y1, color):
    x0 = max(0, min(SIZE, x0))
    x1 = max(0, min(SIZE, x1))
    y0 = max(0, min(SIZE, y0))
    y1 = max(0, min(SIZE, y1))
    for y in range(y0, y1):
        row = pixels[y]
        for x in range(x0, x1):
            row[x] = color


def draw_triangle(pixels, x0, y0, x1, y1, x2, y2, color):
    # Barycentric fill
    min_x = max(0, min(x0, x1, x2))
    max_x = min(SIZE - 1, max(x0, x1, x2))
    min_y = max(0, min(y0, y1, y2))
    max_y = min(SIZE - 1, max(y0, y1, y2))

    def edge(ax, ay, bx, by, cx, cy):
        return (cx - ax) * (by - ay) - (cy - ay) * (bx - ax)

    for y in range(min_y, max_y + 1):
        row = pixels[y]
        for x in range(min_x, max_x + 1):
            w0 = edge(x1, y1, x2, y2, x, y)
            w1 = edge(x2, y2, x0, y0, x, y)
            w2 = edge(x0, y0, x1, y1, x, y)
            if (w0 >= 0 and w1 >= 0 and w2 >= 0) or (w0 <= 0 and w1 <= 0 and w2 <= 0):
                row[x] = color


def draw_outline(pixels, x0, y0, x1, y1, color, thickness=6):
    draw_rect(pixels, x0, y0, x1, y0 + thickness, color)
    draw_rect(pixels, x0, y1 - thickness, x1, y1, color)
    draw_rect(pixels, x0, y0, x0 + thickness, y1, color)
    draw_rect(pixels, x1 - thickness, y0, x1, y1, color)


def main():
    pixels = [[COLORS["grass"] for _ in range(SIZE)] for _ in range(SIZE)]

    # Subtle grass bands
    for y in range(0, SIZE, 28):
        if (y // 28) % 2 == 0:
            draw_rect(pixels, 0, y, SIZE, min(SIZE, y + 12), COLORS["grass_dark"])

    # Path
    draw_rect(pixels, 0, int(SIZE * 0.72), SIZE, int(SIZE * 0.82), COLORS["path"])

    # House base
    house_w = int(SIZE * 0.46)
    house_h = int(SIZE * 0.30)
    house_x = (SIZE - house_w) // 2
    house_y = int(SIZE * 0.38)
    draw_rect(pixels, house_x, house_y, house_x + house_w, house_y + house_h, COLORS["house"])
    draw_outline(pixels, house_x, house_y, house_x + house_w, house_y + house_h, COLORS["trim"], thickness=8)

    # Roof
    roof_peak_x = SIZE // 2
    roof_peak_y = int(SIZE * 0.22)
    draw_triangle(
        pixels,
        house_x - int(SIZE * 0.02), house_y,
        house_x + house_w + int(SIZE * 0.02), house_y,
        roof_peak_x, roof_peak_y,
        COLORS["roof"],
    )

    # Door
    door_w = int(SIZE * 0.10)
    door_h = int(SIZE * 0.17)
    door_x = SIZE // 2 - door_w // 2
    door_y = house_y + house_h - door_h
    draw_rect(pixels, door_x, door_y, door_x + door_w, door_y + door_h, COLORS["door"])
    draw_outline(pixels, door_x, door_y, door_x + door_w, door_y + door_h, COLORS["outline"], thickness=4)

    # Window
    win_w = int(SIZE * 0.09)
    win_h = int(SIZE * 0.09)
    win_x = house_x + int(SIZE * 0.12)
    win_y = house_y + int(SIZE * 0.10)
    draw_rect(pixels, win_x, win_y, win_x + win_w, win_y + win_h, COLORS["window"])
    draw_outline(pixels, win_x, win_y, win_x + win_w, win_y + win_h, COLORS["outline"], thickness=4)

    # Tree
    trunk_w = int(SIZE * 0.06)
    trunk_h = int(SIZE * 0.16)
    trunk_x = house_x - int(SIZE * 0.12)
    trunk_y = house_y + house_h - trunk_h
    draw_rect(pixels, trunk_x, trunk_y, trunk_x + trunk_w, trunk_y + trunk_h, COLORS["trunk"])
    draw_outline(pixels, trunk_x, trunk_y, trunk_x + trunk_w, trunk_y + trunk_h, COLORS["outline"], thickness=3)

    canopy_w = int(SIZE * 0.18)
    canopy_h = int(SIZE * 0.14)
    canopy_x = trunk_x - int(SIZE * 0.06)
    canopy_y = trunk_y - int(SIZE * 0.10)
    draw_rect(pixels, canopy_x, canopy_y, canopy_x + canopy_w, canopy_y + canopy_h, COLORS["tree"])
    draw_outline(pixels, canopy_x, canopy_y, canopy_x + canopy_w, canopy_y + canopy_h, COLORS["outline"], thickness=3)

    # Write PPM (P3)
    out_ppm = Path("assets/app-icon/babushka-village-1024.ppm")
    out_ppm.parent.mkdir(parents=True, exist_ok=True)
    with out_ppm.open("w") as f:
        f.write(f"P3\n{SIZE} {SIZE}\n255\n")
        for y in range(SIZE):
            row = pixels[y]
            f.write(" ".join(f"{r} {g} {b}" for (r, g, b) in row))
            f.write("\n")


if __name__ == "__main__":
    main()
