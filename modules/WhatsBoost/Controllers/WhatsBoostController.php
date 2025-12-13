<?php

namespace WhatsBoost\Controllers;

use App\Controllers\Security_Controller;
use App\Models\Settings_model;
use App\Models\Users_model;
use WhatsBoost\Models\BotsModel;
use WhatsBoost\Models\CampaignModel;
use WhatsBoost\Models\InteractionModel;
use WhatsBoost\Models\WhatsboostActivityLogModel;
use WhatsBoost\Models\WhatsboostModel;
use WhatsBoost\Traits\Whatsapp;
use WhatsBoost\Traits\OpenAiTraits;
use WhatsBoost\Config\Languages;

class WhatsBoostController extends Security_Controller
{
    use Whatsapp;
    use OpenAiTraits;
    protected $settingsModel;
    protected $whatsboostModel;
    protected $activityLogModel;
    protected $BotsModel;
    protected $CampaignModel;
    protected $interactionModel;
    protected $languages;
    protected $UsersModel;

    public function __construct()
    {
        parent::__construct();

        helper('whatsboost');

        $this->settingsModel    = new Settings_model();
        $this->whatsboostModel  = new WhatsboostModel();
        $this->activityLogModel = new WhatsboostActivityLogModel();
        $this->BotsModel        = new BotsModel();
        $this->CampaignModel    = new CampaignModel();
        $this->interactionModel = new InteractionModel();
        $this->languages = new Languages();
        $this->UsersModel = new Users_model();
    }

    public function connectAccount()
    {
        if (!check_wb_permission($this->login_user, 'wb_connect')) {
            app_redirect('forbidden');
        }

        $data['phoneNumbers'] = [];

        if ($this->request->isAJAX()) {
            $postData = $this->request->getPost();

            if (!empty($postData)) {
                $this->settingsModel->save_setting('wb_business_account_id', $postData['wb_business_account_id']);
                $this->settingsModel->save_setting('wb_access_token', $postData['wb_access_token']);
                $response = $this->whatsboostModel->loadTemplates();
                if (false == $response['success']) {
                    echo json_encode($response);

                    return;
                }

                $phoneNumbers = $this->getPhoneNumbers();
                $profileData  = $this->getProfile();
                if ($phoneNumbers['status']) {
                    $numberId      = $phoneNumbers['data'][array_key_first($phoneNumbers['data'])]->id;
                    $defaultNumber = $phoneNumbers['data'][array_key_first($phoneNumbers['data'])]->display_phone_number;
                    $this->settingsModel->save_setting('wb_phone_number_id', $numberId);
                    $this->settingsModel->save_setting('wb_default_phone_number', preg_replace('/\D/', '', $defaultNumber));
                    $data['phoneNumbers'] = $phoneNumbers['data'];
                }
                if (isset($profileData['data']) && isset($profileData['data']->profile_picture_url)) {
                    $this->settingsModel->save_setting('wb_profile_picture_url', $profileData['data']->profile_picture_url);
                } else {
                    $this->settingsModel->save_setting('wb_profile_picture_url', '');
                }
                echo json_encode(['type' => 'success', 'message' => ('submit' == $this->request->getPost('submit')) ? app_lang('account_connected') : app_lang('settings_updated')]);

                return;
            }
        }

        if ('' != get_setting('wb_business_account_id')) {
            $phone_numbers = $this->getPhoneNumbers();
            if ($phone_numbers['status']) {
                $data['phoneNumbers'] = $phone_numbers['data'];
            }
        }

        $data['isConnected'] = false;
        if (!empty(get_setting('wb_business_account_id')) && !empty(get_setting('wb_access_token')) && !empty(get_setting('wb_phone_number_id'))) {
            $data['isConnected'] = true;
        }

        if ($this->request->getPost()) {
            app_redirect('whatsboost/connect_account');
        }

        return $this->template->rander("WhatsBoost\Views\connect_account", $data);
    }

    public function setDefaultPhoneNumberId()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $this->settingsModel->save_setting('wb_phone_number_id', $this->request->getPost('wb_phone_number_id'));
        $phoneNumber = preg_replace("/\D/", '', $this->request->getPost('wb_default_phone_number'));
        $this->settingsModel->save_setting('wb_default_phone_number', $phoneNumber);

