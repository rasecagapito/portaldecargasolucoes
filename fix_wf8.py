import json

with open(r'C:\Users\Seidor\.gemini\antigravity\brain\a31d207e-e67f-4e4a-bbf0-9a735da9de21\.system_generated\steps\269\output.txt', 'r', encoding='utf-8') as f:
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

# Node 7: AI • Extração (Fix reference)
for node in nodes:
    if node['name'] == 'AI • Extração':
        text = node['parameters'].get('text', '')
        if '$node["OCRD • Filtrar 0150"]' in text:
            node['parameters']['text'] = text.replace('$node["OCRD • Filtrar 0150"]', "$('OCRD • Filtrar 0150').first()")

# Node 15w: Wait (Throttling) (Fix parameters)
for node in nodes:
    if node['name'] == 'Wait (Throttling)':
         node['parameters'] = {
             "amount": 1,
             "unit": "seconds"
         }

# Fix Switch • Existe? Connections
# Remove the invalid "1" property if it exists and use main[1]
if "Switch • Existe?" in connections:
    if "1" in connections["Switch • Existe?"]:
        conn_to_move = connections["Switch • Existe?"].pop("1")
        # Ensure main has at least 2 entries
        while len(connections["Switch • Existe?"]["main"]) < 2:
            connections["Switch • Existe?"]["main"].append([])
        connections["Switch • Existe?"]["main"][1].extend(conn_to_move[0]) # conn_to_move is [[...]]

    # Ensure main[0] has both Log and Wait
    # (Based on previous logic: branch 0 goes to both)
    # Wait, the user said branch 0 -> Log. Fallback (branch 1) -> Wait -> Create BP.
    # Let's adjust connections for Switch according to AJUSTE 1.
    
    # AJUSTE 1: Rule 0 -> Log • BP Existente. Fallback -> Wait (Throttling) -> HTTP • Create BP.
    # So branch 0 -> Log • BP Existente
    # branch 1 -> Wait (Throttling)
    
    connections["Switch • Existe?"] = {
        "main": [
            [ { "node": "Log • BP Existente", "type": "main", "index": 0 } ],
            [ { "node": "Wait (Throttling)", "type": "main", "index": 0 } ]
        ]
    }

# Connections for Wait (Throttling)
connections["Wait (Throttling)"] = {
    "main": [
        [ { "node": "SAP • Get CNAE ID", "type": "main", "index": 0 } ]
    ]
}

# Connections for SAP lookups
connections["SAP • Map COUNTY"] = {
    "main": [
        [ { "node": "HTTP • Create BP", "type": "main", "index": 0 } ]
    ]
}

# Final data to save
output = {
    "nodes": nodes,
    "connections": connections
}

with open(r'C:\Users\Seidor\.gemini\antigravity\brain\a31d207e-e67f-4e4a-bbf0-9a735da9de21\fixed_wf.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)

print("Workflow fixed and saved to fixed_wf.json")
