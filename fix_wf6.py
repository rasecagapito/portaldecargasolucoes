"""
Fix 6: Corrige parâmetro de merge por posição nos nós (OCRD payload + CRD1) e + CRD7

Fix 5 usou combineMode: "mergeByPosition" (errado).
O parâmetro correto no n8n 3.2 é combineBy: "combineByPosition"
(confirmado nos nós MERGE (Entrada + Resposta), Juncao OCNT+CRD1, etc.)
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
    p = n["parameters"] = {
        "mode": "combine",
        "combineBy": "combineByPosition",
        "options": {}
    }
    changes.append(f"{label}: parâmetros → combineBy=combineByPosition")

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
