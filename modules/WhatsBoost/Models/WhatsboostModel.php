<?php

namespace WhatsBoost\Models;

use App\Models\Clients_model;
use App\Models\Users_model;
use WhatsBoost\Traits\Whatsapp;
use Pusher;

require_once(APPPATH . "ThirdParty/Pusher/vendor/autoload.php");

class WhatsboostModel extends CtlModel
{
    use Whatsapp;

    protected $db;
    protected $campaignModel;
    protected $botsModel;
    protected $clientsModel;
    protected $usersModel;
    protected $interactionModel;

    /**
     * Stores the pusher options.
     *
     * @var array
     */
    protected $pusher_options = [];

    /**
     * Hold Pusher instance.
     *
     * @var object
     */
    protected $pusher;

    public function __construct()
    {
        parent::__construct();

        $this->db = db_connect('default');

        $this->campaignModel = new CampaignModel();
        $this->botsModel     = new BotsModel();
        $this->clientsModel  = new Clients_model();
        $this->usersModel    = new Users_model();
        $this->interactionModel = new InteractionModel();

        if (!empty(get_setting('pusher_key')) || !empty(get_setting('pusher_secret')) || !empty(get_setting('pusher_app_id'))) {
            // store pusher data into pusher variable
            $this->pusher_options['app_key'] = get_setting('pusher_key');
            $this->pusher_options['app_secret'] = get_setting('pusher_secret');
            $this->pusher_options['app_id'] = get_setting('pusher_app_id');
            if (!empty(get_setting('pusher_cluster'))) {
                $this->pusher_options['cluster'] = get_setting('pusher_cluster');
            }

            $this->pusher = new Pusher\Pusher(
                $this->pusher_options['app_key'],
                $this->pusher_options['app_secret'],
                $this->pusher_options['app_id'],
                ['cluster' => $this->pusher_options['cluster'] ?? '']
            );
        }
    }

    public function loadTemplates()
    {
        $templates = $this->loadTemplatesFromWhatsApp();

        // if there is any error from api then display appropriate message
        if (!$templates['status']) {
            return [
                'success' => false,
                'type'    => 'danger',
                'message' => $templates['message'],
            ];
        }
        $data        = $templates['data'];
        $insert_data = [];

        foreach ($data as $key => $template_data) {
            $insert_data[$key]['template_id']   = $template_data->id;
            $insert_data[$key]['template_name'] = $template_data->name;
            $insert_data[$key]['language']      = $template_data->language;

            $insert_data[$key]['status']   = $template_data->status;
            $insert_data[$key]['category'] = $template_data->category;

            $components = array_column($template_data->components, null, 'type');

            $insert_data[$key]['header_data_format']  = $components['HEADER']->format ?? '';
            $insert_data[$key]['header_data_text']    = $components['HEADER']->text ?? null;
            $insert_data[$key]['header_params_count'] = preg_match_all('/{{(.*?)}}/i', $components['HEADER']->text ?? '', $matches);

            $insert_data[$key]['body_data']         = $components['BODY']->text ?? null;
            $insert_data[$key]['body_params_count'] = preg_match_all('/{{(.*?)}}/i', $components['BODY']->text, $matches);

            $insert_data[$key]['footer_data']         = $components['FOOTER']->text ?? null;
            $insert_data[$key]['footer_params_count'] = preg_match_all('/{{(.*?)}}/i', $components['FOOTER']->text ?? null, $matches);

            $insert_data[$key]['buttons_data'] = json_encode($components['BUTTONS'] ?? []);
        }
        $insert_data_id = array_column($insert_data, 'template_id');

        $builder = $this->db->table('wb_templates');

        $existing_template = $builder->whereIn('template_id', $insert_data_id, )->get()->getResult();

        $existing_data_id = array_column($existing_template, 'template_id');

        $new_template_id = array_diff($insert_data_id, $existing_data_id);
        $new_template    = array_filter($insert_data, function ($val) use ($new_template_id) {
            return \in_array($val['template_id'], $new_template_id);
        });

        if (!empty($new_template)) {
            $this->db->query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_general_ci'");
            $builder->insertBatch($new_template);
        }

        return [
            'success' => true,
            'type'    => 'success',
            'message' => app_lang('template_data_loaded'),
        ];
    }

