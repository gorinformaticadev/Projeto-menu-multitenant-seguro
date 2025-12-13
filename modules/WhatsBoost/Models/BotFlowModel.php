<?php

namespace WhatsBoost\Models;

use CodeIgniter\Model;

class BotFlowModel extends Model
{
    protected $table = 'wb_bot_flow';

    protected $ctlModel;

    protected $allowedFields = ['flow_name', 'is_active', 'flow_data'];

    public function __construct()
    {
        parent::__construct();

        $this->ctlModel = new CtlModel();
    }

    public function saveFlow($data)
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
            $message = ($insert) ? app_lang('flow_added_successfully') : app_lang('flow_update_successfully');
        }

        return [
            'success' => $status,
            'type'    => ($status) ? 'success' : 'danger',
            'message' => $message,
        ];
    }

    public function deleteFlow($id)
    {
        $where  = ['id' => $id];
        $delete = $this->ctlModel->ctlDelete($this->table, $where);

        return [
            'success' => $delete,
            'message' => $delete ? app_lang('record_deleted') : app_lang('error_occurred'),
        ];
    }

    public function changeActiveStatus($data)
    {
        $update = $this->set(['is_active' => $data['is_active']])->where('id', $data['id'])->update();

        return [
            'message' => (1 == $data['is_active']) ? app_lang('bot_activate_successfully') : app_lang('bot_deactivate_successfully'),
        ];
    }

    public function getFlows($relType, $message, $is_first_time)
    {
        $data = $this->where(['is_active' => 1])->get();
        $flows = $data->getResultArray();
        $msg_arr = [];

        foreach ($flows as &$flow) {
            $map = json_decode($flow['flow_data'], true);

            $nodes = collect($map['nodes'])->mapWithKeys(function ($node) {
                return [$node["id"] => ["data" => $node["data"]['output'][0], "type" => $node['type']]];
            })->toArray();

            $connections = collect($map['edges'])->mapToGroups(function ($edge) {
                return [$edge["source"] => ["target" => $edge["target"], "handle" => $edge["sourceHandle"]]];
            })->toArray();

            $msg_mapping = collect($map['nodes'])->filter(function ($box) use ($relType, $message) {
                return $box['type'] == "start" && $box['data']['output'][0]['rel_type'] == $relType;
            })->toArray();

            $this->prepare_msg_array($msg_mapping, $nodes, $connections, $flow, $msg_arr);
        }
        return $msg_arr;
    }
    
    function prepare_msg_array($msg_mapping, $nodes, $connections, $flow, &$msg_arr)
    {
        foreach ($msg_mapping as $start) {
            $start_data = $nodes[$start['id']]['data'];
            $start_data['id'] = $flow['id'];
            $start_data['sending_count'] = $flow['sending_count'] ?? 0;
            $start_data['bot_header'] = "";
            $start_data['bot_footer'] = "";
            $start_data['reply_text'] = "";
            $start_data['button1'] = "";
            $start_data['button2'] = "";
            $start_data['button3'] = "";
            $start_data['filename'] = "";
            if (!empty($connections[$start['id']])) {
                foreach ($connections[$start['id']] as $output_details) {
                    $output_id = $output_details['target'];
                    $output_data = $nodes[$output_id]['data'];
                    if (!empty($output_details['handle'])) {
                        $btn_id = str_replace("source-", "", $output_details['handle']);
                        $output_data['trigger'] = "flow_" . $flow['id'] . "_output_" . $start['parent_id'] . "_node_" . $start['id'] . "_btn" . $btn_id;
                        if ($btn_id == "4") {
                            $output_data['trigger'] = $nodes[$start['parent_id']]['data']['trigger'];
                            $output_data['reply_type'] = $nodes[$start['parent_id']]['data']['reply_type'];
                            $output_data['rel_type'] = $nodes[$start['parent_id']]['data']['rel_type'];
                        }
                    }
                    if ($nodes[$output_id]['type'] == "imageMessage") {
                        $output_data['filename'] = $flow['id'] . "/" . rawurlencode($output_data['imageUrl']);
                    }
                    if ($nodes[$output_id]['type'] == "videoMessage") {
                        $output_data['filename'] = $flow['id'] . "/" . rawurlencode($output_data['videoUrl']);
                    }
                    if ($nodes[$output_id]['type'] == "document") {
                        $output_data['filename'] = $flow['id'] . "/" . rawurlencode($output_data['documentName']);
                    }
                    if ($nodes[$output_id]['type'] == "audioMessage") {
                        $output_data['filename'] = $flow['id'] . "/" . rawurlencode($output_data['audioUrl']);
                    }
                    if ($nodes[$output_id]['type'] == "buttonsMessage") {
                        if (!empty($output_data['button1'])) {
                            $output_data['button1_id'] = "flow_" . $flow['id'] . "_output_" . $start['id'] . "_node_" . $output_id . "_btn1";
                        }
                        if (!empty($output_data['button2'])) {
                            $output_data['button2_id'] = "flow_" . $flow['id'] . "_output_" . $start['id'] . "_node_" . $output_id . "_btn2";
                        }
                        if (!empty($output_data['button3'])) {
                            $output_data['button3_id'] = "flow_" . $flow['id'] . "_output_" . $start['id'] . "_node_" . $output_id . "_btn3";
                        }
                    }
                    $msg_arr[] = array_merge($start_data, $output_data);
                    $new_msg_mapping = [];
                    if (!empty($connections[$output_id])) {
                        $new_msg_mapping[] = ["id" => $output_id, "parent_id" => $start['id']];
                        $nodes[$output_id]['data'] = $start_data;
                        $nodes[$output_id]['data']['reply_type'] = 1;
                        $this->prepare_msg_array($new_msg_mapping, $nodes, $connections, $flow, $msg_arr);
                    }
                }
            }
        }
    }
}
