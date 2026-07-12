"""Script to update remaining files for turbidity_index migration"""

import re

files_to_update = [
    'app/models/database.py',
    'app/api/v1/endpoints/status.py',
    'app/services/email_service.py',
    'tests/conftest.py',
    'insert_sample_data.py'
]

for filepath in files_to_update:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Update field names: turbidity -> turbidity_index (but NOT in feature names for ML)
        # Be careful to only replace in API/database contexts, not ML feature dictionaries
        
        if 'database.py' in filepath:
            # Update model field
            content = re.sub(r'turbidity: float', 'turbidity_index: float  # 0-100 relative scale, self-calibrated', content)
            # Update example JSON
            content = re.sub(r'"turbidity": 15\.5,', '"turbidity_index": 15.5,', content)
        
        elif 'status.py' in filepath:
            # Update parameter references
            content = content.replace('"turbidity":', '"turbidity_index":')
            content = content.replace('turbidity,', 'turbidity_index,')
            content = content.replace('["turbidity"]', '["turbidity_index"]')
            # Fix query parameter filter list
            content = re.sub(
                r'valid_parameters = \["ph", "turbidity", "temperature"',
                'valid_parameters = ["ph", "turbidity_index", "temperature"',
                content
            )
        
        elif 'email_service.py' in filepath:
            # Update email template text
            content = content.replace('Track pH, Turbidity,', 'Track pH, Turbidity Index,')
        
        elif 'conftest.py' in filepath:
            # Update test fixtures
            content = re.sub(r'"turbidity": 15\.5,', '"turbidity_index": 15.5,', content)
        
        elif 'insert_sample_data.py' in filepath:
            # Update sample data
            content = re.sub(r'"turbidity": 3\.1,', '"turbidity_index": 3.1,', content)
            content = re.sub(r'"turbidity":', '"turbidity_index":', content)
            content = content.replace('Turbidity:', 'Turbidity Index:')
            content = content.replace("f'   Turbidity: {sensor_data[\"turbidity\"]}'",
                                    "f'   Turbidity Index: {sensor_data[\"turbidity_index\"]} /100'")
        
        # Write back if changed
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'✓ Updated {filepath}')
        else:
            print(f'○ No changes needed in {filepath}')
    
    except FileNotFoundError:
        print(f'⚠ File not found: {filepath}')
    except Exception as e:
        print(f'✗ Error updating {filepath}: {e}')

print('\n✅ Migration complete for remaining files!')
