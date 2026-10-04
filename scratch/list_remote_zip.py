import urllib.request
import zipfile
import io

class RemoteZipReader(io.RawIOBase):
    def __init__(self, url):
        self.url = url
        req = urllib.request.Request(url, headers={'Range': 'bytes=0-0', 'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            content_range = resp.headers.get('Content-Range') # e.g. bytes 0-0/803205769
            self.size = int(content_range.split('/')[-1])
        self.pos = 0

    def seek(self, offset, whence=io.SEEK_SET):
        if whence == io.SEEK_SET:
            self.pos = offset
        elif whence == io.SEEK_CUR:
            self.pos += offset
        elif whence == io.SEEK_END:
            self.pos = self.size + offset
        return self.pos

    def tell(self):
        return self.pos

    def read(self, size=-1):
        if size == -1 or size is None:
            size = self.size - self.pos
        if self.pos >= self.size or size <= 0:
            return b""
        end = min(self.pos + size - 1, self.size - 1)
        req = urllib.request.Request(self.url, headers={
            'Range': f'bytes={self.pos}-{end}',
            'User-Agent': 'Mozilla/5.0'
        })
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
        self.pos += len(data)
        return data

url = "https://huggingface.co/xmlyqing00/V-FloodNet/resolve/main/records.zip"
print(f"Reading central directory of {url}...")
remote_file = RemoteZipReader(url)
zf = zipfile.ZipFile(remote_file)

print(f"\nFiles in records.zip ({len(zf.infolist())}):")
for info in zf.infolist():
    size_mb = info.file_size / (1024*1024)
    comp_mb = info.compress_size / (1024*1024)
    print(f"  - {info.filename} (uncompressed: {size_mb:.2f} MB, compressed: {comp_mb:.2f} MB)")
