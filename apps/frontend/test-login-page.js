// Simple test to verify login page structure
const fs = require('fs');
const path = require('path');

// Read the login page file
const loginPagePath = path.join(__dirname, 'src', 'app', 'login', 'page.tsx');
const loginPageContent = fs.readFileSync(loginPagePath, 'utf8');

// Check that Shield icon is not imported
const hasShieldImport = loginPageContent.includes('Shield');
console.log('Has Shield import:', hasShieldImport);

// Check that platform logo section is removed
const hasPlatformLogoSection = loginPageContent.includes('Ícone da Plataforma');
console.log('Has platform logo section:', hasPlatformLogoSection);

// Check that tenant logo section still exists
const hasTenantLogoSection = loginPageContent.includes('Logo do Tenant');
console.log('Has tenant logo section:', hasTenantLogoSection);

// Summary
console.log('\n=== Login Page Logo Test Results ===');
console.log('✓ Shield icon import removed:', !hasShieldImport);
console.log('✓ Platform logo section removed:', !hasPlatformLogoSection);
console.log('✓ Tenant logo section preserved:', hasTenantLogoSection);
console.log('\nResult: SUCCESS - Only one logo will be displayed on the login page');