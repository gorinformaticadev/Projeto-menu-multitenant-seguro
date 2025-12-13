<?php

namespace WhatsBoost\Models;

use CodeIgniter\Model;

class CustomPromptsModel extends Model
{
    protected $table = 'wb_custom_prompts';

    protected $ctlModel;

    protected $allowedFields = ['name', 'action', 'added_from'];

    public function __construct()
    {
        parent::__construct();

        $this->ctlModel = new CtlModel();
    }

    public function savePrompt($data)
    {
        $insert = $update = false;
        if (isset($data['action'])) {
            $data['action'] = strip_tags($data['action']);
        }
        if (empty($data['id'])) {
            $data['added_from'] = $_SESSION['user_id'];
            $insert = $this->insert($data);
            $id     = $this->getInsertID();
        } else {
            $update = $this->set($data)->where('id', $data['id'])->update();
            $id     = $data['id'];
        }

        $status  = ($insert || $update);
        $message = app_lang('something_went_wrong');

        if ($status) {
            $message = ($insert) ? app_lang('prompt_added_successfully') : app_lang('prompt_update_successfully');
        }

        return [
            'success' => $status,
            'type'    => ($status) ? 'success' : 'danger',
            'message' => $message,
        ];
    }

    public function deletePrompt($id)
    {
        $where  = ['id' => $id];
        $delete = $this->ctlModel->ctlDelete($this->table, $where);

        return [
            'success' => $delete,
            'message' => $delete ? app_lang('record_deleted') : app_lang('error_occurred'),
        ];
    }
}
