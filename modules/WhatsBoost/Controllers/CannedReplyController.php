<?php

namespace WhatsBoost\Controllers;

use App\Controllers\Security_Controller;
use WhatsBoost\Models\CannedReplyModel;

class CannedReplyController extends Security_Controller
{
    public $cannedReply;

    public function __construct()
    {
        parent::__construct();

        helper('whatsboost');

        $this->cannedReply = new CannedReplyModel();
    }

    /**
     * Load the manage canned reply view.
     */
    public function index()
    {
        if (!check_wb_permission($this->login_user, 'wb_view_own_canned_reply') && !check_wb_permission($this->login_user, 'wb_view_canned_reply')) {
            app_redirect('forbidden');
        }

        $data['user'] = $this->login_user;

        return $this->template->rander('WhatsBoost\\Views\\canned_reply\\manage', $data);
    }

    /**
     * Load modal for adding or editing canned reply.
     */
    public function promptModal()
    {
        $data       = [];
        $canned_id  = $this->request->getPost('id');

        if (!empty($canned_id)) {
            $data['model_info'] = $this->cannedReply->find($canned_id);
        }

        return $this->template->view('WhatsBoost\\Views\\canned_reply\\canned_reply', $data);
    }

    /**
     * Save canned reply.
     */
    public function save()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $this->validate_submitted_data([
            'title'       => 'required',
            'description' => 'required',
        ]);

        $post_data = $this->request->getPost();
        $post_data['title'] = htmlspecialchars($post_data['title']);
        $post_data['description'] = htmlspecialchars($post_data['description']);
        $permission_type = !empty($post_data['id']) ? 'wb_edit_canned_reply' : 'wb_create_canned_reply';

        if (!check_wb_permission($this->login_user, $permission_type)) {
            app_redirect('forbidden');
        }

        $res = $this->cannedReply->saveCanned($post_data);

        echo json_encode($res);
    }

    /**
     * Get canned replies data for table.
     */
    public function promptTable()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $data = [];

        if (check_wb_permission($this->login_user, 'wb_view_own_canned_reply')) {
            $data = $this->cannedReply->where('added_from', $_SESSION['user_id'])->findAll();
        }

        if (check_wb_permission($this->login_user, 'wb_view_canned_reply')) {
            $data = $this->cannedReply->findAll();
        }

        $result = [];

        foreach ($data as $value) {
            $result[] = $this->_makeTemplateRow($value);
        }

        echo json_encode(['data' => $result]);
    }

    /**
     * Format a single canned reply row for table.
     */
    private function _makeTemplateRow($data)
    {
        $id                 = $data['id'];
        $canned_title       = htmlspecialchars($data['title']);
        $canned_description = htmlspecialchars($data['description']);
        $active_status      = $data['is_public'] == '1' ? 'checked' : '';
        $active             = '<div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="canned_status" name="is_public" data-id="' . $data['id'] . '" ' . $active_status . '>
                                    <label class="form-check-label" for="canned_status"></label>
                                </div>';

        $actions = "";

        if (check_wb_permission($this->login_user, 'wb_edit_canned_reply')) {
            $actions .= modal_anchor(
                get_uri("whatsboost/canned_reply"),
                "<i data-feather='edit' class='icon-16'></i>",
                ["class" => "edit", "title" => app_lang('edit'), "data-post-id" => $data['id']]
            );
        }

        if (check_wb_permission($this->login_user, 'wb_delete_canned_reply')) {
            $actions .= js_anchor("<i data-feather='x' class='icon-16'></i>", [
                'title'           => app_lang('delete'),
                'class'           => 'delete',
                'data-id'         => $data['id'],
                'data-action-url' => get_uri('whatsboost/delete_canned_reply'),
                'data-action'     => 'delete-confirmation'
            ]);
        }

        return [
            $id,
            $canned_title,
            $canned_description,
            $active,
            $actions,
        ];
    }

    /**
     * Change the status of a canned reply.
     */
    public function changeStatus()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $postData = $this->request->getPost();
        $res = $this->cannedReply->changeStatus($postData);

        echo json_encode($res);
    }

    /**
     * Delete a canned reply.
     */
    public function delete()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        if (!check_wb_permission($this->login_user, 'wb_delete_canned_reply')) {
            app_redirect('forbidden');
        }

        $id = $this->request->getPost('id');
        $res = $this->cannedReply->deleteCanned($id);

        echo json_encode($res);
    }


    public function getCanned()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $data = [];

        if (check_wb_permission($this->login_user, 'wb_view_own_canned_reply')) {
            $data = $this->cannedReply->where('added_from', $_SESSION['user_id'])->findAll();
        }

        if (check_wb_permission($this->login_user, 'wb_view_canned_reply')) {
            $data = $this->cannedReply->findAll();
        }

        echo json_encode($data);
    }
}
