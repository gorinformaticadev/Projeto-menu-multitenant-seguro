<?php

namespace WhatsBoost\Controllers;

use App\Controllers\Security_Controller;

class CampaignsController extends Security_Controller
{
    protected $campaignModel;
    protected $campaignDataModel;

    public function __construct()
    {
        parent::__construct();

        helper('whatsboost');
        wbRemoveDeletedData();

        $this->campaignModel     = model('WhatsBoost\Models\CampaignModel');
        $this->campaignDataModel = model('WhatsBoost\Models\CampaignDataModel');
    }

    public function index()
    {
        if (!check_wb_permission($this->login_user, 'wb_view_campaign')) {
            app_redirect('forbidden');
        }

        $viewData['title'] = app_lang('campaigns');
        $viewData['user']  = $this->login_user;

        return $this->template->rander('WhatsBoost\Views\campaigns\manage', $viewData);
    }

    public function table()
    {
        if ($this->request->isAJAX()) {
            $data   = $this->campaignModel->where('is_bot', '0')->findAll();
            $result = [];
            foreach ($data as $value) {
                $result[] = $this->_make_row($value);
            }
            echo json_encode(['data' => $result]);
        }
    }

    public function _make_row($data)
    {
        $campaign_name = (check_wb_permission($this->login_user, 'wb_show_campaign')) ? "<a href='".get_uri('whatsboost/campaigns/view/').$data['id']."'>".$data['name'].'</a>' : $data['name'];

        $rel_color = ('contacts' == $data['rel_type']) ? 'bg-danger' : 'bg-primary';
        $rel_type  = '<span class="badge '.$rel_color.'">'.app_lang($data['rel_type']).'</span> &nbsp;';
        $total     = \count(wbGetCampaignData($data['id']));
        $template  = wbGetWhatsappTemplate($data['template_id']);

        $actions = '';

        if (check_wb_permission($this->login_user, 'wb_edit_campaign')) {
            $actions .= "<a href='".get_uri('whatsboost/campaigns/campaign/').$data['id']."' class='edit'><i data-feather='edit' class='icon-16'></i></a>";
        }

        if (check_wb_permission($this->login_user, 'wb_delete_campaign')) {
            $actions .= js_anchor("<i data-feather='x' class='icon-16'></i>", ['title' => app_lang('delete'), 'class' => 'delete', 'data-id' => $data['id'], 'data-action-url' => get_uri('whatsboost/campaigns/delete/').$data['id'], 'data-action' => 'delete-confirmation']);
        }

        return [
            $data['id'],
            $campaign_name,
            !empty($template) ? $template->template_name : '-',
            $rel_type,
            $total,
            wb_total_rows(get_db_prefix().'wb_campaign_data', ['status' => 2, 'campaign_id' => $data['id']]),
            wb_total_rows(get_db_prefix().'wb_campaign_data', ['message_status' => 'read', 'campaign_id' => $data['id']]),
            $actions,
        ];
    }

    public function campaign($id = '')
    {
        $permission_type = (!empty($id)) ? 'wb_edit_campaign' : 'wb_create_campaign';
        if (!check_wb_permission($this->login_user, $permission_type)) {
            app_redirect('forbidden');
        }

        $viewData['title']          = app_lang('campaigns');
        $viewData['lead']           = $this->Clients_model->get_all_where(['deleted' => 0, 'is_lead' => 1], 0, 0, 'company_name')->getResultArray();
        $viewData['customers']      = $this->Clients_model->get_all_where(['deleted' => 0, 'is_lead' => 0], 0, 0, 'company_name')->getResultArray();
        $viewData['total_leads']    = \count($viewData['lead']);
        $viewData['total_contacts'] = \count($viewData['customers']);

        if (!empty($id)) {
            $viewData['campaign'] = $this->campaignModel->get($id);
            if (!empty($viewData['campaign']['scheduled_send_time'])) {
                $dateTimeObj                       = new \DateTime($viewData['campaign']['scheduled_send_time']);
                $sendDate                          = $dateTimeObj->format('Y-m-d');
                $sendTime                          = $dateTimeObj->format('H:i:s');
                $viewData['campaign']['send_date'] = $sendDate;
                $viewData['campaign']['send_time'] = $sendTime;
            }

            $relationMapping = [
                'leads'    => 'lead_ids',
                'contacts' => 'contact_ids',
            ];

            if (isset($relationMapping[$viewData['campaign']['rel_type']])) {
                $viewData['campaign'][$relationMapping[$viewData['campaign']['rel_type']]] = !empty($viewData['campaign']['rel_ids']) ? json_decode($viewData['campaign']['rel_ids']) : [];
            }
        }

        return $this->template->rander('WhatsBoost\Views\campaigns\campaign', $viewData);
    }

