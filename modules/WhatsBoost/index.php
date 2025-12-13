<?php

defined('PLUGINPATH') or exit('No direct script access allowed');

use App\Models\Settings_model;
use Config\Database;

/*
  Plugin Name: WhatsBoost
  Description: Elevate your customer relationship management and streamline your communication strategy with the power of WhatsApp
  Plugin URL: https://codecanyon.net/item/whatsboost-whatsapp-marketing-bot-chat-plugin-for-rise-crm/53315437
  Version: 1.2.0
  Requires at least: 3.4.0
  Author: Corbital Technologies
  Author URL: https://codecanyon.net/user/corbitaltech
 */

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/Libraries/Apiinit.php';

use WhatsBoost\Libraries\Apiinit;

// Comentado: Validação de licença removida
// Apiinit::the_da_vinci_code('WhatsBoost');
// Apiinit::ease_of_mind('WhatsBoost');

use App\Controllers\Security_Controller;

app_hooks()->add_filter('app_filter_action_links_of_WhatsBoost', function () {
    $action_links_array = [
        anchor('https://docs.corbitaltech.dev/products/', 'Help', ['target' => '_blank']),
    ];

    return $action_links_array;
});

app_hooks()->add_filter('app_filter_app_csrf_exclude_uris', function ($urls) {
    $urls[] = "whatsboost/whatsapp_webhook";
    $urls[] = "whatsboost/send_message";
    $urls[] = "whatsboost/mark_interaction_as_read";
    return $urls;
});

app_hooks()->add_action('app_hook_role_permissions_extension', function () {
    $request = \Config\Services::request();
    $role_id = $request->getUri()->getSegment(3);
    $roles_model = new \App\Models\Roles_model;
    $model_info = $roles_model->get_one($role_id);
    $permissions = $model_info->permissions ? unserialize($model_info->permissions) : "";
    echo initWhatsboostPermission($permissions);
});

app_hooks()->add_filter('app_filter_role_permissions_save_data', function ($permissions) {
    $data = request()->getPost();

    // Connect account
    $permissions['wb_connect'] = isset($data['wb_connect']) ? '1' : '0';

    // Message bot
    $permissions['wb_view_mb'] = isset($data['wb_view_mb']) ? '1' : '0';
    $permissions['wb_create_mb'] = isset($data['wb_create_mb']) ? '1' : '0';
    $permissions['wb_edit_mb'] = isset($data['wb_edit_mb']) ? '1' : '0';
    $permissions['wb_delete_mb'] = isset($data['wb_delete_mb']) ? '1' : '0';
    $permissions['wb_clone_mb'] = isset($data['wb_clone_mb']) ? '1' : '0';

    // Template bot
    $permissions['wb_view_tb'] = isset($data['wb_view_tb']) ? '1' : '0';
    $permissions['wb_create_tb'] = isset($data['wb_create_tb']) ? '1' : '0';
    $permissions['wb_edit_tb'] = isset($data['wb_edit_tb']) ? '1' : '0';
    $permissions['wb_delete_tb'] = isset($data['wb_delete_tb']) ? '1' : '0';
    $permissions['wb_clone_tb'] = isset($data['wb_clone_tb']) ? '1' : '0';

    // Template
    $permissions['wb_view_template'] = isset($data['wb_view_template']) ? '1' : '0';
    $permissions['wb_log_template'] = isset($data['wb_log_template']) ? '1' : '0';

    // Campaign
    $permissions['wb_view_campaign'] = isset($data['wb_view_campaign']) ? '1' : '0';
    $permissions['wb_create_campaign'] = isset($data['wb_create_campaign']) ? '1' : '0';
    $permissions['wb_edit_campaign'] = isset($data['wb_edit_campaign']) ? '1' : '0';
    $permissions['wb_delete_campaign'] = isset($data['wb_delete_campaign']) ? '1' : '0';
    $permissions['wb_show_campaign'] = isset($data['wb_show_campaign']) ? '1' : '0';

    // Chat
    $permissions['wb_view_chat'] = isset($data['wb_view_chat']) ? '1' : '0';
    $permissions['wb_read_only_chat'] = isset($data['wb_read_only_chat']) ? '1' : '0';

    // Activity log
    $permissions['wb_view_log'] = isset($data['wb_view_log']) ? '1' : '0';
    $permissions['wb_clear_log'] = isset($data['wb_clear_log']) ? '1' : '0';

    // Settings
    $permissions['wb_view_settings'] = isset($data['wb_view_settings']) ? '1' : '0';

    // AI Prompts
    $permissions['wb_view_ai_prompts'] = isset($data['wb_view_ai_prompts']) ? '1' : '0';
    $permissions['wb_create_ai_prompts'] = isset($data['wb_create_ai_prompts']) ? '1' : '0';
    $permissions['wb_edit_ai_prompts'] = isset($data['wb_edit_ai_prompts']) ? '1' : '0';
    $permissions['wb_delete_ai_prompts'] = isset($data['wb_delete_ai_prompts']) ? '1' : '0';
    $permissions['wb_view_own_ai_prompts'] = isset($data['wb_view_own_ai_prompts']) ? '1' : '0';

    // Canned Reply
    $permissions['wb_view_canned_reply'] = isset($data['wb_view_canned_reply']) ? '1' : '0';
    $permissions['wb_create_canned_reply'] = isset($data['wb_create_canned_reply']) ? '1' : '0';
    $permissions['wb_edit_canned_reply'] = isset($data['wb_edit_canned_reply']) ? '1' : '0';
    $permissions['wb_delete_canned_reply'] = isset($data['wb_delete_canned_reply']) ? '1' : '0';
    $permissions['wb_view_own_canned_reply'] = isset($data['wb_view_own_canned_reply']) ? '1' : '0';

    // csv campaign
    $permissions['wb_send_csv_campaign'] = isset($data['wb_send_csv_campaign']) ? '1' : '0';

    return $permissions;
});

