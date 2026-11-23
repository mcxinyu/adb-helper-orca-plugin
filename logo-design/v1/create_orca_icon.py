from io import BytesIO
from pathlib import Path

from PIL import Image

root = Path(r"C:\Users\yuefeng\Documents\CodeHub\adb-helper-orca-plugin")
src = root / "logo-design" / "v1" / "android_orca_no_watermark_transparent.png"
outdir = root / "assets"
outdir.mkdir(exist_ok=True)

im = Image.open(src).convert("RGBA")
data_256 = None
for size in (256, 512):
    buf = BytesIO()
    im.resize((size, size), Image.Resampling.LANCZOS).save(buf, format="PNG", optimize=True)
    data = buf.getvalue()
    print(f"{size}x{size}: {len(data)} bytes ({len(data) / 1024:.1f} KiB)")
    if size == 256:
        data_256 = data

assert data_256 is not None and len(data_256) <= 256 * 1024
out = outdir / "icon.png"
out.write_bytes(data_256)
print(f"saved: {out} ({len(data_256)} bytes)")
