
import json
import os

path = r'C:\Users\Seidor\.gemini\antigravity\brain\bb038574-aa46-4360-98cd-72c6fc72cf73\.system_generated\steps\622\output.txt'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Ensure it's the workflow data
if 'success' in data and 'data' in data:
    wf = data['data']
else:
    wf = data

# Nodes to fix
for node in wf['nodes']:
    # Fix Google Drive operations
    if node['type'] == 'n8n-nodes-base.googleDrive':
        if node['parameters'].get('operation') != 'upload':
             node['parameters']['operation'] = 'upload'
    
    # Fix Set nodes ZipCode
    if node['type'] == 'n8n-nodes-base.set':
        if 'assignments' in node['parameters'] and 'assignments' in node['parameters']['assignments']:
            for ass in node['parameters']['assignments']['assignments']:
                if ass['name'] == 'ZipCode' and '`' in ass.get('value', ''):
                    # Replace template literal with concatenation
                    ass['value'] = ass['value'].replace('`${cep.slice(0,5)}-${cep.slice(5)}`', "cep.slice(0,5) + '-' + cep.slice(5)")

# Output modified workflow nodes and connections
result = {
    "nodes": wf['nodes'],
    "connections": wf['connections'],
    "name": wf['name'],
    "settings": wf.get('settings', {})
}

output_path = r'n:\Pessoal\44-IA\Antigravity\Projetos\Projetos\central-projetos\projetos\Portal de Automação B1\portalsolucoes-master\wf_11_fixed.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, indent=2)

print(f"Fixed workflow saved to {output_path}")
