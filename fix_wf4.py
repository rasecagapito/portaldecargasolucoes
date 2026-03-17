"""
Fix 4: Adiciona codigo_pn como assignment explícito nos nós CRD1 Montar
Motivo: includeOtherFields não está passando o campo, mesmo configurado.
Nós afetados:
- CRD1 • Montar Cobranca (id: 7bef75a9-43a8-4913-b57a-49970bcccf11)
- CRD1 • Montar Entrega  (id: c75c4567-3c47-4fcc-84a4-b13b48436490)
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

print("Buscando workflow...")
wf = api_get(f"/workflows/{WF_ID}")
nodes = wf["nodes"]

changes = []

TARGET_IDS = {
    "7bef75a9-43a8-4913-b57a-49970bcccf11": "CRD1 • Montar Cobranca",
    "c75c4567-3c47-4fcc-84a4-b13b48436490": "CRD1 • Montar Entrega",
}

for n in nodes:
    nid = n.get("id")
    if nid not in TARGET_IDS:
        continue

    label = TARGET_IDS[nid]
    p = n.setdefault("parameters", {})
    assignments = p.setdefault("assignments", {}).setdefault("assignments", [])

    if not any(a["name"] == "codigo_pn" for a in assignments):
        assignments.append({
            "id": f"fix4-codigopn-{nid[:8]}",
            "name": "codigo_pn",
            "type": "string",
            "value": "={{ $json.codigo_pn || '' }}",
        })
        changes.append(f"{label}: adicionado codigo_pn explícito")

if not changes:
    print("Nenhuma mudança necessária.")
    sys.exit(0)

print(f"\nMudanças a aplicar ({len(changes)}):")
for c in changes:
    print(f"  • {c}")

print("\nAplicando via API PUT...")
result = api_put(f"/workflows/{WF_ID}", {
    "name": wf["name"],
    "nodes": nodes,
    "connections": wf["connections"],
    "settings": wf.get("settings", {}),
})
print(f"OK! Workflow atualizado: {result.get('name')} (id: {result.get('id')})")
