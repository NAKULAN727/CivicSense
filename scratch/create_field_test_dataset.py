import os
import shutil
import piexif
from PIL import Image

SRC_DIR = r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas"
OUT_DIR = r"e:\CivicSenseAI\Field Test Dataset"

subdirs = ["Road", "Waste", "Flood", "WaterFilledPothole", "Negative", "Metadata"]
for sd in subdirs:
    os.makedirs(os.path.join(OUT_DIR, sd), exist_ok=True)

# 1. Road Damage real images
road_files = ["pathole 18.webp", "pathole 19.webp", "pathole 20.webp", "pathole 21.webp", "pathole 22.webp"]
for fn in road_files:
    src_fp = os.path.join(SRC_DIR, "Pathole", fn)
    if os.path.exists(src_fp):
        shutil.copy2(src_fp, os.path.join(OUT_DIR, "Road", fn))

# 2. Waste real images
waste_files = ["garbage 1.webp", "garbage 2.webp", "garbage 3.webp", "garbage 4.webp", "garbage 5.webp"]
for fn in waste_files:
    src_fp = os.path.join(SRC_DIR, "Garbage", fn)
    if os.path.exists(src_fp):
        shutil.copy2(src_fp, os.path.join(OUT_DIR, "Waste", fn))

# 3. Flood real images
flood_files = ["flood 1.jpg", "flood 10.webp", "flood 15.jpg", "flood 16.jpg", "flood 17.jpg"]
for fn in flood_files:
    src_fp = os.path.join(SRC_DIR, "Flood", fn)
    if os.path.exists(src_fp):
        shutil.copy2(src_fp, os.path.join(OUT_DIR, "Flood", fn))

# 4. Water-Filled Pothole benchmark real images (all 9 verified benchmark cases)
wfp_files = [
    "pathole 1.webp", "pathole 4.webp", "pathole 8.webp", "pathole 10.webp", 
    "pathole 13.webp", "pathole 14.webp", "pathole 25.webp", "pathole 26.webp", "pathole 30.webp"
]
for fn in wfp_files:
    src_fp = os.path.join(SRC_DIR, "Pathole", fn)
    if os.path.exists(src_fp):
        shutil.copy2(src_fp, os.path.join(OUT_DIR, "WaterFilledPothole", fn))

# 5. Negative / Clean unhazardous road scenes
neg_candidates = ["pathole 2.webp", "pathole 3.webp"]
for fn in neg_candidates:
    src_fp = os.path.join(SRC_DIR, "Pathole", fn)
    if os.path.exists(src_fp):
        shutil.copy2(src_fp, os.path.join(OUT_DIR, "Negative", fn))

# 6. Create Metadata Test Images (Tests A through F) using real image as base
base_img_path = os.path.join(SRC_DIR, "Pathole", "pathole 18.webp")
base_img = Image.open(base_img_path).convert('RGB')

def deg_to_dms_rational(deg):
    d = int(deg)
    m = int((deg - d) * 60)
    s = int(round((deg - d - m/60) * 3600 * 100))
    return ((d, 1), (m, 1), (s, 100))

# Test A: Valid EXIF GPS + Timestamp
zeroth_ifd_a = {
    piexif.ImageIFD.Make: b"CivicSense Mobile Pilot Camera",
    piexif.ImageIFD.DateTime: b"2026:10:06 14:15:22"
}
exif_ifd_a = {
    piexif.ExifIFD.DateTimeOriginal: b"2026:10:06 14:15:22"
}
gps_ifd_a = {
    piexif.GPSIFD.GPSLatitudeRef: 'N',
    piexif.GPSIFD.GPSLatitude: deg_to_dms_rational(12.9716),
    piexif.GPSIFD.GPSLongitudeRef: 'E',
    piexif.GPSIFD.GPSLongitude: deg_to_dms_rational(80.2184)
}
exif_bytes_a = piexif.dump({"0th": zeroth_ifd_a, "Exif": exif_ifd_a, "GPS": gps_ifd_a})
base_img.save(os.path.join(OUT_DIR, "Metadata", "test_a_gps_and_time.jpg"), format="JPEG", exif=exif_bytes_a)

# Test B: Timestamp but NO GPS
zeroth_ifd_b = {
    piexif.ImageIFD.Make: b"CivicSense Mobile Pilot Camera",
    piexif.ImageIFD.DateTime: b"2026:10:06 14:20:00"
}
exif_ifd_b = {
    piexif.ExifIFD.DateTimeOriginal: b"2026:10:06 14:20:00"
}
exif_bytes_b = piexif.dump({"0th": zeroth_ifd_b, "Exif": exif_ifd_b})
base_img.save(os.path.join(OUT_DIR, "Metadata", "test_b_time_no_gps.jpg"), format="JPEG", exif=exif_bytes_b)

# Test C: GPS but NO Timestamp
gps_ifd_c = {
    piexif.GPSIFD.GPSLatitudeRef: 'N',
    piexif.GPSIFD.GPSLatitude: deg_to_dms_rational(12.9810),
    piexif.GPSIFD.GPSLongitudeRef: 'E',
    piexif.GPSIFD.GPSLongitude: deg_to_dms_rational(80.2210)
}
exif_bytes_c = piexif.dump({"GPS": gps_ifd_c})
base_img.save(os.path.join(OUT_DIR, "Metadata", "test_c_gps_no_time.jpg"), format="JPEG", exif=exif_bytes_c)

# Test D: Neither GPS nor Timestamp
base_img.save(os.path.join(OUT_DIR, "Metadata", "test_d_neither.jpg"), format="JPEG")

# Test E: Low-Resolution image (<300x200 or <60,000 px)
low_res_img = base_img.resize((280, 190), Image.Resampling.BILINEAR)
low_res_img.save(os.path.join(OUT_DIR, "Metadata", "test_e_low_res.jpg"), format="JPEG")

# Test F: Normal High-Resolution image
high_res_img = base_img.resize((1280, 720), Image.Resampling.LANCZOS)
high_res_img.save(os.path.join(OUT_DIR, "Metadata", "test_f_high_res.jpg"), format="JPEG")

print("Successfully generated all Field Test Dataset images with piexif EXIF.")
