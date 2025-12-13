<?php

namespace WhatsBoost\Controllers;

use App\Controllers\Security_Controller;

class BotsController extends Security_Controller
{
    protected $botsModel;
    protected $campaignModel;

    public function __construct()
    {
        parent::__construct();

        helper('whatsboost');

        $this->botsModel     = model('WhatsBoost\Models\BotsModel');
        $this->campaignModel = model('WhatsBoost\Models\CampaignModel');
    }

    public function manageTemplateBot($value = '')
    {
        if (!check_wb_permission($this->login_user, 'wb_view_tb')) {
            app_redirect('forbidden');
        }

        $viewData['title'] = app_lang('template_bot');
        $viewData['type']  = 'template';
        $viewData['user']  = $this->login_user;

        return $this->template->rander('WhatsBoost\Views\bots\manage', $viewData);
    }

    public function manageMessageBot($value = '')
    {
        if (!check_wb_permission($this->login_user, 'wb_view_mb')) {
            app_redirect('forbidden');
        }
        $viewData['title'] = app_lang('message_bot');
        $viewData['type']  = 'message';
        $viewData['user']  = $this->login_user;

        return $this->template->rander('WhatsBoost\Views\bots\manage', $viewData);
    }

    public function table($type)
    {
        if (!$this->request->isAJAX()) {
            return;
        }
        $data = $this->botsModel->findAll();
        if ('template' == $type) {
            $data = $this->campaignModel->where('is_bot', '1')->findAll();
        }
        $result = [];
        foreach ($data as $value) {
            $result[] = $this->_make_row($value, $type);
        }
        echo json_encode(['data' => $result]);
    }

    public function _make_row($data, $type)
    {
        $active_status = ('1' == $data['is_bot_active']) ? 'checked' : '';
        $active        = '<div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="active_deactive_bot" name="status" data-id="'.$data['id'].'" '.$active_status.'>
                        <label class="form-check-label" for="has_action"></label>
                    </div>';

        $rel_color = ('contacts' == $data['rel_type']) ? 'bg-danger' : 'bg-primary';
        $rel_type  = '<span class="badge '.$rel_color.'">'.app_lang($data['rel_type']).'</span> &nbsp;';

        $template = ('template' == $type) ? '<span>'.wbGetWhatsappTemplate($data['template_id'])->template_name.'</span> &nbsp;' : wbGetReplyType($data['reply_type']);

        $actions = '';

        $edit_type = ('message' == $type) ? 'wb_edit_mb' : 'wb_edit_tb';
        if (check_wb_permission($this->login_user, $edit_type)) {
            $actions .= "<a href='".get_uri('whatsboost/bots/'.$type.'/'.$data['id'])."' class='edit' title='" . app_lang('edit') . "'><i data-feather='edit' class='icon-16'></i></a>";
        }

        $delete_type = ('message' == $type) ? 'wb_delete_mb' : 'wb_delete_tb';
        if (check_wb_permission($this->login_user, $delete_type)) {
            $actions .= js_anchor("<i data-feather='x' class='icon-16'></i>", ['title' => app_lang('delete'), 'class' => 'delete', 'data-id' => $data['id'], 'data-action-url' => get_uri('whatsboost/bots/delete/'.$type), 'data-action' => 'delete-confirmation']);
        }

        $permission_type = ('message' == $type) ? 'wb_clone_mb' : 'wb_clone_tb';
        if (check_wb_permission($this->login_user, $permission_type)) {
            $actions .= "<a href='javascript:void(0)' class='clone bot_clone_btn' title='" . app_lang('clone') . "' data-bot_type='" . $type . "' data-id='" . $data['id'] . "'><img src='". base_url(PLUGIN_URL_PATH.'WhatsBoost/assets/images/copy_bot.png') ."'></a>";
        }

        $result = [
            $data['id'],
            $data['name'],
            $template,
            $data['trigger'],
            $rel_type,
            $active,
            $actions,
        ];

        return $result;
    }

