#!/usr/bin/env python
import os

# Remove BOM from package.json
path = r'd:\windows\Rossine\package.json'
with open(path, 'rb') as f:
    content = f.read()

# Remove UTF-8 BOM (EF BB BF)
if content.startswith(b'\xef\xbb\xbf'):
    content = content[3:]

# Write back without BOM
with open(path, 'wb') as f:
    f.write(content)

print("BOM removed successfully")