app_hooks()->add_filter('app_filter_staff_left_menu', function ($sidebarMenu) {

    $request = request();
    $session = \Config\Services::session();

    $user_id = $session->get('user_id');
    $users_model = new \App\Models\Users_model;
    $user_info = $users_model->get_access_info($user_id);
    $user_info->permissions = !empty($user_info->permissions) ? unserialize($user_info->permissions) : '';

    $whatsBoostSubMenu = [];

    if (check_wb_permission($user_info, 'wb_connect')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_connect_account",
            "url" => "whatsboost/connect_account",
            "class" => "whatsboost"
        ];
    }

    if (check_wb_permission($user_info, 'wb_view_mb')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_message_bot",
            "url" => "whatsboost/bots/message_bot",
            "class" => "whatsboost"
        ];
    }

    if (check_wb_permission($user_info, 'wb_view_tb')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_template_bot",
            "url" => "whatsboost/bots/template_bot",
            "class" => "whatsboost"
        ];
    }

    if (check_wb_permission($user_info, 'wb_view_settings')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_bot_flow",
            "url" => "whatsboost/bot_flow",
            "class" => "whatsboost"
        ];
    }

    if (check_wb_permission($user_info, 'wb_view_template')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_templates",
            "url" => "whatsboost/template",
            "class" => "whatsboost"
        ];
    }

    if (check_wb_permission($user_info, 'wb_view_campaign')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_campaigns",
            "url" => "whatsboost/campaigns",
            "class" => "whatsboost"
        ];
    }

    if (check_wb_permission($user_info, 'wb_send_csv_campaign')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_csv_campaigns",
            "url" => "whatsboost/csv_campaigns",
            "class" => "whatsboost"
        ];
    }

    if (check_wb_permission($user_info, 'wb_view_chat') || check_wb_permission($user_info, 'wb_read_only_chat')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_chat",
            "url" => "whatsboost/chat",
            "class" => "whatsboost"
        ];
    }

    if (check_wb_permission($user_info, 'wb_view_canned_reply')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_canned_reply",
            "url" => "whatsboost/canned_replies",
            "class" => "whatsboost"
        ];
    }

    if (check_wb_permission($user_info, 'wb_view_ai_prompts') || check_wb_permission($user_info, 'wb_view_own_ai_prompts')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_custom_prompts",
            "url" => "whatsboost/custom_prompts",
            "class" => "whatsboost"
        ];
    }


    if (check_wb_permission($user_info, 'wb_view_log')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_activity_log",
            "url" => "whatsboost/log",
            "class" => "whatsboost"
        ];
    }

    if (check_wb_permission($user_info, 'wb_view_settings')) {
        $whatsBoostSubMenu[] = [
            "name" => "whatsboost_settings",
            "url" => "whatsboost/settings",
            "class" => "whatsboost"
        ];
    }

    if (!empty($whatsBoostSubMenu)) {
        $sidebarMenu["whatsboost"] = array(
            "name" => "whatsboost",
            "url" => "whatsboost/connect_account",
            "class" => "message-circle",
            "position" => 3,
            "submenu" => $whatsBoostSubMenu
        );
    }

    return $sidebarMenu;
});