        echo json_encode(true);
    }

    public function disconnect()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $this->settingsModel->save_setting('wb_business_account_id', '');
        $this->settingsModel->save_setting('wb_access_token', '');
        $this->settingsModel->save_setting('wb_phone_number_id', '');
        $this->settingsModel->save_setting('wb_default_phone_number', '');

        $db = db_connect();
        $db->table('wb_templates')->truncate();

        echo json_encode(['success' => true, 'message' => app_lang('account_disconnect_success')]);
    }

    public function settings()
    {
        if (!check_wb_permission($this->login_user, 'wb_view_settings')) {
            app_redirect('forbidden');
        }

        $view_data['sources']  = $this->Lead_source_model->get_details()->getResult();
        $view_data['statuses'] = $this->Lead_status_model->get_details()->getResult();

        $team_members          = $this->Users_model->get_all_where(['user_type' => 'staff', 'deleted' => 0, 'status' => 'active'])->getResult();
        $team_members_dropdown = [];

        foreach ($team_members as $member) {
            $team_members_dropdown[] = ['id' => $member->id, 'text' => $member->first_name . ' ' . $member->last_name];
        }

        $view_data['owners'] = $team_members_dropdown;

        return $this->template->rander('WhatsBoost\Views\whatsboost_settings', $view_data);
    }

    public function saveSettings()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $old_openai_key = get_setting('wb_open_ai_key');

        $postData = $this->request->getPost();

        if (!empty($postData)) {
            $this->settingsModel->save_setting('wb_auto_lead_settings', $postData['wb_auto_lead_settings'] ?? 0);
            $this->settingsModel->save_setting('wb_auto_lead_status', $postData['wb_auto_lead_status']);
            $this->settingsModel->save_setting('wb_auto_lead_source', $postData['wb_auto_lead_source']);
            $this->settingsModel->save_setting('wb_auto_lead_owner', $postData['wb_auto_lead_owner']);
            $this->settingsModel->save_setting('wb_enable_webhooks_re_send', $postData['wb_enable_webhooks_re_send'] ?? 0);
            $this->settingsModel->save_setting('wb_webhook_resend_url', $postData['wb_webhook_resend_url']);
            $this->settingsModel->save_setting('wb_enable_supportagent', $postData['wb_enable_supportagent'] ?? 0);
            $this->settingsModel->save_setting('wb_enable_notification_sound', $postData['wb_enable_notification_sound'] ?? 0);
            $this->settingsModel->save_setting('wb_webhook_resend_method', $postData['wb_webhook_resend_method']);
            $this->settingsModel->save_setting('enable_wb_openai', $postData['enable_wb_openai'] ?? 0);
            $this->settingsModel->save_setting('wb_open_ai_key', $postData['wb_open_ai_key']);
            $this->settingsModel->save_setting('wb_openai_model', $postData['wb_openai_model']);
            $this->settingsModel->save_setting('wb_enable_clear_chat_history', $postData['wb_enable_clear_chat_history'] ?? 0);
            $this->settingsModel->save_setting('wb_auto_clear_history_time', $postData['wb_auto_clear_history_time']);
        }

        if (isset($postData['wb_open_ai_key']) && !empty($postData['wb_open_ai_key']) && $old_openai_key != $postData['wb_open_ai_key']) {
            $response = $this->listModel();
            if (!$response['status']) {
                echo json_encode($response);
                exit;
            }
        }
        echo json_encode(['status' => true, 'message' => app_lang('settings_saved_sucessfully')]);
    }

    public function chat()
    {
        if (!check_wb_permission($this->login_user, 'wb_view_chat') && !check_wb_permission($this->login_user, 'wb_read_only_chat')) {
            app_redirect('forbidden');
        }

        $viewData['title'] = app_lang('chat');
        $viewData['login_user'] = $this->login_user;
        $viewData['languages'] = $this->languages;
        $viewData['staff'] = wbGetAllStaff();
        return $this->template->rander("WhatsBoost\Views\interaction", $viewData);
    }

    public function manageLog()
    {
        if (!check_wb_permission($this->login_user, 'wb_view_log')) {
            app_redirect('forbidden');
        }

        $viewData['title'] = app_lang('whatsboost_activity_log');
        $viewData['user']  = $this->login_user;

        return $this->template->rander('WhatsBoost\Views\activity_log', $viewData);
    }

    public function logTable()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $data   = $this->activityLogModel->show_all();
        $result = [];
        foreach ($data as $value) {
            $result[] = $this->_make_log_row($value);
        }
        echo json_encode(['data' => $result]);
    }

    public function _make_log_row($data)
    {
        $template_name = '';
        if ('Message Bot' == $data->category) {
            $bot  = $this->BotsModel->getMessageBots($data->category_id);
            $name = $bot['name'] ?? '';
        } else {
            $campaign      = $this->CampaignModel->get($data->category_id);
            $template      =  wbGetWhatsappTemplate($campaign['template_id']);
            $template_name = $template->template_name ?? app_lang('not_found_or_deleted');
            $name          = $campaign['name'];
        }

        $color = 'btn-default';
        if ($data->response_code >= 200 && $data->response_code <= 299) {
            $color = 'btn-success';
        }
        if ($data->response_code >= 300 && $data->response_code <= 399) {
            $color = 'btn-info';
        }
        if ($data->response_code >= 400 && $data->response_code <= 499) {
            $color = 'btn-warning';
        }
        if ($data->response_code >= 500 && $data->response_code <= 599) {
            $color = 'btn-danger';
        }
        $response_code = '<a class="badge ' . $color . '">' . $data->response_code . '</a>';

        $actions = '-';
        if (check_wb_permission($this->login_user, 'wb_view_log')) {
            $actions = "<a href='" . get_uri('whatsboost/view_log/' . $data->id) . "' class='btn btn-default'><i data-feather='eye' class='icon-16'></i></a>";
        }
        if (check_wb_permission($this->login_user, 'wb_clear_log')) {
            $actions .= js_anchor("<i data-feather='x' class='icon-16'></i>", ['title' => app_lang('delete'), 'class' => 'delete', 'data-id' => $data->id, 'data-action-url' => get_uri('whatsboost/delete_log/') . $data->id, 'data-action' => 'delete-confirmation']);
        }

        return [
            $data->id,
            ('Message Bot' != $data->category) ? app_lang($data->category) : 'Message Bot',
            $name,
            $template_name,
            $response_code,
            app_lang($data->rel_type),
            $data->recorded_at,
            $actions,
        ];
    }

    public function clearLog()
    {
        if (!check_wb_permission($this->login_user, 'wb_clear_log')) {
            app_redirect('forbidden');
        }

        $this->activityLogModel->clear_log();

        return redirect()->to('whatsboost/log');
    }

    public function viewLog($id)
    {
        if (!check_wb_permission($this->login_user, 'wb_view_log')) {
            app_redirect('forbidden');
        }

        $viewData['title']    = app_lang('view_log');
        $viewData['log_data'] = $this->activityLogModel->get_one($id);

        return $this->template->rander('WhatsBoost\Views\view_log_details', $viewData);
    }

    /**
     * Marks a chat interaction as read and returns the response as JSON.
     * Updates the status of a chat interaction to 'read'.
     */
    public function chat_mark_as_read()
    {
        $id       = $this->request->getPost('interaction_id');
        $response = $this->interactionModel->chat_mark_as_read($id);
        echo json_encode($response);
    }

    /**
     * Fetches and sends interaction data as a JSON response.
     * Retrieves interaction data from the model and outputs it as JSON.
     */
    public function interactions()
    {
        $data['interactions'] = $this->interactionModel->get_interactions();
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    public function deleteLog($id)
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        if (!check_wb_permission($this->login_user, 'wb_clear_log')) {
            app_redirect('forbidden');
        }

        $delete = $this->activityLogModel->delete_log($id);
        echo json_encode([
            'success' => $delete,
            'message' => $delete ? app_lang('record_deleted') : app_lang('error_occurred'),
        ]);
    }

    public function deleteChat()
    {
        $id     = $this->request->getPost('interaction_id');
        $delete = $this->interactionModel->delete_chat($id);
        echo json_encode([
            'success' => $delete,
        ]);
    }

    public function aiResponse()
    {
        if (get_setting('wb_open_ai_key_verify') && get_setting('enable_wb_openai')) {
            $data = $this->request->getPost();
            $response = $this->getAiResponse($data);
            echo json_encode($response);
        } else {
            echo json_encode([
                'status' => false,
                'message' => app_lang('open_ai_key_verification_fail')
            ]);
        }
    }

    public function assignStaff()
    {
        $post_data = $this->request->getPost();
        $res = $this->interactionModel->add_assign_staff($post_data);
        echo json_encode($res);
    }

    public function get_chat_required_data()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $data = $this->interactionModel->get_chat_required_data();

        echo json_encode($data);
    }
}