    public function getTemplateMap()
    {
        if ($this->request->isAJAX()) {
            $template = wbGetWhatsappTemplate($this->request->getPost('template_id'));

            if (!empty($template)) {
                $header_data = $template->header_data_text ?? '';
                $body_data   = $template->body_data ?? '';
                $footer_data = $template->footer_data ?? '';
                $button_data = !empty($template->buttons_data) ? json_decode($template->buttons_data) : [];
            }

            if (!empty($this->request->getPost('temp_id'))) {
                $campaign = $this->campaignModel->get($this->request->getPost('temp_id'));

                $header_params = json_decode($campaign['header_params'] ?? '');
                $body_params   = json_decode($campaign['body_params'] ?? '');
                $footer_params = json_decode($campaign['footer_params'] ?? '');
            }

            include PLUGINPATH.'WhatsBoost/Views/variables.php';
            $view = ob_get_clean();
            echo json_encode(['view' => $view, 'header_data' => $header_data ?? '', 'body_data' => $body_data ?? '', 'footer_data' => $footer_data ?? '', 'button_data' => $button_data ?? []]);
        }
    }

    public function save()
    {
        $this->validate_submitted_data([
            'name'        => 'required',
            'rel_type'    => 'required',
            'template_id' => 'required',
        ]);

        $post_data = $this->request->getPost();

        $sendTime = '';
        if (isset($post_data['send_time'])) {
            if ('24_hours' != get_setting('time_format')) {
                $sendTime = convert_time_to_24hours_format($post_data['send_time']);
            }
        }

        $scheduledSendTime = (isset($post_data['send_date'])) ? $post_data['send_date'].' '.$sendTime : '';

        $post_data['scheduled_send_time'] = $scheduledSendTime;
        $post_data['send_now']            = (isset($post_data['send_now']) ? 1 : 0);
        $post_data['select_all']          = (isset($post_data['select_all']) ? 1 : 0);
        $post_data['header_params']       = json_encode($post_data['header_params'] ?? []);
        $post_data['body_params']         = json_encode($post_data['body_params'] ?? []);
        $post_data['footer_params']       = json_encode($post_data['footer_params'] ?? []);

        $rel_ids  = $post_data['rel_id'] ?? [];
        $rel_type = $post_data['rel_type'];

        unset($post_data['rel_id']);

        if (1 == $post_data['select_all']) {
            if ('leads' == $post_data['rel_type']) {
                $leads    = $this->Clients_model->get_details(['leads_only' => true])->getResultArray();
                $rel_ids  = array_column($leads, 'id');
                $rel_type = 'leads';
            } elseif ('contacts' == $post_data['rel_type']) {
                $contacts = $this->Clients_model->get_details()->getResultArray();
                $rel_ids  = array_column($contacts, 'id');
                $rel_type = 'contacts';
            }
        }

        $insert   = $update   = false;
        $template = wbGetWhatsappTemplate($post_data['template_id']);

        if (!empty($post_data['id'])) {
            $update = $this->campaignModel->update($post_data['id'], $post_data);
            if ($update) {
                $this->campaignDataModel->where('campaign_id', $post_data['id'])->delete();
                foreach ($rel_ids as $rel_id) {
                    $campaignData = [
                        'campaign_id'    => $post_data['id'],
                        'rel_id'         => $rel_id,
                        'rel_type'       => $rel_type,
                        'header_message' => $template->header_data_text ?? '',
                        'body_message'   => $template->body_data ?? '',
                        'footer_message' => $template->footer_data ?? '',
                        'status'         => 1,
                    ];
                    $this->campaignDataModel->insert($campaignData);
                }
            }
        } else {
            $insert = $this->campaignModel->insert($post_data);
            if ($insert) {
                $insert_id = $this->campaignModel->getInsertID();
                foreach ($rel_ids as $rel_id) {
                    $campaignData = [
                        'campaign_id'    => $insert_id,
                        'rel_id'         => $rel_id,
                        'rel_type'       => $rel_type,
                        'header_message' => $template->header_data_text ?? '',
                        'body_message'   => $template->body_data ?? '',
                        'footer_message' => $template->footer_data ?? '',
                        'status'         => 1,
                    ];
                    $this->campaignDataModel->insert($campaignData);
                }
            }
        }

        $campaign_id = !empty($post_data['id']) ? $post_data['id'] : $insert_id;
        wbHandleUploadFile($campaign_id, $post_data, 'campaign');
        $send_campaign = $this->campaignDataModel->send_campaign($post_data, $campaign_id);

        echo json_encode([
            'success'     => $insert || $update ? true : false,
            'message'     => $insert ? app_lang('campaign_added_successfully') : ($update ? app_lang('campaign_updated_successfully') : app_lang('something_went_wrong')),
            'recirect_to' => get_uri('whatsboost/campaigns'),
        ]);
    }

