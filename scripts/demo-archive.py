"""Deterministic PNG storage, split for bounded repository transfers."""
import hashlib
import json
import pathlib
import sys
import zipfile

CHUNK_SIZE = 7_500_000
root = pathlib.Path(sys.argv[2])
archive = root / 'screens.zip'

def split():
    for old in root.glob('screens.zip.part*'):
        old.unlink()
    data = archive.read_bytes()
    for index, start in enumerate(range(0, len(data), CHUNK_SIZE)):
        (root / f'screens.zip.part{index:03d}').write_bytes(data[start:start + CHUNK_SIZE])

def materialize():
    parts = sorted(root.glob('screens.zip.part*'))
    if not parts:
        return  # Older revisions store a single archive.
    expected_names = [f'screens.zip.part{i:03d}' for i in range(len(parts))]
    if [p.name for p in parts] != expected_names:
        raise ValueError('Archive parts are missing or out of order')
    expected = json.loads((root / 'manifest.json').read_text())['archive']
    data = b''.join(p.read_bytes() for p in parts)
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('Archive parts do not match the manifest')
    if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
        temporary = root / 'screens.zip.tmp'
        temporary.write_bytes(data)
        temporary.replace(archive)

command = sys.argv[1]
if command == 'pack':
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        for row in json.loads((root / 'manifest.json').read_text())['screens']:
            info = zipfile.ZipInfo(row['file'], (2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, (root / row['file']).read_bytes())
    split()
elif command == 'split':
    split()
elif command in ('materialize', 'unpack'):
    materialize()
    if command == 'unpack':
        manifest = json.loads((root / 'manifest.json').read_text())
        allowed = {row['file'] for row in manifest['screens']}
        if hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['archive']:
            raise ValueError('Archive hash mismatch')
        with zipfile.ZipFile(archive) as z:
            if set(z.namelist()) != allowed or any(pathlib.PurePosixPath(n).name != n for n in allowed):
                raise ValueError('Archive screen inventory mismatch')
            for row in manifest['screens']:
                data = z.read(row['file'])
                if hashlib.sha256(data).hexdigest() != row['sha256']:
                    raise ValueError('Screen hash mismatch: ' + row['file'])
                (root / row['file']).write_bytes(data)
else:
    raise ValueError('Expected pack | split | materialize | unpack')
