import re

with open('server/tools/internet.js', 'r') as f:
    content = f.read()

# Replace: html.match(/href="https:\/\/www\.instagram\.com\/([^\/"]+)\/"/i);
# with:    html.match(/href="https:\/\/www\.instagram\.com\/([^/"]+)\/"/i);
content = content.replace(r'html.match(/href="https:\/\/www\.instagram\.com\/([^\/"]+)\/"/i);', r'html.match(/href="https:\/\/www\.instagram\.com\/([^/"]+)\/"/i);')

# Replace: html.match(/([0-9,kM\.]+\s+likes?)/i);
# with:    html.match(/([0-9,kM.]+\s+likes?)/i);
content = content.replace(r'html.match(/([0-9,kM\.]+\s+likes?)/i);', r'html.match(/([0-9,kM.]+\s+likes?)/i);')

with open('server/tools/internet.js', 'w') as f:
    f.write(content)