    public function changeStatus($type, $id, $status)
    {
        if ('message' == $type) {
            return $this->botsModel->set(['is_bot_active' => $status])->where(['id' => $id])->update();
        }

        return $this->campaignModel->set(['is_bot_active' => $status])->where(['id' => $id, 'is_bot' => 1])->update();
    }

    public function send_campaign($scheduled_data)
    {
        helper('whatsboost');

        $logBatch = $chatMessage = [];

        foreach ($scheduled_data as $template_data) {
            switch ($template_data['rel_type']) {
                case 'leads':
                    $options       = ['id' => $template_data['rel_id'], 'is_lead' => 1, 'deleted' => 0];
                    $rel_data      = $this->clientsModel->get_details($options)->getRowArray();
                    $interactionId = wbGetInteractionId($template_data, 'leads', $rel_data['id'], $rel_data['company_name'], $rel_data['phone'], $this->getDefaultPhoneNumber());
                    break;

                case 'contacts':
                    $options       = ['id' => $template_data['rel_id'], 'is_lead' => 0, 'deleted' => 0];
                    $rel_data      = $this->clientsModel->get_details($options)->getRowArray();
                    $interactionId = wbGetInteractionId($template_data, 'contacts', $rel_data['id'], $rel_data['company_name'], $rel_data['phone'], $this->getDefaultPhoneNumber());
                    break;
            }
            $response = $this->sendTemplate($rel_data, $template_data);

            // store log response
            $logBatch[] = $response['log_data'];

            if (!empty($response['status'])) {
                $header = wbParseText($rel_data, 'header', $template_data);
                $body   = wbParseText($rel_data, 'body', $template_data);
                $footer = wbParseText($rel_data, 'footer', $template_data);

                $header_data = '';
                if ('IMAGE' == $template_data['header_data_format']) {
                    $header_data = '<a href="'.base_url('files/whatsboost/campaign/'.$template_data['filename']).'" data-lightbox="image-group"><img src="'.base_url('files/whatsboost/campaign/'.$template_data['filename']).'" class="img-responsive img-rounded" style="width: 300px"></img></a>';
                } elseif ('TEXT' == $template_data['header_data_format'] || '' == $template_data['header_data_format']) {
                    $header_data = "<div class='my-1 bold'>".nl2br(wbDecodeWhatsAppSigns($header ?? '')).'</div>';
                }

                $buttonHtml = '';
                if (!empty(json_decode($template_data['buttons_data']))) {
                    $buttons    = json_decode($template_data['buttons_data']);
                    $buttonHtml = "<div class='d-flex gap-2 w-100 px-1 flex-column mt-3'>";
                    foreach ($buttons->buttons as $key => $value) {
                        $buttonHtml .= '<button class="btn btn-default w-100">'.$value->text.'</button>';
                    }
                    $buttonHtml .= '</div>';
                }

                // Prepare the data for chat message
                $chatMessage[] = [
                    'interaction_id' => $interactionId,
                    'sender_id'      => $this->getDefaultPhoneNumber(),
                    'url'            => null,
                    'message'        => "<div class='p-2'>"."
                            $header_data
                            <p>".nl2br(wbDecodeWhatsAppSigns($body))."</p>
                            <span class='text-muted small'>".nl2br(wbDecodeWhatsAppSigns($footer ?? ''))."</span>
                            $buttonHtml
                        ".'</div>',
                    'status'     => 'sent',
                    'time_sent'  => wbGetCurrentTimestamp(),
                    'message_id' => $response['data']->messages[0]->id,
                    'staff_id'   => 0,
                    'type'       => 'text',
                ];
            }
            $update_data['status']           = (1 == $response['status']) ? 2 : $response['status'];
            $update_data['whatsapp_id']      = ($response['status']) ? reset($response['data']->messages)->id : null;
            $update_data['response_message'] = $response['message'] ?? '';
            $this->db->table(get_db_prefix().'wb_campaign_data')->update($update_data, ['id' => $template_data['id']]);
        }
        $this->addWhatsboostLog($logBatch);

        // Add chat message
        $this->addChatMessage($chatMessage);

        return $this->db->table(get_db_prefix().'wb_campaigns')->update(['is_sent' => 1, 'sending_count' => $template_data['sending_count'] + 1, 'scheduled_send_time' =>  wbGetCurrentTimestamp()], ['id' => $template_data['campaign_id']]);
    }