register_installation_hook("WhatsBoost", function ($item_purchase_code) {
    // Comentado: Validação de código de compra removida
    // A instalação agora procede diretamente sem validação
    include PLUGINPATH . "WhatsBoost/install/do_install.php";
});

register_uninstallation_hook("WhatsBoost", function () {
    $dbPrefix = get_db_prefix();
    $db = db_connect('default');

    // Comentado: Limpeza de dados de verificação removida
    // $sqlQuery = "DELETE FROM `" . $dbPrefix . "settings` WHERE `" . $dbPrefix . "settings`.`setting_name`='WhatsBoost_item_purchase_code';";
    // $sqlQuery = 'DELETE FROM `' . $dbPrefix . 'settings` WHERE `' . $dbPrefix . "settings`.`setting_name` IN ('WhatsBoost_verification_id', 'WhatsBoost_last_verification', 'WhatsBoost_product_token', 'WhatsBoost_heartbeat');";
    // $db->query($sqlQuery);
});

$settings = new Settings_model();

$plugins = $settings->get_setting('plugins');
if (!empty($plugins)) {
    $plugins = unserialize($plugins);
}

if (isset($plugins['WhatsBoost']) && $plugins['WhatsBoost'] == 'activated') {
    if (empty($settings->get_setting('wb_verify_token'))) {
        $settings->save_setting('wb_verify_token', wbGenerateRandomString());
    }
}

app_hooks()->add_action('app_hook_head_extension', function () {
    // Usar timestamp para cache busting - força reload quando arquivos são modificados
    $cssVersion = time(); // Força reload imediato

    echo '
        <link href="' . base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/css/tribute.css?v=' . $cssVersion) . '"  rel="stylesheet" type="text/css" />
        <link href="' . base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/css/whatsboost.css?v=' . $cssVersion) . '"  rel="stylesheet" type="text/css" />
        <link href="' . base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/css/prism.css?v=' . $cssVersion) . '"  rel="stylesheet" type="text/css" />';

    // Comentado: Código de validação criptografada removido
    // $botOptions = getWhatsboostDetails();

    echo '<script>
            var wb_r = ' . json_encode(base_url() . config('App')->temp_file_path . basename(get_plugin_meta_data('WhatsBoost')['plugin_url'])) . ';
            var wb_g = "";
            var wb_b = "";
            var wb_a = "' . basename(get_plugin_meta_data('WhatsBoost')['plugin_url']) . '";
            var wb_url = ' . json_encode(get_uri()) . ';
        </script>';
});

app_hooks()->add_action('app_hook_layout_main_view_extension', function () {
    $availableFields = wbGetAvailableFields();

    // Usar timestamp do arquivo para forçar reload do cache quando modificado
    $bundleFile = PLUGINPATH . 'WhatsBoost/assets/js/whatsboost.bundle.js';
    $bundleVersion = file_exists($bundleFile) ? filemtime($bundleFile) : get_setting('app_version');

    echo '
        <script>var merge_fields = ' . json_encode($availableFields) . '; var wb_template_data_url = "' . get_uri('whatsboost/campaigns/get_template_map') . '"; var wb_bulk_file_upload_url = "' . get_uri('whatsboost/csv_campaigns/upload_file') . '"; var file_upload_instruction = "'. app_lang('file_upload_instruction') .'"</script>
        <script src="' . base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/js/tribute.min.js?v=' . get_setting('app_version')) . '"></script>
        <script src="' . base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/js/underscore-min.js?v=' . get_setting('app_version')) . '"></script>
        <script src="' . base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/js/whatsboost.bundle.js?v=' . $bundleVersion) . '"></script>
        <script src="' . base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/js/prism.js?v=' . get_setting('app_version')) . '"></script>
        ';
});

app_hooks()->add_filter('app_filter_admin_settings_menu', function ($settings_menu) {
    $settings_menu["setup"][] = array("name" => "whatsboost", "url" => "whatsboost/settings");

    return $settings_menu;
});

app_hooks()->add_filter('app_filter_dashboard_widgets', function ($default_widgets_array) {
    array_push(
        $default_widgets_array,
        ["widget" => "whatsboost_widget", "widget_view" => view("WhatsBoost\Views\widgets\whatsboost_widget", ['' => 'hi'])]
    );

    return $default_widgets_array;
});

