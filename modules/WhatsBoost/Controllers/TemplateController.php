<?php

namespace WhatsBoost\Controllers;

use App\Controllers\Security_Controller;
use WhatsBoost\Models\TemplateModel;
use WhatsBoost\Models\WhatsboostModel;

class TemplateController extends Security_Controller
{
    public $templateModel;
    public $whatsboostModel;

    public function __construct()
    {
        parent::__construct();

        helper('whatsboost');

        $this->templateModel   = new TemplateModel();
        $this->whatsboostModel = new WhatsboostModel();
    }

    public function index()
    {
        if (!check_wb_permission($this->login_user, 'wb_view_template')) {
            app_redirect('forbidden');
        }

        $viewData['user'] = $this->login_user;

        return $this->template->rander('WhatsBoost\\Views\\templates', $viewData);
    }

    public function loadTemplates()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        if (!check_wb_permission($this->login_user, 'wb_load_template')) {
            app_redirect('forbidden');
        }

        $res = $this->whatsboostModel->loadTemplates();

        echo json_encode($res);
    }

    public function getTableData()
    {
        if (!$this->request->isAJAX()) {
            return;
        }

        $data   = wbGetWhatsappTemplate();
        $result = [];
        foreach ($data as $value) {
            $result[] = $this->_makeTemplateRow($value);
        }

        echo json_encode(['data' => $result]);
    }

    public function _makeTemplateRow($data)
    {
        $id            = $data->id;
        $template_name = $data->template_name;
        $language      = $data->language;
        $category      = $data->category;
        $template_type = $data->header_data_format;
        $status        = $data->status;
        $body_data     = $data->body_data;

        $color = '';
        if ('APPROVED' == $status) {
            $color = '#0abb87';
        } else {
            $color = '#ff5a5a';
        }

        $status = js_anchor($status, ['style' => "background-color: $color", 'class' => 'badge']);

        return [
            $id,
            $template_name,
            $language,
            $category,
            !empty($template_type) ? $template_type : '-',
            $status,
            $body_data,
        ];
    }
}
