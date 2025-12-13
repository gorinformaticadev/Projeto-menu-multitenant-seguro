<?php
/**
 * WhatsBoost Routes Tester
 * Verifica se todas as rotas principais estão acessíveis
 */

echo "=== WhatsBoost Routes Test ===\n\n";

// Definir rotas principais
$routes = [
    'connect_account' => 'index.php/whatsboost/connect_account',
    'interaction' => 'index.php/whatsboost/interaction',
    'templates' => 'index.php/whatsboost/templates',
    'bot_flow' => 'index.php/whatsboost/bot_flow',
    'campaigns' => 'index.php/whatsboost/campaigns',
    'csv_campaigns' => 'index.php/whatsboost/csv_campaigns',
    'settings' => 'index.php/whatsboost/settings',
    'activity_log' => 'index.php/whatsboost/activity_log',
    'ai_prompts' => 'index.php/whatsboost/ai_prompts',
    'canned_reply' => 'index.php/whatsboost/canned_reply',
];

// Verificar Controllers
echo "1. Verificando Controllers:\n";
$controllerPath = __DIR__ . '/Controllers/';
$controllers = glob($controllerPath . '*.php');

foreach ($controllers as $controller) {
    $name = basename($controller);
    $syntax = shell_exec("php -l " . escapeshellarg($controller) . " 2>&1");
    $status = strpos($syntax, 'No syntax errors') !== false ? '✅' : '❌';
    echo "   {$status} {$name}\n";
}

echo "\n2. Verificando Views:\n";
$viewPath = __DIR__ . '/Views/';
$views = glob($viewPath . '*.php');

foreach ($views as $view) {
    $name = basename($view);
    $syntax = shell_exec("php -l " . escapeshellarg($view) . " 2>&1");
    $status = strpos($syntax, 'No syntax errors') !== false ? '✅' : '❌';
    echo "   {$status} {$name}\n";
}

echo "\n3. Verificando Assets JavaScript:\n";
$jsPath = __DIR__ . '/assets/js/';
$jsFiles = [
    'whatsboost.bundle.js',
    'vueflow.bundle.js',
    'vue.min.js'
];

foreach ($jsFiles as $jsFile) {
    $filePath = $jsPath . $jsFile;
    if (file_exists($filePath)) {
        $size = filesize($filePath);
        $sizeKB = round($size / 1024, 2);

        // Verificar se contém validação ATIVA (não comentada)
        $content = file_get_contents($filePath);

        // Procurar por padrões de validação ativa (não em comentários)
        $hasActiveLicFetch = preg_match('/fetch\([^)]*\.lic[^)]*\)/', $content);
        $hasActiveSessionStorage = preg_match('/sessionStorage\.(get|set)Item\([^)]*\.lic/', $content);
        $hasActiveValidation = ($hasActiveLicFetch || $hasActiveSessionStorage);

        // Verificar se há mensagem de bypass
        $hasBypassMessage = strpos($content, 'License validation bypassed') !== false;

        if ($hasActiveValidation) {
            echo "   ⚠️  {$jsFile} ({$sizeKB}KB) - CONTÉM VALIDAÇÃO ATIVA!\n";
        } elseif ($hasBypassMessage) {
            echo "   ✅ {$jsFile} ({$sizeKB}KB) - Validação removida\n";
        } else {
            echo "   ✅ {$jsFile} ({$sizeKB}KB)\n";
        }
    } else {
        echo "   ❌ {$jsFile} - NOT FOUND\n";
    }
}

echo "\n4. Verificando Config/Routes.php:\n";
$routesFile = __DIR__ . '/Config/Routes.php';
if (file_exists($routesFile)) {
    $syntax = shell_exec("php -l " . escapeshellarg($routesFile) . " 2>&1");
    $status = strpos($syntax, 'No syntax errors') !== false ? '✅' : '❌';
    echo "   {$status} Routes.php\n";

    // Contar rotas definidas
    $content = file_get_contents($routesFile);
    preg_match_all('/\$routes->/', $content, $matches);
    $routeCount = count($matches[0]);
    echo "   ℹ️  Total de rotas definidas: {$routeCount}\n";
} else {
    echo "   ❌ Routes.php - NOT FOUND\n";
}

echo "\n5. Verificando index.php (validações removidas):\n";
$indexFile = __DIR__ . '/index.php';
if (file_exists($indexFile)) {
    $content = file_get_contents($indexFile);

    $checks = [
        'Apiinit::the_da_vinci_code' => strpos($content, '// Apiinit::the_da_vinci_code') !== false,
        'Apiinit::ease_of_mind' => strpos($content, '// Apiinit::ease_of_mind') !== false,
        'app_hook_before_app_access' => strpos($content, '// app_hooks()->add_action(\'app_hook_before_app_access\'') !== false,
        'wb_g empty' => strpos($content, 'var wb_g = "";') !== false,
        'wb_b empty' => strpos($content, 'var wb_b = "";') !== false,
    ];

    foreach ($checks as $check => $result) {
        $status = $result ? '✅' : '❌';
        echo "   {$status} {$check} " . ($result ? 'comentado/vazio' : 'AINDA ATIVO!') . "\n";
    }
}

echo "\n6. Resumo das Rotas Principais:\n";
foreach ($routes as $name => $route) {
    echo "   📍 {$name}: {$route}\n";
}

echo "\n=== Teste Completo ===\n";
echo "\n⚠️  IMPORTANTE: Para testar acesso real às rotas,\n";
echo "   acesse-as pelo navegador e verifique:\n";
echo "   - Tela não está branca\n";
echo "   - Console não mostra erros (F12)\n";
echo "   - Mensagem 'License validation bypassed' aparece\n";