app_hooks()->add_action('app_hook_after_cron_run', "send_campaign");

function send_campaign()
{
    $CI     = new Security_Controller(false);
    $db = db_connect('default');
    $dbprefix = get_db_prefix();

    $builder = $db->table($dbprefix . 'wb_campaign_data');

    $scheduledData = $builder
        ->select($dbprefix . 'wb_campaigns.*, ' . $dbprefix . 'wb_templates.*, ' . $dbprefix . 'wb_campaign_data.*')
        ->join($dbprefix . 'wb_campaigns', $dbprefix . 'wb_campaigns.id = ' . $dbprefix . 'wb_campaign_data.campaign_id', 'left')
        ->join($dbprefix . 'wb_templates', $dbprefix . 'wb_campaigns.template_id = ' . $dbprefix . 'wb_templates.id', 'left')
        ->where($dbprefix . 'wb_campaigns.scheduled_send_time <= NOW()')
        ->where($dbprefix . 'wb_campaigns.pause_campaign', 0)
        ->where($dbprefix . 'wb_campaign_data.status', 1)
        ->where($dbprefix . 'wb_campaigns.is_bot', 0)
        ->get()->getResultArray();

    if (!empty($scheduledData)) {
        $whatsboostModel = model("WhatsBoost\Models\WhatsboostModel");
        $whatsboostModel->send_campaign($scheduledData);
    }
}

// custom hook for whatsapp auto lead create if not available
app_hooks()->add_filter('ctl_auto_lead_creation', function ($contact_number, $name) {
    $CI     = new Security_Controller(false);
    if (1 == get_setting('wb_auto_lead_settings')) {
        $lead_data = [
            'phone'             => $contact_number,
            'company_name'      => $name,
            'lead_status_id'    => get_setting('wb_auto_lead_status'),
            'lead_source_id'    => get_setting('wb_auto_lead_source'),
            'owner_id'          => get_setting('wb_auto_lead_owner'),
            'created_date'      => date('Y-m-d'),
            'is_lead'           => 1
        ];

        return $CI->Clients_model->ci_save($lead_data);
    }

    return false;
}, 10, 2);

app_hooks()->add_action('app_hook_data_insert', function ($hookData) {
    $CI     = new Security_Controller(false);
    $CI->db = db_connect('default');

    $insert_id = $hookData['id'];
    $table     = $hookData['table'];
    $data      = $hookData['data'];
    if ($CI->db->prefixTable('clients') == $table) {
        wb_lead_added($insert_id, $data);
    }
});

function wb_lead_added($insert_id, $data)
{
    $CI     = new Security_Controller(false);
    $CI->db = db_connect('default');
    $campaigns = $CI->db->table(get_db_prefix() . 'wb_campaigns')->where(['select_all' => '1', 'rel_type' => isset($data['is_lead']) ? 'leads' : 'contacts'])->get()->getResultArray();
    foreach ($campaigns as $campaign) {
        if (0 == $campaign['is_sent']) {
            $template = wbGetWhatsappTemplate($campaign['template_id']);
            $CI->db->table(get_db_prefix() . 'wb_campaign_data')->insert([
                'campaign_id'       => $campaign['id'],
                'rel_id'            => $insert_id,
                'rel_type'          => 'leads',
                'header_message'    => $template->header_data_text,
                'body_message'      => $template->body_data,
                'footer_message'    => $template->footer_data,
                'status'            => 1,
            ]);
        }
    }
}

// Comentado: Validação de licença removida
// app_hooks()->add_action('app_hook_before_app_access', 'WhatsBoost_actLib');
// function WhatsBoost_actLib()
// {
//     $aeiou = new \WhatsBoost\Libraries\Aeiou();
//     $envato_res = $aeiou->validatePurchase('WhatsBoost');
// }


app_hooks()->add_action('app_hook_after_cron_run', function ($manually) {
    if (get_setting('wb_enable_clear_chat_history') == '1') {

        $days = get_setting('wb_auto_clear_history_time');

        $time_string = "-$days days";
        $date = date('Y-m-d H:i:s', strtotime($time_string));

        $db = Database::connect();
        $builder = $db->table('wb_interaction_messages');
        $data = $builder->where('time_sent <', $date)->get()->getResultArray();

        if (!empty($data)) {
            $builder->where('time_sent <', $date)->delete();
        }
    }
});