    public function template($id = '')
    {
        $permission_type = (!empty($id)) ? 'wb_edit_tb' : 'wb_create_tb';
        if (!check_wb_permission($this->login_user, $permission_type) && ($this->session->has('is_bot_clone') == false)) {
            app_redirect('forbidden');
        }

        $viewData['title'] = app_lang('template_bot');

        if (!empty($id)) {
            $viewData['bot'] = $this->campaignModel->getTemplateBots($id);
        }

        return $this->template->rander('WhatsBoost\Views\bots\template_bot', $viewData);
    }

    public function message($id = '')
    {
        $permission_type = (!empty($id)) ? 'wb_edit_mb' : 'wb_create_mb';
        if (!check_wb_permission($this->login_user, $permission_type) && ($this->session->has('is_bot_clone') == false)) {
            app_redirect('forbidden');
        }

        $viewData['title'] = app_lang('message_bot');

        if (!empty($id)) {
            $viewData['bot'] = $this->botsModel->getMessageBots($id);
        }
        $viewData['user'] = $this->login_user;

        return $this->template->rander('WhatsBoost\Views\bots\message_bot', $viewData);
    }

    public function saveTemplates()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $this->validate_submitted_data([
            'name'        => 'required',
            'rel_type'    => 'required',
            'template_id' => 'required',
        ]);

        $permission_type = (!empty($post_data['id'])) ? 'wb_edit_tb' : 'wb_create_tb';
        if (!check_wb_permission($this->login_user, $permission_type) && ($this->session->has('is_bot_clone') == false)) {
            app_redirect('forbidden');
        }

        $post_data = $this->request->getPost();
        $res       = $this->campaignModel->saveTemplates($post_data);
        $this->session->set('is_bot_clone', false);
        echo json_encode($res);
    }

    public function saveMessages()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $this->validate_submitted_data([
            'name'       => 'required',
            'rel_type'   => 'required',
            'reply_type' => 'required',
        ]);

        $post_data       = $this->request->getPost();
        $permission_type = (!empty($post_data['id'])) ? 'wb_edit_mb' : 'wb_create_mb';
        if (!check_wb_permission($this->login_user, $permission_type) && ($this->session->has('is_bot_clone') == false)) {
            app_redirect('forbidden');
        }
        $res = $this->botsModel->saveMessages($post_data);
        $this->session->set('is_bot_clone', false);
        echo json_encode($res);
    }

    public function deleteBot($type)
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $permission_type = ('message' == $type) ? 'wb_delete_mb' : 'wb_delete_tb';
        if (!check_wb_permission($this->login_user, $permission_type)) {
            app_redirect('forbidden');
        }

        $id  = $this->request->getPost('id');
        $res = $this->botsModel->deleteBot($id, $type);

        echo json_encode($res);
    }

    public function changeActiveStatus()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $postData = $this->request->getPost();
        $res      = $this->botsModel->changeActiveStatus($postData);
        echo json_encode($res);
    }

    public function delete_bot_file($id)
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $res = $this->botsModel->delete_bot_file($id);
        echo json_encode($res);
    }

    public function cloneBot()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $postData = $this->request->getPost();

        $permission_type = ('message' == $postData['type']) ? 'wb_clone_mb' : 'wb_clone_tb';
        if (!check_wb_permission($this->login_user, $permission_type)) {
            app_redirect('forbidden');
        }

        $id = ($postData['type'] == 'message') ? $this->botsModel->cloneMessageBot($postData['type'], $postData['id']) : $this->campaignModel->cloneTemplateBot($postData['type'], $postData['id']);
        $this->session->set('is_bot_clone', !empty($id) ? true : false);
        $res = [
            'type' => $id ? 'success' : 'danger',
            'message' => $id ? app_lang('bot_clone_successfully') : app_lang('something_went_wrong'),
            'redirect_url' => ($id) ? site_url('whatsboost/bots/' . $postData['type'] . '/' . $id) : site_url('whatsboost/bots/' . $postData['type'] . '_bot'),
        ];

        echo json_encode($res);
    }
}
