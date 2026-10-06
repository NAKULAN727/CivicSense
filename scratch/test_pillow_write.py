from PIL import Image

img = Image.new('RGB', (100, 100), color='white')
exif = img.getexif()

# GPS IFD
gps_ifd = exif.get_ifd(0x8825)
gps_ifd[1] = 'N'
gps_ifd[2] = ((12, 1), (58, 1), (1776, 100))
gps_ifd[3] = 'E'
gps_ifd[4] = ((80, 1), (13, 1), (624, 100))

# DateTime tag in primary IFD (tag 306) or Exif IFD (0x8769, tag 36867)
exif[306] = '2026:10:06 14:15:22'

exif_ifd = exif.get_ifd(0x8769)
exif_ifd[36867] = '2026:10:06 14:15:22'

img.save('scratch_exif_test.jpg', format='JPEG', exif=exif)

read_img = Image.open('scratch_exif_test.jpg')
read_exif = read_img.getexif()
print('Primary EXIF:', dict(read_exif))
print('GPS IFD:', dict(read_exif.get_ifd(0x8825)))
print('Exif IFD:', dict(read_exif.get_ifd(0x8769)))
