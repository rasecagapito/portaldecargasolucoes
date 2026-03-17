"""
Fix 3: Aplica correções no workflow n8n
- Merge Junção CRD1+OCNA: joinMode keepNonMatches → enrichInput1 (left join)
- CRD1 • Montar Cobranca: add includeOtherFields + assignments de endereço
- CRD1 • Montar Entrega:  add includeOtherFields + assignments de endereço
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

# Endereço assignments comuns aos dois nós CRD1
ADDRESS_COMMON = [
    {"name": "Street",   "value": "={{ ($json.body || {}).logradouro || '' }}"},
    {"name": "City",     "value": "={{ ($json.body || {}).municipio || '' }}"},
    {"name": "State",    "value": "={{ ($json.body || {}).uf || '' }}"},
    {"name": "ZipCode",  "value": "={{ ($json.body || {}).cep || '' }}"},
    {"name": "StreetNo", "value": "={{ ($json.body || {}).numero || '' }}"},
    {"name": "Block",    "value": "={{ ($json.body || {}).bairro || '' }}"},
    {"name": "Building", "value": "={{ ($json.body || {}).complemento || '' }}"},
]

CRD1_FIXES = {
    "7bef75a9-43a8-4913-b57a-49970bcccf11": ("CRD1 • Montar Cobranca", "Cobranca", "bo_BillTo"),
    "c75c4567-3c47-4fcc-84a4-b13b48436490": ("CRD1 • Montar Entrega",  "Entrega",  "bo_ShipTo"),
}

for n in nodes:
    nid = n.get("id")

    # Fix A — Merge Junção CRD1+OCNA: keepNonMatches → enrichInput1
    if nid == "84de2a09-3e29-4407-9b2f-570160e3dd88":
        p = n.setdefault("parameters", {})
        old_mode = p.get("joinMode")
        if old_mode != "enrichInput1":
            p["joinMode"] = "enrichInput1"
            p.pop("outputDataFrom", None)
            changes.append(f"Merge Junção CRD1+OCNA: joinMode {old_mode!r} → 'enrichInput1' (outputDataFrom removido)")

    # Fix B/C — CRD1 • Montar Cobranca / Entrega
    if nid in CRD1_FIXES:
        label, address_val, adres_type = CRD1_FIXES[nid]
        p = n.setdefault("parameters", {})
        assignments = p.setdefault("assignments", {}).setdefault("assignments", [])

        # includeOtherFields
        opts = p.setdefault("options", {})
        if not opts.get("includeOtherFields"):
            opts["includeOtherFields"] = True
            changes.append(f"{label}: includeOtherFields = True")

        # Address e AdresType específicos deste nó
        node_specific = [
            {"name": "Address",   "value": address_val},
            {"name": "AdresType", "value": adres_type},
        ]

        for a in ADDRESS_COMMON + node_specific:
            if not any(x["name"] == a["name"] for x in assignments):
                assignments.append({
                    "id": f"fix3-{a['name'].lower()}-{nid[:8]}",
                    "name": a["name"],
                    "type": "string",
                    "value": a["value"],
                })
                changes.append(f"{label}: adicionado {a['name']}={a['value'][:40]}")

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
