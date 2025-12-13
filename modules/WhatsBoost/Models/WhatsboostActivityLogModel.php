<?php

namespace WhatsBoost\Models;

use App\Models\Crud_model; //access main app's models

class WhatsboostActivityLogModel extends Crud_model
{
    protected $table = null;

    protected $ctlModel;

    public function __construct()
    {
        $this->table = 'wb_activity_log';
        parent::__construct($this->table);
        $this->ctlModel = new CtlModel();
    }

    public function show_all()
    {
        return $this->get_all(true)->getResult();
    }

    public function clear_log()
    {
        $builder = $this->db->table($this->table);
        if ($builder->truncate()) {
            return true;
        }

        return false;
    }

    public function delete_log($id)
    {
        return $this->ctlModel->ctlDelete($this->table, ['id' => $id]);
    }

    public function update_log($data, $msg_id)
    {
        $log_data    = $this->get_all(true)->getResult();
        $foundRecord = array_reduce(
            array_filter(
                array_map(
                    function ($object) use ($msg_id) {
                        $responseData = json_decode($object->response_data);
                        if ($responseData && isset($responseData->messages) && \is_array($responseData->messages)) {
                            $matches = array_filter($responseData->messages, function ($message) use ($msg_id) {
                                return isset($message->id) && $message->id === $msg_id;
                            });
                            if (!empty($matches)) {
                                return $object;
                            }
                        }

                        return null;
                    },
                    $log_data
                )
            ),
            function ($carry, $item) {
                return $item; // Return the first matching item
            }
        );

        $log_id = $foundRecord->id ?? 0;
        if (!empty($log_id)) {
            return $this->db->table('wb_activity_log')->set(['response_data' => json_encode($data), 'response_code' => 400])->where('id', $log_id)->update();
        }
    }
}
