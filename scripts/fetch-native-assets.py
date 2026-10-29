"""Fetch pinned, explicitly licensed inputs. Preserve any modified local asset."""
import argparse
import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'production/native/assets/boulder-01')
    options = parser.parse_args()
    record = json.loads((ROOT/'production/native/asset-sources/boulder-01.json').read_text())
    options.output.mkdir(parents=True, exist_ok=True)
    for item in record['files']:
        relative = Path(item['path'])
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Unsafe asset path')
        if not item['url'].startswith('https://dl.polyhaven.org/file/ph-assets/'):
            raise ValueError('Unexpected download origin')
        destination = options.output/relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            if hashlib.sha256(destination.read_bytes()).hexdigest() != item['sha256']:
                raise RuntimeError('Modified existing asset retained: '+str(destination))
            print('Already verified:', item['path'])
            continue
        temporary = destination.with_name(destination.name+'.download')
        with urllib.request.urlopen(item['url'], timeout=60) as response, temporary.open('wb') as handle:
            while chunk := response.read(1024*1024):
                handle.write(chunk)
        data = temporary.read_bytes()
        if len(data) != item['size'] or hashlib.sha256(data).hexdigest() != item['sha256']:
            temporary.unlink()
            raise RuntimeError('Downloaded asset integrity failure: '+item['path'])
        temporary.rename(destination)
        print('Downloaded and verified:', item['path'])
    (options.output/'download-manifest.json').write_text(json.dumps(record, indent=2)+'\n')
    (options.output/'verified-files.json').write_text(json.dumps([{'path':x['path'],'bytes':x['size'],'sha256':x['sha256']} for x in record['files']],indent=2)+'\n')


if __name__ == '__main__':
    main()
