<?php

namespace WhatsBoost\Models;

use CodeIgniter\Model;

class CampaignDataModel extends Model
{
    protected $table = 'wb_campaign_data';

    protected $allowedFields = ['campaign_id', 'rel_id', 'rel_type', 'header_message', 'body_message', 'footer_message', 'status'];

    protected $WhatsboostModel;

    public function __construct()
    {
        parent::__construct();
        $this->WhatsboostModel = Model('WhatsBoost\Models\WhatsboostModel');
    }

    public function show_all()
    {
        return $this->get_all(true)->getResult();
    }

    public function send_campaign($post_data, $campaign_id)
    {
        if ($post_data['send_now']) {
            $scheduledData = $this->select(get_db_prefix().'wb_campaigns.*, '.get_db_prefix().'wb_templates.*,'.get_db_prefix().'wb_campaign_data.*')
                ->join(get_db_prefix().'wb_campaigns', get_db_prefix().'wb_campaigns.id = '.get_db_prefix().'wb_campaign_data.campaign_id', 'left')
                ->join(get_db_prefix().'wb_templates', get_db_prefix().'wb_campaigns.template_id = '.get_db_prefix().'wb_templates.id', 'left')
                ->where(get_db_prefix().'wb_campaign_data.status', 1)
                ->where(get_db_prefix().'wb_campaigns.is_bot', 0)
                ->where(get_db_prefix().'wb_campaign_data.campaign_id', $campaign_id)
                ->get()
                ->getResultArray();

            if (!empty($scheduledData)) {
                return $this->WhatsboostModel->send_campaign($scheduledData);
            }
        }
    }

    public function delete_data($id)
    {
        return $this->where('id', $id)->delete();
    }
}
