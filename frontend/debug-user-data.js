/**
 * Script de debug para verificar os dados do usuário no contexto de autenticação
 */

console.log("🔍 Debug dos Dados do Usuário");
console.log("============================");

console.log("\n📋 Verificações a fazer:");
console.log("1. Abra o DevTools do navegador (F12)");
console.log("2. Vá para a aba Console");
console.log("3. Faça login no sistema");
console.log("4. Execute os comandos abaixo no console:");

console.log("\n🔧 Comandos para Debug:");
console.log("// 1. Verificar se há token no localStorage");
console.log("localStorage.getItem('@App:token')");

console.log("\n// 2. Verificar dados do usuário no contexto React");
console.log("// (Adicione temporariamente no TopBar.tsx)");
console.log("console.log('User data:', user);");
console.log("console.log('User tenant:', user?.tenant);");

console.log("\n// 3. Testar chamada direta para /auth/me");
console.log(`fetch('/api/auth/me', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('@App:token')
  }
}).then(r => r.json()).then(console.log)`);

console.log("\n🎯 O que verificar:");
console.log("✅ Token existe no localStorage");
console.log("✅ user.tenant existe e tem nomeFantasia");
console.log("✅ user.tenantId não é null");
console.log("✅ Endpoint /auth/me retorna tenant");

console.log("\n🔧 Possíveis problemas:");
console.log("❌ Token expirado ou inválido");
console.log("❌ Usuário SUPER_ADMIN (não tem tenant)");
console.log("❌ Cache do contexto não atualizado");
console.log("❌ Endpoint /auth/me não inclui tenant");

console.log("\n🛠️ Soluções:");
console.log("1. Fazer logout e login novamente");
console.log("2. Limpar localStorage e cookies");
console.log("3. Verificar se o backend está rodando");
console.log("4. Testar com usuário que tem tenant (não SUPER_ADMIN)");

console.log("\n📝 Dados esperados do usuário:");
console.log(`{
  id: "uuid",
  email: "admin@empresa1.com",
  name: "Admin da Empresa", 
  role: "ADMIN",
  tenantId: "uuid-do-tenant",
  tenant: {
    id: "uuid-do-tenant",
    nomeFantasia: "GOR Informatica",
    cnpjCpf: "12345678901234",
    telefone: "(11) 98765-4321"
  }
}`);

console.log("\n✅ Para testar:");
console.log("1. Login com: admin@empresa1.com / admin123");
console.log("2. Verificar se 'GOR Informatica' aparece no menu");
console.log("3. Se não aparecer, executar debug no console");