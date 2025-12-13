<?php

namespace WhatsBoost\Models;

use CodeIgniter\Model;

class BotsModel extends Model
{
    protected $table = 'wb_bot';

    protected $ctlModel;

    protected $allowedFields = ['name', 'rel_type', 'reply_text', 'reply_type', 'trigger', 'bot_header', 'bot_footer', 'button1', 'button1_id', 'button2', 'button2_id', 'button3', 'button3_id', 'button_name', 'button_url', 'filename', 'addedfrom', 'created_at', 'used', 'is_bot_active'];

    public function __construct()
    {
        parent::__construct();

        $this->ctlModel = new CtlModel();
    }

    public function saveMessages($data)
    {
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
            wbHandleUploadFile($id, $data, 'bot');
            $message = ($insert) ? app_lang('message_bot_create_successfully') : app_lang('message_bot_update_successfully');
        }

        return [
            'success' => $status,
            'type'    => ($status) ? 'success' : 'danger',
            'message' => $message,
        ];
    }

    public function getMessageBots($id)
    {
        if (!empty($id)) {
            return $this->where(['id' => $id])->first();
        }

        return $this->findAll();
    }

    public function deleteBot($id, $type)
    {
        $table  = ('message' == $type) ? 'wb_bot' : 'wb_campaigns';
        $where  = ['id' => $id];
        $delete = $this->ctlModel->ctlDelete($table, $where);

        return [
            'success' => $delete,
            'message' => $delete ? app_lang('record_deleted') : app_lang('error_occurred'),
        ];
    }

    public function delete_bot_file($id)
    {
        $bot = $this->getMessageBots($id);

        $update = $this->set(['filename' => null])->where('id', $id)->update();
        $path   = getcwd() . '/files/whatsboost/bot/' . $bot['filename'];

        if ($update && file_exists($path)) {
            unlink($path);
        }

        return [
            'message'             => ($update) ? app_lang('image_deleted_successfully') : app_lang('error_occurred'),
            'recirect_to'   => get_uri('whatsboost/bots/message/' . $id),
        ];
    }

    public function changeActiveStatus($data)
    {
        $table  = ('message' == $data['type']) ? 'wb_bot' : 'wb_campaigns';
        $update = $this->db->table(get_db_prefix() . $table)->set(['is_bot_active' => $data['status']])->where('id', $data['id'])->update();

        return [
            'message' => (1 == $data['status']) ? app_lang('bot_activate_successfully') : app_lang('bot_deactivate_successfully'),
        ];
    }

    public function getMessageBotsByRelType($relType, $message, $replyType = null)
    {
        if (!is_null($replyType)) {
            $this->where("reply_type", $replyType);
        }
        $messageWords = explode(' ', $message);

        $this->groupStart();
        foreach ($messageWords as $value) {
            $value = str_replace(["'", "\""], "", $value);
            $this->orWhere("FIND_IN_SET('$value', `trigger`) >", 0);
        }
        $this->groupEnd();

        $data = $this->where(['rel_type' => $relType, 'is_bot_active' => 1])->get();
        if ($data->getNumRows() == 0 && $replyType != 4) {
            return $this->getMessageBotsByRelType($relType, '', 4);
        }
    
        return $data->getResultArray();
    }

    public function cloneMessageBot($type, $id)
    {
        $bot_data = $this->getMessageBots($id);
        $bot_data['id'] = '';
        if (!empty($bot_data['filename'])) {
            $new_file_name = prepareNewFileName($bot_data['filename']);
            $bot_data['filename'] = copy(getcwd() . '/files/whatsboost/bot/' . $bot_data['filename'], getcwd() . '/files/whatsboost/bot/' . $new_file_name) ? $new_file_name : '';
        }
        $insert = $this->insert($bot_data);
        return $this->getInsertID();
    }
}
