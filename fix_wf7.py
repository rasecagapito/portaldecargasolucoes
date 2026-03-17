"""
Fix 7: Corrige autenticação nos nós HTTP SAP

Problemas:
1. Login SAP B: sem fullResponse → SL • Save Session1 não recebe Set-Cookie → ROUTEID vazio
2. HTTP • Check BP (GET)1: sem header Cookie → 401 Unauthorized
3. HTTP • Create BP Post: sem header Cookie → mesma falha futura

Fixes:
- Login SAP B: options.response.response.fullResponse = true
- HTTP • Check BP (GET)1 e HTTP • Create BP Post:
    sendHeaders = true
    headerParameters com Cookie = {{ $('SL • Build Cookie1').first().json.cookie }}
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

COOKIE_EXPR = "={{ $('SL • Build Cookie1').first().json.cookie }}"

for n in nodes:
    name = n.get("name", "")
    p = n.setdefault("parameters", {})

    # Fix 1: Login SAP B — habilitar fullResponse para capturar Set-Cookie
    if name == "Login SAP B":
        opts = p.setdefault("options", {})
        resp = opts.setdefault("response", {}).setdefault("response", {})
        if not resp.get("fullResponse"):
            resp["fullResponse"] = True
            resp["responseFormat"] = "json"
            changes.append("Login SAP B: fullResponse = true (captura Set-Cookie/ROUTEID)")

    # Fix 2: Nós HTTP SAP autenticados — adicionar header Cookie
    if name in ("HTTP • Check BP (GET)1", "HTTP • Create BP Post"):
        if not p.get("sendHeaders"):
            p["sendHeaders"] = True
            p["headerParameters"] = {
                "parameters": [
                    {
                        "name": "Cookie",
                        "value": COOKIE_EXPR
                    }
                ]
            }
            changes.append(f"{name}: adicionado header Cookie")

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
