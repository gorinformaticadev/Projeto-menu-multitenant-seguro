<?php

namespace WhatsBoost\Models;

use CodeIgniter\Model;
use WhatsBoost\Traits\Whatsapp;

class CampaignModel extends Model
{
    use Whatsapp;
    protected $table = 'wb_campaigns';

    protected $allowedFields = ['name', 'rel_type', 'template_id', 'scheduled_send_time', 'send_now', 'header_params', 'body_params', 'footer_params', 'filename', 'pause_campaign', 'select_all', 'trigger', 'bot_type', 'is_bot_active', 'is_bot', 'created_at'];

    public function __construct()
    {
        parent::__construct();
    }

    public function get($id = '')
    {
        if (is_numeric($id)) {
            return $this->db->table(get_db_prefix() . 'wb_campaigns')->select(
                get_db_prefix() . 'wb_campaigns.*,' .
                    get_db_prefix() . 'wb_templates.template_name as template_name,' .
                    get_db_prefix() . 'wb_templates.template_id as tmp_id,' .
                    get_db_prefix() . 'wb_templates.header_params_count,' .
                    get_db_prefix() . 'wb_templates.body_params_count,' .
                    get_db_prefix() . 'wb_templates.footer_params_count,' .
                    'CONCAT("[", GROUP_CONCAT(' . get_db_prefix() . 'wb_campaign_data.rel_id SEPARATOR ","), "]") as rel_ids,'
            )
                ->join(get_db_prefix() . 'wb_templates', get_db_prefix() . 'wb_templates.id = ' . get_db_prefix() . 'wb_campaigns.template_id')
                ->join(get_db_prefix() . 'wb_campaign_data', get_db_prefix() . 'wb_campaign_data.campaign_id = ' . get_db_prefix() . 'wb_campaigns.id', 'LEFT')
                ->where(get_db_prefix() . 'wb_campaigns.id', $id)->get()->getRowArray();
        }

        return $this->db->table(get_db_prefix() . 'wb_campaigns')->get();
    }

    public function saveTemplates($data)
    {
        $data['header_params'] = json_encode($data['header_params'] ?? []);
        $data['body_params']   = json_encode($data['body_params'] ?? []);
        $data['footer_params'] = json_encode($data['footer_params'] ?? []);

        $insert = $update = false;
        if (empty($data['id'])) {
            $insert = $this->insert($data);
            $id     = $this->getInsertID();
        } else {
            $update = $this->set($data)->where('id', $data['id'])->update();
            $id     = $data['id'];
        }

        $status  = ($insert || $update);
        $message = app_lang('something_went_wrong');

        if ($status) {
            wbHandleUploadFile($id, $data, 'template');
            $message = ($insert) ? app_lang('template_bot_create_successfully') : app_lang('template_bot_update_successfully');
        }

        return [
            'success' => $status,
            'type'    => ($status) ? 'success' : 'danger',
            'message' => $message,
        ];
    }

    public function getTemplateBots($id)
    {
        if (! empty($id)) {
            return $this->where(['id' => $id, 'is_bot' => 1])->first();
        }

        return $this->where(['is_bot' => 1])->findAll();
    }

    public function pause_resume_campaign($id)
    {
        $campaign = $this->get($id);
        $update   = $this->set(['pause_campaign' => (1 == $campaign['pause_campaign'] ? 0 : 1)])->where('id', $id)->update();

        return [
            'message'     => $update && 1 == $campaign['pause_campaign'] ? app_lang('campaign_resumed') : app_lang('campaign_paused'),
            'recirect_to' => get_uri('whatsboost/campaigns/view/' . $id),
        ];
    }

    public function delete_campaign_file($id)
    {
        $campaign = $this->get($id);
        $type     = (1 == $campaign['is_bot']) ? 'template' : 'campaign';

        $update = $this->set(['filename' => null])->where('id', $id)->update();
        $path   = getcwd() . '/files/whatsboost/' . $type . '/' . $campaign['filename'];

        if ($update && file_exists($path)) {
            unlink($path);
        }

        return [
            'message'     => ($update) ? app_lang('image_deleted_successfully') : app_lang('error_occurred'),
            'recirect_to' => (1 == $campaign['is_bot']) ? get_uri('whatsboost/bots/template/' . $id) : get_uri('whatsboost/campaigns/campaign/' . $id),
        ];
    }

