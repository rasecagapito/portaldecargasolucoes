"""
Fix 2: Aplica correções adicionais no workflow n8n
- SUB-OCNT-COUNTY: alwaysOutputData = true
- Montar CRD7 (Contabil/Cobranca/Entrega): add CardCode, Address, LineNum, includeOtherFields
"""
import json
import urllib.request
import sys
sys.stdout.reconfigure(encoding='utf-8')

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZmRlMDM0Mi01ZTNhLTRmNWYtOWQxNy0wNTBmYThmMDE3ZmUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzY3NjVjOGItOTRjMS00OWE2LTljMTgtYzk4YTc3NjhkOGJlIiwiaWF0IjoxNzczMDU5MzQyfQ.s9HWKoF7rAsOTuRhoBZx64N42vzWwo8gtaoUpiOAK5M"
BASE_URL = "https://tododiasoftware.app.n8n.cloud/api/v1"
WF_ID = "up2fgEwTd8I8EtBb"

def api_get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}", headers={"X-N8N-API-KEY": API_KEY})
    with urllib.request.urlopen(req) as r:
        return json.load(r)

def api_put(path, payload):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=body,
        method="PUT",
        headers={"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)

# Fetch workflow
print("Buscando workflow...")
wf = api_get(f"/workflows/{WF_ID}")
nodes = wf["nodes"]

changes = []

for n in nodes:
    nid = n.get("id")

    # Fix 1: SUB-OCNT-COUNTY → alwaysOutputData = true
    if nid == "cecd4d4d-5efe-4fc5-81a0-d6946cc404f7":
        before = n.get("alwaysOutputData")
        n["alwaysOutputData"] = True
        changes.append(f"SUB-OCNT-COUNTY: alwaysOutputData {before} -> True")

    # Fix 2-4: Montar CRD7 nodes → add CardCode, Address, LineNum + includeOtherFields
    crd7_fixes = {
        "74ebb7d4-8467-4581-8b24-175e6928990b": ("Montar CRD7 - Contabil",  "Contabil",  "0"),
        "b50134af-88fb-45b6-a3ff-b57776422104": ("Montar CRD7 - Cobranca",   "Cobranca",  "1"),
        "979299f3-fed7-4b5a-bc56-745f48a10790": ("Montar CRD7 - Entrega",    "Entrega",   "2"),
    }

    if nid in crd7_fixes:
        label, address, line_num = crd7_fixes[nid]
        p = n.setdefault("parameters", {})
        assignments = p.setdefault("assignments", {}).setdefault("assignments", [])

        # Add CardCode if not present
        if not any(a["name"] == "CardCode" for a in assignments):
            assignments.append({
                "id": f"fix2-cardcode-{nid[:8]}",
                "name": "CardCode",
                "type": "string",
                "value": "={{ $json.codigo_pn || \"\" }}"
            })
            changes.append(f"{label}: adicionado CardCode")

        # Add Address if not present
        if not any(a["name"] == "Address" for a in assignments):
            assignments.append({
                "id": f"fix2-address-{nid[:8]}",
                "name": "Address",
                "type": "string",
                "value": address
            })
            changes.append(f"{label}: adicionado Address={address}")

        # Add LineNum if not present
        if not any(a["name"] == "LineNum" for a in assignments):
            assignments.append({
                "id": f"fix2-linenum-{nid[:8]}",
                "name": "LineNum",
                "type": "string",
                "value": line_num
            })
            changes.append(f"{label}: adicionado LineNum={line_num}")

        # Enable includeOtherFields
        opts = p.setdefault("options", {})
        if not opts.get("includeOtherFields"):
            opts["includeOtherFields"] = True
            changes.append(f"{label}: includeOtherFields = True")

if not changes:
    print("Nenhuma mudança necessária.")
    sys.exit(0)

print(f"\nMudanças a aplicar ({len(changes)}):")
for c in changes:
    print(f"  • {c}")

# Apply via PUT
print("\nAplicando via API PUT...")
result = api_put(f"/workflows/{WF_ID}", {
    "name": wf["name"],
    "nodes": nodes,
    "connections": wf["connections"],
    "settings": wf.get("settings", {}),
})
print(f"OK! Workflow atualizado: {result.get('name')} (id: {result.get('id')})")