    public function delete($id)
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        if (!check_wb_permission($this->login_user, 'wb_delete_campaign')) {
            app_redirect('forbidden');
        }

        $delete = $this->campaignModel->where('id', $id)->delete();
        if ($delete) {
            $delete = $this->campaignDataModel->where('campaign_id', $id)->delete();
        }

        echo json_encode([
            'success' => $delete,
            'message' => $delete ? app_lang('record_deleted') : app_lang('error_occurred'),
        ]);
    }

    public function view($campaign_id)
    {
        if (!check_wb_permission($this->login_user, 'wb_show_campaign')) {
            app_redirect('forbidden');
        }

        $data['title']     = app_lang('view_campaign');
        $data['campaign']  = $this->campaignModel->get($campaign_id);

        $total_leads       = wb_total_rows(get_db_prefix().'clients', ['is_lead' => 1, 'deleted' => 0]);
        $total_contacts    = wb_total_rows(get_db_prefix().'clients', ['is_lead' => 0, 'deleted' => 0]);
        $campaign_data     = \count(json_decode($data['campaign']['rel_ids']));

        $relation_type_map = [
            'leads'    => $total_leads,
            'contacts' => $total_contacts,
        ];
        $data['total_percent'] = number_format(($campaign_data / $relation_type_map[$data['campaign']['rel_type']]) * 100, 2);

        $data['delivered_to_count']     = wb_total_rows(get_db_prefix().'wb_campaign_data', ['status' => 2, 'campaign_id' => $campaign_id]);
        $data['read_by_count']          = wb_total_rows(get_db_prefix().'wb_campaign_data', ['message_status' => 'read', 'campaign_id' => $campaign_id]);
        $data['delivered_to_percent']   = $data['read_by_percent']   = 0;
        if (!empty($data['delivered_to_count'])) {
            $data['delivered_to_percent'] = number_format(($data['delivered_to_count'] / $campaign_data) * 100, 2);
            $data['read_by_percent']      = number_format(($data['read_by_count'] / $data['delivered_to_count']) * 100, 2);
        }

        return $this->template->rander('WhatsBoost\Views\campaigns\view', $data);
    }

    public function dailyTaskTable($campaign_id)
    {
        if (!$this->request->isAJAX()) {
            return false;
        }

        $data   = wbGetCampaignData($campaign_id);
        $result = [];
        foreach ($data as $value) {
            $result[] = $this->_make_campaign_row($value);
        }
        $result = array_filter($result, function ($arr) {
            // Check if all elements in the array are empty strings
            return !empty(array_filter($arr, 'strlen'));
        });
        $result = array_values($result);
        echo json_encode(['data' => $result]);
    }

    public function _make_campaign_row($data)
    {
        $campaign = $this->campaignModel->get($data['campaign_id']);

        $data['header_params']       = $campaign['header_params'];
        $data['body_params']         = $campaign['body_params'];
        $data['footer_params']       = $campaign['footer_params'];
        $data['header_params_count'] = $campaign['header_params_count'];
        $data['body_params_count']   = $campaign['body_params_count'];
        $data['footer_params_count'] = $campaign['footer_params_count'];

        $where = ('leads' == $data['rel_type']) ? '1' : '0';

        $relData = $this->Clients_model->get_details(['id' => $data['rel_id'], 'is_lead' => $where])->getRowArray();
        $message = $status = '';
        if (!empty($relData)) {
            $message .= wbParseText($relData, 'header', $data);
            $message .= wbParseText($relData, 'body', $data);
            $message .= wbParseText($relData, 'footer', $data);

            $status = wbCampaignStatus($data['status']);
            $status = '<span class="badge '.$status['class'].'" data-bs-toggle="tooltip" title="'.$data['response_message'].'">'.$status['label'].'</span>';
        }

        return [
            $relData['phone'] ?? '',
            $relData['company_name'] ?? '',
            $message,
            $status,
        ];
    }

    public function pause_resume_campaign($campaign_id)
    {
        if (!$this->request->isAJAX()) {
            return false;
        }

        $res = $this->campaignModel->pause_resume_campaign($campaign_id);
        echo json_encode($res);
    }

    public function delete_campaign_file($id)
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $res = $this->campaignModel->delete_campaign_file($id);
        echo json_encode($res);
    }
}
