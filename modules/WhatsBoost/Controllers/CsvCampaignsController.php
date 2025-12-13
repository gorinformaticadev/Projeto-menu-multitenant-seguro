<?php

namespace WhatsBoost\Controllers;

use App\Controllers\Security_Controller;
use CodeIgniter\HTTP\Request;

class CsvCampaignsController extends Security_Controller
{
    protected $campaignModel;
    protected $campaignDataModel;

    public function __construct()
    {
        parent::__construct();

        helper('whatsboost');
        wbRemoveDeletedData();

        $this->campaignModel     = model('WhatsBoost\Models\CampaignModel');
        $this->campaignDataModel = model('WhatsBoost\Models\CampaignDataModel');
    }

    public function index()
    {
        if (!check_wb_permission($this->login_user, 'wb_send_csv_campaign')) {
            app_redirect('forbidden');
        }

        $viewData['title'] = app_lang('campaigns');
        $viewData['user']  = $this->login_user;

        return $this->template->rander('WhatsBoost\Views\campaigns\bulk_campaign', $viewData);
    }

    public function downloadSample()
    {
        $path = FCPATH . 'plugins/WhatsBoost/assets/campaignfile/campaigns_sample.csv';

        if (file_exists($path)) {
            return $this->response->download($path, null);
        } else {
            return redirect()->back()->with('error', 'The file does not exist.');
        }
    }

    public function uploadFile()
    {
        $target_path = getcwd() . '/files/whatsboost/csv/';
        if (!is_dir($target_path)) {
            if (!mkdir($target_path, 0755, true)) {
                exit('Failed to create file folders.');
            }
        }

        if (isset($_FILES) && !empty($_FILES)) {
            $type = array_key_first($_FILES);
            $path = $target_path;

            $tmpFilePath = $_FILES[$type]['tmp_name'];
            if (!empty($tmpFilePath) && $tmpFilePath != '') {
                $newFileName = str_replace(" ", "_", $_FILES[$type]['name']);
                $filename = $newFileName;

                $newFilePath = $path . '/' . $filename;
                if (move_uploaded_file($tmpFilePath, $newFilePath)) {
                    $json_file_name = str_replace(wb_get_file_extension($newFileName), 'json', $newFileName);
                    $res = wbCsvToJson($newFilePath, $path . $json_file_name);
                    @unlink($newFilePath);

                    $response = $this->campaignModel->prepare_merge_field($res);
                    echo json_encode($response);
                }
            }
        }
    }

    public function sendCampaign()
    {
        if (!$this->request->isAJAX() && !check_wb_permission($this->login_user, 'wb_send_csv_campaign')) {
            return;
        }

        $post_data = $this->request->getPost();
        $res = $this->campaignModel->send_bulk_campaign($post_data);
        echo json_encode($res);
    }
}
