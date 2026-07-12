import re

# Read file
with open('app/api/v1/endpoints/config.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace 'turbidity' with 'turbidity_index' in quality_thresholds context
content = content.replace('"turbidity":', '"turbidity_index":')

# Replace turbidity thresholds  
content = re.sub(
    r'"turbidity_index": \{\s+"safe_max": 5\.0,\s+"unsafe_max": 25\.0',
    '"turbidity_index": {\n                    "safe_max": 10.0,\n                    "unsafe_max": 50.0',
    content
)

# Replace calibration max offset for turbidity
content = re.sub(
    r'"turbidity": 100\.0,',
    '"turbidity_index": 30.0,',
    content
)

# Replace calibration offset field name
content = content.replace('"turbidity_offset":', '"turbidity_index_offset":')

# Write back
with open('app/api/v1/endpoints/config.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('✓ config.py updated successfully')
