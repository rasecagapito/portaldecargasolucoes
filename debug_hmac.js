const crypto = require('crypto');

// Payload de teste do usuário
const payload = {
  "id": "teste-123",
  "tenant_id": "a0000000-0000-0000-0000-000000000001",
  "status": "success",
  "result": { "message": "Teste concluído" },
  "entity_type": "carga"
};

const secret = "minha-chave-secreta-teste"; // Simulação da N8N_WEBHOOK_SECRET
const body = JSON.stringify(payload);

// Geração da assinatura (Lógica do n8n)
const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

console.log("--- DEBUG HMAC ---");
console.log("Payload:", body);
console.log("Secret:", secret);
console.log("Signature (Hex):", signature);

// Simulação da validação (Lógica da Edge Function)
function verifyHmac(secret, payload, signature) {
  const computedHex = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return computedHex === signature;
}

const isValid = verifyHmac(secret, body, signature);
console.log("Assinatura é válida?", isValid ? "SIM" : "NÃO");