    public function getTemplateBotsByRelType($relType, $message, $botType = null)
    {
        $builder = $this->db->table(get_db_prefix() . 'wb_campaigns');
        $builder->select(
            get_db_prefix() . 'wb_campaigns.id as campaign_table_id,' .
                get_db_prefix() . 'wb_campaigns.*,' .
                get_db_prefix() . 'wb_templates.*'
        );
        $messageWords = explode(' ', $message);

        foreach ($messageWords as $value) {
            $value = str_replace(["'", "\""], "", $value);
            $builder->orWhere("FIND_IN_SET(" . $this->db->escape($value) . ", `trigger`) >", 0);
        }

        if (! is_null($botType)) {
            $builder->where("bot_type", $botType);
        }
        $builder->join(get_db_prefix() . 'wb_templates', get_db_prefix() . 'wb_campaigns.template_id = ' . get_db_prefix() . 'wb_templates.id', 'left');
        $builder->where(['rel_type' => $relType, 'is_bot' => 1, 'is_bot_active' => 1]);

        $data = $builder->get();

        if ($data->getNumRows() == 0 && $botType != 4) {
            return $this->getTemplateBotsByRelType($relType, '', 4);
        }

        return $data->getResultArray();
    }

    public function cloneTemplateBot($type, $id)
    {
        $bot_data       = $this->getTemplateBots($id);
        $bot_data['id'] = '';
        if (! empty($bot_data['filename'])) {
            $new_file_name        = prepareNewFileName($bot_data['filename']);
            $bot_data['filename'] = copy(getcwd() . '/files/whatsboost/template/' . $bot_data['filename'], getcwd() . '/files/whatsboost/template/' . $new_file_name) ? $new_file_name : '';
        }
        $insert = $this->insert($bot_data);
        return $this->getInsertID();
    }

    public function prepare_merge_field($data)
    {
        $merge_field = [];
        if (isset($data['fields'])) {
            foreach ($data['fields'] as $key => $value) {
                $merge_field[] = [
                    'key'   => $value,
                    'value' => '{' . $value . '}',
                ];
            }
        }
        $data['error_note'] = '';
        if (isset($data['json_file_path'])) {
            $data['error_note'] = '<h5>' . app_lang('note') . ' : </h5>' . app_lang('out_of_the') . ' ' . $data['total'] . ' ' . app_lang('records_in_your_csv_file') . ' ' . $data['valid'] . ' ' . app_lang('valid_the_campaign_can_be_sent') . ' ' . $data['valid'] . ' ' . app_lang('users');
        }
        unset($data['fields']);
        $data['merge_field'] = $merge_field;
        return $data;
    }

    public function send_bulk_campaign($post_data)
    {
        $template                   = wbGetWhatsappTemplate($post_data['template_id']);
        $post_data['header_params'] = json_encode($post_data['header_params'] ?? []);
        $post_data['body_params']   = json_encode($post_data['body_params'] ?? []);
        $post_data['footer_params'] = json_encode($post_data['footer_params'] ?? []);
        $post_data                  = array_merge($post_data, (array) $template);

        $jsonData              = file_get_contents($post_data['json_file_path']);
        $file                  = wbHandleUploadFile('', $post_data, 'csv');
        $post_data['filename'] = $file['filename'] ?? '';
        $campaignData          = json_decode($jsonData, true);
        $response              = [];
        foreach ($campaignData as $campaign) {
            $data   = array_merge($campaign, $post_data);
            $result = $this->sendBulkCampaign($data['Phoneno'], $data, $campaign);
            array_push($response, $result);
        }

        $valid = count(array_filter($response, function ($item) {
            return $item['responseCode'] === 200;
        }));
        return [
            'success' => ($valid != 0) ? true : false,
            'type'    => ($valid != 0) ? 'success' : 'danger',
            'message' => ($valid != 0) ? app_lang('total_send_campaign_list') . $valid : app_lang('please_add_valid_number_in_csv_file'),
        ];
    }
}
