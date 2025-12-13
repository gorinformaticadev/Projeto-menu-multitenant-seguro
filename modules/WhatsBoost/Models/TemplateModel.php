<?php

namespace WhatsBoost\Models;

use App\Models\Crud_model;

class TemplateModel extends Crud_model
{
    protected $table = 'wb_templates';

    public function __construct()
    {
        parent::__construct($this->table);
    }
}