    public function updateStatus($status_data)
    {
        foreach ($status_data as $status) {
            $stat = \is_array($status) ? $status['status'] : $status->status;
            $id   = \is_array($status) ? $status['id'] : $status->id;
            $this->db->table(get_db_prefix().'wb_campaign_data')->update(['message_status' => $stat], ['whatsapp_id' => $id]);
        }
    }

    public function getContactData($contactNumber, $name)
    {
        $contact = $this->db->table(get_db_prefix().'clients')->where('phone', $contactNumber)->where('is_lead', 0)->where('deleted', 0)->get()->getRowArray();

        if (!empty($contact)) {
            $contact['rel_type'] = 'contacts';
            $contact['name']     = $contact['company_name'];

            return $contact;
        }

        $lead = $this->db->table(get_db_prefix().'clients')->where('phone', $contactNumber)->where('is_lead', 1)->where('deleted', 0)->get()->getRowArray();
        if (!empty($lead)) {
            $lead['rel_type'] = 'leads';

            return $lead;
        }

        $leadId = app_hooks()->apply_filters('ctl_auto_lead_creation', $contactNumber, $name);

        if (!empty($leadId)) {
            $lead             = $this->db->table(get_db_prefix().'clients')->where('id', $leadId)->where('is_lead', 1)->get()->getRowArray();
            $lead['rel_type'] = 'leads';

            return $lead;
        }

        return false;
    }

    public function addWhatsboostLog($logData)
    {
        if (!empty($logData)) {
            // Prepare the data for activity log
            $logsData = [
                'phone_number_id'     => get_setting('wb_phone_number_id'),
                'access_token'        => get_setting('wb_access_token'),
                'business_account_id' => get_setting('wb_business_account_id'),
            ];
            $logData = array_map(function ($item) use ($logsData) {
                return array_merge($item, $logsData);
            }, $logData);

            return $this->db->table(get_db_prefix() . 'wb_activity_log')->insertBatch($logData);
        }

        return false;
    }

    public function addChatMessage($chatMessage)
    {
        if (!empty($chatMessage)) {
            $affected_rows = 0;
            for ($i = 0; $i < count($chatMessage); $i++) {
                $message_id = $this->interactionModel->insert_interaction_message($chatMessage[$i]);
                if (!empty($message_id) && !empty(get_setting('pusher_app_key')) || !empty(get_setting('pusher_app_secret')) || !empty(get_setting('pusher_app_id'))) {
                    $this->pusher->trigger('wboost-interactions-channel', 'wboost-new-message-event', [
                        'interaction' => json_encode($this->interactionModel->get_new_interaction_message($chatMessage[$i]['interaction_id'], $message_id))
                    ]);
                    $affected_rows++;
                }
            }
            return $affected_rows;
        }
    }

    public function getWhatsappLogDetails($id)
    {
        if (!empty($id)) {
            return $this->db->table(get_db_prefix() . 'wb_activity_log')->where(['id' => $id])->first();
        }

        return $this->db->table(get_db_prefix() . 'wb_activity_log')->findAll();
    }

    public function updateSendingCount($table, $count, $id)
    {
        return $this->db->table($table)->set('sending_count', $count)->where('id', $id)->update();
    }

    public function updateCategory($table, $data, $where)
    {
        return $this->db->table($table)->set($data)->where($where)->update();
    }
}
