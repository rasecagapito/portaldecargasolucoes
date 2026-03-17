import json

input_path = r'C:\Users\Seidor\.gemini\antigravity\brain\a31d207e-e67f-4e4a-bbf0-9a735da9de21\.system_generated\steps\269\output.txt'
output_path = r'C:\Users\Seidor\.gemini\antigravity\brain\a31d207e-e67f-4e4a-bbf0-9a735da9de21\fixed_wf.json'

with open(input_path, 'r', encoding='utf-8') as f:
    wf = json.load(f)

nodes = wf['data']['nodes']
connections = wf['data']['connections']

# Node 2: SL • Config
for node in nodes:
    if node['name'] == 'SL • Config':
        node['parameters'] = {
            "mode": "manual",
            "values": {
                "string": [
                    { "name": "sap_url", "value": "={{ $json.body.sap_url }}" },
                    { "name": "sap_user", "value": "={{ $json.body.sap_user }}" },
                    { "name": "sap_password", "value": "={{ $json.body.sap_password }}" },
                    { "name": "sap_company_db", "value": "={{ $json.body.sap_company_db }}" },
                    { "name": "signed_url", "value": "={{ $json.body.signed_url }}" }
                ]
            },
            "options": {}
        }

# Node 3: SL • Login SAP
for node in nodes:
    if node['name'] == 'SL • Login SAP':
        node['parameters'] = {
            "method": "POST",
            "url": "={{ $('SL • Config').first().json.sap_url }}/b1s/v2/Login",
            "sendBody": True,
            "specifyBody": "keypair",
            "bodyParameters": {
                "parameters": [
                    { "name": "UserName", "value": "={{ $('SL • Config').first().json.sap_user }}" },
                    { "name": "Password", "value": "={{ $('SL • Config').first().json.sap_password }}" },
                    { "name": "CompanyDB", "value": "={{ $('SL • Config').first().json.sap_company_db }}" }
                ]
            },
            "options": {
                "allowUnauthorizedCerts": True
            }
        }

# Node 5: Download SPED
for node in nodes:
    if node['name'] == 'Download SPED':
        node['parameters'] = {
            "url": "={{ $('SL • Config').first().json.signed_url }}",
            "options": {
                "response": {
                    "response": {
                        "responseFormat": "file"
                    }
                }
            }
        }

# Node 7: AI • Extração
for node in nodes:
    if node['name'] == 'AI • Extração':
        text = node['parameters'].get('text', '')
        if '$node["OCRD • Filtrar 0150"]' in text:
            node['parameters']['text'] = text.replace('$node["OCRD • Filtrar 0150"]', "$('OCRD • Filtrar 0150').first()")

# Node 15w: Wait (Throttling)
for node in nodes:
    if node['name'] == 'Wait (Throttling)':
         node['parameters'] = {
             "amount": 1,
             "unit": "seconds"
         }

# Fix Connections
if "Switch • Existe?" in connections:
    connections["Switch • Existe?"] = {
        "main": [
            [ { "node": "Log • BP Existente", "type": "main", "index": 0 } ],
            [ { "node": "Wait (Throttling)", "type": "main", "index": 0 } ]
        ]
    }

connections["Wait (Throttling)"] = {
    "main": [
        [ { "node": "SAP • Get CNAE ID", "type": "main", "index": 0 } ]
    ]
}

connections["SAP • Map COUNTY"] = {
    "main": [
        [ { "node": "HTTP • Create BP", "type": "main", "index": 0 } ]
    ]
}

output_wf = {
    "nodes": nodes,
    "connections": connections
}

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(output_wf, f, indent=2)

print("Workflow fixed and saved")
