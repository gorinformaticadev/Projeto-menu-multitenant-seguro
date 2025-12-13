<?php

namespace WhatsBoost\Controllers;

use App\Controllers\Security_Controller;

class BotFlowController extends Security_Controller
{
    protected $botsModel;
    protected $botFlowModel;

    public function __construct()
    {
        parent::__construct();

        helper('whatsboost');

        $this->botsModel     = model('WhatsBoost\Models\BotsModel');
        $this->botFlowModel     = model('WhatsBoost\Models\BotFlowModel');
    }

    public function botFlow()
    {
        if (!check_wb_permission($this->login_user, 'wb_view_bot_flow')) {
            app_redirect('forbidden');
        }

        $viewData['user']  = $this->login_user;

        return $this->template->rander('WhatsBoost\Views\flow\manage', $viewData);
    }

    public function flow($id)
    {
        if (!check_wb_permission($this->login_user, 'wb_view_bot_flow')) {
            app_redirect('forbidden');
        }
        $viewData['title'] = app_lang('flow');

        $viewData['flow'] = $this->botFlowModel->find($id);

        return $this->template->rander("WhatsBoost\Views\\flow\manage_flow", $viewData);
    }

    public function promptTable()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $data = [];

        if (check_wb_permission($this->login_user, 'wb_view_bot_flow')) {
            $data = $this->botFlowModel->findAll();
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
        $prompt_name   = $data['flow_name'];
        $active_status = ('1' == $data['is_active']) ? 'checked' : '';
        $active        = '<div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="active_deactive_flow" name="is_active" data-id="' . $data['id'] . '" ' . $active_status . '>
                        <label class="form-check-label" for="has_action"></label>
                    </div>';

        $actions = '';

        if (check_wb_permission($this->login_user, 'wb_edit_bot_flow')) {
            $actions .= "<a href='" . get_uri('whatsboost/flow/' . $data['id']) . "' class='edit' title='" . app_lang('flow') . "'><i data-feather='trending-up' class='icon-16'></i></a>";
        }

        if (check_wb_permission($this->login_user, 'wb_edit_bot_flow')) {
            $actions .= modal_anchor(get_uri("whatsboost/custom_prompt"), "<i data-feather='edit' class='icon-16'></i>", array("class" => "edit", "title" => app_lang('edit'), "data-post-id" => $data['id']));
        }

        if (check_wb_permission($this->login_user, 'wb_delete_bot_flow')) {
            $actions .= js_anchor("<i data-feather='x' class='icon-16'></i>", ['title' => app_lang('delete'), 'class' => 'delete', 'data-id' => $data['id'], 'data-action-url' => get_uri('whatsboost/delete_flow'), 'data-action' => 'delete-confirmation']);
        }

        return [
            $id,
            $prompt_name,
            $active,
            $actions,
        ];
    }

    public function promptModal()
    {
        $viewData = [];

        $prompt_id = $this->request->getPost('id');

        if (!empty($prompt_id)) {
            $viewData['model_info'] = $this->botFlowModel->find($prompt_id);
        }

        return $this->template->view('WhatsBoost\\Views\\flow\\flow_modal', $viewData);
    }

    public function save()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $this->validate_submitted_data([
            'flow_name'        => 'required',
        ]);

        $post_data = $this->request->getPost();
        $permission_type = (!empty($post_data['id'])) ? 'wb_edit_bot_flow' : 'wb_create_bot_flow';
        if (!check_wb_permission($this->login_user, $permission_type)) {
            app_redirect('forbidden');
        }

        $res       = $this->botFlowModel->saveFlow($post_data);
        echo json_encode($res);
    }

    public function save_flow()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $this->validate_submitted_data([
            'flow_data'        => 'required',
        ]);

        $post_data = $this->request->getPost();
        $permission_type = (!empty($post_data['id'])) ? 'wb_edit_ai_prompts' : 'wb_create_ai_prompts';
        if (!check_wb_permission($this->login_user, $permission_type)) {
            app_redirect('forbidden');
        }

        $res       = $this->botFlowModel->saveFlow($post_data);
        echo json_encode($res);
    }

    public function changeActiveStatus()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $postData = $this->request->getPost();
        $res      = $this->botFlowModel->changeActiveStatus($postData);
        echo json_encode($res);
    }

    public function delete()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        if (!check_wb_permission($this->login_user, 'wb_delete_bot_flow')) {
            app_redirect('forbidden');
        }

        $id  = $this->request->getPost('id');
        $res = $this->botFlowModel->deleteFlow($id);

        echo json_encode($res);
    }

    public function storeFile()
    {
        $id = $this->request->getPost('id') ?? 0;
        $node_id = $this->request->getPost('node_id') ?? 0;

        $target_path = getcwd() . '/files/whatsboost/flow/' . $id;
        if (!is_dir($target_path)) {
            if (!mkdir($target_path, 0755, true)) {
                exit('Failed to create file folders.');
            }
        }

        if (!empty($node_id)) {
            // check if old file exist then remove it
            $dir = $target_path;
            if (is_dir($dir)) {
                $files = scandir($dir);
                $matchingFiles = array_filter($files, function ($file) use ($node_id) {
                    return strpos($file, $node_id . '_') === 0;
                });
                array_walk($matchingFiles, function ($file) use ($dir) {
                    $filePath = $dir . DIRECTORY_SEPARATOR . $file;
                    if (is_file($filePath)) {
                        unlink($filePath);
                    }
                });
            }
        }

        $status = false;
        $file_url = base_url('assets/images/avatar.jpg');
        $filename = '';
        $message = '';
        $extensions = wbGetAllowedExtension();
        if (isset($_FILES) && !empty($_FILES)) {
            $type = array_key_first($_FILES);
            $path = $target_path;

            $tmpFilePath = $_FILES[$type]['tmp_name'];
            if (!empty($tmpFilePath) && $tmpFilePath != '') {
                $newFileName = str_replace(" ", "_", $_FILES[$type]['name']);
                $filename = $node_id . '_' . $newFileName;
                if (in_array('.' . wb_get_file_extension($filename), array_map('trim', explode(',', $extensions[$type]['extension'])))) {
                    $newFilePath = $path . '/' . $filename;
                    if (move_uploaded_file($tmpFilePath, $newFilePath)) {
                        $status = true;
                        $file_url = base_url('files/whatsboost/flow/' . $id . '/');
                    }
                } else {
                    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                    $message = app_lang('you_can_not_upload_file_type', app_lang($extension));
                    $filename = '';
                }
            }
        }
        echo json_encode(['status' => $status, 'file_path' => $file_url, 'filename' => $filename, 'message' => $message]);
    }
}
