<?php
// Script de debug para WhatsBoost
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== WhatsBoost Debug Test ===\n\n";

// 1. Verificar se arquivo index.php existe
$index_file = __DIR__ . '/index.php';
echo "1. Index.php existe: " . (file_exists($index_file) ? "SIM" : "NAO") . "\n";

// 2. Verificar sintaxe
if (file_exists($index_file)) {
    $output = shell_exec("php -l $index_file 2>&1");
    echo "2. Sintaxe PHP: " . (strpos($output, 'No syntax errors') !== false ? "OK" : "ERRO") . "\n";
    if (strpos($output, 'No syntax errors') === false) {
        echo "   Erro: $output\n";
    }
}

// 3. Verificar Controllers
$controller_file = __DIR__ . '/Controllers/WhatsBoostController.php';
echo "3. Controller existe: " . (file_exists($controller_file) ? "SIM" : "NAO") . "\n";

// 4. Verificar Views
$view_file = __DIR__ . '/Views/connect_account.php';
echo "4. View connect_account existe: " . (file_exists($view_file) ? "SIM" : "NAO") . "\n";

// 5. Verificar Routes
$routes_file = __DIR__ . '/Config/Routes.php';
echo "5. Routes.php existe: " . (file_exists($routes_file) ? "SIM" : "NAO") . "\n";

// 6. Verificar helpers
$helper_file = __DIR__ . '/Helpers/whatsboost_helper.php';
echo "6. Helper existe: " . (file_exists($helper_file) ? "SIM" : "NAO") . "\n";
if (file_exists($helper_file)) {
    $output = shell_exec("php -l $helper_file 2>&1");
    echo "   Sintaxe Helper: " . (strpos($output, 'No syntax errors') !== false ? "OK" : "ERRO") . "\n";
}

// 7. Verificar assets JS
$js_file = __DIR__ . '/assets/js/whatsboost.bundle.js';
echo "7. JS Bundle existe: " . (file_exists($js_file) ? "SIM (" . filesize($js_file) . " bytes)" : "NAO") . "\n";

// 8. Listar arquivos modificados
echo "\n8. Arquivos modificados:\n";
$modified_files = [
    'index.php',
    'install/do_install.php',
    'Helpers/whatsboost_helper.php'
];
foreach ($modified_files as $file) {
    $full_path = __DIR__ . '/' . $file;
    if (file_exists($full_path)) {
        echo "   - $file: " . date('Y-m-d H:i:s', filemtime($full_path)) . "\n";
    }
}

echo "\n=== Teste Completo ===\n";
