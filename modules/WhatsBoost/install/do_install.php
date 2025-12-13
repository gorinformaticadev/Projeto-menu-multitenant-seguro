<?php

// Comentado: Validação de compra removida
// require_once __DIR__ . '/../Libraries/Apiinit.php';
// use WhatsBoost\Libraries\Apiinit;

ini_set('max_execution_time', 300); //300 seconds

$product = 'WhatsBoost';

// Comentado: Processo de validação do código de compra removido
// $return = Apiinit::pre_validate($product, $item_purchase_code);
// if (!$return['status']) {
//     echo json_encode(['success' => false, 'message' => $return['message']]);
//     exit();
// }

// Comentado: Validação de código de compra removida
// if (!(isset($item_purchase_code) && $item_purchase_code)) {
//     echo json_encode(['success' => false, 'message' => 'Please enter a valid purchase code.']);
//     exit();
// }

// to enable emoji option we require utf8mb4
$db_file_path = APPPATH . "Config/Database.php";
$db_file = file_get_contents($db_file_path);
$db_file = preg_replace('/\butf8\b/', 'utf8mb4', $db_file);
$db_file = preg_replace('/\butf8_general_ci\b/', 'utf8mb4_general_ci', $db_file);
file_put_contents($db_file_path, $db_file);

$db = db_connect('default');
$dbPrefix = get_db_prefix();

if (!$db->tableExists($dbPrefix . 'wb_bot')) {
    $sql_query = 'CREATE TABLE IF NOT EXISTS `' . $dbPrefix . 'wb_bot` (
            `id` int NOT NULL AUTO_INCREMENT,
            `name` varchar(255) NOT NULL,
            `rel_type` varchar(50) NOT NULL,
            `reply_text` text NOT NULL,
            `reply_type` int NOT NULL,
            `trigger` varchar(255) NOT NULL,
            `bot_header` varchar(65) DEFAULT NULL,
            `bot_footer` varchar(65) DEFAULT NULL,
            `button1` varchar(25) DEFAULT NULL,
            `button1_id` varchar(258) DEFAULT NULL,
            `button2` varchar(25) DEFAULT NULL,
            `button2_id` varchar(258) DEFAULT NULL,
            `button3` varchar(25) DEFAULT NULL,
            `button3_id` varchar(258) DEFAULT NULL,
            `button_name` varchar(25) DEFAULT NULL,
            `button_url` varchar(255) DEFAULT NULL,
            `filename` text DEFAULT NULL,
            `addedfrom` int NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `is_bot_active` tinyint(1) NOT NULL DEFAULT "1",
            `sending_count` int DEFAULT "0",
          PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;';
    $db->query($sql_query);
}

