<?php

namespace WhatsBoost\Models;

use App\Models\Crud_model;

class CtlModel extends Crud_model
{
    protected $campaignModel;
    protected $db;

    public function __construct()
    {
        parent::__construct();

        $this->db = db_connect();
    }

    public function ctlDelete($table, $where)
    {
        if (!empty($where)) {
            return $this->db->table($table)->where($where)->delete();
        }

        return $this->db->table($table)->delete();
    }
}
