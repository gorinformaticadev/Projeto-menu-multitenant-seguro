<?php

namespace WhatsBoost\Models;

use CodeIgniter\Model;

class CannedReplyModel extends Model
{
    protected $table = 'rise_wb_canned_reply';
    protected $allowedFields = ['title', 'description', 'is_public', 'added_from'];

    protected $ctlModel;

    public function __construct()
    {
        parent::__construct();
        $this->ctlModel = new CtlModel();
    }

    /**
     * Save or update canned reply.
     *
     * @param array $data
     * @return array
     */
    public function saveCanned($data)
    {
        $insert = $update = false;

        if (empty($data['id'])) {
            // Insert new record
            $data['added_from'] = $_SESSION['user_id'];
            $insert             = $this->insert($data);
            $id                 = $this->getInsertID();
        } else {
            // Update existing record
            $update             = $this->set($data)->where('id', $data['id'])->update();
            $id                 = $data['id'];
        }

        $status     = $insert || $update;
        $message    = app_lang('something_went_wrong');

        if ($status) {
            $message = $insert
                ? app_lang('create_canned_reply_successfully')
                : app_lang('update_canned_reply_successfully');
        }

        return [
            'success' => $status,
            'type'    => $status ? 'success' : 'danger',
            'message' => $message,
        ];
    }

    /**
     * Change the public status of a canned reply.
     *
     * @param array $data
     * @return array
     */
    public function changeStatus($data)
    {
        $this->set('is_public', $data['is_public'])->where('id', $data['id'])->update();

        return [
            'message' => $data['is_public'] == 1
                ? app_lang('canned_reply_is_public')
                : app_lang('canned_reply_is_not_public'),
        ];
    }

    /**
     * Delete a canned reply by ID.
     *
     * @param int $id
     * @return array
     */
    public function deleteCanned($id)
    {
        $where = ['id' => $id];
        $delete = $this->ctlModel->ctlDelete($this->table, $where);

        return [
            'success' => $delete,
            'message' => $delete
                ? app_lang('delete_successfully')
                : app_lang('error_occurred'),
        ];
    }
}
