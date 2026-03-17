"""
Fix 5: Corrige merges (OCRD payload + CRD1) e (OCRD payload + CRD1) + CRD7

Problema:
- Ambos usam mode=combine + fieldsToMatchString="CardCode" (inner join)
- CRD1 Agrupar gera campo "codigo_pn", não "CardCode" → join falha → 0 items
- OCRD payload tem CardCode="" enquanto CRD1 tem codigo_pn="C00001"

Fix: trocar para mergeByPosition (merge por posição)
- Cada input tem exatamente 1 item por CNPJ processado
- Posição é confiável e evita dependência de nome/valor de campo
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
    "d4f875be-0eea-4f60-9b9d-8896e55443a6": "(OCRD payload + CRD1)",
    "f2485852-2ed4-47c0-a66a-11265c1649b2": "(OCRD payload + CRD1) + CRD7",
}

for n in nodes:
    nid = n.get("id")
    if nid not in TARGET_IDS:
        continue

    label = TARGET_IDS[nid]
    p = n.setdefault("parameters", {})

    old_mode = p.get("mode")
    old_combine = p.get("combineMode") or p.get("joinMode") or "(inner join por campo)"

    # Trocar para mergeByPosition
    p["mode"] = "combine"
    p["combineMode"] = "mergeByPosition"
    # Remover parâmetros do inner join que não se aplicam
    p.pop("fieldsToMatchString", None)
    p.pop("joinMode", None)
    p.pop("outputDataFrom", None)

    changes.append(f"{label}: {old_mode}/{old_combine} → combine/mergeByPosition")

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