if (!$db->tableExists($dbPrefix . 'wb_templates')) {
    $sql_query = 'CREATE TABLE IF NOT EXISTS `' . $dbPrefix . 'wb_templates` (
       `id` INT NOT NULL AUTO_INCREMENT ,
        `template_id` BIGINT UNSIGNED NOT NULL COMMENT "id from api" ,
        `template_name` VARCHAR(255) NOT NULL ,
        `language` VARCHAR(50) NOT NULL ,
        `status` VARCHAR(50) NOT NULL ,
        `category` VARCHAR(100) NOT NULL ,
        `header_data_format` VARCHAR(10) NOT NULL ,
        `header_data_text` TEXT ,
        `header_params_count` INT NOT NULL ,
        `body_data` TEXT NOT NULL ,
        `body_params_count` INT NOT NULL ,
        `footer_data` TEXT,
        `footer_params_count` INT NOT NULL ,
        `buttons_data` VARCHAR(255) NOT NULL ,
       PRIMARY KEY (`id`),
       UNIQUE KEY `template_id` (`template_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;';
    $db->query($sql_query);
}

if (!$db->tableExists($dbPrefix . 'wb_campaigns')) {
    $sql_query = 'CREATE TABLE IF NOT EXISTS `' . $dbPrefix . 'wb_campaigns` (
        `id` int NOT NULL AUTO_INCREMENT,
        `name` varchar(100) NOT NULL,
        `rel_type` varchar(50) NOT NULL,
        `template_id` int DEFAULT NULL,
        `scheduled_send_time` timestamp NULL DEFAULT NULL,
        `send_now` tinyint NOT NULL DEFAULT "0",
        `header_params` text,
        `body_params` text,
        `footer_params` text,
        `filename` text DEFAULT NULL,
        `pause_campaign` tinyint(1) NOT NULL DEFAULT "0",
        `select_all` tinyint(1) NOT NULL DEFAULT "0",
        `trigger` varchar(191) DEFAULT NULL,
        `bot_type` int NOT NULL DEFAULT 0,
        `is_bot_active` int NOT NULL DEFAULT 1,
        `is_bot` int NOT NULL DEFAULT 0,
        `is_sent` tinyint(1) NOT NULL DEFAULT "0",
        `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `sending_count` int DEFAULT "0",
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;';
    $db->query($sql_query);
}

if (!$db->tableExists($dbPrefix . 'wb_campaign_data')) {
    $sql_query = 'CREATE TABLE IF NOT EXISTS `' . $dbPrefix . 'wb_campaign_data` (
        `id` int NOT NULL AUTO_INCREMENT,
        `campaign_id` int NOT NULL,
        `rel_id` int DEFAULT NULL,
        `rel_type` varchar(50) NOT NULL,
        `header_message` text DEFAULT NULL,
        `body_message` text DEFAULT NULL,
        `footer_message` text DEFAULT NULL,
        `status` int DEFAULT NULL,
        `response_message` TEXT NULL DEFAULT NULL,
        `whatsapp_id` TEXT NULL DEFAULT NULL,
        `message_status` varchar(25) NULL DEFAULT NULL,
        `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;';
    $db->query($sql_query);
}

if (!$db->tableExists($dbPrefix . 'wb_activity_log')) {
    $sql_query = 'CREATE TABLE IF NOT EXISTS `' . $dbPrefix . 'wb_activity_log` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `phone_number_id` varchar(255) NULL DEFAULT NULL,
        `access_token` TEXT NULL DEFAULT NULL,
        `business_account_id` varchar(255) NULL DEFAULT NULL,
        `response_code` varchar(4) NOT NULL,
        `response_data` text NOT NULL,
        `category` varchar(50) NOT NULL,
        `category_id` int(11) NOT NULL,
        `rel_type` varchar(50) NOT NULL,
        `rel_id` int(11) NOT NULL,
        `category_params` longtext NOT NULL,
        `raw_data` TEXT NOT NULL,
        `recorded_at` datetime NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;';
    $db->query($sql_query);
}

if (!$db->tableExists($dbPrefix . 'wb_interactions')) {
    $sql_query = 'CREATE TABLE IF NOT EXISTS `' . $dbPrefix . 'wb_interactions` (
        `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
        `name` VARCHAR(100) NOT NULL,
        `receiver_id` VARCHAR(20) NOT NULL,
        `last_message` TEXT NULL COLLATE utf8mb4_general_ci,
        `last_msg_time` DATETIME NULL,
        `wa_no` VARCHAR(20) NULL,
        `wa_no_id` VARCHAR(20) NULL,
        `time_sent` DATETIME NOT NULL,
        `type` VARCHAR(500) NULL,
        `type_id` VARCHAR(500) NULL,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;';
    $db->query($sql_query);
}

if (!$db->tableExists($dbPrefix . 'wb_interaction_messages')) {
    $sql_query = 'CREATE TABLE IF NOT EXISTS `' . $dbPrefix . 'wb_interaction_messages` (
        `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
        `interaction_id` INT(11) UNSIGNED NOT NULL,
        `sender_id` VARCHAR(20) NOT NULL,
        `url` VARCHAR(255) NULL,
        `message` LONGTEXT NOT NULL COLLATE utf8mb4_general_ci,
        `status` VARCHAR(20) NULL,
        `time_sent` DATETIME NOT NULL,
        `message_id` TEXT NULL DEFAULT NULL,
        `staff_id` INT(11) NULL,
        `type` VARCHAR(20) NULL,
        `is_read` TINYINT(1) NOT NULL DEFAULT "0",
        PRIMARY KEY (`id`),
        FOREIGN KEY (`interaction_id`) REFERENCES `' . $dbPrefix . 'wb_interactions`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;';
    $db->query($sql_query);
}

if (!$db->tableExists($dbPrefix . 'wb_canned_reply')) {
    $sql_query = 'CREATE TABLE `' . $dbPrefix . 'wb_canned_reply` (
        `id` INT NOT NULL AUTO_INCREMENT,
        `title` VARCHAR(255) NOT NULL,
        `description` TEXT NOT NULL,
        `is_public` TINYINT(1) NOT NULL DEFAULT 0,
        `added_from` INT NOT NULL,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;';
    $db->query($sql_query);
}


// v1.1.0
if (!$db->tableExists($dbPrefix . 'wb_custom_prompts')) {
    $sql_query = 'CREATE TABLE IF NOT EXISTS `' . $dbPrefix . 'wb_custom_prompts` (
        `id` int NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        `action` text NOT NULL,
        `added_from` int NOT NULL,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;';
    $db->query($sql_query);
}

if ($db->tableExists($dbPrefix . 'wb_interaction_messages')) {
    if (!$db->fieldExists('ref_message_id', $dbPrefix . 'wb_interaction_messages')) {
        $db->query('ALTER TABLE `' . $dbPrefix . 'wb_interaction_messages` ADD `ref_message_id` TEXT NULL');
    }
}

if ($db->tableExists($dbPrefix . 'wb_interactions')) {
    if (!$db->fieldExists('agent', $dbPrefix . 'wb_interactions')) {
        $db->query("ALTER TABLE `" . $dbPrefix . "wb_interactions` ADD `agent` TEXT NULL ;");
    }
}

// Comentado: Criação de arquivo de licença removida
// helper(['filesystem']);
// $settingsModel = model("App\Models\Settings_model");
// $content = (!empty($settingsModel->get_setting('WhatsBoost_product_token')) && !empty($settingsModel->get_setting('WhatsBoost_verification_id'))) ? hash_hmac('sha512', $settingsModel->get_setting('WhatsBoost_product_token'), $settingsModel->get_setting('WhatsBoost_verification_id')) : '';
// write_file(FCPATH . config('App')->temp_file_path . basename(get_plugin_meta_data('WhatsBoost')['plugin_url']) . '.lic', $content);

// v1.2.0
if (!$db->tableExists($dbPrefix . 'wb_bot_flow')) {
    $sql_query = 'CREATE TABLE IF NOT EXISTS `' . $dbPrefix . 'wb_bot_flow` (
        `id` int NOT NULL AUTO_INCREMENT,
        `flow_data` longtext NOT NULL,
        `flow_name` varchar(50) NOT NULL,
        `is_active` tinyint(1) DEFAULT "1",
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;';
    $db->query($sql_query);
}
