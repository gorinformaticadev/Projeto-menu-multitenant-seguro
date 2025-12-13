<?php

namespace WhatsBoost\Controllers;

use App\Controllers\Security_Controller;
use WhatsBoost\Models\CustomPromptsModel;

class CustomPromptsController extends Security_Controller
{
    public $custompromptsModel;

    public function __construct()
    {
        parent::__construct();

        helper('whatsboost');

        $this->custompromptsModel = new CustomPromptsModel();
    }

    public function index()
    {
        if (!check_wb_permission($this->login_user, 'wb_view_own_ai_prompts') && !check_wb_permission($this->login_user, 'wb_view_ai_prompts')) {
            app_redirect('forbidden');
        }

        $viewData['user'] = $this->login_user;

        return $this->template->rander('WhatsBoost\\Views\\custom_prompts\\manage', $viewData);
    }

    public function promptTable()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $data = [];
        if (check_wb_permission($this->login_user, 'wb_view_own_ai_prompts')) {
            $data = $this->custompromptsModel->where('added_from', $_SESSION['user_id'])->findAll();
        }

        if (check_wb_permission($this->login_user, 'wb_view_ai_prompts')) {
            $data = $this->custompromptsModel->findAll();
        }

        $result = [];
        foreach ($data as $value) {
            $result[] = $this->_makeTemplateRow($value);
        }

        echo json_encode(['data' => $result]);
    }

    public function _makeTemplateRow($data)
    {
        $id            = $data['id'];
        $prompt_name   = $data['name'];
        $prompts_action = $data['action'];

        $actions = '';

        if (check_wb_permission($this->login_user, 'wb_edit_ai_prompts')) {
            $actions .= modal_anchor(get_uri("whatsboost/custom_prompt"), "<i data-feather='edit' class='icon-16'></i>", array("class" => "edit", "title" => app_lang('edit'), "data-post-id" => $data['id']));
        }

        if (check_wb_permission($this->login_user, 'wb_delete_ai_prompts')) {
            $actions .= js_anchor("<i data-feather='x' class='icon-16'></i>", ['title' => app_lang('delete'), 'class' => 'delete', 'data-id' => $data['id'], 'data-action-url' => get_uri('whatsboost/delete_prompt'), 'data-action' => 'delete-confirmation']);
        }

        return [
            $id,
            $prompt_name,
            $prompts_action,
            $actions,
        ];
    }

    public function promptModal()
    {
        $viewData = [];

        $prompt_id = $this->request->getPost('id');

        if (!empty($prompt_id)) {
            $viewData['model_info'] = $this->custompromptsModel->find($prompt_id);
        }

        return $this->template->view('WhatsBoost\\Views\\custom_prompts\\custom_prompt', $viewData);
    }

    public function save()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $this->validate_submitted_data([
            'name'        => 'required',
            'action'    => 'required',
        ]);

        $post_data = $this->request->getPost();
        $permission_type = (!empty($post_data['id'])) ? 'wb_edit_ai_prompts' : 'wb_create_ai_prompts';
        if (!check_wb_permission($this->login_user, $permission_type)) {
            app_redirect('forbidden');
        }

        $res       = $this->custompromptsModel->savePrompt($post_data);
        echo json_encode($res);
    }

    public function getPrompts()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        if (check_wb_permission($this->login_user, 'wb_view_own_ai_prompts')) {
            $data = $this->custompromptsModel->where('added_from', $_SESSION['user_id'])->findAll();
        }
        
        if (check_wb_permission($this->login_user, 'wb_view_ai_prompts')) {
            $data = $this->custompromptsModel->findAll();
        }

        echo json_encode(['custom_prompts' => $data ?? []]);
    }

    public function delete()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        if (!check_wb_permission($this->login_user, 'wb_delete_ai_prompts')) {
            app_redirect('forbidden');
        }

        $id  = $this->request->getPost('id');
        $res = $this->custompromptsModel->deletePrompt($id);

        echo json_encode($res);
    }
}
