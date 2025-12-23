/**
 * Script para debugar problemas com inputs no formulário de empresas
 * Execute este script no console do navegador na página de empresas
 */

console.log("🔍 Iniciando debug dos inputs do formulário de empresas");

// Função para testar todos os inputs
function debugInputs() {
    console.log("\n📝 Testando inputs do formulário:");
    
    const inputs = document.querySelectorAll('input');
    console.log(`Total de inputs encontrados: ${inputs.length}`);
    
    inputs.forEach((input, index) => {
        console.log(`\nInput ${index + 1}:`);
        console.log(`- ID: ${input.id}`);
        console.log(`- Name: ${input.name}`);
        console.log(`- Type: ${input.type}`);
        console.log(`- Disabled: ${input.disabled}`);
        console.log(`- ReadOnly: ${input.readOnly}`);
        console.log(`- Value: "${input.value}"`);
        console.log(`- Placeholder: "${input.placeholder}"`);
        
        // Testa se consegue focar
        try {
            input.focus();
            console.log(`- Pode focar: ✅`);
        } catch (e) {
            console.log(`- Pode focar: ❌ (${e.message})`);
        }
        
        // Testa se consegue alterar valor
        const originalValue = input.value;
        try {
            input.value = 'teste';
            if (input.value === 'teste') {
                console.log(`- Pode alterar valor: ✅`);
                input.value = originalValue; // Restaura valor original
            } else {
                console.log(`- Pode alterar valor: ❌ (valor não mudou)`);
            }
        } catch (e) {
            console.log(`- Pode alterar valor: ❌ (${e.message})`);
        }
        
        // Verifica estilos CSS
        const styles = window.getComputedStyle(input);
        console.log(`- Pointer Events: ${styles.pointerEvents}`);
        console.log(`- Display: ${styles.display}`);
        console.log(`- Visibility: ${styles.visibility}`);
        console.log(`- Z-Index: ${styles.zIndex}`);
    });
}

// Função para verificar se há overlays bloqueando
function checkOverlays() {
    console.log("\n🔍 Verificando overlays que podem estar bloqueando:");
    
    const inputs = document.querySelectorAll('input');
    inputs.forEach((input, index) => {
        const rect = input.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const elementAtPoint = document.elementFromPoint(centerX, centerY);
        
        console.log(`Input ${index + 1}:`);
        console.log(`- Posição: ${rect.left}, ${rect.top}`);
        console.log(`- Elemento no centro: ${elementAtPoint?.tagName} (${elementAtPoint?.className})`);
        console.log(`- É o próprio input: ${elementAtPoint === input ? '✅' : '❌'}`);
    });
}

// Função para forçar habilitar inputs
function forceEnableInputs() {
    console.log("\n🔧 Forçando habilitação de todos os inputs:");
    
    const inputs = document.querySelectorAll('input');
    inputs.forEach((input, index) => {
        input.disabled = false;
        input.readOnly = false;
        console.log(`Input ${index + 1} habilitado`);
    });
    
    console.log("✅ Todos os inputs foram habilitados. Tente digitar agora!");
}

// Função para verificar event listeners
function checkEventListeners() {
    console.log("\n👂 Verificando event listeners:");
    
    const inputs = document.querySelectorAll('input');
    inputs.forEach((input, index) => {
        console.log(`Input ${index + 1}:`);
        
        // Adiciona listeners temporários para teste
        const testListeners = {
            focus: () => console.log(`  - Focus event triggered`),
            blur: () => console.log(`  - Blur event triggered`),
            input: (e) => console.log(`  - Input event triggered: "${e.target.value}"`),
            change: (e) => console.log(`  - Change event triggered: "${e.target.value}"`),
            keydown: (e) => console.log(`  - Keydown event triggered: ${e.key}`),
        };
        
        Object.entries(testListeners).forEach(([event, handler]) => {
            input.addEventListener(event, handler);
        });
        
        console.log(`  - Event listeners adicionados para teste`);
    });
}

// Função para verificar React
function checkReact() {
    console.log("\n⚛️ Verificando React:");
    
    // Verifica se há React DevTools
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        console.log("✅ React DevTools detectado");
    } else {
        console.log("❌ React DevTools não detectado");
    }
    
    // Verifica se há componentes React
    const reactElements = document.querySelectorAll('[data-reactroot], [data-react-checksum]');
    console.log(`Elementos React encontrados: ${reactElements.length}`);
    
    // Verifica se há erros no console
    const errors = [];
    const originalError = console.error;
    console.error = function(...args) {
        errors.push(args.join(' '));
        originalError.apply(console, args);
    };
    
    setTimeout(() => {
        console.error = originalError;
        if (errors.length > 0) {
            console.log("❌ Erros encontrados:");
            errors.forEach(error => console.log(`  - ${error}`));
        } else {
            console.log("✅ Nenhum erro detectado");
        }
    }, 1000);
}

// Executa todos os testes
console.log("🚀 Executando todos os testes...");
debugInputs();
checkOverlays();
checkReact();

// Disponibiliza funções globalmente para uso manual
window.debugInputs = debugInputs;
window.checkOverlays = checkOverlays;
window.forceEnableInputs = forceEnableInputs;
window.checkEventListeners = checkEventListeners;
window.checkReact = checkReact;

console.log("\n✅ Debug concluído!");
console.log("💡 Funções disponíveis:");
console.log("- debugInputs() - Testa todos os inputs");
console.log("- checkOverlays() - Verifica overlays bloqueando");
console.log("- forceEnableInputs() - Força habilitação dos inputs");
console.log("- checkEventListeners() - Adiciona listeners de teste");
console.log("- checkReact() - Verifica estado do React");

console.log("\n🔧 Se os inputs não funcionarem, tente:");
console.log("1. forceEnableInputs()");
console.log("2. Recarregue a página");
console.log("3. Verifique se há erros no console");
console.log("4. Teste em modo incógnito");